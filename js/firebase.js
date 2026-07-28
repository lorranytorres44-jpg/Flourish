// Inicialização central do Firebase — único ponto de contato com o SDK.
// Usa o SDK modular via CDN (sem bundler/Node), compatível com <script type="module">.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, setPersistence, browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Mantém a sessão ativa entre recarregamentos/fechamentos do navegador.
await setPersistence(auth, browserLocalPersistence);
