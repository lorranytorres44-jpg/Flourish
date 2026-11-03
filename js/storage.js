// ============================================
// Camada de dados — Firebase Auth + Firestore
// Único ponto de contato com persistência: qualquer troca de provedor
// (ou volta a um backend próprio) deve mexer só neste arquivo.
// ============================================
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification,
  verifyPasswordResetCode, confirmPasswordReset, deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc,
  query, where, onSnapshot, increment, serverTimestamp, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Bonequinho rosa do layout, para quem não tem foto (no banco a foto fica vazia).
export const DEFAULT_FOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#D481A3"/><circle cx="50" cy="31" r="16" fill="#FAD3E2"/><path d="M17 78c4-17 18-27 33-27s29 10 33 27c-8 9-20 14-33 14s-25-5-33-14z" fill="#FAD3E2"/></svg>')}`;

// -------- Estado em cache (preenchido pelo listener de autenticação) --------
let cachedUser = null;
let cachedSession = null;
let cachedFavorites = new Set();

let resolveAuthReady;
export const authReady = new Promise(resolve => { resolveAuthReady = resolve; });
let authReadyResolved = false;

let favoritesUnsub = null;

// O WhatsApp fica em users/{uid}/contato/whatsapp: o perfil é público (aparece
// para visitantes sem login), mas o telefone só é lido por quem está logado.
const contatoRef = (uid) => doc(db, 'users', uid, 'contato', 'whatsapp');

onAuthStateChanged(auth, async (user) => {
  favoritesUnsub?.();
  favoritesUnsub = null;
  cachedUser = user;

  if (!user) {
    cachedSession = null;
    cachedFavorites = new Set();
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
    // O perfil é público: o e-mail fica só no login (Firebase Auth). Contas
    // antigas que ainda têm o campo no perfil têm ele apagado aqui.
    if ('email' in data) updateDoc(ref, { email: deleteField() }).catch(() => {});
    const contato = await getDoc(contatoRef(user.uid)).catch(() => null);
    cachedSession = { id: user.uid, nome: data.nome || 'Leitor(a)', email: user.email || '', foto: data.foto || DEFAULT_FOTO, cidade: data.cidade || '', estado: data.estado || '', bio: data.bio || 'Ainda não escrevi minha biografia.', telefone: contato?.data()?.telefone || '' };

    favoritesUnsub = onSnapshot(collection(db, 'users', user.uid, 'favorites'), (qs) => {
      cachedFavorites = new Set(qs.docs.map(d => d.id));
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
async function createUserDoc(uid, { nome, email, foto, telefone = '' }) {
  const data = {
    nome, foto: foto || '', cidade: '', estado: '',
    bio: 'Ainda não escrevi minha biografia.',
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), data);
  if (telefone) await setDoc(contatoRef(uid), { telefone });
  cachedSession = { id: uid, ...data, email, foto: data.foto || DEFAULT_FOTO, telefone };
}

export async function signUpWithEmail({ nome, email, senha, telefone }) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  await createUserDoc(cred.user.uid, { nome, email, telefone });
  sendEmailVerification(cred.user).catch(() => {}); // não bloqueia o cadastro se falhar
  return cred.user;
}

export async function loginWithEmail({ email, senha }) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

// O Google não informa o telefone: a conta nasce sem WhatsApp e a pessoa
// completa em Configurações (anunciar exige o número).
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

export async function saveTelefone(telefone) {
  if (!cachedUser) return null;
  await setDoc(contatoRef(cachedUser.uid), { telefone });
  cachedSession = { ...cachedSession, telefone };
  return cachedSession;
}

// WhatsApp do anunciante (só para quem está logado; vazio se não tiver).
export async function getOwnerTelefone(ownerId) {
  if (!cachedUser) return '';
  const snap = await getDoc(contatoRef(ownerId));
  return snap.exists() ? snap.data().telefone || '' : '';
}

export async function logout() {
  await signOut(auth);
}

// Exclui a conta: tira os livros anunciados da Biblioteca, apaga os favoritos,
// as avaliações que a pessoa escreveu, o WhatsApp e o perfil, e por fim remove o login. O Firebase só deixa excluir
// o login logo depois de entrar, por isso confere isso antes de mexer em qualquer coisa.
export async function excluirConta() {
  if (!cachedUser) throw new Error('Entre na sua conta para excluí-la.');
  const ultimoLogin = new Date(cachedUser.metadata?.lastSignInTime || 0).getTime();
  if (Date.now() - ultimoLogin > 4 * 60 * 1000) {
    const err = new Error('Por segurança, saia e entre de novo na sua conta antes de excluí-la.');
    err.code = 'precisa-login-recente';
    throw err;
  }
  const uid = cachedUser.uid;
  const [livros, favoritos, avaliacoes] = await Promise.all([
    getDocs(query(collection(db, 'books'), where('ownerId', '==', uid))),
    getDocs(collection(db, 'users', uid, 'favorites')),
    getDocs(query(collection(db, 'ratings'), where('autorId', '==', uid))),
  ]);
  await Promise.all([...livros.docs, ...favoritos.docs, ...avaliacoes.docs].map(d => deleteDoc(d.ref)));
  await deleteDoc(contatoRef(uid));
  await deleteDoc(doc(db, 'users', uid));
  await deleteUser(cachedUser);
}

// -------- Favoritos --------
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
    await setDoc(ref, {});
    cachedFavorites.add(bookId);
    await updateDoc(bookRef, { curtidas: increment(1) }).catch(() => {});
  }
}

// -------- Livros --------
async function getFirestoreBooks() {
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
  const data = {
    ...book, ownerId: cachedUser.uid, curtidas: 0,
    dataCadastro: new Date().toISOString().slice(0, 10),
  };
  const docRef = doc(collection(db, 'books'));
  await setDoc(docRef, data);
  return { id: docRef.id, ...data };
}

// Edição e exclusão de um livro anunciado (tela "Meu acervo"). As regras do
// Firestore só deixam o dono alterar ou apagar o livro.
export async function updateMyBook(bookId, patch) {
  await updateDoc(doc(db, 'books', bookId), patch);
}

export async function deleteMyBook(bookId) {
  await deleteDoc(doc(db, 'books', bookId));
}

export async function getAllBooks() {
  return getFirestoreBooks();
}

// Livros ordenados por curtidas — usado na home.
// Adaptação para dados reais: se houver poucos livros com curtidas, completa
// com os livros mais recentes cadastrados, garantindo que a vitrine nunca fique vazia.
export async function getMostLikedBooks(max = 5) {
  const books = await getFirestoreBooks();
  const liked = books
    .filter(b => (b.curtidas || 0) > 0)
    .sort((a, b) => (b.curtidas || 0) - (a.curtidas || 0));
  if (liked.length >= 3) return liked.slice(0, max);
  const remaining = books
    .filter(b => !liked.some(l => l.id === b.id))
    .sort((a, b) => new Date(b.dataCadastro || 0) - new Date(a.dataCadastro || 0));
  return [...liked, ...remaining].slice(0, max);
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
      cidade: cachedSession?.cidade || '', estado: cachedSession?.estado || '',
    };
  }
  const snap = await getDoc(doc(db, 'users', ownerId));
  if (snap.exists()) {
    const d = snap.data();
    return { id: ownerId, nome: d.nome, foto: d.foto || DEFAULT_FOTO, cidade: d.cidade || '', estado: d.estado || '' };
  }
  return { nome: 'Anunciante', foto: DEFAULT_FOTO, cidade: '', estado: '' };
}

// Livros anunciados por um usuário qualquer (perfil público do anunciante).
export async function getBooksByOwner(ownerId) {
  const qs = await getDocs(query(collection(db, 'books'), where('ownerId', '==', ownerId)));
  return qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));
}

// -------- Avaliações --------
// Qualquer pessoa logada avalia o perfil de outra (não o próprio), com nota de
// 1 a 5 e comentário opcional. O id é "avaliado_autor": cada um avalia um
// perfil uma única vez (as regras não deixam regravar).
const avaliacaoRef = (avaliadoId) => doc(db, 'ratings', `${avaliadoId}_${cachedUser.uid}`);

export async function saveRating(avaliadoId, { nota, comentario }) {
  if (!cachedUser) throw new Error('Entre na sua conta para avaliar.');
  if (avaliadoId === cachedUser.uid) throw new Error('Você não pode avaliar o próprio perfil.');
  await setDoc(avaliacaoRef(avaliadoId), {
    avaliadoId, autorId: cachedUser.uid, nota, comentario, criadoEm: new Date().toISOString(),
  });
}

// O dono do perfil responde uma avaliação recebida, uma vez (as regras só
// deixam ele gravar a resposta, e só se ainda não houver uma).
export async function replyRating(autorId, texto) {
  if (!cachedUser) throw new Error('Entre na sua conta para responder.');
  await updateDoc(doc(db, 'ratings', `${cachedUser.uid}_${autorId}`), {
    resposta: texto, respostaEm: new Date().toISOString(),
  });
}

// Avaliações recebidas por um usuário, prontas para exibir (página do livro e
// perfil do anunciante), da mais recente para a mais antiga.
export async function getPublicReviews(userId) {
  const qs = await getDocs(query(collection(db, 'ratings'), where('avaliadoId', '==', userId)));
  const ratings = qs.docs.map(d => d.data()).sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  return Promise.all(ratings.map(async (r) => ({
    autorId: r.autorId,
    autor: await getOwnerInfo(r.autorId),
    nota: r.nota,
    comentario: r.comentario,
    data: r.criadoEm,
    resposta: r.resposta || '',
    respostaEm: r.respostaEm || '',
  })));
}
