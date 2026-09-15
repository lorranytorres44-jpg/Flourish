import { GENEROS } from './data.js';
import {
  getSession, updateSession, isLoggedIn, getPoints, getMyBooks, getTrades,
  getFavorites, getAnyBookById, getRatingsForUser, ratingScore, authReady,
  deleteBook, deleteAccount,
} from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { initTheme } from './theme.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { populateEstados } from './auth.js';
import { compressImage } from './image-utils.js';

initTheme();
window.addEventListener('unload', () => {});
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
await authReady;
renderNavbar();
renderFooter();

if (!isLoggedIn()) {
  requireLoginModal('Faça login para ver seu perfil.');
}

let session = getSession() || {};
const trades = await getTrades();
const concluidas = trades.filter(t => t.status === 'Finalizada').length;
const minhasAvaliacoes = await getRatingsForUser(session.id);
const notaMedia = minhasAvaliacoes.length
  ? minhasAvaliacoes.reduce((s, r) => s + ratingScore(r), 0) / minhasAvaliacoes.length
  : 5;

function renderHeader() {
  document.getElementById('pFoto').src = session.foto || 'assets/default-avatar.svg';
  document.getElementById('pNome').textContent = session.nome || 'Leitor(a)';
  document.getElementById('pLocal').textContent = [session.cidade, session.estado].filter(Boolean).join(' / ') || 'Localização não informada';
  document.getElementById('pBio').textContent = session.bio || 'Ainda não escreveu uma biografia.';
  document.getElementById('statPontos').textContent = getPoints() ?? 0;
  document.getElementById('statAvaliacao').textContent = `${notaMedia.toFixed(1)}★`;
  document.getElementById('statTrocas').textContent = concluidas;
}
renderHeader();

// Tabs
function showTab(tab) {
  const btn = document.querySelector(`#profileTabs button[data-tab="${tab}"]`);
  if (!btn) return;
  document.querySelectorAll('#profileTabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`panel-${tab}`).style.display = 'block';
}
document.querySelectorAll('#profileTabs button').forEach(btn => {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
});
// Links externos podem abrir direto numa aba via #hash (ex: perfil.html#favoritos).
if (location.hash) {
  showTab(location.hash.slice(1));
  document.getElementById('profileTabs')?.scrollIntoView({ block: 'start' });
}

async function refreshMyBooks() {
  const books = await getMyBooks();
  document.getElementById('statAnunciados').textContent = books.length;
  await renderBookGrid(document.getElementById('gridAnunciados'), books, 'Você ainda não anunciou nenhum livro.', {
    showDelete: true,
    onDeleteBook: (bookId, bookTitle) => {
      openModal(`
        <div class="modal-header">
          <h3 id="delBookTitle">Excluir livro anunciado</h3>
          <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
        </div>
        <p>Tem certeza que deseja excluir o anúncio de <strong>"${bookTitle || 'este livro'}"</strong>?</p>
        <p class="text-muted" style="font-size:0.85rem;">Ele será removido imediatamente da biblioteca.</p>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button type="button" class="btn btn-secondary btn-block" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary btn-block" id="btnConfirmDelBook" style="background:var(--danger);border-color:var(--danger);">Sim, excluir livro</button>
        </div>
      `, {
        labelledBy: 'delBookTitle',
        onMount: (overlay, close) => {
          overlay.querySelector('#btnConfirmDelBook').addEventListener('click', async (e) => {
            e.target.disabled = true;
            try {
              await deleteBook(bookId);
              close();
              showToast('Livro excluído', 'O anúncio foi removido com sucesso.', 'success');
              await refreshMyBooks();
            } catch (err) {
              showToast('Erro ao excluir', err.message || '', 'error');
              e.target.disabled = false;
            }
          });
        }
      });
    }
  });
}

await refreshMyBooks();
window.addEventListener('tdl:book-deleted', refreshMyBooks);

const favBooks = (await Promise.all(getFavorites().map(getAnyBookById))).filter(Boolean);
await renderBookGrid(document.getElementById('gridFavoritos'), favBooks, 'Você ainda não favoritou nenhum livro.');

function renderGenreList() {
  document.getElementById('genreList').innerHTML = GENEROS.map(g => {
    const active = (session.generosFavoritos || []).includes(g);
    return `<span class="genre-chip ${active ? 'active' : ''}">${g}</span>`;
  }).join('');
}
renderGenreList();

const listHistorico = document.getElementById('listHistorico');
if (trades.length === 0) {
  listHistorico.innerHTML = `<div class="empty-state"><div class="emoji">🔄</div><p>Nenhuma troca no histórico ainda.</p></div>`;
} else {
  listHistorico.innerHTML = trades.map(t => `
    <div class="card" style="display:flex;gap:16px;align-items:center;padding:16px;margin-bottom:12px;">
      <img src="${t.bookCapa}" alt="" style="width:50px;aspect-ratio:3/4;object-fit:cover;border-radius:6px;">
      <div style="flex:1;">
        <strong>${t.bookTitulo}</strong>
        <p class="mb-0 text-muted" style="font-size:0.85rem;">${new Date(t.criadoEm).toLocaleDateString('pt-BR')} · ${t.tipo === 'pontos' ? 'Troca por pontos' : 'Proposta de troca'}</p>
      </div>
      <span class="badge badge-brown">${t.status}</span>
    </div>
  `).join('');
}

// Editar perfil
document.getElementById('editProfileBtn').addEventListener('click', () => {
  openModal(`
    <div class="modal-header">
      <h3 id="editTitle">Editar perfil</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <form id="editForm">
      <div class="avatar-upload">
        <img id="editAvatarPreview" src="${session.foto || 'assets/default-avatar.svg'}" alt="">
        <div>
          <label class="btn btn-secondary btn-sm" for="editFotoInput" style="cursor:pointer;">Alterar foto</label>
          <input type="file" id="editFotoInput" accept="image/*" class="visually-hidden">
        </div>
      </div>
      <div class="field"><label for="editNome">Nome</label><input class="input" id="editNome" value="${session.nome || ''}"></div>
      <div class="row-2">
        <div class="field"><label for="editCidade">Cidade</label><input class="input" id="editCidade" value="${session.cidade || ''}"></div>
        <div class="field"><label for="editEstado">Estado</label><select class="input" id="editEstado"></select></div>
      </div>
      <div class="field"><label for="editBio">Biografia</label><textarea class="input" id="editBio" rows="3">${session.bio || ''}</textarea></div>
      <div class="field">
        <label>Gêneros favoritos</label>
        <div id="editGenres" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
      </div>
      <button type="submit" class="btn btn-primary btn-block btn-lg">Salvar alterações</button>
    </form>
  `, { labelledBy: 'editTitle', onMount: (overlay, close) => {
    const estadoSelect = overlay.querySelector('#editEstado');
    populateEstados(estadoSelect);
    estadoSelect.value = session.estado || '';

    const selected = new Set(session.generosFavoritos || []);
    const genresEl = overlay.querySelector('#editGenres');
    genresEl.innerHTML = GENEROS.map(g => `<button type="button" class="genre-chip ${selected.has(g) ? 'active' : ''}" data-g="${g}">${g}</button>`).join('');
    genresEl.querySelectorAll('.genre-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const g = chip.dataset.g;
        if (selected.has(g)) { selected.delete(g); chip.classList.remove('active'); }
        else { selected.add(g); chip.classList.add('active'); }
      });
    });

    let novaFoto = session.foto;
    overlay.querySelector('#editFotoInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      novaFoto = await compressImage(file, 400, 0.75);
      overlay.querySelector('#editAvatarPreview').src = novaFoto;
    });

    overlay.querySelector('#editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      const cidade = overlay.querySelector('#editCidade').value.trim();
      const estado = estadoSelect.value;
      session = await updateSession({
        nome: overlay.querySelector('#editNome').value.trim() || session.nome,
        cidade,
        estado,
        bio: overlay.querySelector('#editBio').value.trim(),
        generosFavoritos: [...selected],
        foto: novaFoto,
      });
      close();
      showToast('Perfil atualizado!', '', 'success');
      renderHeader();
      renderGenreList();
    });
  }});
// Exclusão de conta
document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  openModal(`
    <div class="modal-header">
      <h3 id="delAccountTitle" style="color:var(--danger);">Excluir conta</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <p><strong>Atenção: esta ação é definitiva e irreversível!</strong></p>
    <p>Ao excluir sua conta, seus dados de perfil, livros anunciados e histórico serão permanentemente removidos.</p>
    <div class="field" style="margin-top:16px;">
      <label for="confirmDeleteWord">Para confirmar, digite <strong>EXCLUIR</strong> abaixo:</label>
      <input class="input" id="confirmDeleteWord" placeholder="EXCLUIR" autocomplete="off">
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button type="button" class="btn btn-secondary btn-block" data-modal-close>Cancelar</button>
      <button type="button" class="btn btn-primary btn-block" id="btnConfirmDelAccount" style="background:var(--danger);border-color:var(--danger);">Excluir definitivamente</button>
    </div>
  `, {
    labelledBy: 'delAccountTitle',
    onMount: (overlay, close) => {
      overlay.querySelector('#btnConfirmDelAccount').addEventListener('click', async (e) => {
        const val = overlay.querySelector('#confirmDeleteWord').value.trim();
        if (val !== 'EXCLUIR') {
          showToast('Confirmação incorreta', 'Digite a palavra EXCLUIR para confirmar.', 'error');
          return;
        }
        e.target.disabled = true;
        try {
          await deleteAccount();
          close();
          showToast('Conta excluída', 'Sua conta e dados foram removidos.', 'info');
          setTimeout(() => window.location.href = 'index.html', 800);
        } catch (err) {
          showToast('Não foi possível excluir', err.message || 'Faça login novamente para validar a exclusão.', 'error');
          e.target.disabled = false;
        }
      });
    }
  });
});

initRevealAnimations();
