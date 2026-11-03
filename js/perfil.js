import {
  getSession, updateSession, saveTelefone, isLoggedIn, getMyBooks, getAnyBookById,
  authReady, getFavorites, logout, excluirConta, DEFAULT_FOTO,
} from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { populateEstados } from './auth.js';
import { compressImage } from './image-utils.js';
import { maskTelefone, isValidTelefone } from './validators.js';
import { renderAvaliacoes } from './reviews.js';

// Perfil: cabeçalho com os números do usuário (com a nota) e as abas
// Favoritos, Avaliações recebidas e Configurações (editar perfil e WhatsApp,
// excluir conta, sair).
window.addEventListener('unload', () => {});
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
await authReady;
renderNavbar('perfil.html');
renderFooter();

if (!isLoggedIn()) requireLoginModal();

let session = getSession() || {};

function renderHeader() {
  document.getElementById('pFoto').src = session.foto || DEFAULT_FOTO;
  document.getElementById('pNome').textContent = session.nome || 'Leitor(a)';
  document.getElementById('pLocal').textContent = [session.cidade, session.estado].filter(Boolean).join('/') || 'Cidade/UF';
  document.getElementById('pBio').textContent = session.bio || 'Ainda não escreveu uma biografia.';
}
renderHeader();
document.getElementById('statAnunciados').textContent = (await getMyBooks()).length;

// ---------- Abas ----------
function showTab(tab) {
  const btn = document.querySelector(`#profileTabs button[data-tab="${tab}"]`);
  if (!btn) return;
  document.querySelectorAll('#profileTabs button').forEach(b => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== `panel-${tab}`; });
}
document.querySelectorAll('#profileTabs button').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});
// Links de outras páginas abrem direto numa aba via #hash (ex.: perfil.html#config).
function openTabFromHash() {
  if (!location.hash) return;
  showTab(location.hash.slice(1));
  document.getElementById('profileTabs')?.scrollIntoView({ block: 'start' });
}
openTabFromHash();
window.addEventListener('hashchange', openTabFromHash);

// ---------- Favoritos ----------
const favoritos = (await Promise.all(getFavorites().map(getAnyBookById))).filter(Boolean);
document.getElementById('statFavoritos').textContent = favoritos.length;
await renderBookGrid(document.getElementById('gridFavoritosDash'), favoritos, 'Você ainda não favoritou nenhum livro.');

// ---------- Avaliações recebidas (nota no topo e lista na aba) ----------
if (session.id) await renderAvaliacoes(document.body, session);

// ---------- Configurações: editar perfil ----------
const form = document.getElementById('editForm');
const estadoSelect = document.getElementById('editEstado');
const telefoneInput = document.getElementById('editTelefone');
populateEstados(estadoSelect);
let novaFoto = session.foto === DEFAULT_FOTO ? '' : session.foto; // o bonequinho não vai para o banco
document.getElementById('editAvatarPreview').src = session.foto || DEFAULT_FOTO;
document.getElementById('editNome').value = session.nome || '';
telefoneInput.value = session.telefone || '';
document.getElementById('editCidade').value = session.cidade || '';
estadoSelect.value = session.estado || '';
document.getElementById('editBio').value = session.bio || '';
telefoneInput.addEventListener('input', (e) => { e.target.value = maskTelefone(e.target.value); });

// Conta sem WhatsApp (cadastro pelo Google): abre direto no campo.
if (isLoggedIn() && !session.telefone) {
  showTab('config');
  telefoneInput.focus();
  showToast('Informe seu WhatsApp', 'É por ele que os leitores combinam a troca dos seus livros.');
}

document.getElementById('editarPerfilBtn').addEventListener('click', () => document.getElementById('editNome').focus());
document.getElementById('editFotoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  novaFoto = await compressImage(file, 400, 0.75);
  document.getElementById('editAvatarPreview').src = novaFoto;
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const telefone = telefoneInput.value.trim();
  if (!isValidTelefone(telefone)) {
    showToast('WhatsApp inválido', 'Informe o DDD e o número, como (11) 99999-9999.');
    telefoneInput.focus();
    return;
  }
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    if (telefone !== session.telefone) await saveTelefone(telefone);
    session = await updateSession({
      nome: document.getElementById('editNome').value.trim() || session.nome,
      cidade: document.getElementById('editCidade').value.trim(),
      estado: estadoSelect.value,
      bio: document.getElementById('editBio').value.trim(),
      foto: novaFoto || '',
    });
    showToast('Perfil atualizado!');
    renderHeader();
  } catch {
    showToast('Não foi possível salvar', 'Tente novamente em instantes.');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Configurações: excluir conta e sair ----------
document.getElementById('excluirContaBtn').addEventListener('click', () => {
  openModal(`
    <h3 id="excluirTitle" class="confirmar-titulo">Tem certeza que deseja excluir sua conta?</h3>
    <p class="confirmar-texto">Seus livros saem da Biblioteca e seus dados são apagados.</p>
    <div class="confirmar-acoes">
      <button type="button" class="confirmar-nao" data-modal-close>Não</button>
      <button type="button" class="confirmar-sim" id="confirmExcluirBtn">Sim</button>
    </div>
  `, { labelledBy: 'excluirTitle', className: 'confirmar-modal', onMount: (overlay, close) => {
    const sim = overlay.querySelector('#confirmExcluirBtn');
    sim.addEventListener('click', async () => {
      sim.disabled = true;
      try {
        await excluirConta();
        window.location.href = 'index.html';
      } catch (err) {
        close();
        showToast('Não foi possível excluir', err.message || 'Tente novamente em instantes.');
      }
    });
  }});
});
document.getElementById('logoutBtnDash').addEventListener('click', async () => {
  await logout();
  window.location.href = 'index.html';
});

initRevealAnimations();
