const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

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
    .where('status', '==', 'Finalizada')
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
