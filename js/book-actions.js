import { deleteMyBook } from './storage.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

// Editar (lápis) e excluir (lixeira) um livro do próprio acervo — usados nos
// cards do "Meu acervo" e na página do livro aberta pelo dono.
export const EDIT_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
export const TRASH_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg>';

// Lixeira cheia (página do livro): lata preenchida com frisos vazados.
export const TRASH_FILLED_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 2h6l1 2h4a1 1 0 010 2H4a1 1 0 010-2h4l1-2z"/><path fill-rule="evenodd" d="M5 8h14l-1.2 12.2A2 2 0 0115.8 22H8.2a2 2 0 01-2-1.8L5 8zm4 3a.9.9 0 00-.9.9v6.2a.9.9 0 001.8 0v-6.2A.9.9 0 009 11zm3 0a.9.9 0 00-.9.9v6.2a.9.9 0 001.8 0v-6.2A.9.9 0 0012 11zm3 0a.9.9 0 00-.9.9v6.2a.9.9 0 001.8 0v-6.2A.9.9 0 0015 11z"/></svg>';

export const editarLivroUrl = (book) => `cadastrar-livro.html?editar=${book.id}`;

// Pede confirmação e exclui (por exemplo, depois de trocar o livro).
export function confirmarExclusaoLivro(book, { onDeleted } = {}) {
  openModal(`
    <h3 id="excluirTitle" class="confirmar-titulo">Tem certeza que deseja excluir esse livro? A ação não poderá ser desfeita.</h3>
    <div class="confirmar-acoes">
      <button type="button" class="confirmar-nao" data-modal-close>Não</button>
      <button type="button" class="confirmar-sim" id="confirmarExcluir">Sim</button>
    </div>
  `, { labelledBy: 'excluirTitle', className: 'confirmar-modal', onMount: (overlay, close) => {
    const btn = overlay.querySelector('#confirmarExcluir');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await deleteMyBook(book.id);
        close();
        showToast('Livro excluído', `"${book.titulo}" saiu do seu acervo.`);
        onDeleted?.();
      } catch {
        showToast('Não foi possível excluir', 'Tente de novo em instantes.');
        btn.disabled = false;
      }
    });
  }});
}
