const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const correios = require('./correios');

initializeApp();
const db = getFirestore();

const PRAZO_CARENCIA_DIAS = 14;

// Roda uma vez por dia: apaga o chat das trocas finalizadas há mais de
// PRAZO_CARENCIA_DIAS dias (endereços trocados ali não precisam ficar
// guardados para sempre — o mesmo prazo já é exigido em firestore.rules
// para quem tenta apagar direto pelo app).
exports.limparMensagensAntigas = onSchedule('every 24 hours', async () => {
  const limite = Timestamp.fromMillis(Date.now() - PRAZO_CARENCIA_DIAS * 86400000);

  const tradesSnap = await db.collection('trades')
    .where('status', 'in', ['Finalizada', 'Entregue']) // 'Entregue' = nome antigo do fim da troca
    .where('finalizadoEm', '<=', limite)
    .get();

  for (const tradeDoc of tradesSnap.docs) {
    const messagesSnap = await tradeDoc.ref.collection('messages').get();
    if (messagesSnap.empty) continue;
    const batch = db.batch();
    messagesSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
});

// ============================================
// Rastreamento automático pelos Correios
// ============================================

// Mesma sequência de js/storage.js — o status só anda para frente.
const TRADE_STATUS = ['Solicitação enviada', 'Aceita', 'Postada', 'Em rota', 'Chegada na agência', 'Finalizada', 'Cancelada'];
const LEGACY_STATUS = { 'Em análise': 'Solicitação enviada', 'Aguardando postagem': 'Postada', 'Em transporte': 'Em rota', 'Entregue': 'Finalizada' };
const STATUS_RASTREAVEIS = ['Postada', 'Em rota', 'Aguardando postagem', 'Em transporte'];

async function notificar(uid, titulo, texto, tipo = 'troca') {
  if (!uid) return;
  await db.collection('users').doc(uid).collection('notifications').add({
    titulo, texto, tipo, lida: false, criadoEm: new Date().toISOString(),
  });
}

// Consulta os Correios para uma troca e grava o último evento em `rastreio`.
// Se o evento indicar um status mais avançado que o atual, a troca avança sozinha,
// no máximo até "Chegada na agência" (a finalização é do solicitante, no app).
// Devolve o rastreio gravado.
async function sincronizarRastreio(tradeRef, trade) {
  const codigo = correios.normalizarCodigo(trade.rastreio?.codigo);
  if (!correios.isValidTrackingCode(codigo)) return null;

  const evento = await correios.rastrear(codigo);
  const agora = new Date().toISOString();
  const rastreioAtual = trade.rastreio || {};
  const ultimoEvento = evento.encontrado
    ? { descricao: evento.descricao, local: evento.local, data: evento.data, situacao: evento.situacao || null }
    : { descricao: evento.mensagem, local: '', data: null, situacao: null };

  const patch = {
    'rastreio.ultimoEvento': ultimoEvento,
    'rastreio.consultadoEm': agora,
  };
  const anterior = rastreioAtual.ultimoEvento;
  const mudou = !anterior || anterior.descricao !== ultimoEvento.descricao || anterior.data !== ultimoEvento.data;
  if (mudou && evento.encontrado) {
    patch['rastreio.historico'] = FieldValue.arrayUnion({
      texto: [ultimoEvento.descricao, ultimoEvento.local].filter(Boolean).join(' · '),
      data: ultimoEvento.data || agora,
    });
  }

  const statusAtual = LEGACY_STATUS[trade.status] || trade.status;
  const statusNovo = correios.statusDaTrocaPara(ultimoEvento.situacao);
  const avanca = statusNovo && TRADE_STATUS.indexOf(statusNovo) > TRADE_STATUS.indexOf(statusAtual)
    && statusAtual !== 'Cancelada';
  if (avanca) patch.status = statusNovo;
  await tradeRef.update(patch);

  if (avanca) {
    const texto = `"${trade.bookTitulo}" agora está: ${statusNovo} (atualizado pelos Correios).`;
    await Promise.all([
      notificar(trade.ownerId, 'Atualização de troca', texto),
      notificar(trade.requesterId, 'Atualização de troca', statusNovo === 'Chegada na agência'
        ? `"${trade.bookTitulo}" chegou na agência dos Correios. Retire o livro e finalize a troca no app.`
        : texto),
    ]);
  } else if (mudou && evento.encontrado) {
    const texto = `${trade.bookTitulo}: ${ultimoEvento.descricao}${ultimoEvento.local ? ` (${ultimoEvento.local})` : ''}`;
    await Promise.all([
      notificar(trade.ownerId, 'Rastreamento atualizado', texto),
      notificar(trade.requesterId, 'Rastreamento atualizado', texto),
    ]);
  }

  return { ...rastreioAtual, ultimoEvento, consultadoEm: agora, status: avanca ? statusNovo : statusAtual };
}

// A cada 2 horas consulta todas as trocas postadas que têm código de rastreio.
// Os Correios não atualizam com mais frequência que isso, e os provedores
// gratuitos limitam o número de consultas.
exports.atualizarRastreios = onSchedule('every 2 hours', async () => {
  if (!correios.provedorConfigurado()) {
    console.warn('Rastreio automático desligado: nenhum provedor configurado (ver functions/.env.example).');
    return;
  }
  const tradesSnap = await db.collection('trades').where('status', 'in', STATUS_RASTREAVEIS).get();
  for (const tradeDoc of tradesSnap.docs) {
    const trade = tradeDoc.data();
    if (!correios.isValidTrackingCode(trade.rastreio?.codigo)) continue;
    try {
      await sincronizarRastreio(tradeDoc.ref, trade);
    } catch (err) {
      console.error(`Rastreio da troca ${tradeDoc.id} (${trade.rastreio.codigo}) falhou:`, err.message);
    }
  }
});

// Consulta sob demanda, pelo botão "Atualizar agora" no app. Só as duas partes
// da troca podem chamar.
exports.consultarRastreio = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Faça login para consultar o rastreio.');
  const tradeId = String(request.data?.tradeId || '');
  if (!tradeId) throw new HttpsError('invalid-argument', 'tradeId é obrigatório.');

  const tradeRef = db.collection('trades').doc(tradeId);
  const snap = await tradeRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Troca não encontrada.');
  const trade = snap.data();
  if (trade.ownerId !== uid && trade.requesterId !== uid) {
    throw new HttpsError('permission-denied', 'Você não participa desta troca.');
  }
  if (!correios.isValidTrackingCode(trade.rastreio?.codigo)) {
    throw new HttpsError('failed-precondition', 'Esta troca não tem um código de rastreio válido.');
  }
  if (!correios.provedorConfigurado()) {
    throw new HttpsError('unavailable', 'Rastreamento automático não configurado no servidor.');
  }
  try {
    return await sincronizarRastreio(tradeRef, trade);
  } catch (err) {
    console.error(`consultarRastreio ${tradeId}:`, err.message);
    throw new HttpsError('unavailable', 'Os Correios não responderam. Tente de novo em instantes.');
  }
});
