let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  return container;
}

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };

export function showToast(titulo, texto = '', type = 'info', duration = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span aria-hidden="true">${ICONS[type] || ICONS.info}</span>
    <div><strong>${titulo}</strong>${texto ? `<span>${texto}</span>` : ''}</div>
  `;
  getContainer().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}
