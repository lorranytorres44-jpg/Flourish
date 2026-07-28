import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { getPoints, getMyBooks, createTradeRequest, isLoggedIn } from './storage.js';

const CUSTO_TROCA_PONTOS = 3;

export async function openTradeModal(book) {
  if (!isLoggedIn()) {
    showToast('Entre na sua conta', 'Faça login para solicitar uma troca.', 'info');
    return;
  }
  const points = getPoints() ?? 0;
  const myBooks = await getMyBooks();

  openModal(`
    <div class="modal-header">
      <h3 id="tradeModalTitle">Solicitar troca — ${book.titulo}</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <div id="tradeOptionPontos" class="trade-option">
      <h4 style="display:flex;align-items:center;gap:12px;"><span style="font-size:1.3em;">★</span> Usar pontos</h4>
      <p class="mb-0">Solicite este livro utilizando seus pontos acumulados.</p>
      <p style="margin:10px 0 0;font-weight:700;">Necessário: ${CUSTO_TROCA_PONTOS} pontos${points < CUSTO_TROCA_PONTOS ? ` · Você tem: ${points} pontos` : ''}</p>
    </div>
    <div id="tradeOptionProposta" class="trade-option">
      <h4 style="display:flex;align-items:center;gap:8px;"><img src="assets/pilha-livros.png" alt="" width="22" height="22"> Propor troca de livros</h4>
      <p class="mb-0">Ofereça um ou mais livros do seu acervo em troca deste.</p>
      <p style="margin:10px 0 0;font-weight:700;">Necessário: 1 ponto${points < 1 ? ` · Você tem: ${points} pontos` : ''}</p>
    </div>
    <div id="tradeFormArea"></div>
  `, { labelledBy: 'tradeModalTitle', onMount: (overlay, close) => {
    const pontosBtn = overlay.querySelector('#tradeOptionPontos');
    const propostaBtn = overlay.querySelector('#tradeOptionProposta');
    const formArea = overlay.querySelector('#tradeFormArea');

    pontosBtn.addEventListener('click', () => {
      pontosBtn.classList.add('selected');
      propostaBtn.classList.remove('selected');
      const disabled = points < CUSTO_TROCA_PONTOS;
      formArea.innerHTML = `
        ${disabled ? `<p style="color:var(--danger);font-weight:600;">Você não tem pontos suficientes para esta solicitação.</p>` : ''}
        <button class="btn btn-primary btn-block btn-lg" id="confirmPontos" ${disabled ? 'disabled' : ''}>Confirmar solicitação com pontos</button>
      `;
      overlay.querySelector('#confirmPontos')?.addEventListener('click', async (e) => {
        e.target.disabled = true;
        await createTradeRequest({ bookId: book.id, tipo: 'pontos', pontosUsados: CUSTO_TROCA_PONTOS });
        close();
        showToast('Solicitação enviada!', `Você usou ${CUSTO_TROCA_PONTOS} pontos.`, 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      });
    });

    propostaBtn.addEventListener('click', () => {
      propostaBtn.classList.add('selected');
      pontosBtn.classList.remove('selected');
      if (myBooks.length === 0) {
        formArea.innerHTML = `<p class="text-muted">Você ainda não anunciou nenhum livro. <a href="cadastrar-livro.html">Anuncie um livro</a> para poder propor trocas.</p>`;
        return;
      }
      if (points < 1) {
        formArea.innerHTML = `<p style="color:var(--danger);font-weight:600;">Você não tem pontos suficientes para solicitar uma troca (custo de 1 ponto).</p>`;
        return;
      }
      formArea.innerHTML = `
        <p style="font-weight:600;margin-top:16px;">Selecione o(s) livro(s) que deseja oferecer:</p>
        <div class="my-books-select">
          ${myBooks.map(b => `
            <div class="my-book-pick" data-id="${b.id}">
              <img src="${b.capa}" alt="${b.titulo}">
              ${b.titulo}
            </div>
          `).join('')}
        </div>
        <div class="field">
          <label for="tradeMessage">Mensagem (opcional)</label>
          <textarea class="input" id="tradeMessage" rows="3" placeholder="Diga algo ao anunciante..."></textarea>
        </div>
        <button class="btn btn-primary btn-block btn-lg" id="confirmProposta">Enviar proposta</button>
      `;
      const selected = new Set();
      formArea.querySelectorAll('.my-book-pick').forEach(pick => {
        pick.addEventListener('click', () => {
          const id = pick.dataset.id;
          if (selected.has(id)) { selected.delete(id); pick.classList.remove('selected'); }
          else { selected.add(id); pick.classList.add('selected'); }
        });
      });
      overlay.querySelector('#confirmProposta').addEventListener('click', async (e) => {
        if (selected.size === 0) { showToast('Selecione ao menos um livro', '', 'error'); return; }
        e.target.disabled = true;
        const mensagem = overlay.querySelector('#tradeMessage').value.trim();
        await createTradeRequest({ bookId: book.id, tipo: 'proposta', livrosOferecidos: [...selected], mensagem });
        close();
        showToast('Proposta enviada!', 'O anunciante irá analisar sua proposta.', 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      });
    });
  }});
}
