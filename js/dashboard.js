import {
  getSession, isLoggedIn, logout, getPoints, getMyBooks, getTrades,
  getAnyBookById, getOwnerInfo, getAllBooks, TRADE_STATUS, STATUS_FINAL, STATUS_CHEGADA, advanceTradeStatus, finalizeTrade, cancelTrade, updateTrade,
  cleanupExpiredMessages, setTradeAgencia, saveTradeTracking, refreshTradeTracking, addNotificationFor, getSavedAgencia, saveAgencia,
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
import { populateEstados } from './auth.js';
import {
  CORREIOS_BUSCA_AGENCIAS_URL,
  agenciaResumo, agenciaMapUrl,
  isValidTrackingCode, normalizeTrackingCode, trackingUrl,
} from './correios.js';

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
  document.getElementById('ovTrocasAtivas').textContent = trades.filter(t => ![STATUS_FINAL, 'Cancelada'].includes(t.status)).length;
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

  trades.filter(t => t.status === STATUS_FINAL).forEach(t => { cleanupExpiredMessages(t).catch(() => {}); });

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
    const showDeadline = !isCancelled && !!trade.prazoPostagem && idx < TRADE_STATUS.indexOf('Postada') + 1 && dl <= 15;
    const souDono = trade.ownerId === session.id;

    // A etapa atual já conta como cumprida: ao "Marcar como: X", o passo X fica verde.
    const stepperHTML = isCancelled
      ? `<p style="color:var(--danger);font-weight:600;">❌ Troca cancelada</p>`
      : `<div class="status-stepper">
          ${TRADE_STATUS.slice(0, 6).map((s, i) => `
            <div class="status-step ${i <= idx ? 'done' : ''}">
              <div class="status-dot">${i <= idx ? '✓' : i + 1}</div>
              <div class="status-label">${s}</div>
            </div>
          `).join('')}
        </div>`;

    const isFinal = trade.status === STATUS_FINAL;
    // O dono avança até "Chegada na agência"; quem finaliza é o solicitante, ao retirar o livro.
    const nextStatus = TRADE_STATUS[Math.min(idx + 1, TRADE_STATUS.indexOf(STATUS_CHEGADA))];
    const podeFinalizar = !souDono && trade.status === STATUS_CHEGADA;
    const pendingDecision = souDono && trade.status === 'Solicitação enviada';

    // Agência dos Correios onde o solicitante vai retirar: ele escolhe (e pode
    // trocar) enquanto o livro não foi postado; os dois lados veem a escolha.
    const agencia = trade.agenciaRetirada;
    const podeEscolherAgencia = !souDono && !isCancelled && idx < TRADE_STATUS.indexOf('Postada');
    let agenciaHTML = '';
    if (agencia) {
      agenciaHTML = `
        <div class="trade-agencia">
          <div class="trade-agencia-info">
            <strong>📍 Retirada nos Correios</strong>
            <p class="mb-0">${agenciaResumo(agencia)}</p>
            ${agencia.cep ? `<p class="mb-0 text-muted">CEP ${agencia.cep}</p>` : ''}
            ${agencia.telefone ? `<p class="mb-0 text-muted">Destinatário: ${agencia.destinatario || trade.requesterNome || 'Solicitante'} · ${agencia.telefone}</p>` : ''}
            ${agencia.horario ? `<p class="mb-0 text-muted">Horário: ${agencia.horario}</p>` : ''}
            ${agenciaMapUrl(agencia) ? `<a href="${agenciaMapUrl(agencia)}" target="_blank" rel="noopener" class="agencia-map-link">Ver no mapa ↗</a>` : ''}
          </div>
          ${podeEscolherAgencia ? `<button class="btn btn-ghost btn-sm" data-action="agencia">Trocar agência</button>` : ''}
        </div>`;
    } else if (podeEscolherAgencia) {
      agenciaHTML = `
        <div class="trade-agencia ${trade.status === 'Aceita' ? 'trade-agencia-pending' : ''}">
          <div class="trade-agencia-info">
            <strong>📍 Onde você vai retirar o livro?</strong>
            <p class="mb-0 text-muted">O local escolhido será o local de retirada do livro.</p>
          </div>
          <button class="btn ${trade.status === 'Aceita' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="agencia">Escolher agência</button>
        </div>`;
    } else if (souDono && trade.status === 'Aceita') {
      agenciaHTML = `<p class="trade-agencia-waiting mb-0">📍 Aguardando o solicitante escolher a agência dos Correios para retirada.</p>`;
    }

    const rastreio = trade.rastreio || {};
    const codigoValido = isValidTrackingCode(rastreio.codigo);
    const ultimoEvento = rastreio.ultimoEvento;
    const historico = [...(rastreio.historico || [])].reverse().slice(0, 5);
    const trackingHTML = `
      ${souDono && !isCancelled && !isFinal ? `
        <p class="mb-0"><strong>Transportadora:</strong> Correios</p>
        <div class="field" style="margin-top:10px;">
          <label>Código de rastreio dos Correios</label>
          <input class="input" type="text" placeholder="Ex: AA123456789BR" value="${rastreio.codigo || ''}" data-tracking-code>
        </div>
        <button class="btn btn-secondary btn-sm" data-save-tracking>Salvar código de rastreio</button>
        ${trade.status === 'Aceita' ? `<p class="hint">Ao informar o código dos Correios a troca passa para "Postada" automaticamente.</p>` : ''}
      ` : `
        <p class="mb-0"><strong>Transportadora:</strong> Correios</p>
        <p class="mb-0"><strong>Código de rastreio:</strong> ${rastreio.codigo || 'ainda não informado pelo anunciante'}</p>
      `}
      ${codigoValido ? `
        <div class="tracking-event">
          ${ultimoEvento ? `
            <strong>${ultimoEvento.descricao}</strong>
            ${ultimoEvento.local ? `<p class="mb-0 text-muted">${ultimoEvento.local}</p>` : ''}
            ${ultimoEvento.data ? `<p class="mb-0 text-muted">${new Date(ultimoEvento.data).toLocaleString('pt-BR')}</p>` : ''}
          ` : `<p class="mb-0 text-muted">Ainda sem eventos dos Correios para este código.</p>`}
          ${rastreio.consultadoEm ? `<p class="mb-0 hint">Consultado em ${new Date(rastreio.consultadoEm).toLocaleString('pt-BR')}</p>` : ''}
        </div>
        ${historico.length ? `<ul class="tracking-history">${historico.map(h => `<li>${h.data ? `<span>${new Date(h.data).toLocaleString('pt-BR')}</span> ` : ''}${h.texto}</li>`).join('')}</ul>` : ''}
        <div class="tracking-actions">
          ${!isCancelled && !isFinal ? `<button class="btn btn-secondary btn-sm" data-refresh-tracking>🔄 Atualizar agora</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="${trackingUrl(rastreio.codigo)}" target="_blank" rel="noopener">Ver no site dos Correios ↗</a>
        </div>
        ${!isCancelled && !isFinal ? `<p class="hint">O status da troca é atualizado automaticamente pelos Correios a cada 2 horas.</p>` : ''}
      ` : ''}
      <p class="mb-0" style="font-weight:600;">Status atual: ${trade.status}</p>`;

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
          <button class="btn-icon trade-info-btn" data-action="info" title="Como funciona a retirada nos Correios" aria-label="Como funciona a retirada nos Correios">i</button>
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
        ${agenciaHTML}

        ${stepperHTML}

        <div class="trade-card-actions">
          ${pendingDecision ? `
            <button class="btn btn-primary btn-sm" data-action="aceitar">✓ Aceitar</button>
            <button class="btn btn-secondary btn-sm" data-action="recusar">✕ Recusar</button>
          ` : ''}
          ${!pendingDecision && !isCancelled && !isFinal ? `
            ${souDono && trade.status !== STATUS_CHEGADA ? `<button class="btn btn-primary btn-sm" data-action="avancar">Marcar como: ${nextStatus}</button>` : ''}
            <button class="btn btn-secondary btn-sm" data-action="cancelar">Cancelar troca</button>
          ` : ''}
          ${podeFinalizar ? `<button class="btn btn-highlight btn-sm" data-action="finalizar">✅ Finalizar troca</button>` : ''}
          ${isFinal ? `<button class="btn btn-highlight btn-sm" data-action="avaliar">⭐ Avaliar troca</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-action="chat">💬 Chat</button>
          ${!isCancelled ? `<button class="btn btn-ghost btn-sm" data-action="rastreio">📦 Rastreamento</button>` : ''}
        </div>

        <div class="chat-panel" data-panel="chat">
          <div class="chat-messages" data-messages></div>
          <div class="chat-input-row">
            <input class="input" type="text" placeholder="Escreva uma mensagem..." data-chat-input>
            <button class="btn btn-primary" data-send-chat>Enviar</button>
          </div>
          <p class="chat-disclaimer">⚠️ O site não se responsabiliza por trocas presenciais.</p>
        </div>

        <div class="tracking-panel" data-panel="tracking">
          ${trackingHTML}
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
      await addNotificationFor(trade.requesterId, 'Proposta aceita!', `"${trade.bookTitulo}" foi aceita. Escolha a agência dos Correios onde vai retirar o livro.`, 'troca');
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
    // Só o solicitante finaliza (confirma que retirou o livro) e já avalia em seguida.
    card.querySelector('[data-action="finalizar"]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        const updated = await finalizeTrade(tradeId);
        showToast('Troca finalizada!', 'Agora conte como foi a experiência.', 'success');
        await renderTrades(); await renderOverview();
        openRatingModal(updated || { ...trade, status: STATUS_FINAL });
      } catch (err) {
        showToast('Não foi possível finalizar', err.message || '', 'error');
        e.target.disabled = false;
      }
    });
    card.querySelector('[data-action="avaliar"]')?.addEventListener('click', () => {
      openRatingModal(trade);
    });
    card.querySelector('[data-action="agencia"]')?.addEventListener('click', () => {
      openAgencyModal(trade);
    });
    card.querySelector('[data-action="info"]')?.addEventListener('click', openCliqueRetireModal);

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

    card.querySelector('[data-save-tracking]')?.addEventListener('click', async (e) => {
      const codigo = normalizeTrackingCode(card.querySelector('[data-tracking-code]').value);
      if (!isValidTrackingCode(codigo)) {
        showToast('Código inválido', 'Códigos dos Correios têm o formato AA123456789BR.', 'error');
        return;
      }
      e.target.disabled = true;
      try {
        const updated = await saveTradeTracking(trade, { codigo, transportadora: 'Correios' });
        showToast('Rastreamento salvo!', updated.status !== trade.status ? `A troca agora está: ${updated.status}` : '', 'success');
        await renderTrades(); await renderOverview();
      } catch (err) {
        showToast('Não foi possível salvar', err.message || '', 'error');
        e.target.disabled = false;
      }
    });

    card.querySelector('[data-refresh-tracking]')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      e.target.textContent = 'Consultando...';
      try {
        const result = await refreshTradeTracking(tradeId);
        const mudouStatus = result?.status && result.status !== trade.status;
        showToast(
          mudouStatus ? `Troca agora está: ${result.status}` : 'Rastreio atualizado',
          result?.ultimoEvento?.descricao || '', 'success',
        );
        await renderTrades(); await renderOverview();
      } catch (err) {
        showToast('Não foi possível consultar', err.message || 'Tente de novo em instantes.', 'error');
        e.target.disabled = false;
        e.target.textContent = '🔄 Atualizar agora';
      }
    });
  });
}

// Guia "Clique e Retire" dos Correios (mesmo conteúdo da página oficial), aberto
// pelo "i" no canto do card da troca.
const CORREIOS_CLIQUE_RETIRE_URL = 'https://www.correios.com.br/receber/encomenda/nacional';
function openCliqueRetireModal() {
  openModal(`
    <div class="modal-header">
      <h3 id="cliqueRetireTitle">📦 Como funciona o Clique e Retire</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <ol class="clique-retire-steps">
      <li>
        <span class="clique-retire-icon" aria-hidden="true">🏪</span>
        <div><strong>1.</strong> Quando escolher por "Clique e Retire", escolha também a agência de sua preferência;</div>
      </li>
      <li>
        <span class="clique-retire-icon" aria-hidden="true">🖥️</span>
        <div>
          <strong>2.</strong> Você deve indicar o endereço da agência dos Correios informando os seguintes dados:
          <ul>
            <li>Nome do destinatário</li>
            <li>A expressão "Clique e Retire"</li>
            <li>Nome da agência de destino</li>
            <li>CEP do Clique e Retire da agência</li>
            <li>Município/UF</li>
          </ul>
          <p class="mb-0 text-muted" style="margin-top:8px;">Exemplo:</p>
          <div class="clique-retire-etiqueta" aria-label="Exemplo de etiqueta">
            <span class="clique-retire-etiqueta-titulo">DESTINATÁRIO</span>
            José Silva<br>
            CLIQUE E RETIRE DOS CORREIOS<br>
            AC GUARÁ<br>
            <span class="clique-retire-etiqueta-cep">71010-959 &nbsp;&nbsp; Brasília-DF</span>
          </div>
        </div>
      </li>
      <li>
        <span class="clique-retire-icon" aria-hidden="true">📱</span>
        <div><strong>3.</strong> É fundamental informar um número de celular válido do destinatário. Quando a encomenda estiver disponível para retirada na agência selecionada, os Correios enviarão um SMS ao destinatário.</div>
      </li>
      <li>
        <span class="clique-retire-icon" aria-hidden="true">🪪</span>
        <div><strong>4.</strong> A entrega da encomenda será feita mediante apresentação de documento de identificação oficial com foto.</div>
      </li>
      <li>
        <span class="clique-retire-icon" aria-hidden="true">🌐</span>
        <div><strong>5.</strong> Os lojistas virtuais também poderão oferecer o Clique e Retire por meio da integração virtual do site da loja do Correios Web Service.</div>
      </li>
    </ol>
    <p class="mb-0" style="margin-top:18px;">
      <a href="${CORREIOS_CLIQUE_RETIRE_URL}" target="_blank" rel="noopener">${CORREIOS_CLIQUE_RETIRE_URL}</a>
    </p>
  `, { labelledBy: 'cliqueRetireTitle' });
}

// Escolha da agência dos Correios onde o solicitante vai retirar o livro: ele
// consulta o buscador oficial (Clique e Retire) e informa os dados aqui, podendo
// salvar a agência para reaproveitar nas próximas trocas.
function openAgencyModal(trade) {
  const atual = trade.agenciaRetirada || {};
  openModal(`
    <div class="modal-header">
      <h3 id="agenciaTitle">📍 Onde você quer retirar o livro?</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <p class="text-muted">Consulte a agência no <a href="${CORREIOS_BUSCA_AGENCIAS_URL}" target="_blank" rel="noopener">buscador dos Correios ↗</a> e copie os dados aqui. O anunciante vai postar o livro para essa agência.</p>
    <form id="agenciaForm" class="agencia-manual">
      <div class="field"><label for="agenciaNome">Nome da agência</label><input class="input" id="agenciaNome" placeholder="Ex: AC Itaquera" value="${atual.nome || ''}" required></div>
      <div class="field"><label for="agenciaEndereco">Endereço</label><input class="input" id="agenciaEndereco" placeholder="Rua, número" value="${atual.endereco || ''}" required></div>
      <div class="row-2">
        <div class="field"><label for="agenciaBairro">Bairro</label><input class="input" id="agenciaBairro" value="${atual.bairro || ''}"></div>
        <div class="field"><label for="agenciaCep">CEP da agência <span class="text-muted">(Clique e Retire)</span></label><input class="input" id="agenciaCep" inputmode="numeric" maxlength="9" placeholder="00000-000" value="${atual.cep || ''}"></div>
      </div>
      <div class="row-2">
        <div class="field"><label for="agenciaCidade">Cidade</label><input class="input" id="agenciaCidade" value="${atual.cidade || ''}" required></div>
        <div class="field"><label for="agenciaEstado">Estado</label><select class="input" id="agenciaEstado" required><option value="">Selecione</option></select></div>
      </div>
      <div class="field">
        <label for="agenciaDestinatario">Nome completo do destinatário <span class="text-muted">(como está no documento com foto)</span></label>
        <input class="input" id="agenciaDestinatario" value="${atual.destinatario || ''}" required>
      </div>
      <div class="field">
        <label for="agenciaTelefone">Telefone do destinatário <span class="text-muted">(para a etiqueta e o aviso de chegada)</span></label>
        <input class="input" id="agenciaTelefone" type="tel" inputmode="numeric" maxlength="15" placeholder="(11) 99999-9999" value="${atual.telefone || ''}" required>
      </div>
      <label class="agencia-salvar"><input type="checkbox" id="agenciaSalvar"> Salvar esta agência para as próximas trocas</label>
      <p class="text-muted agencia-salva-aviso" id="agenciaSalvaAviso" hidden>Preenchido com a agência salva — você pode alterar o que quiser.</p>
      <button type="submit" class="btn btn-primary btn-block btn-lg" style="margin-top:16px;">Confirmar agência</button>
    </form>
  `, { labelledBy: 'agenciaTitle', onMount: async (overlay, close) => {
    const $ = (sel) => overlay.querySelector(sel);
    const estadoSelect = $('#agenciaEstado');
    populateEstados(estadoSelect);
    estadoSelect.value = atual.estado || '';

    $('#agenciaCep').addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
      e.target.value = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    });
    // (11) 99999-9999 ou (11) 9999-9999
    $('#agenciaTelefone').addEventListener('input', (e) => {
      const d = e.target.value.replace(/\D/g, '').slice(0, 11);
      let v = d;
      if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length > 6) v = `(${d.slice(0, 2)}) ${d.length > 10 ? `${d.slice(2, 7)}-${d.slice(7)}` : `${d.slice(2, 6)}-${d.slice(6)}`}`;
      e.target.value = v;
    });

    // Primeira escolha nesta troca: usa a agência salva pelo usuário, se houver;
    // senão adianta o que dá (nome e cidade/estado do perfil).
    const salvarCheckbox = $('#agenciaSalvar');
    if (!atual.nome) {
      const salva = await getSavedAgencia().catch(() => null);
      if (salva) {
        const campos = { nome: 'agenciaNome', endereco: 'agenciaEndereco', bairro: 'agenciaBairro', cep: 'agenciaCep', cidade: 'agenciaCidade', destinatario: 'agenciaDestinatario', telefone: 'agenciaTelefone' };
        Object.entries(campos).forEach(([key, id]) => { $(`#${id}`).value = salva[key] || ''; });
        estadoSelect.value = salva.estado || '';
        salvarCheckbox.checked = true; // mantém a agência salva atualizada se editar
        $('#agenciaSalvaAviso').hidden = false;
      } else {
        $('#agenciaDestinatario').value = session.nome || '';
        $('#agenciaCidade').value = session.cidade || '';
        estadoSelect.value = session.estado || '';
      }
    }

    $('#agenciaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type=submit]');
      const agencia = {
        id: 'manual',
        nome: $('#agenciaNome').value.trim(),
        endereco: $('#agenciaEndereco').value.trim(),
        bairro: $('#agenciaBairro').value.trim(),
        cidade: $('#agenciaCidade').value.trim(),
        estado: estadoSelect.value,
        cep: $('#agenciaCep').value.trim(),
        destinatario: $('#agenciaDestinatario').value.trim(),
        telefone: $('#agenciaTelefone').value.trim(),
      };
      if (agencia.destinatario.split(/\s+/).length < 2) {
        showToast('Nome incompleto', 'Informe nome e sobrenome do destinatário.', 'error');
        $('#agenciaDestinatario').focus();
        return;
      }
      if (agencia.cep && agencia.cep.replace(/\D/g, '').length !== 8) {
        showToast('CEP inválido', 'Informe os 8 dígitos do CEP da agência.', 'error');
        $('#agenciaCep').focus();
        return;
      }
      if (agencia.telefone.replace(/\D/g, '').length < 10) {
        showToast('Telefone inválido', 'Informe o DDD e o número do destinatário.', 'error');
        $('#agenciaTelefone').focus();
        return;
      }
      submitBtn.disabled = true;
      try {
        await setTradeAgencia(trade, agencia);
        // Salvar a preferência não pode impedir a troca de seguir — falha em silêncio.
        if (salvarCheckbox.checked) await saveAgencia(agencia).catch(() => {});
        close();
        showToast('Agência escolhida!', 'O anunciante já consegue ver onde postar o livro.', 'success');
        await renderTrades();
      } catch (err) {
        showToast('Não foi possível salvar', err.message || '', 'error');
        submitBtn.disabled = false;
      }
    });
  }});
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
