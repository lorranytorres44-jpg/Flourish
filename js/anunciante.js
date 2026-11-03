import { getOwnerInfo, getBooksByOwner, authReady } from './storage.js';
import { renderNavbar, renderFooter } from './navbar.js';
import { renderBookGrid } from './book-card.js';
import { renderAvaliacoes } from './reviews.js';

await authReady;
renderNavbar('biblioteca.html');
renderFooter();

// Perfil público: só nome, foto, cidade/estado, livros anunciados e
// avaliações. Bio, e-mail, WhatsApp e gêneros favoritos não aparecem.
const sellerId = new URLSearchParams(window.location.search).get('id');
const root = document.getElementById('sellerRoot');
const owner = sellerId ? await getOwnerInfo(sellerId) : null;

if (!owner?.id) {
  root.innerHTML = `
    <div class="empty-state bk-empty">
      <h1>Anunciante não encontrado</h1>
      <p>Este perfil não existe ou foi removido.</p>
      <a href="biblioteca.html" class="bk-action">Voltar para a biblioteca</a>
    </div>`;
} else {
  const books = await getBooksByOwner(sellerId);
  const localizacao = [owner.cidade, owner.estado].filter(Boolean).join('/');
  document.title = `${owner.nome} — Flowrish`;

  root.innerHTML = `
    <header class="sl-header">
      <img class="sl-avatar" src="${owner.foto}" alt="Foto de ${owner.nome}">
      <div>
        <h1 class="sl-name">${owner.nome}</h1>
        ${localizacao ? `<p class="sl-location">${localizacao}</p>` : ''}
        <ul class="sl-stats">
          <li><strong>${books.length}</strong> ${books.length === 1 ? 'livro anunciado' : 'livros anunciados'}</li>
          <li class="sl-score" data-score></li>
        </ul>
      </div>
    </header>

    <section class="sl-books" aria-labelledby="booksTitle">
      <h2 class="sl-section-title" id="booksTitle">Livros anunciados</h2>
      <div class="sl-grid hv-cards" id="sellerBooks"></div>
    </section>

    <section class="bk-owner sl-reviews" aria-labelledby="reviewsTitle">
      <div class="bk-owner-subrow">
        <h2 class="bk-owner-sub" id="reviewsTitle">Avaliações <span class="bk-owner-score" data-score></span></h2>
        <button type="button" class="bk-avaliar" data-avaliar hidden>Avaliar</button>
      </div>
      <div data-reviews></div>
    </section>
  `;

  // A nota aparece no topo (números do perfil) e no título das avaliações.
  await Promise.all([
    renderBookGrid(document.getElementById('sellerBooks'), books, `${owner.nome} não tem livros anunciados no momento.`),
    renderAvaliacoes(root, owner),
  ]);
}
