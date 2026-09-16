import { getSession, logout, getPoints, getNotifications, unreadCount, markNotificationsRead, isLoggedIn } from './storage.js';
import { openModal } from './modal.js';
import { getTheme, toggleTheme } from './theme.js';

const NAV_LINKS = [
  { href: 'index.html', label: 'Início' },
  { href: 'biblioteca.html', label: 'Biblioteca' },
  { href: 'cadastrar-livro.html', label: 'Anunciar Livro' },
  { href: 'dashboard.html', label: 'Minha Área' },
];

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} d atrás`;
}

let currentActiveNavPage = '';

function getThemeIconSVG(theme) {
  return theme === 'dark'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
}

export function renderNavbar(activePage = '') {
  if (activePage) currentActiveNavPage = activePage;
  const root = document.getElementById('navbar-root');
  if (!root) return;
  const session = getSession();
  const points = getPoints();

  const linksHTML = NAV_LINKS.map(l => `<a href="${l.href}" class="${currentActiveNavPage === l.href ? 'active' : ''}">${l.label}</a>`).join('');

  const authArea = session
    ? `
      <div class="user-menu">
        <button class="btn-icon notif-btn" aria-label="Notificações" id="notifBtn">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
          ${unreadCount() > 0 ? '<span class="notif-dot"></span>' : ''}
        </button>
        <div class="notif-panel" id="notifPanel"></div>
      </div>
      <span class="points-pill" title="Seus pontos">🌸 ${points ?? 0} pts</span>
      <div class="user-menu">
        <button class="user-avatar-btn" id="userMenuBtn">
          <img src="${session.foto || 'assets/default-avatar.svg'}" alt="" width="34" height="34">
          <span>${session.nome.split(' ')[0]}</span>
        </button>
        <div class="dropdown-menu" id="userDropdown">
          <a href="perfil.html">👤 Meu Perfil</a>
          <a href="dashboard.html">📊 Minha Área</a>
          <a href="cadastrar-livro.html">➕ Anunciar Livro</a>
          <div class="dropdown-divider"></div>
          <button id="logoutBtn">🚪 Sair</button>
        </div>
      </div>
    `
    : `
      <a href="login.html" class="btn btn-ghost btn-sm">Entrar</a>
      <a href="cadastro.html" class="btn btn-primary btn-sm">Cadastrar</a>
    `;

  const curTheme = getTheme();
  const themeBtnHTML = `
    <button class="btn-icon theme-toggle-btn" id="navThemeToggleBtn" aria-label="Alternar tema claro/escuro" title="Alternar modo escuro/claro">
      ${getThemeIconSVG(curTheme)}
    </button>
  `;

  root.innerHTML = `
    <header class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="logo" aria-label="Flourish Início">
          <img src="assets/logo-horizontal.png" alt="Flourish" class="logo-horizontal-img">
        </a>
        <nav class="nav-links" aria-label="Navegação principal">${linksHTML}</nav>
        <form class="nav-search" role="search" id="navSearchForm">
          <span class="icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="search" id="navSearchInput" placeholder="Buscar livros, autores..." aria-label="Buscar livros">
        </form>
        <div class="nav-actions">
          ${themeBtnHTML}
          ${authArea}
          <button class="nav-toggle" id="navToggle" aria-label="Abrir menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
    </header>
    <div class="mobile-drawer" id="mobileDrawer">
      <div class="mobile-drawer-panel">
        <div class="flex justify-between items-center" style="margin-bottom:14px;">
          <img src="assets/logo-horizontal-marrom.png" alt="Flourish" style="height:36px;">
          <button class="btn-icon" id="closeDrawer" aria-label="Fechar menu">✕</button>
        </div>
        <form class="nav-search mobile-search" id="mobileSearchForm">
          <span class="icon" aria-hidden="true">🔎</span>
          <input type="search" id="mobileSearchInput" placeholder="Buscar livros, autores..." aria-label="Buscar livros">
        </form>
        ${NAV_LINKS.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
        <div class="dropdown-divider"></div>
        <button class="btn-icon" id="mobileThemeToggle" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 14px;background:none;border:none;color:var(--text);font-size:0.95rem;cursor:pointer;border-radius:var(--radius-pill);">
          ${getThemeIconSVG(curTheme)}
          <span id="mobileThemeText">${curTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
        <div class="dropdown-divider"></div>
        ${session ? `<a href="perfil.html">Meu Perfil</a><button id="mobileLogout">Sair</button>` : `<a href="login.html" class="btn btn-ghost btn-block">Entrar</a><a href="cadastro.html" class="btn btn-primary btn-block">Cadastrar</a>`}
      </div>
    </div>
  `;

  // ---- Sliding pill indicator ----
  const navLinksEl = root.querySelector('.nav-links');
  if (navLinksEl) {
    const slider = document.createElement('span');
    slider.className = 'nav-pill-slider';
    navLinksEl.prepend(slider);

    function moveSliderTo(linkEl) {
      if (!linkEl) return;
      const navRect = navLinksEl.getBoundingClientRect();
      const linkRect = linkEl.getBoundingClientRect();
      const left = linkRect.left - navRect.left;
      navLinksEl.style.setProperty('--pill-left', left + 'px');
      navLinksEl.style.setProperty('--pill-width', linkRect.width + 'px');
    }

    const activeLink = navLinksEl.querySelector('a.active');
    setTimeout(() => moveSliderTo(activeLink), 10);

    navLinksEl.querySelectorAll('a').forEach(a => {
      a.addEventListener('mouseenter', () => moveSliderTo(a));
      a.addEventListener('mouseleave', () => moveSliderTo(navLinksEl.querySelector('a.active')));
    });
  }

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
    document.getElementById('notifPanel')?.classList.remove('open');
  });

  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!notifPanel.classList.contains('open')) {
      renderNotifPanel(notifPanel);
      markNotificationsRead();
      notifBtn.querySelector('.notif-dot')?.remove();
    }
    notifPanel.classList.toggle('open');
    userDropdown?.classList.remove('open');
  });

  document.addEventListener('click', () => {
    userDropdown?.classList.remove('open');
    notifPanel?.classList.remove('open');
  });
}

function renderNotifPanel(panel) {
  const notifications = getNotifications();
  panel.innerHTML = `
    <div class="notif-panel-head">Notificações</div>
    ${notifications.length === 0
      ? '<div class="empty-state" style="padding:24px;"><p>Nenhuma notificação ainda.</p></div>'
      : notifications.slice(0, 10).map(n => `
        <div class="notif-item ${n.lida ? 'read' : ''}">
          <span class="dot" aria-hidden="true"></span>
          <div>
            <strong style="font-size:0.88rem;">${n.titulo}</strong>
            <div style="font-size:0.83rem;color:var(--text-muted);">${n.texto}</div>
            <div class="time">${timeAgo(n.criadoEm)}</div>
          </div>
        </div>
      `).join('')}
  `;
}

export function requireLoginModal(message = 'Você precisa estar logado para acessar esta área.') {
  if (isLoggedIn()) return; // Se já está autenticado, nunca abre modal
  openModal(`
    <div class="modal-header">
      <h3 id="loginRequiredTitle">Login necessário</h3>
    </div>
    <p>${message}</p>
    <div style="display:flex;gap:12px;margin-top:20px;">
      <a href="login.html" class="btn btn-primary btn-block">Entrar</a>
      <a href="index.html" class="btn btn-ghost btn-block">Voltar ao início</a>
    </div>
  `, { labelledBy: 'loginRequiredTitle' });
}

export function renderFooter() {
  const root = document.getElementById('footer-root');
  if (!root) return;
  root.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-col">
            <div class="footer-logo">
              <span class="logo-mark" aria-hidden="true" style="background:rgba(255,255,255,0.15);">
                <img src="assets/livro-logo.png" width="20" height="20" alt="">
              </span>
              Flowrish
            </div>
            <p>Uma comunidade de leitores que acredita que todo livro merece ser lido mais de uma vez, por mais de uma pessoa.</p>
            <div class="footer-social">
              <a href="#" aria-label="Instagram"><img src="assets/instagram.png" width="20" height="20" alt=""></a>
              <a href="#" aria-label="Facebook"><img src="assets/facebook.png" width="20" height="20" alt=""></a>
              <a href="#" aria-label="Twitter/X"><img src="assets/twitter.png" width="20" height="20" alt=""></a>
            </div>
          </div>
          <div class="footer-col">
            <h4>Plataforma</h4>
            <a href="biblioteca.html">Biblioteca</a>
            <a href="cadastrar-livro.html">Anunciar livro</a>
            <a href="dashboard.html">Minha área</a>
            <a href="index.html#como-funciona">Como funciona</a>
            <a href="index.html#beneficios">Benefícios</a>
          </div>
          <div class="footer-col">
            <h4>Legal</h4>
            <a href="ajuda.html">Central de ajuda</a>
            <a href="termos.html">Termos de uso e política de privacidade</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} Flowrish. Todos os direitos reservados.</span>
          <span>Feito com 💚 para leitores.</span>
        </div>
      </div>
    </footer>
  `;
}

window.addEventListener('tdl:auth-changed', () => {
  const root = document.getElementById('navbar-root');
  if (root && root.innerHTML.trim().length > 0) {
    renderNavbar(currentActiveNavPage);
  }
});
