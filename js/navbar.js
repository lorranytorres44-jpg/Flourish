import { getSession, logout } from './storage.js';
import { openModal } from './modal.js';
import { getTheme, toggleTheme } from './theme.js';

const NAV_LINKS = [
  { href: 'index.html', label: 'Início' },
  { href: 'biblioteca.html', label: 'Biblioteca' },
  { href: 'cadastrar-livro.html', label: 'Anunciar Livro', shortLabel: 'Anunciar', requiresLogin: true },
  // Livros anunciados pelo usuário, com editar e excluir.
  { href: 'acervo.html', label: 'Meu acervo', requiresLogin: true },
];

function getThemeIconSVG(theme) {
  return theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
}

// Logo: o "o" de Flowrish vira uma flor.
const FLOWER_LOGO = `Fl<img class="logo-flower" src="assets/flor-logo.svg" alt="">wrish`;

// Barra do topo de todas as páginas: busca à esquerda, sem "Início" (o logo
// leva à home), rótulos curtos e logo com flor.
export function renderNavbar(activePage = '') {
  initTheme();
  const root = document.getElementById('navbar-root');
  if (!root) return;
  const session = getSession();

  // Sem login o menu aparece inteiro, mas os links de quem está logado ficam
  // bloqueados: clicar abre o aviso de login em vez de abrir a página.
  const visibleLinks = NAV_LINKS;
  const bloqueado = (l) => l.requiresLogin && !session;
  const lockAttrs = (l) => bloqueado(l) ? ' data-requires-login title="Entre na sua conta para acessar"' : '';
  const linksHTML = visibleLinks
    .filter(l => l.href !== 'index.html')
    .map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}"${lockAttrs(l)}>${l.shortLabel || l.label}</a>`).join('');

  const authArea = session
    ? `
      <div class="user-menu">
        <button class="user-avatar-btn" id="userMenuBtn">
          <img src="${session.foto}" alt="" width="32" height="32">
          <span>${session.nome.split(' ')[0]}</span>
        </button>
        <div class="dropdown-menu user-dropdown" id="userDropdown">
          <a href="perfil.html">Perfil</a>
          <a href="perfil.html#config">Configurações</a>
          <button id="logoutBtn">Sair</button>
        </div>
      </div>
    `
    // Sem login: só "Entrar" (o cadastro fica acessível pela tela de login).
    : `<a href="login.html" class="btn btn-sm nav-login">Entrar</a>`;

  const curTheme = getTheme();
  const themeBtnHTML = `
    <button class="btn-icon theme-toggle-btn" id="navThemeToggleBtn" aria-label="Alternar modo claro/escuro" title="Alternar modo claro/escuro">
      ${getThemeIconSVG(curTheme)}
    </button>
  `;

  root.innerHTML = `
    <header class="navbar navbar--home">
      <div class="navbar-inner">
        <a href="index.html" class="logo" aria-label="Flowrish — início">
          <span class="logo-text">${FLOWER_LOGO}</span>
        </a>
        <nav class="nav-links" aria-label="Navegação principal">${linksHTML}</nav>
        <form class="nav-search" role="search" id="navSearchForm">
          <span class="icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="search" id="navSearchInput" autocomplete="off" placeholder="Autor ou livro" aria-label="Buscar livros">
        </form>
        <div class="nav-actions">
          ${themeBtnHTML}
          ${authArea}
          <button class="nav-toggle" id="navToggle" aria-label="Abrir menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-drawer" id="mobileDrawer">
      <div class="mobile-drawer-panel">
        <div class="flex justify-between items-center" style="margin-bottom:12px;">
          <strong>Menu</strong>
          <button class="btn-icon" id="closeDrawer" aria-label="Fechar menu">✕</button>
        </div>
        <form class="nav-search mobile-search" id="mobileSearchForm">
          <span class="icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
          <input type="search" id="mobileSearchInput" placeholder="Buscar livros, autores..." aria-label="Buscar livros">
        </form>
        ${visibleLinks.map(l => `<a href="${l.href}"${lockAttrs(l)}>${l.label}</a>`).join('')}
        <button class="btn btn-secondary btn-sm" id="mobileThemeToggle" style="margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">
          ${getThemeIconSVG(curTheme)}
          <span id="mobileThemeText">${curTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
        <div class="dropdown-divider"></div>
        ${session ? `<a href="perfil.html">Meu Perfil</a><button id="mobileLogout">Sair</button>` : `<a href="login.html">Entrar</a><a href="cadastro.html">Cadastrar</a>`}
      </div>
    </div>
  `;

  const handleThemeToggle = () => {
    const newTheme = toggleTheme();
    updateThemeButtons(newTheme);
  };

  function updateThemeButtons(theme) {
    const navBtn = document.getElementById('navThemeToggleBtn');
    if (navBtn) navBtn.innerHTML = getThemeIconSVG(theme);
    const mobBtn = document.getElementById('mobileThemeToggle');
    if (mobBtn) {
      mobBtn.innerHTML = `
        ${getThemeIconSVG(theme)}
        <span id="mobileThemeText">${theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
      `;
    }
  }

  document.getElementById('navThemeToggleBtn')?.addEventListener('click', handleThemeToggle);
  document.getElementById('mobileThemeToggle')?.addEventListener('click', handleThemeToggle);
  window.addEventListener('tdl:theme-changed', (e) => {
    if (e.detail?.theme) updateThemeButtons(e.detail.theme);
  });

  const navToggle = document.getElementById('navToggle');
  const drawer = document.getElementById('mobileDrawer');
  navToggle?.addEventListener('click', () => drawer.classList.add('open'));
  document.getElementById('closeDrawer')?.addEventListener('click', () => drawer.classList.remove('open'));
  drawer?.addEventListener('click', (e) => { if (e.target === drawer) drawer.classList.remove('open'); });

  root.querySelectorAll('[data-requires-login]').forEach(link => link.addEventListener('click', (e) => {
    e.preventDefault();
    drawer?.classList.remove('open');
    requireLoginModal();
  }));

  const doSearch = (value) => {
    if (!value.trim()) return;
    window.location.href = `biblioteca.html?busca=${encodeURIComponent(value.trim())}`;
  };
  document.getElementById('navSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(document.getElementById('navSearchInput').value);
  });
  document.getElementById('mobileSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    doSearch(document.getElementById('mobileSearchInput').value);
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => { await logout(); window.location.href = 'index.html'; });
  document.getElementById('mobileLogout')?.addEventListener('click', async () => { await logout(); window.location.href = 'index.html'; });

  const userBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    userDropdown?.classList.remove('open');
  });
}

// dismissible: aberto por um clique no menu — a pessoa continua na página,
// então o segundo botão só fecha o aviso (em vez de "Voltar ao início").
export function requireLoginModal() {
  openModal(`
    <h3 id="loginRequiredTitle" class="login-aviso-titulo">O login é necessário para acessar essa área!</h3>
    <a href="login.html" class="login-aviso-entrar">Entrar</a>
  `, { labelledBy: 'loginRequiredTitle', className: 'login-aviso' });
}

export function renderFooter() {
  const root = document.getElementById('footer-root');
  if (!root) return;
  root.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <div class="footer-logo"><span aria-hidden="true">${FLOWER_LOGO}</span><span class="visually-hidden">Flowrish</span></div>
          </div>
          <div class="footer-col footer-links-inline">
            <a href="ajuda.html">Central de ajuda</a>
            <a href="assets/termos.pdf" target="_blank" rel="noopener">Termos de uso e política de privacidade</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Flowrish</span>
        </div>
      </div>
    </footer>
  `;
}
