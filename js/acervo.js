import { GENEROS, ESTADOS_CONSERVACAO } from './data.js';
import { getSession, getMyBooks, authReady } from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { PIN_ICON, initRevealAnimations } from './book-card.js';
import { EDIT_ICON, TRASH_ICON, editarLivroUrl, confirmarExclusaoLivro } from './book-actions.js';

// "Meu acervo": os livros que o usuário anunciou, com os filtros da Biblioteca.
// O lápis abre o formulário de anúncio já preenchido (cadastrar-livro.html?editar=id),
// a lixeira exclui o livro e o card abre a página do livro na versão do dono
// (sem curtir nem trocar, com editar e excluir).
await authReady;
renderNavbar('acervo.html');
renderFooter();

const session = getSession();
if (!session) requireLoginModal();

const books = session ? await getMyBooks() : [];
books.sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));

const state = { nome: '', genero: null, conservacao: null, origem: null };

// Chips de filtro: clicar de novo no chip ativo desmarca.
function renderChips(container, values, stateKey) {
  container.innerHTML = values.map(v => `<button type="button" class="filter-chip" data-value="${v}">${v}</button>`).join('');
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const isActive = state[stateKey] === chip.dataset.value;
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      state[stateKey] = isActive ? null : chip.dataset.value;
      if (!isActive) chip.classList.add('active');
      render();
    });
  });
}
renderChips(document.getElementById('fGenero'), GENEROS, 'genero');
renderChips(document.getElementById('fConservacao'), ESTADOS_CONSERVACAO, 'conservacao');
renderChips(document.getElementById('fOrigem'), ['Internacional', 'Nacional'], 'origem');

document.getElementById('fNome').addEventListener('input', (e) => { state.nome = e.target.value; render(); });
document.getElementById('clearFilters').addEventListener('click', () => {
  Object.assign(state, { nome: '', genero: null, conservacao: null, origem: null });
  document.getElementById('fNome').value = '';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  render();
});
const filtersBtn = document.getElementById('toggleFilters');
const filtersPanel = document.getElementById('filtersPanel');
filtersBtn.addEventListener('click', () => {
  const open = filtersPanel.hidden;
  filtersPanel.hidden = !open;
  filtersBtn.setAttribute('aria-expanded', String(open));
  filtersBtn.setAttribute('aria-label', open ? 'Ocultar filtros' : 'Mostrar filtros');
});

function acervoCardHTML(book) {
  return `
    <article class="card book-card acervo-card reveal" data-book-id="${book.id}" tabindex="0" role="link" aria-label="Ver ${book.titulo}">
      <div class="book-cover">
        <img src="${book.capa}" alt="Capa do livro ${book.titulo}" loading="lazy" onerror="this.src='https://placehold.co/300x420/A8CFA8/2F4A2F?text=Sem+capa'">
        <span class="badge condition-tag">${book.estadoConservacao}</span>
      </div>
      <div class="book-info">
        <h3 class="book-title">${book.titulo}</h3>
        <p class="book-author">${book.autor}</p>
        <div class="book-meta">
          ${book.generos.map(g => `<span class="badge badge-brown">${g}</span>`).join('')}
        </div>
        <p class="book-interest">${PIN_ICON} ${session.estado || '—'}</p>
        <div class="acervo-actions">
          <a class="acervo-btn" href="${editarLivroUrl(book)}" data-edit aria-label="Editar ${book.titulo}">${EDIT_ICON}</a>
          <button type="button" class="acervo-btn acervo-btn-delete" data-delete aria-label="Excluir ${book.titulo}">${TRASH_ICON}</button>
        </div>
      </div>
    </article>
  `;
}

function render() {
  let lista = books;
  if (state.nome) {
    const q = state.nome.toLowerCase();
    lista = lista.filter(b => b.titulo.toLowerCase().includes(q) || b.autor.toLowerCase().includes(q));
  }
  if (state.genero) lista = lista.filter(b => b.generos.includes(state.genero));
  if (state.conservacao) lista = lista.filter(b => b.estadoConservacao === state.conservacao);
  if (state.origem) lista = lista.filter(b => b.nacionalidade === state.origem);

  const grid = document.getElementById('bookGrid');
  const empty = document.getElementById('emptyState');
  const filtrando = lista.length !== books.length || state.nome;
  document.getElementById('resultsCount').textContent = books.length
    ? `${lista.length} livro${lista.length === 1 ? '' : 's'} no acervo${filtrando ? ` (de ${books.length})` : ''}`
    : '';

  // Sem nenhum livro anunciado, a mensagem do acervo vazio substitui o "nenhum encontrado".
  const vazio = books.length === 0;
  document.getElementById('acervoVazio').hidden = !vazio;
  empty.hidden = vazio || lista.length > 0;

  grid.innerHTML = lista.map(acervoCardHTML).join('');
  grid.querySelectorAll('.acervo-card').forEach(card => {
    const book = books.find(b => b.id === card.dataset.bookId);
    const go = () => { window.location.href = `livro.html?id=${book.id}`; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === card) go(); });
    card.querySelector('[data-edit]').addEventListener('click', (e) => e.stopPropagation());
    card.querySelector('[data-delete]').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmarExclusaoLivro(book, {
        onDeleted: () => { books.splice(books.indexOf(book), 1); render(); },
      });
    });
  });
  initRevealAnimations();
}

render();
