// ============================================
// Camada de dados — Firebase Auth + Firestore
// Único ponto de contato com persistência: qualquer troca de provedor
// (ou volta a um backend próprio) deve mexer só neste arquivo.
// ============================================
import { app, auth, db } from './firebase.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification,
  verifyPasswordResetCode, confirmPasswordReset,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc,
  query, where, orderBy, onSnapshot, increment, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const DEFAULT_FOTO = 'https://i.pravatar.cc/150?img=5';

// -------- Estado em cache (preenchido pelo listener de autenticação) --------
let cachedUser = null;
let cachedSession = null;
let cachedPoints = null;
let cachedFavorites = new Set();
let cachedReadList = new Set();
let cachedNotifications = [];

let resolveAuthReady;
export const authReady = new Promise(resolve => { resolveAuthReady = resolve; });
let authReadyResolved = false;

function unsubscribeAll() {
  favoritesUnsub?.(); readListUnsub?.(); notifUnsub?.();
  favoritesUnsub = readListUnsub = notifUnsub = null;
}
let favoritesUnsub = null, readListUnsub = null, notifUnsub = null;

onAuthStateChanged(auth, async (user) => {
  unsubscribeAll();
  cachedUser = user;

  if (!user) {
    cachedSession = null;
    cachedPoints = null;
    cachedFavorites = new Set();
    cachedReadList = new Set();
    cachedNotifications = [];
  } else {
    const ref = doc(db, 'users', user.uid);
    let snap = await getDoc(ref);
    if (!snap.exists()) {
      // Cadastro recém-criado: o documento pode ainda estar sendo gravado
      // (ver createUserDoc). Espera um instante e tenta de novo antes de
      // cair nos valores padrão, evitando sobrescrever com dados vazios.
      await new Promise(r => setTimeout(r, 500));
      snap = await getDoc(ref);
    }
    const data = snap.exists() ? snap.data() : {};
    cachedSession = { id: user.uid, nome: data.nome || 'Leitor(a)', email: data.email || user.email || '', foto: data.foto || DEFAULT_FOTO, cidade: data.cidade || '', estado: data.estado || '', bio: data.bio || 'Ainda não escrevi minha biografia.', generosFavoritos: data.generosFavoritos || [] };
    cachedPoints = data.pontos ?? 0;

    favoritesUnsub = onSnapshot(collection(db, 'users', user.uid, 'favorites'), (qs) => {
      cachedFavorites = new Set(qs.docs.map(d => d.id));
    });
    readListUnsub = onSnapshot(collection(db, 'users', user.uid, 'readList'), (qs) => {
      cachedReadList = new Set(qs.docs.map(d => d.id));
    });
    notifUnsub = onSnapshot(collection(db, 'users', user.uid, 'notifications'), (qs) => {
      cachedNotifications = qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      window.dispatchEvent(new CustomEvent('tdl:notification'));
    });
  }

  window.dispatchEvent(new CustomEvent('tdl:auth-changed'));
  if (!authReadyResolved) { authReadyResolved = true; resolveAuthReady(); }
});

// -------- Sessão / usuário atual --------
export function getSession() {
  return cachedSession;
}

export function isLoggedIn() {
  return !!cachedSession;
}

// Cria o documento de perfil e já preenche o cache local na hora — não dá pra
// confiar só no listener onAuthStateChanged aqui, porque ele dispara assim que
// o login acontece e pode ler o documento ANTES desta escrita terminar (corrida).
async function createUserDoc(uid, { nome, email, foto, cidade = '', estado = '', generosFavoritos = [] }) {
  const data = {
    nome, email, foto: foto || DEFAULT_FOTO, cidade, estado,
    bio: 'Ainda não escrevi minha biografia.', generosFavoritos,
    pontos: 5, createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), data);
  cachedSession = { id: uid, ...data };
  cachedPoints = data.pontos;
}

export async function signUpWithEmail({ nome, email, senha }) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await createUserDoc(cred.user.uid, { nome, email });
  sendEmailVerification(cred.user).catch(() => {}); // não bloqueia o cadastro se falhar
  return cred.user;
}

export async function loginWithEmail({ email, senha }) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

async function ensureGoogleUserDoc(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await createUserDoc(user.uid, { nome: user.displayName || 'Leitor(a)', email: user.email, foto: user.photoURL });
  }
}

// Alguns navegadores/extensões bloqueiam o popup do Google (auth/popup-blocked).
// Nesses casos caímos para o fluxo de redirecionamento; o retorno é tratado
// pelo getRedirectResult logo abaixo, que roda assim que o módulo carrega.
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    await ensureGoogleUserDoc(cred.user);
    return cred.user;
  } catch (err) {
    if (['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

getRedirectResult(auth).then((result) => {
  if (result?.user) return ensureGoogleUserDoc(result.user);
}).catch(() => {});

export async function sendPasswordReset(email) {
  const dir = window.location.pathname.replace(/[^/]*$/, '');
  await sendPasswordResetEmail(auth, email, {
    url: `${window.location.origin}${dir}redefinir-senha.html`,
    handleCodeInApp: true,
  });
}

export async function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function confirmReset(oobCode, novaSenha) {
  await confirmPasswordReset(auth, oobCode, novaSenha);
}

export async function updateSession(patch) {
  if (!cachedUser) return null;
  await updateDoc(doc(db, 'users', cachedUser.uid), patch);
  cachedSession = { ...cachedSession, ...patch };
  return cachedSession;
}

export async function logout() {
  await signOut(auth);
}

// -------- Pontos --------
export function getPoints() {
  return cachedPoints;
}

export async function addPoints(amount, reason) {
  if (!cachedUser) return null;
  await updateDoc(doc(db, 'users', cachedUser.uid), { pontos: increment(amount) });
  cachedPoints = Math.max(0, (cachedPoints ?? 0) + amount);
  if (reason) {
    await addNotification(
      amount >= 0 ? 'Pontos recebidos' : 'Pontos debitados',
      `${amount >= 0 ? '+' : ''}${amount} pontos — ${reason}`,
      'pontos'
    );
  }
  return cachedPoints;
}

export const PONTOS_REGRAS = {
  CRIAR_CONTA: 5,
  ENVIAR_LIVRO: 1,
  CONCLUIR_TROCA: 2,
  AVALIACAO_POSITIVA: 1,
  CANCELAR_SEM_JUSTIFICATIVA: -2,
};

// -------- Favoritos / lidos --------
export function getFavorites() { return [...cachedFavorites]; }
export function isFavorite(bookId) { return cachedFavorites.has(bookId); }
export async function toggleFavorite(bookId) {
  if (!cachedUser) return;
  const ref = doc(db, 'users', cachedUser.uid, 'favorites', bookId);
  const bookRef = doc(db, 'books', bookId);
  if (cachedFavorites.has(bookId)) {
    await deleteDoc(ref);
    cachedFavorites.delete(bookId);
    await updateDoc(bookRef, { curtidas: increment(-1) }).catch(() => {});
  } else {
    await setDoc(ref, { addedAt: serverTimestamp() });
    cachedFavorites.add(bookId);
    await updateDoc(bookRef, { curtidas: increment(1) }).catch(() => {});
  }
}

export function getReadList() { return [...cachedReadList]; }
export function isRead(bookId) { return cachedReadList.has(bookId); }
export async function toggleRead(bookId) {
  if (!cachedUser) return;
  const ref = doc(db, 'users', cachedUser.uid, 'readList', bookId);
  if (cachedReadList.has(bookId)) { await deleteDoc(ref); cachedReadList.delete(bookId); }
  else { await setDoc(ref, { addedAt: serverTimestamp() }); cachedReadList.add(bookId); }
}

// -------- Livros --------
export async function getFirestoreBooks() {
  const qs = await getDocs(collection(db, 'books'));
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMyBooks() {
  if (!cachedUser) return [];
  const q = query(collection(db, 'books'), where('ownerId', '==', cachedUser.uid));
  const qs = await getDocs(q);
  return qs.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addMyBook(book) {
  const docRef = await addDoc(collection(db, 'books'), {
    ...book, ownerId: cachedUser.uid, interessados: 0, curtidas: 0,
    dataCadastro: new Date().toISOString().slice(0, 10),
  });
  await addPoints(PONTOS_REGRAS.ENVIAR_LIVRO, 'livro anunciado');
  return { id: docRef.id, ...book, ownerId: cachedUser.uid };
}

export async function getAllBooks() {
  return getFirestoreBooks();
}

// Livros ordenados por curtidas — usado na home.
export async function getMostLikedBooks(max = 5) {
  const books = await getFirestoreBooks();
  return books
    .filter(b => (b.curtidas || 0) > 0)
    .sort((a, b) => (b.curtidas || 0) - (a.curtidas || 0))
    .slice(0, max);
}

export async function getAnyBookById(id) {
  const snap = await getDoc(doc(db, 'books', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Resolve os dados de exibição do dono de um livro. Prioriza o cache da
// sessão atual (evita ida ao servidor) e cai em Firestore para outros usuários reais.
export async function getOwnerInfo(ownerId) {
  if (cachedUser && ownerId === cachedUser.uid) {
    return {
      id: ownerId, nome: cachedSession?.nome || 'Você', foto: cachedSession?.foto || DEFAULT_FOTO,
      cidade: cachedSession?.cidade || '', estado: cachedSession?.estado || '', avaliacaoMedia: 5, totalAvaliacoes: 0,
    };
  }
  const snap = await getDoc(doc(db, 'users', ownerId));
  if (snap.exists()) {
    const d = snap.data();
    return { id: ownerId, nome: d.nome, foto: d.foto || DEFAULT_FOTO, cidade: d.cidade || '', estado: d.estado || '', avaliacaoMedia: d.avaliacaoMedia ?? 5, totalAvaliacoes: d.totalAvaliacoes ?? 0 };
  }
  return { nome: 'Anunciante', foto: DEFAULT_FOTO, cidade: '', estado: '', avaliacaoMedia: 5, totalAvaliacoes: 0 };
}

// -------- Trocas --------
// O dono avança até "Chegada na agência" (ou os Correios avançam por ele);
// "Finalizada" só o solicitante marca, ao retirar o livro — e aí avalia a troca.
export const TRADE_STATUS = [
  'Solicitação enviada', 'Aceita', 'Postada', 'Em rota',
  'Chegada na agência', 'Finalizada', 'Cancelada'
];
export const STATUS_FINAL = 'Finalizada';
export const STATUS_CHEGADA = 'Chegada na agência';
// Nomes antigos de status que ainda podem existir em trocas já salvas no Firestore.
// "Entregue" era o fim da troca (pontos dados, livros removidos), então vira "Finalizada".
const LEGACY_STATUS = {
  'Em análise': 'Solicitação enviada',
  'Aguardando postagem': 'Postada',
  'Em transporte': 'Em rota',
  'Entregue': 'Finalizada',
};

export async function getTrades() {
  if (!cachedUser) return [];
  const uid = cachedUser.uid;
  const [asRequester, asOwner] = await Promise.all([
    getDocs(query(collection(db, 'trades'), where('requesterId', '==', uid))),
    getDocs(query(collection(db, 'trades'), where('ownerId', '==', uid))),
  ]);
  const map = new Map();
  asRequester.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  asOwner.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  // Trocas antigas ainda podem estar salvas com o nome anterior do status.
  map.forEach(t => { t.status = LEGACY_STATUS[t.status] || t.status; });
  return [...map.values()].sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

export async function createTradeRequest({ bookId, tipo, pontosUsados, livrosOferecidos, mensagem }) {
  const book = await getAnyBookById(bookId);
  const owner = await getOwnerInfo(book?.ownerId);

  const trade = {
    bookId,
    bookTitulo: book?.titulo || 'Livro',
    bookCapa: book?.capa || '',
    requesterId: cachedUser.uid,
    requesterNome: cachedSession?.nome || 'Leitor(a)',
    ownerId: book?.ownerId,
    donoNome: owner?.nome || 'Anunciante',
    tipo, // 'pontos' | 'proposta'
    pontosUsados: pontosUsados || 0,
    livrosOferecidos: livrosOferecidos || [],
    mensagem: mensagem || '',
    status: 'Solicitação enviada',
    criadoEm: new Date().toISOString(),
    prazoPostagem: null,
    rastreio: { codigo: '', transportadora: '', historico: [] },
  };
  const docRef = await addDoc(collection(db, 'trades'), trade);

  if (tipo === 'pontos') {
    await addPoints(-pontosUsados, `solicitação de "${trade.bookTitulo}"`);
  } else {
    await addPoints(-1, 'custo de solicitação de troca');
  }
  await addNotification('Solicitação enviada', `Sua solicitação para "${trade.bookTitulo}" foi enviada ao anunciante.`, 'troca');
  await addNotificationFor(book?.ownerId, 'Nova proposta de troca', `${cachedSession?.nome || 'Alguém'} quer trocar por "${trade.bookTitulo}".`, 'proposta');
  return { id: docRef.id, ...trade };
}

export async function getTradeById(tradeId) {
  const snap = await getDoc(doc(db, 'trades', tradeId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateTrade(tradeId, patch) {
  await updateDoc(doc(db, 'trades', tradeId), patch);
  const snap = await getDoc(doc(db, 'trades', tradeId));
  return { id: snap.id, ...snap.data() };
}

function otherPartyId(trade) {
  return trade.requesterId === cachedUser?.uid ? trade.ownerId : trade.requesterId;
}
export { otherPartyId };

// Avança uma etapa (uso do dono do livro). Para no "Chegada na agência" — a
// finalização é do solicitante, em finalizeTrade().
export async function advanceTradeStatus(tradeId) {
  const snap = await getDoc(doc(db, 'trades', tradeId));
  if (!snap.exists()) return null;
  const trade = { id: snap.id, ...snap.data() };
  trade.status = LEGACY_STATUS[trade.status] || trade.status;
  const idx = TRADE_STATUS.indexOf(trade.status);
  const next = TRADE_STATUS[Math.min(idx + 1, TRADE_STATUS.indexOf(STATUS_CHEGADA))];
  if (next === trade.status) return trade;
  const updated = await updateTrade(tradeId, { status: next });
  await addNotification('Atualização de troca', `"${trade.bookTitulo}" agora está: ${next}`, 'troca');
  const textoOutro = next === STATUS_CHEGADA
    ? `"${trade.bookTitulo}" chegou na agência dos Correios. Retire o livro e finalize a troca.`
    : `"${trade.bookTitulo}" agora está: ${next}`;
  await addNotificationFor(otherPartyId(trade), 'Atualização de troca', textoOutro, 'troca');
  return updated;
}

// O solicitante retirou o livro: encerra a troca (pontos, remoção dos livros
// anunciados, data de finalização usada na limpeza do chat).
export async function finalizeTrade(tradeId) {
  const snap = await getDoc(doc(db, 'trades', tradeId));
  if (!snap.exists()) return null;
  const trade = { id: snap.id, ...snap.data() };
  const updated = await updateTrade(tradeId, { status: STATUS_FINAL, finalizadoEm: serverTimestamp() });
  await addNotification('Troca finalizada', `"${trade.bookTitulo}" foi finalizada. Avalie a troca!`, 'troca');
  await addNotificationFor(otherPartyId(trade), 'Troca finalizada', `${cachedSession?.nome || 'O solicitante'} retirou "${trade.bookTitulo}" e finalizou a troca. Avalie a troca!`, 'troca');
  await addPoints(PONTOS_REGRAS.CONCLUIR_TROCA, 'troca concluída');
  const idsToRemove = [trade.bookId, ...(trade.livrosOferecidos || [])];
  await Promise.all(idsToRemove.map(id => deleteDoc(doc(db, 'books', id)).catch(() => {})));
  return updated;
}

export async function cancelTrade(tradeId, comJustificativa = true) {
  const snap = await getDoc(doc(db, 'trades', tradeId));
  const trade = snap.exists() ? { id: snap.id, ...snap.data() } : null;
  const updated = await updateTrade(tradeId, { status: 'Cancelada' });
  if (!comJustificativa) {
    await addPoints(PONTOS_REGRAS.CANCELAR_SEM_JUSTIFICATIVA, 'troca cancelada sem justificativa');
  }
  await addNotification('Troca cancelada', `A troca de "${updated?.bookTitulo}" foi cancelada.`, 'troca');
  if (trade) await addNotificationFor(otherPartyId(trade), 'Troca cancelada', `A troca de "${updated?.bookTitulo}" foi cancelada.`, 'troca');
  return updated;
}

// -------- Correios: agência de retirada e rastreio --------

// Agência preferida do usuário, reaproveitada nas próximas trocas. Fica em
// users/{uid}/private (só o dono lê) porque guarda telefone e nome completo —
// o documento do perfil é público.
export async function getSavedAgencia() {
  if (!cachedUser) return null;
  const snap = await getDoc(doc(db, 'users', cachedUser.uid, 'private', 'agencia'));
  return snap.exists() ? snap.data() : null;
}

export async function saveAgencia(agencia) {
  if (!cachedUser) return null;
  const data = { ...agencia, salvaEm: new Date().toISOString() };
  await setDoc(doc(db, 'users', cachedUser.uid, 'private', 'agencia'), data);
  return data;
}

// O solicitante escolhe em qual agência dos Correios vai retirar o livro; fica
// gravado na própria troca, então os dois lados veem (o dono posta para lá).
export async function setTradeAgencia(trade, agencia) {
  const agenciaRetirada = { ...agencia, escolhidaPor: cachedUser.uid, escolhidaEm: new Date().toISOString() };
  const updated = await updateTrade(trade.id, { agenciaRetirada });
  await addNotificationFor(
    otherPartyId(trade), 'Agência de retirada escolhida',
    `${cachedSession?.nome || 'O solicitante'} vai retirar "${trade.bookTitulo}" em: ${agencia.nome}.`, 'troca',
  );
  return updated;
}

// Salva código/transportadora sem apagar o que o servidor já gravou (último
// evento, histórico). Quando o dono informa o código de uma troca "Aceita", a
// troca vira "Postada" na hora — o rastreio automático cuida do resto.
export async function saveTradeTracking(trade, { codigo, transportadora }) {
  const codigoAntigo = trade.rastreio?.codigo || '';
  const patch = { 'rastreio.codigo': codigo, 'rastreio.transportadora': transportadora };
  if (codigo && codigo !== codigoAntigo) {
    // Código novo: o evento guardado era do objeto anterior.
    patch['rastreio.ultimoEvento'] = null;
    patch['rastreio.consultadoEm'] = null;
  }
  let updated = await updateTrade(trade.id, patch);
  if (codigo && codigo !== codigoAntigo) {
    await addNotificationFor(otherPartyId(trade), 'Código de rastreio informado', `"${trade.bookTitulo}": ${codigo}`, 'troca');
    if (trade.ownerId === cachedUser?.uid && trade.status === 'Aceita') {
      updated = await advanceTradeStatus(trade.id);
    }
  }
  return updated;
}

// Pede ao servidor para consultar os Correios agora (Cloud Function consultarRastreio).
export async function refreshTradeTracking(tradeId) {
  const consultar = httpsCallable(getFunctions(app, 'us-central1'), 'consultarRastreio');
  const result = await consultar({ tradeId });
  return result.data;
}

// Escuta as mensagens de uma troca em tempo real — callback é chamado de novo
// a cada mensagem nova (própria ou da outra parte), sem precisar recarregar.
// Retorna a função de unsubscribe (chamar ao fechar o chat).
export function subscribeChatMessages(tradeId, callback) {
  const q = query(collection(db, 'trades', tradeId, 'messages'), orderBy('hora'));
  return onSnapshot(q, (qs) => {
    callback(qs.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Envia uma mensagem de chat (autor = usuário atual) e notifica a outra parte da troca.
export async function sendChatMessage(trade, texto) {
  await addDoc(collection(db, 'trades', trade.id, 'messages'), {
    autor: cachedUser.uid, texto, hora: new Date().toISOString(),
  });
  await addNotificationFor(otherPartyId(trade), 'Nova mensagem', `${cachedSession?.nome || 'Alguém'} enviou uma mensagem sobre "${trade.bookTitulo}".`, 'chat');
}

// Trocas finalizadas há mais de 14 dias têm o chat apagado (endereços trocados ali não
// precisam ficar guardados para sempre). O prazo dá tempo de reabrir a conversa em
// caso de problema na entrega antes de o histórico sumir.
const PRAZO_CARENCIA_CHAT_DIAS = 14;
export async function cleanupExpiredMessages(trade) {
  if (trade.status !== STATUS_FINAL || !trade.finalizadoEm) return;
  const finalizadoEmMs = trade.finalizadoEm.toMillis ? trade.finalizadoEm.toMillis() : new Date(trade.finalizadoEm).getTime();
  const diasPassados = (Date.now() - finalizadoEmMs) / 86400000;
  if (diasPassados < PRAZO_CARENCIA_CHAT_DIAS) return;
  const qs = await getDocs(collection(db, 'trades', trade.id, 'messages'));
  await Promise.all(qs.docs.map(d => deleteDoc(d.ref).catch(() => {})));
}

// -------- Avaliações --------
export async function addRating(rating) {
  await addDoc(collection(db, 'ratings'), { ...rating, autorId: cachedUser.uid, criadoEm: new Date().toISOString() });
  await addPoints(PONTOS_REGRAS.AVALIACAO_POSITIVA, 'avaliação positiva recebida');
}

// Avaliações recebidas por um usuário (exibidas no perfil dele / anúncios dele — não do livro específico)
export async function getRatingsForUser(userId) {
  const qs = await getDocs(query(collection(db, 'ratings'), where('avaliadoId', '==', userId)));
  return qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
}

// Calcula a nota de uma avaliação a partir dos critérios numéricos presentes
// (avaliações de quem enviou o livro só têm "cooperacao").
export function ratingScore(rating) {
  const keys = ['conservacao', 'comunicacao', 'rapidez', 'experiencia', 'cooperacao'];
  const values = keys.map(k => rating[k]).filter(v => typeof v === 'number');
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 5;
}

// -------- Notificações --------
export function getNotifications() { return cachedNotifications; }
export async function addNotification(titulo, texto, tipo = 'geral') {
  if (!cachedUser) return;
  await addDoc(collection(db, 'users', cachedUser.uid, 'notifications'), {
    titulo, texto, tipo, lida: false, criadoEm: new Date().toISOString(),
  });
}
// Notifica a outra parte de uma troca (ex.: dono do livro quando chega uma proposta).
export async function addNotificationFor(uid, titulo, texto, tipo = 'geral') {
  if (!uid) return;
  await addDoc(collection(db, 'users', uid, 'notifications'), {
    titulo, texto, tipo, lida: false, criadoEm: new Date().toISOString(),
  });
}
export async function markNotificationsRead() {
  if (!cachedUser) return;
  await Promise.all(
    cachedNotifications.filter(n => !n.lida).map(n => updateDoc(doc(db, 'users', cachedUser.uid, 'notifications', n.id), { lida: true }))
  );
}
export function unreadCount() {
  return cachedNotifications.filter(n => !n.lida).length;
}

// -------- Tema (segue local por dispositivo, não é dado de conta) --------
export function getTheme() {
  return localStorage.getItem('tdl_theme')?.replace(/"/g, '') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
export function setTheme(theme) {
  localStorage.setItem('tdl_theme', theme);
}
