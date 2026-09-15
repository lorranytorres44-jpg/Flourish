import { isFavorite, toggleFavorite, isLoggedIn, getOwnerInfo } from './storage.js';
import { showToast } from './toast.js';
import { bookGeneros } from './data.js';

export function starsHTML(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export const PIN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/><path d="M15.5 5.5a6 6 0 0 1 2.5 5"/><path d="M14.5 2.5a9.5 9.5 0 0 1 4.3 8"/></svg>';

export function bookCardHTML(book, owner, options = {}) {
  const fav = isFavorite(book.id);
  const showDelete = options.showDelete;
  return `
    <article class="card book-card reveal" data-book-id="${book.id}" tabindex="0" role="link" aria-label="Ver detalhes de ${book.titulo}" style="position:relative;">
      <div class="book-cover">
        <img src="${book.capa}" alt="Capa do livro ${book.titulo}" loading="lazy" onerror="this.src='https://placehold.co/300x420/A8CFA8/2F4A2F?text=Sem+capa'">
        ${showDelete ? `
          <button type="button" class="btn-delete-card" data-delete-book="${book.id}" data-book-title="${book.titulo}" title="Excluir livro anunciado" aria-label="Excluir livro anunciado" style="position:absolute;top:8px;left:8px;z-index:4;background:rgba(255,255,255,0.95);border:1px solid var(--danger);color:var(--danger);border-radius:16px;padding:4px 8px;font-size:0.75rem;cursor:pointer;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">
            🗑️ Excluir
          </button>
        ` : `
          <button class="fav-btn ${fav ? 'active' : ''}" data-fav-btn aria-label="Favoritar ${book.titulo}" aria-pressed="${fav}">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.7 1.2 6 3.5C14.3 5.2 15.8 4 18 4c4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z"/></svg>
          </button>
        `}
        <span class="badge condition-tag">${book.estadoConservacao}</span>
      </div>
      <div class="book-info">
        <h3 class="book-title">${book.titulo}</h3>
        <p class="book-author">${book.autor}</p>
        <div class="book-meta">
          ${bookGeneros(book).map(g => `<span class="badge badge-brown">${g}</span>`).join('')}
          <span class="badge badge-terracotta">${book.nacionalidade}</span>
        </div>
        <p class="book-interest">${PIN_ICON} ${owner.cidade || '—'}</p>
        <div class="book-owner-row">
          <img src="${owner.foto}" alt="" loading="lazy">
          <span>${owner.nome}</span>
          <span class="stars">${starsHTML(owner.avaliacaoMedia)}</span>
        </div>
      </div>
    </article>
  `;
}

// Renderiza um grid de livros resolvendo os donos em paralelo (Firestore) antes de montar o HTML.
export async function renderBookGrid(container, books, emptyMsg, options = {}) {
  if (!books.length) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">📚</div><p>${emptyMsg}</p></div>`;
    return;
  }
  const owners = await Promise.all(books.map(b => getOwnerInfo(b.ownerId)));
  container.innerHTML = books.map((b, i) => bookCardHTML(b, owners[i], options)).join('');
  bindBookCardEvents(container, options);
  initRevealAnimations();
}

export function bindBookCardEvents(container, options = {}) {
  container.querySelectorAll('[data-delete-book]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      options?.onDeleteBook?.(btn.dataset.deleteBook, btn.dataset.bookTitle);
    });
  });
  container.querySelectorAll('[data-fav-btn]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!isLoggedIn()) { showToast('Entre na sua conta', 'Faça login para favoritar livros.', 'info'); return; }
      const card = btn.closest('.book-card');
      const bookId = card.dataset.bookId;
      await toggleFavorite(bookId);
      const active = isFavorite(bookId);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.querySelector('svg').setAttribute('fill', active ? 'currentColor' : 'none');
      showToast(active ? 'Adicionado aos favoritos' : 'Removido dos favoritos', '', 'success', 2000);
    });
  });
  container.querySelectorAll('.book-card').forEach(card => {
    const go = () => window.location.href = `livro.html?id=${card.dataset.bookId}`;
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

export function initRevealAnimations() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => io.observe(el));
}
