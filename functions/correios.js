// Cliente de rastreamento dos Correios.
//
// Dois provedores, escolhidos por variável de ambiente (ver .env.example):
//   - "cws": API oficial dos Correios (api.correios.com.br). Exige contrato
//     comercial com os Correios: usuário do Meu Correios, código de acesso e
//     cartão de postagem.
//   - "linketrack": Link & Track (linketrack.com), serviço gratuito que consulta
//     o site dos Correios. Basta criar uma conta para receber usuário e token.
//
// Qualquer que seja o provedor, `rastrear()` devolve o último evento num
// formato único, para o resto do código não depender de quem respondeu.

const CWS_BASE = 'https://api.correios.com.br';
const LINKETRACK_BASE = 'https://api.linketrack.com/track/json';

const TRACKING_CODE_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

// Situações que o app entende. A ordem importa: é a sequência natural de um envio.
const SITUACOES = ['postado', 'transito', 'saiu_entrega', 'aguardando_retirada', 'entregue'];

// Situação → status da troca no app (null = não muda o status). Os Correios levam
// a troca no máximo até "Chegada na agência"; quem finaliza é o solicitante, no app.
const STATUS_POR_SITUACAO = {
  postado: 'Postada',
  transito: 'Em rota',
  saiu_entrega: 'Em rota',
  aguardando_retirada: 'Chegada na agência',
  entregue: 'Chegada na agência',
};

function normalizarCodigo(codigo) {
  return String(codigo || '').replace(/\s/g, '').toUpperCase();
}

function isValidTrackingCode(codigo) {
  return TRACKING_CODE_RE.test(normalizarCodigo(codigo));
}

// Classifica um evento pela descrição — funciona para os dois provedores, já que
// os textos vêm dos próprios Correios.
function situacaoPorDescricao(descricao = '') {
  const d = descricao.toLowerCase();
  if (/objeto entregue|entregue ao destinat/.test(d)) return 'entregue';
  if (/aguardando retirada|dispon[ií]vel para retirada|retirada no endere/.test(d)) return 'aguardando_retirada';
  if (/saiu para entrega/.test(d)) return 'saiu_entrega';
  if (/objeto postado|postado ap[oó]s|postagem/.test(d)) return 'postado';
  if (/em tr[âa]nsito|encaminhado|transfer|recebido pela unidade|chegou/.test(d)) return 'transito';
  return null;
}

// Códigos de evento da API oficial (SRO). BDE/BDI/BDR tipo 01 = entrega efetivada;
// os demais tipos desses códigos são tentativas frustradas, então ficam como "em rota".
function situacaoPorCodigoCws(evento) {
  const codigo = (evento.codigo || '').toUpperCase();
  const tipo = String(evento.tipo || '').padStart(2, '0');
  if (['BDE', 'BDI', 'BDR'].includes(codigo)) return tipo === '01' ? 'entregue' : 'transito';
  if (codigo === 'OEC') return 'saiu_entrega';
  if (codigo === 'LDI') return 'aguardando_retirada';
  if (codigo === 'PO') return 'postado';
  if (['RO', 'DO'].includes(codigo)) return 'transito';
  return null;
}

// ---------- Provedor: API oficial (CWS) ----------
let cwsToken = null; // { token, expiraEm } — reaproveitado enquanto válido

async function cwsAutenticar() {
  if (cwsToken && Date.now() < cwsToken.expiraEm - 60000) return cwsToken.token;
  const { CORREIOS_USUARIO, CORREIOS_CODIGO_ACESSO, CORREIOS_CARTAO_POSTAGEM } = process.env;
  if (!CORREIOS_USUARIO || !CORREIOS_CODIGO_ACESSO) {
    throw new Error('CORREIOS_USUARIO / CORREIOS_CODIGO_ACESSO não configurados');
  }
  const basic = Buffer.from(`${CORREIOS_USUARIO}:${CORREIOS_CODIGO_ACESSO}`).toString('base64');
  const url = CORREIOS_CARTAO_POSTAGEM
    ? `${CWS_BASE}/token/v1/autentica/cartaopostagem`
    : `${CWS_BASE}/token/v1/autentica`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: CORREIOS_CARTAO_POSTAGEM ? JSON.stringify({ numero: CORREIOS_CARTAO_POSTAGEM }) : undefined,
  });
  if (!res.ok) throw new Error(`Correios: falha na autenticação (${res.status})`);
  const data = await res.json();
  cwsToken = { token: data.token, expiraEm: new Date(data.expiraEm).getTime() || Date.now() + 3600000 };
  return cwsToken.token;
}

async function cwsRastrear(codigo) {
  const token = await cwsAutenticar();
  const res = await fetch(`${CWS_BASE}/srorastro/v1/objetos/${codigo}?resultado=U`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Correios: falha na consulta (${res.status})`);
  const data = await res.json();
  const objeto = data.objetos?.[0];
  const evento = objeto?.eventos?.[0];
  if (!evento) return { encontrado: false, mensagem: objeto?.mensagem || 'Objeto ainda não localizado' };
  const endereco = evento.unidade?.endereco || {};
  return {
    encontrado: true,
    descricao: evento.descricao || '',
    local: [evento.unidade?.nome, endereco.cidade, endereco.uf].filter(Boolean).join(' - '),
    data: evento.dtHrCriado || null,
    situacao: situacaoPorCodigoCws(evento) || situacaoPorDescricao(evento.descricao),
  };
}

// ---------- Provedor: Link & Track ----------
async function linketrackRastrear(codigo) {
  const { LINKETRACK_USER, LINKETRACK_TOKEN } = process.env;
  if (!LINKETRACK_USER || !LINKETRACK_TOKEN) {
    throw new Error('LINKETRACK_USER / LINKETRACK_TOKEN não configurados');
  }
  const params = new URLSearchParams({ user: LINKETRACK_USER, token: LINKETRACK_TOKEN, codigo });
  const res = await fetch(`${LINKETRACK_BASE}?${params}`);
  if (!res.ok) throw new Error(`Link & Track: falha na consulta (${res.status})`);
  const data = await res.json();
  const evento = data.eventos?.[0]; // o mais recente vem primeiro
  if (!evento) return { encontrado: false, mensagem: 'Objeto ainda não localizado' };
  // "20/05/2026" + "14:32" → ISO local
  let dataIso = null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(evento.data || '');
  if (m) dataIso = `${m[3]}-${m[2]}-${m[1]}T${evento.hora || '00:00'}:00`;
  const descricao = [evento.status, ...(evento.subStatus || [])].filter(Boolean).join(' — ');
  return {
    encontrado: true,
    descricao,
    local: evento.local || '',
    data: dataIso,
    situacao: situacaoPorDescricao(descricao),
  };
}

// ---------- Interface pública ----------
function provedorConfigurado() {
  const p = (process.env.CORREIOS_PROVIDER || '').toLowerCase();
  if (p) return p;
  if (process.env.CORREIOS_USUARIO) return 'cws';
  if (process.env.LINKETRACK_USER) return 'linketrack';
  return null;
}

// Devolve { encontrado, descricao, local, data, situacao } ou lança erro
// (credenciais ausentes, API fora do ar, código inválido).
async function rastrear(codigoBruto) {
  const codigo = normalizarCodigo(codigoBruto);
  if (!isValidTrackingCode(codigo)) throw new Error(`Código de rastreio inválido: ${codigoBruto}`);
  const provedor = provedorConfigurado();
  if (provedor === 'cws') return cwsRastrear(codigo);
  if (provedor === 'linketrack') return linketrackRastrear(codigo);
  throw new Error('Nenhum provedor de rastreio configurado (ver functions/.env.example)');
}

function statusDaTrocaPara(situacao) {
  return STATUS_POR_SITUACAO[situacao] || null;
}

module.exports = {
  rastrear, isValidTrackingCode, normalizarCodigo, statusDaTrocaPara, provedorConfigurado, SITUACOES,
};
