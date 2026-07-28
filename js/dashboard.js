import {
  getSession, isLoggedIn, logout, getPoints, getMyBooks, getTrades,
  getAnyBookById, getOwnerInfo, getAllBooks, TRADE_STATUS, advanceTradeStatus, cancelTrade, updateTrade,
  cleanupExpiredMessages,
  sendChatMessage, subscribeChatMessages, getNotifications, getFavorites, getReadList,
  authReady, getTheme, setTheme,
} from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { initTheme } from './theme.js';
import { showToast } from './toast.js';
import { openRatingModal } from './rating.js';
import { openModal } from './modal.js';
import { bookGeneros } from './data.js';

initTheme();
// O servidor já envia Cache-Control: no-store para impedir o bfcache; isto aqui é
// um reforço para o caso de a página ser servida por algo que ignore o header —
// se ainda assim for restaurada do cache, recarrega antes que o usuário perceba.
window.addEventListener('unload', () => {});
window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
await authReady;
renderNavbar('dashboard.html');
renderFooter();

if (!isLoggedIn()) {
  requireLoginModal('Faça login para acessar sua área.');
}

const session = getSession() || {};
document.getElementById('userFirstName').textContent = (session.nome || 'leitor(a)').split(' ')[0];

// ---------- Navegação de seções ----------
document.querySelectorAll('.dash-sidebar button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dash-sidebar button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
  });
});

// ---------- Visão geral ----------
async function renderOverview() {
  const trades = await getTrades();
  document.getElementById('ovPontos').textContent = getPoints() ?? 0;
  document.getElementById('ovTrocasAtivas').textContent = trades.filter(t => !['Finalizada', 'Cancelada'].includes(t.status)).length;
  document.getElementById('ovAnunciados').textContent = (await getMyBooks()).length;
  document.getElementById('ovFavoritos').textContent = getFavorites().length;
}
await renderOverview();

// Recomendações simples baseadas em gêneros favoritos / lidos / favoritos / histórico de trocas
async function getRecommendations() {
  const generos = new Set(session.generosFavoritos || []);
  const [readList, favorites, trades, myBooks] = await Promise.all([
    Promise.all(getReadList().map(getAnyBookById)),
    Promise.all(getFavorites().map(getAnyBookById)),
    getTrades(),
    getMyBooks(),
  ]);
  [...readList, ...favorites].filter(Boolean).forEach(b => bookGeneros(b).forEach(g => generos.add(g)));
  const tradeBooks = (await Promise.all(trades.map(t => getAnyBookById(t.bookId)))).filter(Boolean);
  tradeBooks.forEach(b => bookGeneros(b).forEach(g => generos.add(g)));

  const owned = new Set([...getFavorites(), ...getReadList(), ...myBooks.map(b => b.id)]);
  const allBooks = await getAllBooks();
  let recs = allBooks.filter(b => bookGeneros(b).some(g => generos.has(g)) && !owned.has(b.id));
  if (recs.length < 4) recs = [...recs, ...allBooks.filter(b => !owned.has(b.id) && !recs.includes(b))];
  return recs.slice(0, 4);
}
await renderBookGrid(document.getElementById('gridRecomendados'), await getRecommendations(), 'Favorite livros para receber recomendações personalizadas.');

// ---------- Minhas trocas ----------
function statusIndex(status) { return TRADE_STATUS.indexOf(status); }

function daysLeft(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

// Listeners de chat ativos (tradeId -> unsubscribe) — precisam ser encerrados
// sempre que os cards são redesenhados, senão ficam escutando cards que não existem mais.
const chatUnsubs = new Map();
function closeAllChatSubs() {
  chatUnsubs.forEach(unsub => unsub());
  chatUnsubs.clear();
}

async function renderTrades() {
  closeAllChatSubs();
  const trades = await getTrades();
  const list = document.getElementById('tradesList');
  if (trades.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">🔄</div><h3>Nenhuma troca ainda</h3><p>Explore a <a href="biblioteca.html">biblioteca</a> e solicite sua primeira troca.</p></div>`;
    return;
  }

  trades.filter(t => t.status === 'Finalizada').forEach(t => { cleanupExpiredMessages(t).catch(() => {}); });

  const bookInfoByTrade = new Map();
  await Promise.all(trades.map(async (trade) => {
    const [mainBook, donoInfo, requesterInfo] = await Promise.all([
      getAnyBookById(trade.bookId),
      getOwnerInfo(trade.ownerId),
      getOwnerInfo(trade.requesterId),
    ]);
    const offeredBooks = trade.tipo === 'proposta' && trade.livrosOferecidos?.length
      ? (await Promise.all(trade.livrosOferecidos.map(getAnyBookById))).filter(Boolean)
      : [];
    bookInfoByTrade.set(trade.id, { mainBook, offeredBooks, donoInfo, requesterInfo });
  }));

  list.innerHTML = trades.map(trade => {
    const { mainBook, offeredBooks, donoInfo, requesterInfo } = bookInfoByTrade.get(trade.id);
    const idx = statusIndex(trade.status);
    const isCancelled = trade.status === 'Cancelada';
    const dl = trade.prazoPostagem ? daysLeft(trade.prazoPostagem) : null;
    const showDeadline = !isCancelled && !!trade.prazoPostagem && idx < TRADE_STATUS.indexOf('Aguardando postagem') + 1 && dl <= 15;
    const souDono = trade.ownerId === session.id;

    const stepperHTML = isCancelled
      ? `<p style="color:var(--danger);font-weight:600;">❌ Troca cancelada</p>`
      : `<div class="status-stepper">
          ${TRADE_STATUS.slice(0, 7).map((s, i) => `
            <div class="status-step ${i < idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
              <div class="status-dot">${i < idx ? '✓' : i + 1}</div>
              <div class="status-label">${s}</div>
            </div>
          `).join('')}
        </div>`;

    const nextStatus = TRADE_STATUS[Math.min(idx + 1, TRADE_STATUS.indexOf('Finalizada'))];
    const pendingDecision = souDono && ['Solicitação enviada', 'Em análise'].includes(trade.status);

    const mainBookHTML = `
      <div class="trade-book-item">
        <img src="${trade.bookCapa}" alt="">
        <div>
          <strong>${trade.bookTitulo}</strong>
          ${mainBook?.autor ? `<p class="mb-0 text-muted">${mainBook.autor}</p>` : ''}
          <p class="mb-0 trade-book-owner">${trade.donoNome || 'Anunciante'}</p>
        </div>
      </div>`;
    const offeredBooksHTML = offeredBooks.map(ob => `
      <div class="trade-book-item">
        <img src="${ob.capa}" alt="">
        <div>
          <strong>${ob.titulo}</strong>
          ${ob.autor ? `<p class="mb-0 text-muted">${ob.autor}</p>` : ''}
          <p class="mb-0 trade-book-owner">${trade.requesterNome || 'Leitor(a)'}</p>
        </div>
      </div>`).join('');
    // O livro do usuário logado (o que ele possui, seja o pedido ou o ofertado) sempre vem primeiro.
    const booksInOrder = souDono
      ? [mainBookHTML, offeredBooksHTML]
      : [offeredBooksHTML, mainBookHTML];
    const booksRowHTML = booksInOrder.filter(Boolean).join('<span class="trade-swap-icon">⇄</span>');

    const bookDetailHTML = (book, titulo, info) => `
      <div class="detail-book">
        <img src="${book?.capa || trade.bookCapa}" alt="">
        <div>
          <strong>${titulo}</strong>
          ${book?.autor ? `<p class="mb-0 text-muted">${book.autor}</p>` : ''}
          <div class="detail-badges">
            ${book?.estadoConservacao ? `<span class="badge">${book.estadoConservacao}</span>` : ''}
            ${book ? bookGeneros(book).map(g => `<span class="badge">${g}</span>`).join('') : ''}
          </div>
          ${book?.sinopse ? `<p class="mb-0 text-muted detail-sinopse">${book.sinopse}</p>` : ''}
        </div>
      </div>
      <div class="detail-profile">
        <img src="${info?.foto}" alt="">
        <div>
          <strong>${info?.nome}</strong>
          <p class="mb-0 text-muted">${[info?.cidade, info?.estado].filter(Boolean).join(' - ') || 'Localização não informada'}</p>
          <p class="mb-0 text-muted">⭐ ${(info?.avaliacaoMedia ?? 5).toFixed(1)} (${info?.totalAvaliacoes ?? 0} avaliações)</p>
        </div>
      </div>`;
    const detailsHTML = souDono
      ? bookDetailHTML(mainBook, trade.bookTitulo, donoInfo) + offeredBooks.map(ob => bookDetailHTML(ob, ob.titulo, requesterInfo)).join('')
      : offeredBooks.map(ob => bookDetailHTML(ob, ob.titulo, requesterInfo)).join('') + bookDetailHTML(mainBook, trade.bookTitulo, donoInfo);

    return `
      <div class="card trade-card" data-trade-id="${trade.id}">
        <div class="trade-card-top">
          <h4 class="trade-card-title">${trade.tipo === 'pontos' ? 'Troca por pontos' : 'Proposta'}</h4>
        </div>
        <div class="trade-card-head">
          <div class="trade-books-row">
            ${booksRowHTML}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm trade-vermais-btn" data-action="vermais">Ver mais ▾</button>
        <div class="details-panel" data-panel="detalhes">
          ${detailsHTML}
        </div>
        ${showDeadline ? `<div class="trade-card-meta"><p class="deadline-warning mb-0">⏳ Prazo de postagem: ${dl > 0 ? `${dl} dia(s) restante(s)` : 'expirado'}</p></div>` : ''}

        ${stepperHTML}

        <div class="trade-card-actions">
          ${pendingDecision ? `
            <button class="btn btn-primary btn-sm" data-action="aceitar">✓ Aceitar</button>
            <button class="btn btn-secondary btn-sm" data-action="recusar">✕ Recusar</button>
          ` : ''}
          ${!pendingDecision && !isCancelled && trade.status !== 'Finalizada' ? `
            ${souDono ? `<button class="btn btn-primary btn-sm" data-action="avancar">Marcar como: ${nextStatus}</button>` : ''}
            <button class="btn btn-secondary btn-sm" data-action="cancelar">Cancelar troca</button>
          ` : ''}
          ${['Entregue', 'Finalizada'].includes(trade.status) ? `<button class="btn btn-highlight btn-sm" data-action="avaliar">⭐ Avaliar troca</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="chat">💬 Chat</button>
          ${!isCancelled ? `<button class="btn btn-ghost btn-sm" data-action="rastreio">📦 Rastreamento</button>` : ''}
        </div>

        <div class="chat-panel" data-panel="chat">
          <div class="chat-messages" data-messages></div>
          <div class="chat-input-row">
            <input class="input" type="text" placeholder="Escreva uma mensagem..." data-chat-input>
            <button class="btn btn-primary" data-send-chat>Enviar</button>
            <button class="btn btn-secondary" data-share-tracking title="Compartilhar código de rastreio">📎</button>
          </div>
          <p class="chat-disclaimer">⚠️ O site não se responsabiliza por trocas presenciais.</p>
        </div>

        <div class="tracking-panel" data-panel="tracking">
          <div class="field">
            <label>Código de rastreio</label>
            <input class="input" type="text" placeholder="Ex: BR123456789BR" value="${trade.rastreio?.codigo || ''}" data-tracking-code>
          </div>
          <div class="field">
            <label>Transportadora</label>
            <select class="input" data-tracking-carrier>
              <option value="">Selecione</option>
              ${['Correios', 'Melhor Envio', 'Entrega combinada'].map(c => `<option value="${c}" ${trade.rastreio?.transportadora === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" data-save-tracking>Salvar informações de rastreio</button>
          <p class="hint">Integração futura com APIs dos Correios / Melhor Envio para atualização automática.</p>
          <p class="mb-0" style="font-weight:600;">Status atual: ${trade.status}</p>
        </div>
      </div>
    `;
  }).join('');

  bindTradeCardEvents(trades);
}

function bindTradeCardEvents(trades) {
  document.querySelectorAll('.trade-card').forEach(card => {
    const tradeId = card.dataset.tradeId;
    const trade = trades.find(t => t.id === tradeId);

    card.querySelector('[data-action="aceitar"]')?.addEventListener('click', async () => {
      const prazoPostagem = new Date();
      prazoPostagem.setDate(prazoPostagem.getDate() + 15);
      await updateTrade(tradeId, { status: 'Aceita', prazoPostagem: prazoPostagem.toISOString() });
      showToast('Proposta aceita!', '', 'success');
      await renderTrades(); await renderOverview();
    });
    card.querySelector('[data-action="recusar"]')?.addEventListener('click', async () => {
      await cancelTrade(tradeId);
      showToast('Proposta recusada', '', 'info');
      await renderTrades(); await renderOverview();
    });
    card.querySelector('[data-action="avancar"]')?.addEventListener('click', async () => {
      await advanceTradeStatus(tradeId);
      await renderTrades(); await renderOverview();
    });
    card.querySelector('[data-action="cancelar"]')?.addEventListener('click', () => {
      openCancelConfirmModal(tradeId);
    });
    card.querySelector('[data-action="avaliar"]')?.addEventListener('click', () => {
      openRatingModal(trade);
    });

    const vermaisBtn = card.querySelector('[data-action="vermais"]');
    const detailsPanel = card.querySelector('[data-panel="detalhes"]');
    vermaisBtn?.addEventListener('click', () => {
      const isOpening = !detailsPanel.classList.contains('open');
      detailsPanel.classList.toggle('open', isOpening);
      vermaisBtn.textContent = isOpening ? 'Ver menos ▴' : 'Ver mais ▾';
    });

    const chatBtn = card.querySelector('[data-action="chat"]');
    const rastreioBtn = card.querySelector('[data-action="rastreio"]');
    const chatPanel = card.querySelector('[data-panel="chat"]');
    const trackingPanel = card.querySelector('[data-panel="tracking"]');
    chatBtn?.addEventListener('click', () => {
      const isOpening = !chatPanel.classList.contains('open');
      chatPanel.classList.toggle('open', isOpening);
      trackingPanel.classList.remove('open');
      chatBtn.classList.toggle('active', isOpening);
      rastreioBtn?.classList.remove('active');

      chatUnsubs.get(tradeId)?.();
      chatUnsubs.delete(tradeId);
      if (isOpening) {
        const unsub = subscribeChatMessages(trade.id, (msgs) => renderChatBubbles(msgs, card));
        chatUnsubs.set(tradeId, unsub);
      }
    });
    rastreioBtn?.addEventListener('click', () => {
      const isOpening = !trackingPanel.classList.contains('open');
      trackingPanel.classList.toggle('open', isOpening);
      chatPanel.classList.remove('open');
      rastreioBtn.classList.toggle('active', isOpening);
      chatBtn?.classList.remove('active');
    });

    card.querySelector('[data-send-chat]')?.addEventListener('click', () => submitChatMessage(trade, card));
    card.querySelector('[data-chat-input]')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitChatMessage(trade, card); });
    card.querySelector('[data-share-tracking]')?.addEventListener('click', async () => {
      const codigo = trade.rastreio?.codigo || card.querySelector('[data-tracking-code]').value.trim();
      if (!codigo) { showToast('Nenhum código de rastreio informado', 'Preencha o rastreamento primeiro.', 'error'); return; }
      await sendChatMessage(trade, `📦 Código de rastreio: ${codigo}`);
    });

    card.querySelector('[data-save-tracking]')?.addEventListener('click', async () => {
      const codigo = card.querySelector('[data-tracking-code]').value.trim();
      const transportadora = card.querySelector('[data-tracking-carrier]').value;
      const historico = [...(trade.rastreio?.historico || []), { texto: `Rastreio atualizado: ${trade.status}`, data: new Date().toISOString() }];
      await updateTrade(tradeId, { rastreio: { codigo, transportadora, historico } });
      showToast('Rastreamento salvo!', '', 'success');
    });
  });
}

function openCancelConfirmModal(tradeId) {
  openModal(`
    <div class="modal-header">
      <h3 id="cancelTitle">Cancelar troca</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <p>Tem certeza que deseja cancelar esta troca?</p>
    <p><strong>Cancelar sem informar uma justificativa resulta no desconto de 2 pontos da sua conta.</strong></p>
    <div class="field">
      <label for="cancelJustificativa">Justificativa (opcional — evita o desconto de pontos)</label>
      <textarea class="input" id="cancelJustificativa" rows="3" placeholder="Descreva o motivo do cancelamento..."></textarea>
    </div>
    <div style="display:flex;gap:10px;">
      <button type="button" class="btn btn-secondary btn-block" data-modal-close>Voltar</button>
      <button type="button" class="btn btn-primary btn-block" id="confirmCancelBtn">Confirmar cancelamento</button>
    </div>
  `, { labelledBy: 'cancelTitle', onMount: (overlay, close) => {
    overlay.querySelector('#confirmCancelBtn').addEventListener('click', async () => {
      const justificativa = overlay.querySelector('#cancelJustificativa').value.trim();
      close();
      await cancelTrade(tradeId, !!justificativa);
      showToast('Troca cancelada', '', 'info');
      await renderTrades(); await renderOverview();
    });
  }});
}

function renderChatBubbles(msgs, card) {
  const container = card.querySelector('[data-messages]');
  container.innerHTML = msgs.length
    ? msgs.map(m => `<div class="chat-bubble ${m.autor === session.id ? 'me' : 'them'}">${m.texto}</div>`).join('')
    : `<p class="text-muted" style="font-size:0.85rem;">Nenhuma mensagem ainda. Diga olá!</p>`;
  container.scrollTop = container.scrollHeight;
}

async function submitChatMessage(trade, card) {
  const input = card.querySelector('[data-chat-input]');
  const texto = input.value.trim();
  if (!texto) return;
  input.value = '';
  await sendChatMessage(trade, texto);
}

await renderTrades();

// ---------- Livros anunciados ----------
await renderBookGrid(document.getElementById('gridAnunciadosDash'), await getMyBooks(), 'Nenhum livro anunciado ainda.');

// ---------- Favoritos ----------
const favBooksDash = (await Promise.all(getFavorites().map(getAnyBookById))).filter(Boolean);
await renderBookGrid(document.getElementById('gridFavoritosDash'), favBooksDash, 'Você ainda não favoritou nenhum livro.');

// ---------- Pontos ----------
document.getElementById('pontosSaldo').textContent = `${getPoints() ?? 0} pontos`;

// ---------- Notificações ----------
function renderNotifDash() {
  const notifications = getNotifications();
  const el = document.getElementById('notifListDash');
  el.innerHTML = notifications.length ? notifications.map(n => `
    <div class="card" style="padding:16px;margin-bottom:10px;display:flex;gap:12px;">
      <span style="font-size:1.2rem;">🔔</span>
      <div>
        <strong>${n.titulo}</strong>
        <p class="mb-0 text-muted" style="font-size:0.88rem;">${n.texto}</p>
        <p class="mb-0 text-muted" style="font-size:0.75rem;">${new Date(n.criadoEm).toLocaleString('pt-BR')}</p>
      </div>
    </div>
  `).join('') : `<div class="empty-state"><p>Nenhuma notificação ainda.</p></div>`;
}
renderNotifDash();
window.addEventListener('tdl:notification', renderNotifDash);

// ---------- Configurações ----------
const darkToggle = document.getElementById('darkModeToggle');
darkToggle.checked = getTheme() === 'dark';
darkToggle.addEventListener('change', () => {
  const theme = darkToggle.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  setTheme(theme);
});
document.getElementById('logoutBtnDash').addEventListener('click', async () => {
  await logout();
  window.location.href = 'index.html';
});

initRevealAnimations();
