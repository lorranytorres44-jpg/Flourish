// Gerador do Modelo Entidade-Relacionamento (notacao de Chen) do projeto Troca de Livros.
const fs = require('fs');

const W = 2700, H = 2280, OFF = 120; // OFF = margem superior para titulo
const out = [];
const Y = v => v + OFF;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FONT = "Segoe UI, Calibri, Arial, Helvetica, sans-serif";

function line(x1, y1, x2, y2, extra = '') {
  out.push(`<line x1="${x1}" y1="${Y(y1)}" x2="${x2}" y2="${Y(y2)}" stroke="#111" stroke-width="1.6" ${extra}/>`);
}
function text(x, y, s, { size = 15, anchor = 'start', weight = 'normal', halo = false, italic = false } = {}) {
  const h = halo ? ' stroke="#fff" stroke-width="5" paint-order="stroke fill" stroke-linejoin="round"' : '';
  const it = italic ? ' font-style="italic"' : '';
  out.push(`<text x="${x}" y="${Y(y)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="#111"${it}${h}>${esc(s)}</text>`);
}

// ---------- Entidades ----------
const EW = 230, EH = 62;
function entity(cx, cy, label, weak = false) {
  const x = cx - EW / 2, y = cy - EH / 2;
  out.push(`<rect x="${x}" y="${Y(y)}" width="${EW}" height="${EH}" fill="#fff" stroke="#111" stroke-width="1.8"/>`);
  if (weak) out.push(`<rect x="${x + 6}" y="${Y(y + 6)}" width="${EW - 12}" height="${EH - 12}" fill="none" stroke="#111" stroke-width="1.4"/>`);
  text(cx, cy + 6, label, { size: 17, anchor: 'middle', weight: 'bold' });
  return { cx, cy, l: x, r: x + EW, t: y, b: y + EH };
}

// ---------- Relacionamentos ----------
const DW = 96, DH = 44;
function rel(cx, cy, label, identifying = false) {
  const pts = `${cx},${cy - DH} ${cx + DW},${cy} ${cx},${cy + DH} ${cx - DW},${cy}`
    .split(' ').map(p => { const [a, b] = p.split(','); return `${a},${Y(+b)}`; }).join(' ');
  out.push(`<polygon points="${pts}" fill="#fff" stroke="#111" stroke-width="1.8"/>`);
  if (identifying) {
    const i = 8;
    const p2 = `${cx},${cy - DH + i * 1.9} ${cx + DW - i * 1.9},${cy} ${cx},${cy + DH - i * 1.9} ${cx - DW + i * 1.9},${cy}`
      .split(' ').map(p => { const [a, b] = p.split(','); return `${a},${Y(+b)}`; }).join(' ');
    out.push(`<polygon points="${p2}" fill="none" stroke="#111" stroke-width="1.4"/>`);
  }
  const parts = label.split('\n');
  parts.forEach((p, i) => text(cx, cy + 5 - (parts.length - 1) * 9 + i * 18, p, { size: 15, anchor: 'middle' }));
  return { cx, cy, top: cy - DH, bot: cy + DH, left: cx - DW, right: cx + DW };
}

// ---------- Atributos ----------
// kind: 'key' | 'partial' | 'normal' | 'derived' | 'composite'
function attrCircle(x, y, kind) {
  const r = 7;
  if (kind === 'key') out.push(`<circle cx="${x}" cy="${Y(y)}" r="${r}" fill="#111" stroke="#111" stroke-width="1.6"/>`);
  else if (kind === 'partial') {
    out.push(`<circle cx="${x}" cy="${Y(y)}" r="${r}" fill="#111" stroke="none"/>`);
    out.push(`<circle cx="${x}" cy="${Y(y)}" r="${r + 4}" fill="none" stroke="#111" stroke-width="1.4" stroke-dasharray="4 3"/>`);
  } else if (kind === 'derived') out.push(`<circle cx="${x}" cy="${Y(y)}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.6" stroke-dasharray="4 3"/>`);
  else out.push(`<circle cx="${x}" cy="${Y(y)}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.6"/>`);
}

// Cluster vertical de atributos ligado a uma "espinha".
// side: 'left' | 'right'
function attrColumn(spineX, rows, side) {
  const ys = rows.map(r => r.y);
  line(spineX, Math.min(...ys), spineX, Math.max(...ys));
  rows.forEach(r => {
    const cx = side === 'left' ? spineX - 30 : spineX + 30;
    line(spineX, r.y, cx, r.y);
    attrCircle(cx, r.y, r.kind || 'normal');
    const tx = side === 'left' ? cx - 15 : cx + 15;
    text(tx, r.y + 5, r.label, { anchor: side === 'left' ? 'end' : 'start' });
  });
}

// Cardinalidade (min,max) posicionada sobre a linha, deslocada perpendicularmente.
function card(x1, y1, x2, y2, t, label, off = 18) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len * off, py = dx / len * off;
  text(x1 + dx * t + px, y1 + dy * t + py + 5, label, { size: 13.5, anchor: 'middle', halo: true });
}

// =====================================================================
// TITULO
// =====================================================================
out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`);
out.push(`<text x="60" y="52" font-family="${FONT}" font-size="30" font-weight="bold" fill="#111">Modelo Entidade-Relacionamento &#8212; Troca de Livros</text>`);
out.push(`<text x="60" y="88" font-family="${FONT}" font-size="16" fill="#333">Projeto biblioteca &#183; base Cloud Firestore (cole&#231;&#245;es users, books, trades, ratings e subcole&#231;&#245;es) &#183; notac&#807;a&#771;o de Chen com cardinalidade (m&#237;n,m&#225;x)</text>`);

// =====================================================================
// ENTIDADES
// =====================================================================
const AUT = entity(400, 130, 'AUTENTICAÇÃO');
const USU = entity(400, 640, 'USUÁRIO');
const NOT = entity(400, 1240, 'NOTIFICAÇÃO', true);
const LIV = entity(1560, 300, 'LIVRO');
const TRO = entity(1560, 1180, 'TROCA');
const MSG = entity(1560, 1560, 'MENSAGEM', true);
const AVA = entity(1000, 1780, 'AVALIAÇÃO');

// ---------- Atributos: AUTENTICACAO (esquerda) ----------
line(AUT.l, 130, 245, 130);
attrColumn(245, [
  { y: 30, label: 'uid', kind: 'key' },
  { y: 80, label: 'email' },
  { y: 130, label: 'senha' },
  { y: 180, label: 'provedor' },
  { y: 230, label: 'emailVerificado' },
], 'left');

// ---------- Atributos: USUARIO (esquerda) ----------
line(USU.l, 640, 245, 640);
attrColumn(245, [
  { y: 388, label: 'idUsuario', kind: 'key' },
  { y: 444, label: 'nome' },
  { y: 500, label: 'email' },
  { y: 556, label: 'foto' },
  { y: 612, label: 'cidade' },
  { y: 668, label: 'estado' },
  { y: 724, label: 'bio' },
  { y: 780, label: 'generosFavoritos (0,n)' },
  { y: 836, label: 'pontos' },
  { y: 892, label: 'createdAt' },
], 'left');

// ---------- Atributos: NOTIFICACAO (esquerda) ----------
line(NOT.l, 1240, 245, 1240);
attrColumn(245, [
  { y: 1100, label: 'idNotificacao', kind: 'partial' },
  { y: 1156, label: 'titulo' },
  { y: 1212, label: 'texto' },
  { y: 1268, label: 'tipo' },
  { y: 1324, label: 'lida' },
  { y: 1380, label: 'criadoEm' },
], 'left');

// ---------- Atributos: LIVRO (direita, 2 colunas) ----------
line(LIV.r, 300, 2100, 300);
attrColumn(1720, [
  { y: 20, label: 'idLivro', kind: 'key' },
  { y: 80, label: 'titulo' },
  { y: 140, label: 'autor' },
  { y: 200, label: 'editora' },
  { y: 260, label: 'edicao' },
  { y: 320, label: 'ano' },
  { y: 380, label: 'paginas' },
  { y: 440, label: 'generos (1,n)' },
  { y: 500, label: 'nacionalidade' },
  { y: 560, label: 'sinopse' },
], 'right');
attrColumn(2100, [
  { y: 20, label: 'estadoConservacao' },
  { y: 80, label: 'semDanificacoes' },
  { y: 140, label: 'observacoes' },
  { y: 200, label: 'tempoUso' },
  { y: 260, label: 'capa' },
  { y: 320, label: 'fotos (1,n)' },
  { y: 380, label: 'pontosNecessarios' },
  { y: 440, label: 'curtidas', kind: 'derived' },
  { y: 500, label: 'interessados', kind: 'derived' },
  { y: 560, label: 'dataCadastro' },
], 'right');

// ---------- Atributos: TROCA (direita, 2 colunas) ----------
line(TRO.r, 1180, 2100, 1180);
attrColumn(1720, [
  { y: 900, label: 'idTroca', kind: 'key' },
  { y: 960, label: 'tipo' },
  { y: 1020, label: 'pontosUsados' },
  { y: 1080, label: 'mensagem' },
  { y: 1140, label: 'status' },
  { y: 1240, label: 'criadoEm' },
  { y: 1300, label: 'prazoPostagem' },
  { y: 1360, label: 'finalizadoEm' },
], 'right');
attrColumn(2100, [
  { y: 1020, label: 'bookTitulo', kind: 'derived' },
  { y: 1080, label: 'bookCapa', kind: 'derived' },
  { y: 1140, label: 'requesterNome', kind: 'derived' },
  { y: 1240, label: 'donoNome', kind: 'derived' },
  { y: 1340, label: 'rastreio' },
], 'right');
// rastreio: atributo composto
line(2130, 1340, 2270, 1340);
attrColumn(2270, [
  { y: 1280, label: 'codigo' },
  { y: 1340, label: 'transportadora' },
  { y: 1400, label: 'historico (0,n)' },
], 'right');

// ---------- Atributos: MENSAGEM (direita) ----------
line(MSG.r, 1560, 1720, 1560);
attrColumn(1720, [
  { y: 1476, label: 'idMensagem', kind: 'partial' },
  { y: 1532, label: 'autor' },
  { y: 1588, label: 'texto' },
  { y: 1644, label: 'hora' },
], 'right');

// ---------- Atributos: AVALIACAO (esquerda) ----------
line(AVA.l, 1780, 830, 1780);
attrColumn(830, [
  { y: 1700, label: 'idAvaliacao', kind: 'key' },
  { y: 1748, label: 'conservacao (0,1)' },
  { y: 1796, label: 'comunicacao (0,1)' },
  { y: 1844, label: 'rapidez (0,1)' },
  { y: 1892, label: 'experiencia (0,1)' },
  { y: 1940, label: 'cooperacao (0,1)' },
  { y: 1988, label: 'comentario' },
  { y: 2036, label: 'criadoEm' },
  { y: 2084, label: 'nota', kind: 'derived' },
], 'left');

// =====================================================================
// RELACIONAMENTOS
// =====================================================================

// AUTENTICACAO (1,1) --- tem --- (1,1) USUARIO
const R_TEM = rel(400, 385, 'tem');
line(400, AUT.b, 400, R_TEM.top); card(400, AUT.b, 400, R_TEM.top, 0.5, '(1,1)');
line(400, R_TEM.bot, 400, USU.t); card(400, R_TEM.bot, 400, USU.t, 0.55, '(1,1)');

// USUARIO (0,n) --- possui --- (1,1) NOTIFICACAO  [identificador]
const R_NOT = rel(400, 960, 'possui', true);
line(400, USU.b, 400, R_NOT.top); card(400, USU.b, 400, R_NOT.top, 0.62, '(0,n)');
line(400, R_NOT.bot, 400, NOT.t); card(400, R_NOT.bot, 400, NOT.t, 0.55, '(1,1)');

// USUARIO (0,n) --- favorita --- (0,n) LIVRO
const R_FAV = rel(980, 180, 'favorita');
line(500, USU.t, R_FAV.left, 180); card(500, USU.t, R_FAV.left, 180, 0.35, '(0,n)');
line(LIV.l, 280, R_FAV.right, 180); card(LIV.l, 280, R_FAV.right, 180, 0.28, '(0,n)');
line(980, R_FAV.top, 1080, 96); attrCircle(1087, 90, 'normal'); text(1102, 95, 'addedAt');

// USUARIO (0,n) --- anuncia --- (1,1) LIVRO
const R_ANU = rel(980, 480, 'anuncia');
line(USU.r, 618, R_ANU.left, 480); card(USU.r, 618, R_ANU.left, 480, 0.32, '(0,n)');
line(LIV.l, 320, R_ANU.right, 480); card(LIV.l, 320, R_ANU.right, 480, 0.28, '(1,1)');

// USUARIO (0,n) --- lista de leitura --- (0,n) LIVRO
const R_LIS = rel(980, 780, 'lista de\nleitura');
line(USU.r, 642, R_LIS.left, 780); card(USU.r, 642, R_LIS.left, 780, 0.30, '(0,n)');
line(1470, LIV.b, 1040, 764); card(1470, LIV.b, 1040, 764, 0.3, '(0,n)');
line(980, R_LIS.bot, 980, 873); attrCircle(980, 880, 'normal'); text(996, 885, 'addedAt');

// TROCA (1,1) --- refere-se a --- (0,n) LIVRO
const R_REF = rel(1420, 740, 'refere-se a');
line(1480, LIV.b, 1420, R_REF.top); card(1480, LIV.b, 1420, R_REF.top, 0.25, '(0,n)');
line(1420, R_REF.bot, 1480, TRO.t); card(1420, R_REF.bot, 1480, TRO.t, 0.75, '(1,1)');

// TROCA (0,n) --- oferece --- (0,n) LIVRO
const R_OFE = rel(1700, 740, 'oferece');
line(1640, LIV.b, 1700, R_OFE.top); card(1640, LIV.b, 1700, R_OFE.top, 0.25, '(0,n)', -18);
line(1700, R_OFE.bot, 1640, TRO.t); card(1700, R_OFE.bot, 1640, TRO.t, 0.75, '(0,n)', -18);

// USUARIO (0,n) --- solicita --- (1,1) TROCA
const R_SOL = rel(980, 980, 'solicita');
line(USU.r, 658, R_SOL.left, 980); card(USU.r, 658, R_SOL.left, 980, 0.28, '(0,n)');
line(R_SOL.right, 980, TRO.l, 1155); card(R_SOL.right, 980, TRO.l, 1155, 0.78, '(1,1)');

// USUARIO (0,n) --- e dono em --- (1,1) TROCA
const R_DON = rel(980, 1200, 'é dono em');
line(505, USU.b, R_DON.left, 1200); card(505, USU.b, R_DON.left, 1200, 0.28, '(0,n)');
line(R_DON.right, 1200, TRO.l, 1195); card(R_DON.right, 1200, TRO.l, 1195, 0.78, '(1,1)');

// TROCA (0,n) --- possui --- (1,1) MENSAGEM  [identificador]
const R_MSG = rel(1560, 1360, 'possui', true);
line(1560, TRO.b, 1560, R_MSG.top); card(1560, TRO.b, 1560, R_MSG.top, 0.5, '(0,n)');
line(1560, R_MSG.bot, 1560, MSG.t); card(1560, R_MSG.bot, 1560, MSG.t, 0.5, '(1,1)');

// USUARIO (0,n) --- escreve --- (1,1) AVALIACAO
const R_ESC = rel(660, 1430, 'escreve');
line(445, USU.b, 660, R_ESC.top); card(445, USU.b, 660, R_ESC.top, 0.26, '(0,n)');
line(660, R_ESC.bot, 930, AVA.t); card(660, R_ESC.bot, 930, AVA.t, 0.72, '(1,1)');

// USUARIO (0,n) --- recebe --- (1,1) AVALIACAO
const R_REC = rel(880, 1500, 'recebe');
line(490, USU.b, 830, 1480); card(490, USU.b, 830, 1480, 0.34, '(0,n)', -18);
line(880, R_REC.bot, 1000, AVA.t); card(880, R_REC.bot, 1000, AVA.t, 0.7, '(1,1)');

// TROCA (0,2) --- gera --- (1,1) AVALIACAO
const R_GER = rel(1290, 1520, 'gera');
line(1490, TRO.b, 1340, 1500); card(1490, TRO.b, 1340, 1500, 0.3, '(0,2)', -18);
line(1240, 1542, 1080, AVA.t); card(1240, 1542, 1080, AVA.t, 0.7, '(1,1)', -18);

// =====================================================================
// LEGENDA
// =====================================================================
(function legenda() {
  const x = 2100, y = 1590, w = 545, h = 505;
  out.push(`<rect x="${x}" y="${Y(y)}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="1.4"/>`);
  text(x + 20, y + 34, 'LEGENDA', { size: 16, weight: 'bold' });
  let ly = y + 70;
  const step = 38;
  const item = (draw, label) => { draw(x + 46, ly); text(x + 90, ly + 5, label, { size: 14 }); ly += step; };

  item((cx, cy) => { out.push(`<rect x="${cx - 30}" y="${Y(cy - 13)}" width="60" height="26" fill="#fff" stroke="#111" stroke-width="1.8"/>`); }, 'entidade');
  item((cx, cy) => {
    out.push(`<rect x="${cx - 30}" y="${Y(cy - 13)}" width="60" height="26" fill="#fff" stroke="#111" stroke-width="1.8"/>`);
    out.push(`<rect x="${cx - 25}" y="${Y(cy - 8)}" width="50" height="16" fill="none" stroke="#111" stroke-width="1.2"/>`);
  }, 'entidade fraca (existe dentro de outra)');
  item((cx, cy) => { out.push(`<polygon points="${cx},${Y(cy - 15)} ${cx + 34},${Y(cy)} ${cx},${Y(cy + 15)} ${cx - 34},${Y(cy)}" fill="#fff" stroke="#111" stroke-width="1.8"/>`); }, 'relacionamento');
  item((cx, cy) => {
    out.push(`<polygon points="${cx},${Y(cy - 15)} ${cx + 34},${Y(cy)} ${cx},${Y(cy + 15)} ${cx - 34},${Y(cy)}" fill="#fff" stroke="#111" stroke-width="1.8"/>`);
    out.push(`<polygon points="${cx},${Y(cy - 9)} ${cx + 21},${Y(cy)} ${cx},${Y(cy + 9)} ${cx - 21},${Y(cy)}" fill="none" stroke="#111" stroke-width="1.2"/>`);
  }, 'relacionamento identificador');
  item((cx, cy) => { attrCircle(cx, cy, 'key'); }, 'atributo identificador (chave)');
  item((cx, cy) => { attrCircle(cx, cy, 'partial'); }, 'chave parcial (da entidade fraca)');
  item((cx, cy) => { attrCircle(cx, cy, 'normal'); }, 'atributo simples');
  item((cx, cy) => { attrCircle(cx, cy, 'derived'); }, 'atributo derivado / redundante');
  ly += 4;
  text(x + 20, ly + 5, '(0,n) depois do nome do atributo = multivalorado;', { size: 14 });
  ly += 24;
  text(x + 20, ly + 5, '(0,1) = atributo opcional.', { size: 14 });
  ly += 30;
  text(x + 20, ly + 5, '(mín,máx) sobre a linha = quantas vezes uma', { size: 14 });
  ly += 24;
  text(x + 20, ly + 5, 'ocorrência da entidade vizinha participa', { size: 14 });
  ly += 24;
  text(x + 20, ly + 5, 'daquele relacionamento.', { size: 14 });
})();

// =====================================================================
// NOTAS
// =====================================================================
(function notas() {
  const x = 60, y = 1500;
  text(x, y, 'NOTAS DE MODELAGEM', { size: 16, weight: 'bold' });
  const linhas = [
    'As chaves estrangeiras do Firestore viraram relacionamentos, não',
    'atributos: books.ownerId = anuncia; trades.bookId = refere-se a;',
    'trades.livrosOferecidos = oferece; trades.requesterId = solicita;',
    'trades.ownerId = é dono em; ratings.autorId / ratings.avaliadoId =',
    'escreve / recebe; ratings.tradeId = gera.',
    '',
    'FAVORITA e LISTA DE LEITURA são os relacionamentos N:N guardados',
    'nas subcoleções users/{id}/favorites e users/{id}/readList — cada',
    'documento tem apenas addedAt, que vira atributo do relacionamento.',
    '',
    'MENSAGEM e NOTIFICAÇÃO são entidades fracas: vivem dentro das',
    'subcoleções trades/{id}/messages e users/{id}/notifications e só',
    'são identificadas junto com a entidade dona. MENSAGEM.autor guarda',
    'o idUsuario do remetente, sempre uma das duas partes da TROCA.',
    '',
    'Derivados: curtidas = nº de USUÁRIOs que favoritaram o LIVRO;',
    'interessados = nº de TROCAs sobre ele; nota = média dos critérios',
    'da AVALIAÇÃO; bookTitulo, bookCapa, requesterNome e donoNome são',
    'cópias gravadas na TROCA para listar sem reler LIVRO e USUÁRIO.',
    '',
    'Os critérios da AVALIAÇÃO são opcionais (0,1) porque dependem do',
    'papel de quem avalia: quem recebe o livro julga conservacao,',
    'comunicacao, rapidez e experiencia; quem envia julga só cooperacao.',
  ];
  linhas.forEach((l, i) => text(x, y + 36 + i * 24, l, { size: 14.5 }));
})();

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n${out.join('\n')}\n</svg>\n`;
fs.writeFileSync(process.argv[2], svg);
console.log('ok', svg.length);
