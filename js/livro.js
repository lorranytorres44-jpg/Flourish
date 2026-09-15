import { getAnyBookById, isFavorite, toggleFavorite, isLoggedIn, getOwnerInfo, getRatingsForUser, ratingScore, getTradeById, authReady } from './storage.js';
import { renderNavbar, renderFooter } from './navbar.js';
import { starsHTML, initRevealAnimations, PIN_ICON } from './book-card.js';
import { bookGeneros } from './data.js';
import { initTheme } from './theme.js';
import { showToast } from './toast.js';
import { openTradeModal } from './trade-modal.js';

initTheme();
await authReady;
renderNavbar('biblioteca.html');
renderFooter();

const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');
const book = await getAnyBookById(bookId);
const root = document.getElementById('bookDetailRoot');

if (!book) {
  root.innerHTML = `
    <div class="empty-state">
      <div class="emoji">📕</div>
      <h3>Livro não encontrado</h3>
      <p>O livro que você procura não existe ou foi removido.</p>
      <a href="biblioteca.html" class="btn btn-primary">Voltar para a biblioteca</a>
    </div>`;
} else {
  const owner = await getOwnerInfo(book.ownerId);
  document.title = `${book.titulo} — Flowrish`;
  const fotos = book.fotos?.length ? book.fotos : [book.capa];

  // Avaliações do perfil do anunciante (não do livro específico)
  const ownerRatings = await getRatingsForUser(book.ownerId);
  const ownerReviews = await Promise.all(ownerRatings.map(async (r) => {
    const trade = r.tradeId ? await getTradeById(r.tradeId) : null;
    return {
      autor: await getOwnerInfo(r.autorId),
      nota: ratingScore(r),
      comentario: r.comentario || '(sem comentário)',
      bookTitulo: trade?.bookTitulo || '',
      data: r.criadoEm,
      tipo: trade?.tipo,
    };
  }));
  const totalAvaliacoes = ownerReviews.length;
  const avaliacaoMedia = totalAvaliacoes ? ownerReviews.reduce((s, r) => s + r.nota, 0) / totalAvaliacoes : 5;

  root.innerHTML = `
    <p class="breadcrumb"><a href="index.html">Início</a> / <a href="biblioteca.html">Biblioteca</a> / ${book.titulo}</p>
    <div class="detail-grid">
      <div>
        <div class="gallery-main"><img id="galleryMain" src="${fotos[0]}" alt="Foto de capa de ${book.titulo}"></div>
        ${fotos.length > 1 ? `<div class="gallery-thumbs">${fotos.map((f, i) => `<img src="${f}" class="${i === 0 ? 'active' : ''}" data-src="${f}" alt="Miniatura ${i + 1}">`).join('')}</div>` : ''}
      </div>
      <div class="detail-actions-sticky">
        <div class="detail-title-row">
          <div>
            <h1 class="mb-0">${book.titulo}</h1>
            <p style="font-size:1.1rem;">${book.autor}</p>
          </div>
        </div>
        <div class="detail-badges">
          ${bookGeneros(book).map(g => `<span class="badge badge-brown">${g}</span>`).join('')}
          <span class="badge badge-terracotta">${book.nacionalidade}</span>
          <span class="badge">${book.estadoConservacao}</span>
          <span class="badge">${PIN_ICON} ${owner.cidade}${owner.estado ? '/' + owner.estado : ''}</span>
        </div>
        <p>${book.sinopse || 'Sem sinopse disponível para este livro.'}</p>
        <ul style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem;color:var(--text-muted);list-style:none;padding-left:0;">
          ${book.editora ? `<li>• Editora: ${book.editora}</li>` : ''}
          ${book.edicao ? `<li>• ${book.edicao}ª edição</li>` : ''}
          ${book.ano ? `<li>• Ano: ${book.ano}</li>` : ''}
          ${book.paginas ? `<li>• Páginas: ${book.paginas}</li>` : ''}
          ${book.semDanificacoes ? `<li>• Sem danificações relevantes</li>` : (book.observacoes ? `<li>• Observações: ${book.observacoes}</li>` : '')}
        </ul>

        <a href="perfil.html" class="card owner-card" style="text-decoration:none;">
          <img src="${owner.foto}" alt="">
          <div>
            <strong>${owner.nome}</strong>
            <p class="mb-0 stars">${starsHTML(avaliacaoMedia)} <span class="text-muted">(${totalAvaliacoes} avaliações)</span></p>
          </div>
        </a>

        <div class="action-buttons">
          <button class="btn btn-secondary" id="favBtn">♥ Favoritar</button>
          <button class="btn btn-highlight" id="requestTradeBtn"><img src="assets/troca.png" alt="" width="18" height="18" style="vertical-align:-3px;margin-right:6px;filter:brightness(0) invert(1);">Solicitar Troca</button>
        </div>

        <div class="detail-tabs-content">
          <div class="tabs" id="detailTabs">
            <button class="active" data-tab="avaliacoes">Avaliações de ${owner.nome}</button>
            <button data-tab="detalhes">Detalhes</button>
          </div>
          <div id="tabAvaliacoes" style="padding-top:20px;">
            <div class="rating-summary">
              <div class="rating-big">
                <div class="num">${avaliacaoMedia.toFixed(1)}</div>
                <div class="stars">${starsHTML(avaliacaoMedia)}</div>
                <p class="text-muted mb-0" style="font-size:0.8rem;">${totalAvaliacoes} avaliações</p>
              </div>
            </div>
            ${totalAvaliacoes === 0
              ? `<p class="text-muted">Este anunciante ainda não recebeu avaliações.</p>`
              : ownerReviews.map(r => `
              <div class="review-item">
                <div class="review-head">
                  <img src="${r.autor.foto}" alt="">
                  <div>
                    <strong style="font-size:0.9rem;">${r.autor.nome}</strong>
                    <div class="stars" style="font-size:0.8rem;">${starsHTML(r.nota)}</div>
                  </div>
                </div>
                <p class="mb-0">${r.comentario}</p>
                <p class="mb-0 text-muted" style="font-size:0.8rem;margin-top:4px;">${[r.bookTitulo, r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '', r.tipo ? (r.tipo === 'pontos' ? 'Troca por pontos' : 'Proposta de troca') : ''].filter(Boolean).join(' · ')}</p>
              </div>
            `).join('')}
          </div>
          <div id="tabDetalhes" style="padding-top:20px;display:none;">
            <p>Cadastrado em: ${new Date(book.dataCadastro).toLocaleDateString('pt-BR')}</p>
            <p>Tempo de uso informado: ${book.tempoUso || 'não informado'}</p>
            <p class="mb-0">O site não se responsabiliza por trocas presenciais.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Galeria
  root.querySelectorAll('.gallery-thumbs img').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.getElementById('galleryMain').src = thumb.dataset.src;
      root.querySelectorAll('.gallery-thumbs img').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  // Tabs
  root.querySelectorAll('#detailTabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('#detailTabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tabAvaliacoes').style.display = btn.dataset.tab === 'avaliacoes' ? 'block' : 'none';
      document.getElementById('tabDetalhes').style.display = btn.dataset.tab === 'detalhes' ? 'block' : 'none';
    });
  });

  // Ações
  function requireLogin() {
    if (!isLoggedIn()) { showToast('Entre na sua conta', 'Faça login para continuar.', 'info'); return false; }
    return true;
  }

  const favBtn = document.getElementById('favBtn');
  const setFavLabel = () => { favBtn.innerHTML = isFavorite(book.id) ? '♥ Favoritado' : '♡ Favoritar'; };
  setFavLabel();
  favBtn.addEventListener('click', async () => {
    if (!requireLogin()) return;
    await toggleFavorite(book.id);
    setFavLabel();
    showToast(isFavorite(book.id) ? 'Adicionado aos favoritos' : 'Removido dos favoritos', '', 'success', 2000);
  });

  document.getElementById('requestTradeBtn').addEventListener('click', () => openTradeModal(book));

  initRevealAnimations();
}
