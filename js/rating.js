import { openModal } from './modal.js';
import { addRating, getSession, otherPartyId } from './storage.js';
import { showToast } from './toast.js';

const CRITERIOS_RECEBEDOR = [
  { key: 'conservacao', label: 'Conservação do livro' },
  { key: 'comunicacao', label: 'Comunicação' },
  { key: 'rapidez', label: 'Rapidez na troca' },
  { key: 'experiencia', label: 'Experiência geral' },
];

const CRITERIOS_REMETENTE = [
  { key: 'cooperacao', label: 'Cooperação' },
];

function starsFieldHTML(criterio) {
  return `
    <div class="field">
      <label>${criterio.label}</label>
      <div class="stars-input" data-key="${criterio.key}">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}">★</button>`).join('')}
      </div>
    </div>
  `;
}

export function openRatingModal(trade) {
  const session = getSession();
  const souRemetente = trade.ownerId === session?.id;
  const criterios = souRemetente ? CRITERIOS_REMETENTE : CRITERIOS_RECEBEDOR;
  const avaliadoId = otherPartyId(trade);

  openModal(`
    <div class="modal-header">
      <h3 id="ratingTitle">Avaliar troca — ${trade.bookTitulo}</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    ${souRemetente ? `<p class="text-muted" style="margin-top:-8px;">Avalie sua experiência de trocar com este leitor.</p>` : ''}
    <form id="ratingForm">
      ${criterios.map(c => starsFieldHTML(c)).join('')}
      <div class="field">
        <label for="ratingComment">Comentário</label>
        <textarea class="input" id="ratingComment" rows="3" placeholder="Conte como foi a experiência..."></textarea>
      </div>
      <button type="submit" class="btn btn-primary btn-block btn-lg">Enviar avaliação</button>
    </form>
  `, { labelledBy: 'ratingTitle', onMount: (overlay, close) => {
    const values = {};
    overlay.querySelectorAll('.stars-input').forEach(group => {
      const key = group.dataset.key;
      values[key] = 0;
      group.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = Number(btn.dataset.n);
          values[key] = n;
          group.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.n) <= n));
        });
      });
    });

    overlay.querySelector('#ratingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (Object.values(values).some(v => v === 0)) {
        showToast('Avalie todos os critérios', '', 'error');
        return;
      }
      e.target.querySelector('button[type=submit]').disabled = true;
      await addRating({ tradeId: trade.id, avaliadoId, ...values, comentario: overlay.querySelector('#ratingComment').value.trim() });
      close();
      showToast('Avaliação enviada!', 'Você ganhou +1 ponto.', 'success');
    });
  }});
}
