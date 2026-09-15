import {
  getSession, isLoggedIn, logout, getPoints, getMyBooks, getTrades, subscribeTrades, deleteBook,
  getAnyBookById, getOwnerInfo, getAllBooks, TRADE_STATUS, STATUS_FINAL, STATUS_CHEGADA, getEnvios, isDualTrade,
  advanceTradeStatus, finalizeTrade, cancelTrade, updateTrade, canCancelTrade, isTradePosted, hasPrazoPostagemExpirado,
  cleanupExpiredMessages, setTradeAgencia, saveTradeTracking, addNotificationFor, getSavedAgencia, saveAgencia,
  sendChatMessage, subscribeChatMessages, getNotifications, getFavorites, getReadList,
  authReady, getTheme, setTheme, checkEmailVerified, resendVerificationEmail, getAuthCurrentUser,
} from './storage.js';
import { renderNavbar, renderFooter, requireLoginModal } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { initTheme } from './theme.js';
import { showToast } from './toast.js';
import { openRatingModal } from './rating.js';
import { openModal } from './modal.js';
import { bookGeneros } from './data.js';
import { populateEstados } from './auth.js';
import { maskCep, maskTelefone, isValidCep, isValidTelefone, isNomeCompleto } from './validators.js';
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
  return;
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

let latestTrades = [];

async function renderTrades(tradesList) {
  closeAllChatSubs();
  const trades = tradesList || await getTrades();
  latestTrades = trades;
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
    const isCancelled = trade.status === 'Cancelada';
    const isFinal = trade.status === STATUS_FINAL;
    const souDono = trade.ownerId === session.id;
    const dual = isDualTrade(trade);
    const pendingDecision = souDono && trade.status === 'Solicitação enviada';

    // Livro por livro: dois envios, cada um com agência, etapas e rastreio
    // próprios. O livro do usuário logado (o que ele envia) vem primeiro, na
    // mesma ordem da linha de capas.
    const envios = getEnvios(trade).sort((a, b) => (a.remetenteId === session.id ? 0 : 1) - (b.remetenteId === session.id ? 0 : 1));
    const dl = trade.prazoPostagem ? daysLeft(trade.prazoPostagem) : null;
    const aguardandoPostagem = envios.some(e => statusIndex(e.status) <= statusIndex('Postada'));
    const showDeadline = !isCancelled && !!trade.prazoPostagem && aguardandoPostagem && dl <= 15;

    // Cada envio vira um bloco: título (só no livro por livro), agência de
    // retirada, linha de etapas e o botão de avançar/finalizar daquele envio.
    const envioBlockHTML = (envio) => {
      const idx = statusIndex(envio.status);
      const souRemetente = envio.remetenteId === session.id;
      const envioFinal = envio.status === STATUS_FINAL;
      const nextStatus = TRADE_STATUS[Math.min(idx + 1, TRADE_STATUS.indexOf(STATUS_CHEGADA))];
      const podeAvancar = souRemetente && !pendingDecision && !isCancelled && !envioFinal && envio.status !== STATUS_CHEGADA;
      const podeFinalizar = !souRemetente && envio.status === STATUS_CHEGADA;

      // A etapa atual já conta como cumprida: ao "Marcar como: X", o passo X fica verde.
      const stepperHTML = isCancelled
        ? `<p style="color:var(--danger);font-weight:600;">❌ Troca cancelada</p>`
        : `<div class="status-stepper ${dual ? 'vertical' : ''}">
            ${TRADE_STATUS.slice(0, 6).map((s, i) => `
              <div class="status-step ${i <= idx ? 'done' : ''}">
                <div class="status-dot">${i <= idx ? '✓' : i + 1}</div>
                <div class="status-label">${s}</div>
              </div>
            `).join('')}
          </div>`;

      // Agência dos Correios onde quem recebe vai retirar: ele escolhe enquanto
      // não houver uma (até o livro chegar) e só pode trocar antes da postagem;
      // os dois lados veem a escolha.
      const agencia = envio.agenciaRetirada;
      const podeEscolherAgencia = !souRemetente && !isCancelled && (agencia ? idx < TRADE_STATUS.indexOf('Postada') : idx < TRADE_STATUS.indexOf(STATUS_CHEGADA));
      // Sem agência escolhida não dá para postar (a etiqueta precisa dela).
      const precisaAgencia = envio.status === 'Aceita' && !agencia;
      let agenciaHTML = '';
      if (agencia) {
        agenciaHTML = `
          <div class="trade-agencia">
            <div class="trade-agencia-info">
              <strong>📍 Retirada nos Correios</strong>
              <p class="mb-0">${agenciaResumo(agencia)}</p>
              ${agencia.cep ? `<p class="mb-0 text-muted">CEP ${agencia.cep}</p>` : ''}
              ${agencia.telefone ? `<p class="mb-0 text-muted">Destinatário: ${agencia.destinatario || envio.destinatarioNome || 'Destinatário'} · ${agencia.telefone}</p>` : ''}
              ${agencia.horario ? `<p class="mb-0 text-muted">Horário: ${agencia.horario}</p>` : ''}
              ${agenciaMapUrl(agencia) ? `<a href="${agenciaMapUrl(agencia)}" target="_blank" rel="noopener" class="agencia-map-link">Ver no mapa ↗</a>` : ''}
            </div>
            ${podeEscolherAgencia ? `<button class="btn btn-ghost btn-sm" data-action="agencia" data-envio="${envio.key}">Trocar agência</button>` : ''}
          </div>`;
      } else if (podeEscolherAgencia) {
        agenciaHTML = `
          <div class="trade-agencia ${envio.status === 'Aceita' ? 'trade-agencia-pending' : ''}">
            <div class="trade-agencia-info">
              <strong>📍 Onde você vai retirar o livro?</strong>
              <p class="mb-0 text-muted">O local escolhido será o local de retirada do livro.</p>
            </div>
            <button class="btn ${envio.status === 'Aceita' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-action="agencia" data-envio="${envio.key}">Escolher agência</button>
          </div>`;
      } else if (souRemetente && envio.status === 'Aceita') {
        agenciaHTML = `<p class="trade-agencia-waiting mb-0">📍 Aguardando ${dual ? envio.destinatarioNome || 'a outra parte' : 'o solicitante'} escolher a agência dos Correios para retirada.</p>`;
      }

      const actionsHTML = podeAvancar || podeFinalizar ? `
        <div class="trade-envio-actions">
          ${podeAvancar ? `<button class="btn btn-primary btn-sm" data-action="avancar" data-envio="${envio.key}" ${precisaAgencia ? 'disabled title="Aguarde a escolha da agência de retirada para postar."' : ''}>Marcar como: ${nextStatus}</button>` : ''}
          ${podeFinalizar ? `<button class="btn btn-highlight btn-sm" data-action="finalizar" data-envio="${envio.key}">✅ Finalizar troca</button>` : ''}
        </div>` : '';

      // Livro por livro: uma coluna por livro, com dados do livro, de entrega e status.
      if (dual) {
        return `
          <div class="trade-dual-col" data-envio-block="${envio.key}">
            <p class="trade-envio-title mb-0">${souRemetente ? 'Você envia' : 'Você recebe'}</p>
            <div class="trade-dual-box">${envio.key === 'dono' ? mainBookHTML : offeredBooksFallbackHTML}</div>
            <div class="trade-dual-box trade-dual-entrega">
              <p class="trade-dual-box-title">📍 Dados de entrega</p>
              ${agenciaHTML || `<p class="mb-0 text-muted">Agência de retirada não informada.</p>`}
            </div>
            <div class="trade-dual-box">
              <p class="trade-dual-box-title">Status</p>
              ${stepperHTML}
              ${actionsHTML}
            </div>
          </div>`;
      }
      return `
        <div class="trade-envio" data-envio-block="${envio.key}">
          ${agenciaHTML}
          ${stepperHTML}
          ${actionsHTML}
        </div>`;
    };

    // Painel de rastreio: quem envia informa o código; quem recebe acompanha.
    const trackingBlockHTML = (envio) => {
      const souRemetente = envio.remetenteId === session.id;
      const envioFinal = envio.status === STATUS_FINAL;
      const rastreio = envio.rastreio || {};
      const codigoValido = isValidTrackingCode(rastreio.codigo);
      return `
        <div class="tracking-envio ${dual ? 'trade-dual-box' : ''}" data-envio-block="${envio.key}">
          ${dual ? `<p class="trade-envio-title mb-0">${souRemetente ? 'Você envia' : 'Você recebe'}: <strong>${envio.titulo}</strong></p>` : ''}
          ${souRemetente && !isCancelled && !envioFinal ? `
            <p class="mb-0"><strong>Transportadora:</strong> Correios</p>
            <div class="field" style="margin-top:10px;">
              <label>Código de rastreio dos Correios</label>
              <input class="input" type="text" placeholder="Ex: AA123456789BR" value="${rastreio.codigo || ''}" maxlength="13" data-tracking-code data-envio="${envio.key}">
            </div>
          ` : `
            <p class="mb-0"><strong>Transportadora:</strong> Correios</p>
            <p class="mb-0"><strong>Código de rastreio:</strong> ${rastreio.codigo || `ainda não informado por ${dual ? envio.remetenteNome || 'quem envia' : 'quem envia'}`}</p>
          `}
          ${codigoValido ? `
            <div class="tracking-actions">
              <a class="btn btn-ghost btn-sm" href="${trackingUrl(rastreio.codigo)}" target="_blank" rel="noopener">Ver no site dos Correios ↗</a>
            </div>
          ` : ''}
        </div>`;
    };

    // Cada um avalia depois de retirar o próprio livro (por pontos: os dois, ao final).
    const meuRecebimento = envios.find(e => e.destinatarioId === session.id);
    const podeAvaliar = isFinal || (dual && meuRecebimento?.status === STATUS_FINAL);
    const algumFinalizado = envios.some(e => e.status === STATUS_FINAL);

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
    // Livro oferecido já removido do catálogo: mostra ao menos o título guardado na troca.
    const offeredBooksFallbackHTML = offeredBooksHTML || (trade.livrosOferecidosTitulos || []).map(titulo => `
      <div class="trade-book-item"><div><strong>${titulo}</strong><p class="mb-0 trade-book-owner">${trade.requesterNome || 'Leitor(a)'}</p></div></div>`).join('');

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
        ${dual ? '' : `
        <div class="trade-card-head">
          <div class="trade-books-row">
            ${booksRowHTML}
          </div>
        </div>`}
        ${dual && showDeadline ? `<div class="trade-card-meta"><p class="deadline-warning mb-0">⏳ Prazo de postagem: ${dl > 0 ? `${dl} dia(s) restante(s)` : 'expirado'}</p></div>` : ''}
        ${dual ? `<div class="trade-dual">${envios.map(envioBlockHTML).join('')}</div>` : ''}
        <button class="btn btn-ghost btn-sm trade-vermais-btn" data-action="vermais">Ver mais ▾</button>
        <div class="details-panel" data-panel="detalhes">
          ${detailsHTML}
        </div>
        ${!dual && showDeadline ? `<div class="trade-card-meta"><p class="deadline-warning mb-0">⏳ Prazo de postagem: ${dl > 0 ? `${dl} dia(s) restante(s)` : 'expirado'}</p></div>` : ''}

        ${dual ? '' : isCancelled ? `<p style="color:var(--danger);font-weight:600;">❌ Troca cancelada</p>` : envios.map(envioBlockHTML).join('')}

        <div class="trade-card-actions">
          ${pendingDecision ? `
            <button class="btn btn-primary btn-sm" data-action="aceitar">✓ Aceitar</button>
            <button class="btn btn-secondary btn-sm" data-action="recusar">✕ Recusar</button>
          ` : ''}
          ${!pendingDecision && !isCancelled && !isFinal && !algumFinalizado ? (
            canCancelTrade(trade)
              ? `<button class="btn btn-secondary btn-sm" data-action="cancelar">Cancelar troca</button>`
              : `<span class="badge" style="font-size:0.75rem;padding:6px 10px;background:var(--surface-alt);color:var(--text-muted);border-radius:12px;" title="Um dos livros já foi postado nos Correios. Não é permitido cancelar.">🔒 Postagem iniciada — cancelamento bloqueado</span>`
          ) : ''}
          ${podeAvaliar ? `<button class="btn btn-highlight btn-sm" data-action="avaliar">⭐ Avaliar troca</button>` : ''}
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
          ${dual ? `<div class="trade-dual trade-dual-tracking">${envios.map(trackingBlockHTML).join('')}</div>` : envios.map(trackingBlockHTML).join('')}
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
    const envioDe = (el) => getEnvios(trade).find(e => e.key === el.dataset.envio);

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
    card.querySelectorAll('[data-action="avancar"]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      await advanceTradeStatus(tradeId, btn.dataset.envio);
      await renderTrades(); await renderOverview();
    }));
    card.querySelector('[data-action="cancelar"]')?.addEventListener('click', () => {
      openCancelConfirmModal(tradeId);
    });
    // Só quem recebe finaliza (confirma que retirou o livro) e já avalia em seguida.
    card.querySelectorAll('[data-action="finalizar"]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const updated = await finalizeTrade(tradeId, btn.dataset.envio);
        showToast('Livro retirado!', 'Agora conte como foi a experiência.', 'success');
        await renderTrades(); await renderOverview();
        openRatingModal(updated || trade);
      } catch (err) {
        showToast('Não foi possível finalizar', err.message || '', 'error');
        btn.disabled = false;
      }
    }));
    card.querySelector('[data-action="avaliar"]')?.addEventListener('click', () => {
      openRatingModal(trade);
    });
    card.querySelectorAll('[data-action="agencia"]').forEach(btn => btn.addEventListener('click', () => {
      openAgencyModal(trade, envioDe(btn));
    }));
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

    // O código é salvo sozinho assim que fica completo (AA123456789BR); se a
    // pessoa sair do campo com um código incompleto, avisa.
    card.querySelectorAll('[data-tracking-code]').forEach(input => {
      const envio = envioDe(input);
      let salvando = false;
      const salvar = async () => {
        const codigo = normalizeTrackingCode(input.value);
        if (salvando || !isValidTrackingCode(codigo) || codigo === (envio.rastreio?.codigo || '')) return;
        salvando = true;
        input.disabled = true;
        try {
          const updated = await saveTradeTracking(trade, { codigo, transportadora: 'Correios' }, envio.key);
          const novoStatus = getEnvios(updated).find(e => e.key === envio.key)?.status;
          showToast('Código de rastreio salvo!', novoStatus && novoStatus !== envio.status ? `O envio agora está: ${novoStatus}` : '', 'success');
          await renderTrades(); await renderOverview();
        } catch (err) {
          showToast('Não foi possível salvar', err.message || '', 'error');
          input.disabled = false;
          salvando = false;
        }
      };
      input.addEventListener('input', () => {
        input.value = normalizeTrackingCode(input.value);
        salvar();
      });
      input.addEventListener('blur', () => {
        const codigo = normalizeTrackingCode(input.value);
        if (codigo && !isValidTrackingCode(codigo)) showToast('Código incompleto', 'Códigos dos Correios têm o formato AA123456789BR.', 'error');
      });
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

// Escolha da agência dos Correios onde quem recebe vai retirar o livro (um envio
// por vez): ele consulta o buscador oficial (Clique e Retire) e informa os dados
// aqui, podendo salvar a agência para reaproveitar nas próximas trocas.
function openAgencyModal(trade, envio) {
  const atual = envio.agenciaRetirada || {};
  openModal(`
    <div class="modal-header">
      <h3 id="agenciaTitle">📍 Onde você quer retirar o livro?</h3>
      <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
    </div>
    <p class="text-muted">Consulte a agência no <a href="${CORREIOS_BUSCA_AGENCIAS_URL}" target="_blank" rel="noopener">buscador dos Correios ↗</a> e copie os dados aqui. Quem envia vai postar o livro para essa agência.</p>
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

    $('#agenciaCep').addEventListener('input', (e) => { e.target.value = maskCep(e.target.value); });
    $('#agenciaTelefone').addEventListener('input', (e) => { e.target.value = maskTelefone(e.target.value); });

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
      if (!isNomeCompleto(agencia.destinatario)) {
        showToast('Nome incompleto', 'Informe nome e sobrenome do destinatário.', 'error');
        $('#agenciaDestinatario').focus();
        return;
      }
      if (agencia.cep && !isValidCep(agencia.cep)) {
        showToast('CEP inválido', 'Informe os 8 dígitos do CEP da agência.', 'error');
        $('#agenciaCep').focus();
        return;
      }
      if (!isValidTelefone(agencia.telefone)) {
        showToast('Telefone inválido', 'Informe o DDD e o número do destinatário.', 'error');
        $('#agenciaTelefone').focus();
        return;
      }
      submitBtn.disabled = true;
      try {
        await setTradeAgencia(trade, agencia, envio.key);
        // Salvar a preferência não pode impedir a troca de seguir — falha em silêncio.
        if (salvarCheckbox.checked) await saveAgencia(agencia).catch(() => {});
        close();
        showToast('Agência escolhida!', 'Quem envia já consegue ver onde postar o livro.', 'success');
        await renderTrades();
      } catch (err) {
        showToast('Não foi possível salvar', err.message || '', 'error');
        submitBtn.disabled = false;
      }
    });
  }});
}

function openCancelConfirmModal(tradeId) {
  const trade = latestTrades.find(t => t.id === tradeId);
  if (trade && !canCancelTrade(trade)) {
    showToast('Cancelamento bloqueado', 'Não é possível cancelar uma troca após a postagem do livro nos Correios.', 'error');
    return;
  }
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

// Atualização em tempo real das trocas (não precisa dar F5)
subscribeTrades(async (updatedTrades) => {
  await renderTrades(updatedTrades);
  await renderOverview();
});

// ---------- Livros anunciados ----------
async function refreshMyBooksDash() {
  await renderBookGrid(document.getElementById('gridAnunciadosDash'), await getMyBooks(), 'Nenhum livro anunciado ainda.', {
    showDelete: true,
    onDeleteBook: (bookId, bookTitle) => {
      openModal(`
        <div class="modal-header">
          <h3 id="delBookTitleDash">Excluir livro anunciado</h3>
          <button class="btn-icon modal-close" data-modal-close aria-label="Fechar">✕</button>
        </div>
        <p>Tem certeza que deseja excluir o anúncio de <strong>"${bookTitle || 'este livro'}"</strong>?</p>
        <p class="text-muted" style="font-size:0.85rem;">Ele será removido imediatamente da biblioteca.</p>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button type="button" class="btn btn-secondary btn-block" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-primary btn-block" id="btnConfirmDelDash" style="background:var(--danger);border-color:var(--danger);">Sim, excluir livro</button>
        </div>
      `, {
        labelledBy: 'delBookTitleDash',
        onMount: (overlay, close) => {
          overlay.querySelector('#btnConfirmDelDash').addEventListener('click', async (e) => {
            e.target.disabled = true;
            try {
              await deleteBook(bookId);
              close();
              showToast('Livro excluído', 'O anúncio foi removido com sucesso.', 'success');
              await refreshMyBooksDash();
              await renderOverview();
            } catch (err) {
              showToast('Erro ao excluir', err.message || '', 'error');
              e.target.disabled = false;
            }
          });
        }
      });
    }
  });
}
await refreshMyBooksDash();

window.addEventListener('tdl:points-changed', (e) => {
  const pts = e.detail?.pontos ?? getPoints() ?? 0;
  const el = document.getElementById('pontosSaldo');
  if (el) el.textContent = `${pts} pontos`;
  const ov = document.getElementById('ovPontos');
  if (ov) ov.textContent = pts;
});

window.addEventListener('tdl:auth-changed', renderOverview);
window.addEventListener('tdl:book-deleted', async () => {
  await refreshMyBooksDash();
  await renderOverview();
});

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
if (darkToggle) {
  darkToggle.checked = false;
  darkToggle.addEventListener('change', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    setTheme('light');
  });
}
document.getElementById('logoutBtnDash').addEventListener('click', async () => {
  await logout();
  window.location.href = 'index.html';
});

// Banner de verificação de e-mail (Etapa 2)
const emailBanner = document.getElementById('emailVerificationBanner');
const currentAuthUser = getAuthCurrentUser();
if (emailBanner && currentAuthUser && !currentAuthUser.emailVerified && currentAuthUser.providerData[0]?.providerId === 'password') {
  emailBanner.style.display = 'flex';

  document.getElementById('btnCheckVerifiedBanner')?.addEventListener('click', async () => {
    const verified = await checkEmailVerified();
    if (verified) {
      emailBanner.style.display = 'none';
      showToast('E-mail verificado!', 'Seu e-mail foi confirmado com sucesso.', 'success');
    } else {
      showToast('Ainda não confirmado', 'Clique no link de confirmação que enviamos para o seu e-mail antes de validar.', 'warning');
    }
  });

  document.getElementById('btnResendEmailBanner')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      await resendVerificationEmail();
      showToast('E-mail reenviado', 'Um novo link de confirmação foi enviado para sua caixa de entrada.', 'success');
      setTimeout(() => { e.target.disabled = false; }, 15000);
    } catch (err) {
      showToast('Erro ao reenviar', err.message || '', 'error');
      e.target.disabled = false;
    }
  });
}

initRevealAnimations();
