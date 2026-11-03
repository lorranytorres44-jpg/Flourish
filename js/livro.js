import { getAnyBookById, isFavorite, toggleFavorite, isLoggedIn, getOwnerInfo, getOwnerTelefone, getMyBooks, getSession, authReady } from './storage.js';
import { EDIT_ICON, TRASH_FILLED_ICON, editarLivroUrl, confirmarExclusaoLivro } from './book-actions.js';
import { renderNavbar, renderFooter } from './navbar.js';
import { initRevealAnimations } from './book-card.js';
import { showToast } from './toast.js';
import { openModal } from './modal.js';
import { renderAvaliacoes } from './reviews.js';
import { whatsappUrl } from './validators.js';

await authReady;
renderNavbar('biblioteca.html');
renderFooter();

const escapeHTML = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HEART_PATH = 'M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.7 1.2 6 3.5C14.3 5.2 15.8 4 18 4c4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z';

const params = new URLSearchParams(window.location.search);
const bookId = params.get('id');
const book = await getAnyBookById(bookId);
const root = document.getElementById('bookDetailRoot');

// O próprio anúncio (aberto pelo "Meu acervo" ou pela Biblioteca) mostra a versão do dono: sem
// curtir, sem trocar e sem o quadro do anunciante, com editar e excluir.
const meuAnuncio = !!book && book.ownerId === getSession()?.id;
if (meuAnuncio) renderNavbar('acervo.html');

if (!book) {
  root.innerHTML = `
    <div class="empty-state bk-empty">
      <h1>Livro não encontrado</h1>
      <p>O livro que você procura não existe ou foi removido.</p>
      <a href="biblioteca.html" class="bk-action">Voltar para a biblioteca</a>
    </div>`;
} else {
  const owner = await getOwnerInfo(book.ownerId);
  document.title = `${book.titulo} — Flowrish`;
  const capaValida = (book.capa && (book.capa.startsWith('http') || book.capa.startsWith('data:') || book.capa.startsWith('assets/'))) ? book.capa : 'assets/sem-capa.svg';
  const fotosRaw = book.fotos?.length ? book.fotos : [capaValida];
  const fotos = fotosRaw.map(f => (f && (f.startsWith('http') || f.startsWith('data:') || f.startsWith('assets/'))) ? f : 'assets/sem-capa.svg');

  // A troca é combinada pelo WhatsApp do anunciante (só quem está logado vê o número).
  const telefoneDono = meuAnuncio ? '' : await getOwnerTelefone(book.ownerId).catch(() => '');
  const localizacao = [owner.cidade, owner.estado].filter(Boolean).join('/');

  const detalhes = [
    book.editora && `Editora: ${book.editora}`,
    book.edicao && `${book.edicao}ª edição`,
    book.paginas && `${book.paginas} páginas`,
    book.ano && `Ano: ${book.ano}`,
    book.semDanificacoes ? 'Sem danificações relevantes' : (book.observacoes && `Observações: ${book.observacoes}`),
  ].filter(Boolean);

  root.innerHTML = `
    <div class="bk-top">
      <div class="bk-gallery">
        <div class="bk-cover">
          <img id="galleryMain" src="${fotos[0]}" alt="Foto de capa de ${book.titulo}" onerror="this.src='assets/sem-capa.svg'">
          ${meuAnuncio ? '' : `<button type="button" class="bk-fav" id="favBtn">
            <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg>
          </button>`}
        </div>
        ${fotos.length > 1 ? `<div class="bk-thumbs">${fotos.map((f, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-src="${f}" aria-label="Ver foto ${i + 1}"><img src="${f}" alt=""></button>`).join('')}</div>` : ''}
      </div>

      <div class="bk-info">
        <h1 class="bk-title">${book.titulo}</h1>
        <p class="bk-author">${book.autor}</p>
        <div class="bk-tags">
          ${book.generos.map(g => `<span class="bk-tag bk-tag--pink">${g}</span>`).join('')}
          ${book.nacionalidade ? `<span class="bk-tag">${book.nacionalidade}</span>` : ''}
          ${book.estadoConservacao ? `<span class="bk-tag bk-tag--pink">${book.estadoConservacao}</span>` : ''}
          ${localizacao ? `<span class="bk-tag">${localizacao}</span>` : ''}
        </div>
        <p class="bk-synopsis">${book.sinopse || 'Sem sinopse disponível para este livro.'}</p>
        ${detalhes.length ? `<ul class="bk-details">${detalhes.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
        ${meuAnuncio ? `
        <div class="bk-owner-actions">
          <a class="bk-owner-btn" href="${editarLivroUrl(book)}" aria-label="Editar ${book.titulo}" title="Editar">${EDIT_ICON}</a>
          <button type="button" class="bk-owner-btn" id="deleteBookBtn" aria-label="Excluir ${book.titulo}" title="Excluir">${TRASH_FILLED_ICON}</button>
        </div>` : ''}
      </div>
    </div>

    ${meuAnuncio ? '' : `<div class="bk-bottom">
      <div class="bk-actions">
        <button type="button" class="bk-trocar" id="tradeBtn" aria-label="Trocar pelo WhatsApp">
          <span class="bk-trocar-topo" aria-hidden="true">Trocar pelo</span>
          <span class="bk-trocar-marca" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.8L2.3 21.7l4.8-1.3A9.8 9.8 0 1 0 12 2.2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path transform="translate(-1.3 0.1)" d="M8.6 7.3c.3-.5.6-.5.9-.5h.6c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.4 0 .6.4.8 1 1.5 1.7 2.1.6.5 1.3.9 2 1.2.2.1.4 0 .6-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.9c.2.1.4.2.4.4 0 .5-.1 1.1-.5 1.5-.5.5-1.3.9-2.1.8-1.5-.2-3.4-1-5-2.6S8 10.3 7.8 8.9c-.1-.6.4-1.2.8-1.6z" fill="currentColor"/></svg>
            WhatsApp
          </span>
        </button>
      </div>

      <section class="bk-owner" aria-labelledby="ownerName">
        <header class="bk-owner-head">
          <a href="anunciante.html?id=${encodeURIComponent(book.ownerId)}" class="bk-owner-link">
            <img src="${owner.foto}" alt="">
            <h2 id="ownerName">${owner.nome}</h2>
          </a>
          <p class="bk-owner-score" data-score></p>
        </header>
        <div class="bk-owner-subrow">
          <h3 class="bk-owner-sub">Avaliações</h3>
          <button type="button" class="bk-avaliar" data-avaliar hidden>Avaliar</button>
        </div>
        <div data-reviews></div>
      </section>
    </div>`}
  `;

  // Galeria
  root.querySelectorAll('.bk-thumbs button').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.getElementById('galleryMain').src = thumb.dataset.src;
      root.querySelectorAll('.bk-thumbs button').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
  });

  if (meuAnuncio) {
    document.getElementById('deleteBookBtn').addEventListener('click', () => {
      confirmarExclusaoLivro(book, { onDeleted: () => setTimeout(() => { window.location.href = 'acervo.html'; }, 900) });
    });
  } else {
    // Ações
    function requireLogin() {
      if (!isLoggedIn()) { showToast('Entre na sua conta', 'Faça login para continuar.'); return false; }
      return true;
    }

    const favBtn = document.getElementById('favBtn');
    const setFavState = () => {
      const fav = isFavorite(book.id);
      favBtn.classList.toggle('active', fav);
      favBtn.setAttribute('aria-pressed', fav);
      favBtn.setAttribute('aria-label', fav ? 'Remover dos favoritos' : 'Favoritar');
    };
    setFavState();
    favBtn.addEventListener('click', async () => {
      if (!requireLogin()) return;
      await toggleFavorite(book.id);
      setFavState();
      showToast(isFavorite(book.id) ? 'Adicionado aos favoritos' : 'Removido dos favoritos');
    });

    renderAvaliacoes(document.querySelector('.bk-owner'), owner);

    // "Trocar": quem pede escolhe um livro do próprio acervo para oferecer, e
    // a conversa no WhatsApp do anunciante já abre com a proposta escrita.
    document.getElementById('tradeBtn').addEventListener('click', async (e) => {
      if (!requireLogin()) return;
      if (!telefoneDono) {
        showToast('WhatsApp indisponível', 'Este anunciante ainda não informou o WhatsApp.');
        return;
      }
      const btn = e.currentTarget;
      btn.disabled = true;
      const meusLivros = await getMyBooks().catch(() => []);
      btn.disabled = false;
      abrirProposta(meusLivros);
    });
  }

  function abrirProposta(meusLivros) {
    const inicio = `Olá, ${owner.nome}! Vi o livro "${book.titulo}" na Flowrish e tenho interesse em trocar.`;
    // Toda mensagem de troca começa com o aviso de respeito e termina com a
    // recomendação de envio do Flowrish.
    const comAvisos = (texto) => '“Lembrem de sempre manter o respeito e cordialidade.”\n\n'
      + texto
      + '\n\n-Um método de envio recomendado pelo Flowrish é o Clique e Retire dos Correios. Acesse o site oficial para mais informações: https://www.correios.com.br';
    const urlLivro = (b) => new URL(`livro.html?id=${b.id}`, window.location.href).href;
    const linkProposta = (b) => whatsappUrl(telefoneDono,
      comAvisos(`${inicio} Ofereço em troca o meu livro "${b.titulo}"${b.autor ? `, de ${b.autor}` : ''}: ${urlLivro(b)}`));
    const lista = meusLivros
      .sort((a, b) => new Date(b.dataCadastro) - new Date(a.dataCadastro))
      .map(b => `
        <li>
          <a class="proposta-livro" href="${linkProposta(b)}" target="_blank" rel="noopener" data-proposta>
            <img src="${escapeHTML(b.capa)}" alt="" onerror="this.src='assets/sem-capa.svg'">
            <span><strong>${escapeHTML(b.titulo)}</strong>${b.autor ? `<small>${escapeHTML(b.autor)}</small>` : ''}</span>
          </a>
        </li>`).join('');

    openModal(`
      <button type="button" class="proposta-fechar" data-modal-close aria-label="Fechar">✕</button>
      <h3 id="propostaTitle" class="proposta-titulo">Qual livro você oferece em troca?</h3>
      ${meusLivros.length ? `
        <p class="proposta-texto">Escolha um livro do seu acervo para propor a ${escapeHTML(owner.nome.split(' ')[0])} por "${escapeHTML(book.titulo)}".</p>
        <ul class="proposta-lista">${lista}</ul>` : `
        <p class="proposta-texto">Você ainda não tem livros no seu acervo. Anuncie um para oferecer em troca.</p>
        <a class="proposta-anunciar" href="cadastrar-livro.html">Anunciar um livro</a>`}
    `, { labelledBy: 'propostaTitle', className: 'proposta-modal', onMount: (overlay, close) => {
      overlay.querySelectorAll('[data-proposta]').forEach(a => a.addEventListener('click', close));
    }});
  }

  initRevealAnimations();
}
