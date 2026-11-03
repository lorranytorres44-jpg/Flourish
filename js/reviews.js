import { getPublicReviews, saveRating, replyRating, getSession, isLoggedIn } from './storage.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';

// Avaliações de perfil no painel oliva (página do livro e perfil do anunciante).
// Qualquer pessoa logada avalia o perfil de outra uma única vez: nota de 1 a 5
// e comentário. Depois de enviada, a avaliação não é editada. O dono do perfil
// responde cada avaliação uma vez; a resposta aparece embaixo dela.
// A seção da página traz os espaços [data-score] (um ou mais), [data-reviews]
// e [data-avaliar]; renderAvaliacoes preenche e liga o botão.

const ICONE_ESTRELA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" stroke-linejoin="round"/></svg>';
const escapeHTML = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function starsHTML(rating) {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// Média das notas; sem avaliações não há nota.
function averageScore(reviews) {
  return reviews.length ? reviews.reduce((s, r) => s + r.nota, 0) / reviews.length : 0;
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function scoreHTML(reviews) {
  if (!reviews.length) return '<span class="bk-score-vazio">Sem avaliações</span>';
  const media = averageScore(reviews);
  return `<span aria-label="Nota ${formatScore(media)} de 5">${formatScore(media)}</span>
    <span class="bk-stars" aria-hidden="true">${starsHTML(media)}</span>`;
}

function respostaHTML(r, owner, souDono) {
  if (r.resposta) return `
    <div class="bk-review-resposta">
      <strong>Resposta de ${escapeHTML(owner.nome?.split(' ')[0] || 'quem anuncia')}</strong>
      <p>${escapeHTML(r.resposta)}</p>
    </div>`;
  return souDono ? `<button type="button" class="bk-responder" data-responder>Responder</button>` : '';
}

function reviewsHTML(reviews, owner, souDono) {
  if (!reviews.length) return '<p class="bk-review-empty">Este perfil ainda não recebeu avaliações.</p>';
  return reviews.map(r => `
    <article class="bk-review" data-autor="${escapeHTML(r.autorId)}">
      <div class="bk-review-head">
        <a class="bk-review-foto" href="anunciante.html?id=${encodeURIComponent(r.autorId)}" aria-hidden="true" tabindex="-1"><img src="${escapeHTML(r.autor.foto)}" alt=""></a>
        <span class="bk-review-autor">
          <a href="anunciante.html?id=${encodeURIComponent(r.autorId)}"><strong>${escapeHTML(r.autor.nome)}</strong></a>
          <span class="bk-stars" aria-label="Nota ${r.nota} de 5">${starsHTML(r.nota)}</span>
        </span>
      </div>
      ${r.comentario ? `<p class="bk-review-text">${escapeHTML(r.comentario)}</p>` : ''}
      <p class="bk-review-meta">${new Date(r.data).toLocaleDateString('pt-BR')}</p>
      ${respostaHTML(r, owner, souDono)}
    </article>
  `).join('');
}

export async function renderAvaliacoes(section, owner) {
  const reviews = await getPublicReviews(owner.id).catch(() => []);
  const minha = reviews.find(r => r.autorId === getSession()?.id);
  section.querySelectorAll('[data-score]').forEach(el => { el.innerHTML = scoreHTML(reviews); });
  const souDono = owner.id === getSession()?.id;
  const lista = section.querySelector('[data-reviews]');
  lista.innerHTML = reviewsHTML(reviews, owner, souDono);
  if (souDono) ligarRespostas(lista, () => renderAvaliacoes(section, owner));

  const btn = section.querySelector('[data-avaliar]');
  if (!btn) return reviews; // perfil do próprio usuário: só leitura
  // O próprio perfil não se avalia, e quem já avaliou não avalia de novo.
  btn.hidden = owner.id === getSession()?.id || !!minha;
  btn.onclick = () => {
    if (!isLoggedIn()) { showToast('Entre na sua conta', 'Faça login para avaliar.'); return; }
    openRatingModal(owner, () => renderAvaliacoes(section, owner));
  };
  return reviews;
}

// "Responder": troca o botão por um campo de texto com Enviar e Cancelar.
function ligarRespostas(lista, onDone) {
  lista.querySelectorAll('[data-responder]').forEach(btn => btn.addEventListener('click', () => {
    const autorId = btn.closest('.bk-review').dataset.autor;
    const form = document.createElement('form');
    form.className = 'bk-resposta-form';
    form.innerHTML = `
      <textarea maxlength="500" rows="3" placeholder="Escreva sua resposta" aria-label="Sua resposta" required></textarea>
      <div class="bk-resposta-acoes">
        <button type="button" class="bk-resposta-cancelar">Cancelar</button>
        <button type="submit" class="bk-responder">Enviar resposta</button>
      </div>`;
    btn.replaceWith(form);
    const campo = form.querySelector('textarea');
    campo.focus();
    form.querySelector('.bk-resposta-cancelar').addEventListener('click', () => form.replaceWith(btn));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const texto = campo.value.trim();
      if (!texto) { showToast('Escreva uma resposta'); return; }
      const enviar = form.querySelector('[type=submit]');
      enviar.disabled = true;
      try {
        await replyRating(autorId, texto);
        showToast('Resposta enviada!');
        onDone();
      } catch (err) {
        showToast('Não foi possível responder', err.message || 'Tente novamente em instantes.');
        enviar.disabled = false;
      }
    });
  }));
}

function openRatingModal(owner, onDone) {
  openModal(`
    <button type="button" class="avaliacao-fechar" data-modal-close aria-label="Fechar">✕</button>
    <h3 id="ratingTitle" class="avaliacao-titulo">Como você avalia ${escapeHTML(owner.nome.split(' ')[0])}?</h3>
    <form id="ratingForm">
      <div class="avaliacao-estrelas" role="radiogroup" aria-label="Nota">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="false" aria-label="${n} estrela${n > 1 ? 's' : ''}" data-n="${n}">${ICONE_ESTRELA}</button>`).join('')}
      </div>
      <label class="avaliacao-label" for="ratingComment">Deixe um comentário :)</label>
      <textarea class="avaliacao-comentario" id="ratingComment" rows="4" maxlength="500" placeholder="Ex: Combinou tudo certinho pelo WhatsApp"></textarea>
      <button type="submit" class="avaliacao-enviar">Enviar avaliação</button>
    </form>
  `, { labelledBy: 'ratingTitle', className: 'avaliacao-modal', onMount: (overlay, close) => {
    let nota = 0;
    const estrelas = [...overlay.querySelectorAll('.avaliacao-estrelas button')];
    const pintar = (n) => estrelas.forEach(b => b.classList.toggle('cheia', Number(b.dataset.n) <= n));
    const marcar = () => estrelas.forEach(b => b.setAttribute('aria-checked', String(Number(b.dataset.n) === nota)));
    estrelas.forEach(btn => {
      btn.addEventListener('click', () => { nota = Number(btn.dataset.n); marcar(); pintar(nota); });
      btn.addEventListener('mouseenter', () => pintar(Number(btn.dataset.n)));
      btn.addEventListener('mouseleave', () => pintar(nota));
    });

    overlay.querySelector('#ratingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!nota) { showToast('Escolha de 1 a 5 estrelas'); return; }
      const submitBtn = e.target.querySelector('button[type=submit]');
      submitBtn.disabled = true;
      try {
        await saveRating(owner.id, { nota, comentario: overlay.querySelector('#ratingComment').value.trim() });
        close();
        showToast('Avaliação enviada!');
        onDone?.();
      } catch (err) {
        showToast('Não foi possível avaliar', err.message || 'Tente novamente em instantes.');
        submitBtn.disabled = false;
      }
    });
  }});
}
