import { GENEROS, ESTADOS_CONSERVACAO, bookGeneros } from './data.js';
import { getAllBooks, getOwnerInfo, authReady } from './storage.js';
import { renderNavbar, renderFooter } from './navbar.js';
import { ESTADOS_BR, NOMES_ESTADOS } from './auth.js';
import { bookCardHTML, bindBookCardEvents, initRevealAnimations } from './book-card.js';
import { initTheme } from './theme.js';

initTheme();
await authReady;
renderNavbar('biblioteca.html');
renderFooter();

// Carrega os livros e resolve os donos uma única vez; os filtros depois operam em memória.
const allBooks = await getAllBooks();
const ownerIds = [...new Set(allBooks.map(b => b.ownerId))];
const ownerEntries = await Promise.all(ownerIds.map(async (id) => [id, await getOwnerInfo(id)]));
const ownerMap = new Map(ownerEntries);

const params = new URLSearchParams(window.location.search);

const state = {
  nome: params.get('busca') || '',
  genero: null,
  conservacao: null,
  origem: null,
  estado: '',
  ordenacao: 'recentes',
};

if (state.nome) document.getElementById('fNome').value = state.nome;

// Renderiza chips de filtro
function renderChips(container, values, stateKey) {
  container.innerHTML += values.map(v => `<button class="filter-chip" data-value="${v}">${v}</button>`).join('');
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const value = chip.dataset.value;
      const isActive = state[stateKey] === value;
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      state[stateKey] = isActive ? null : value;
      if (!isActive) chip.classList.add('active');
      applyFilters();
    });
  });
}
renderChips(document.getElementById('fGenero'), GENEROS, 'genero');
renderChips(document.getElementById('fConservacao'), ESTADOS_CONSERVACAO, 'conservacao');

document.querySelectorAll('#fOrigem .filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const value = chip.dataset.value;
    const isActive = state.origem === value;
    document.querySelectorAll('#fOrigem .filter-chip').forEach(c => c.classList.remove('active'));
    state.origem = isActive ? null : value;
    if (!isActive) chip.classList.add('active');
    applyFilters();
  });
});

const estadoSelect = document.getElementById('fEstado');
ESTADOS_BR.forEach(uf => {
  const opt = document.createElement('option');
  opt.value = uf; opt.textContent = NOMES_ESTADOS[uf];
  estadoSelect.appendChild(opt);
});

document.getElementById('fNome').addEventListener('input', (e) => { state.nome = e.target.value; applyFilters(); });
estadoSelect.addEventListener('change', (e) => { state.estado = e.target.value; applyFilters(); });
document.getElementById('ordenacao').addEventListener('change', (e) => { state.ordenacao = e.target.value; applyFilters(); });
document.getElementById('clearFilters').addEventListener('click', () => {
  state.nome = ''; state.genero = null; state.conservacao = null; state.origem = null; state.estado = '';
  document.getElementById('fNome').value = '';
  estadoSelect.value = '';
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  applyFilters();
});
document.getElementById('toggleFiltersMobile')?.addEventListener('click', () => {
  document.getElementById('filtersPanel').classList.toggle('is-open-mobile');
  document.getElementById('filtersPanel').style.display =
    document.getElementById('filtersPanel').style.display === 'block' ? '' : 'block';
});

function applyFilters() {
  let books = allBooks;

  if (state.nome) {
    const q = state.nome.toLowerCase();
    books = books.filter(b => b.titulo.toLowerCase().includes(q) || b.autor.toLowerCase().includes(q));
  }
  if (state.genero) books = books.filter(b => bookGeneros(b).includes(state.genero));
  if (state.conservacao) books = books.filter(b => b.estadoConservacao === state.conservacao);
  if (state.origem) books = books.filter(b => b.nacionalidade === state.origem);
  if (state.estado) books = books.filter(b => ownerMap.get(b.ownerId)?.estado === state.estado);

  if (state.ordenacao === 'recentes') books.sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro));
  if (state.ordenacao === 'populares') books.sort((a, b) => (b.curtidas || 0) - (a.curtidas || 0));
  if (state.ordenacao === 'az') books.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  if (state.ordenacao === 'az-autor') books.sort((a, b) => a.autor.localeCompare(b.autor, 'pt-BR'));

  const grid = document.getElementById('bookGrid');
  const empty = document.getElementById('emptyState');
  document.getElementById('resultsCount').textContent = `${books.length} livro${books.length === 1 ? '' : 's'} encontrado${books.length === 1 ? '' : 's'}`;

  if (books.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = books.map(b => bookCardHTML(b, ownerMap.get(b.ownerId))).join('');
    bindBookCardEvents(grid);
    initRevealAnimations();
  }
}

applyFilters();
