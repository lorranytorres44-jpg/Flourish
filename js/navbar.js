import { getSession, logout, getPoints, getNotifications, unreadCount, markNotificationsRead } from './storage.js';
import { openModal } from './modal.js';

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

export function renderNavbar(activePage = '') {
  const root = document.getElementById('navbar-root');
  if (!root) return;
  const session = getSession();
  const points = getPoints();

  const linksHTML = NAV_LINKS.map(l => `<a href="${l.href}" class="${activePage === l.href ? 'active' : ''}">${l.label}</a>`).join('');

  const authArea = session
    ? `
      <div class="user-menu">
        <button class="btn-icon notif-btn" aria-label="Notificações" id="notifBtn">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
          ${unreadCount() > 0 ? '<span class="notif-dot"></span>' : ''}
        </button>
        <div class="notif-panel" id="notifPanel"></div>
      </div>
      <span class="points-pill" title="Seus pontos">★ ${points ?? 0}</span>
      <div class="user-menu">
        <button class="user-avatar-btn" id="userMenuBtn">
          <img src="${session.foto}" alt="" width="32" height="32">
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

  root.innerHTML = `
    <header class="navbar">
      <div class="navbar-inner">
        <a href="index.html" class="logo">
          <span class="logo-mark" aria-hidden="true">
            <img src="assets/livro-logo.png" width="20" height="20" alt="">
          </span>
          <span class="logo-text">Flowrish</span>
        </a>
        <nav class="nav-links" aria-label="Navegação principal">${linksHTML}</nav>
        <form class="nav-search" role="search" id="navSearchForm">
          <span class="icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          </span>
          <input type="search" id="navSearchInput" placeholder="Buscar livros, autores..." aria-label="Buscar livros">
        </form>
        <div class="nav-actions">
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
          <span class="icon" aria-hidden="true">🔎</span>
          <input type="search" id="mobileSearchInput" placeholder="Buscar livros, autores..." aria-label="Buscar livros">
        </form>
        ${NAV_LINKS.map(l => `<a href="${l.href}">${l.label}</a>`).join('')}
        <div class="dropdown-divider"></div>
        ${session ? `<a href="perfil.html">Meu Perfil</a><button id="mobileLogout">Sair</button>` : `<a href="login.html">Entrar</a><a href="cadastro.html">Cadastrar</a>`}
      </div>
    </div>
  `;

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
