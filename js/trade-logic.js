// Regras de negócio das trocas que não dependem do Firebase — separadas para
// serem testadas isoladamente (tests/unit/trade-logic.test.js). storage.js
// reexporta o que as telas usam.
//
// Cada troca tem um ou dois "envios" (um livro indo de uma parte para a outra):
// - por pontos: um só, dono → solicitante; status/agência/rastreio ficam no
//   próprio documento da troca (campos status, agenciaRetirada, rastreio);
// - livro por livro: dois, em envios.dono (livro do dono → solicitante) e
//   envios.solicitante (livro do solicitante → dono), cada um com sua agência de
//   retirada, seu rastreio e suas etapas. O status da troca é o do envio mais
//   atrasado — só fica "Finalizada" quando os dois livros foram retirados.
// Quem envia avança até "Chegada na agência";
// "Finalizada" só quem recebe marca, ao retirar o livro — e aí avalia a troca.
export const TRADE_STATUS = [
  'Solicitação enviada', 'Aceita', 'Postada', 'Em rota',
  'Chegada na agência', 'Finalizada', 'Cancelada'
];
export const STATUS_FINAL = 'Finalizada';
export const STATUS_CHEGADA = 'Chegada na agência';
export const ENVIO_KEYS = ['dono', 'solicitante'];

// Nomes antigos de status que ainda podem existir em trocas já salvas no Firestore.
// "Entregue" era o fim da troca (pontos dados, livros removidos), então vira "Finalizada".
export const LEGACY_STATUS = {
  'Em análise': 'Solicitação enviada',
  'Aguardando postagem': 'Postada',
  'Em transporte': 'Em rota',
  'Entregue': 'Finalizada',
};

export function isDualTrade(trade) { return trade?.tipo === 'proposta'; }

export const envioVazio = () => ({ status: 'Aceita', agenciaRetirada: null, rastreio: { codigo: '', transportadora: '' } });

// Normaliza uma troca lida do Firestore: nomes antigos de status e, nas trocas
// livro por livro criadas antes dos envios separados, o que estava no nível da
// troca (agência, rastreio) era o envio do dono.
export function normalizeTrade(t) {
  t.status = LEGACY_STATUS[t.status] || t.status;
  if (isDualTrade(t)) {
    const envios = t.envios || {};
    const donoLegado = envios.dono ? {} : {
      status: TRADE_STATUS.indexOf(t.status) > TRADE_STATUS.indexOf('Aceita') && t.status !== 'Cancelada' ? t.status : 'Aceita',
      agenciaRetirada: t.agenciaRetirada || null,
      rastreio: t.rastreio || envioVazio().rastreio,
    };
    t.envios = {
      dono: { ...envioVazio(), ...donoLegado, ...(envios.dono || {}) },
      solicitante: { ...envioVazio(), ...(envios.solicitante || {}) },
    };
  }
  return t;
}

// Lista os envios da troca já com quem manda/recebe e o status que aparece
// para o usuário (enquanto a troca não foi aceita, ou se foi cancelada, vale o
// status da troca).
export function getEnvios(trade) {
  const base = (key) => key === 'dono'
    ? { key, remetenteId: trade.ownerId, remetenteNome: trade.donoNome, destinatarioId: trade.requesterId, destinatarioNome: trade.requesterNome, titulo: trade.bookTitulo }
    : { key, remetenteId: trade.requesterId, remetenteNome: trade.requesterNome, destinatarioId: trade.ownerId, destinatarioNome: trade.donoNome, titulo: envioTitulo(trade, key) };
  if (!isDualTrade(trade)) {
    return [{ ...base('dono'), status: trade.status, agenciaRetirada: trade.agenciaRetirada || null, rastreio: trade.rastreio || {} }];
  }
  const tradeLevel = ['Solicitação enviada', 'Cancelada'].includes(trade.status);
  return ENVIO_KEYS.map(key => {
    const envio = trade.envios?.[key] || envioVazio();
    return { ...base(key), ...envio, status: tradeLevel ? trade.status : envio.status };
  });
}

export function envioTitulo(trade, key) {
  if (key === 'dono') return trade.bookTitulo;
  const titulos = trade.livrosOferecidosTitulos || [];
  return titulos.length ? titulos.join(', ') : `o livro de ${trade.requesterNome || 'quem solicitou'}`;
}

// Caminho do campo dentro do documento: no nível da troca (pontos) ou dentro
// do envio (livro por livro).
export function envioField(trade, key, field) {
  return isDualTrade(trade) ? `envios.${key}.${field}` : field;
}

// Status da troca livro por livro = envio mais atrasado.
export function aggregateStatus(envios) {
  return envios.reduce((min, e) => TRADE_STATUS.indexOf(e.status) < TRADE_STATUS.indexOf(min) ? e.status : min, STATUS_FINAL);
}

// Próxima etapa de um envio (quem envia avança); para em "Chegada na agência".
export function nextEnvioStatus(status) {
  const idx = TRADE_STATUS.indexOf(status);
  return TRADE_STATUS[Math.min(idx + 1, TRADE_STATUS.indexOf(STATUS_CHEGADA))];
}

// Impede solicitar troca para o próprio livro
export function canRequestTrade(bookOrOwnerId, requesterId) {
  if (!bookOrOwnerId || !requesterId) return false;
  const ownerId = typeof bookOrOwnerId === 'object' ? bookOrOwnerId.ownerId : bookOrOwnerId;
  return ownerId !== requesterId;
}

export const POSTED_STATUSES = ['Postada', 'Em rota', 'Chegada na agência', 'Finalizada'];

// Verifica se qualquer livro da troca já foi postado (ou possui código de rastreio)
export function isTradePosted(trade) {
  if (!trade) return false;
  const envios = getEnvios(trade);
  return envios.some(e => POSTED_STATUSES.includes(e.status) || Boolean(e.rastreio?.codigo));
}

// Bloqueia o cancelamento se algum livro já foi postado nos Correios
export function canCancelTrade(trade) {
  if (!trade) return false;
  if (trade.status === 'Cancelada' || trade.status === 'Finalizada') return false;
  if (isTradePosted(trade)) return false;
  return true;
}

// Verifica se o prazo de postagem expirou
export function hasPrazoPostagemExpirado(trade) {
  if (!trade?.prazoPostagem) return false;
  return new Date(trade.prazoPostagem) < new Date();
}

