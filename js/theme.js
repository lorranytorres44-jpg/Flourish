export function getTheme() {
  const saved = localStorage.getItem('tdl_theme')?.replace(/"/g, '');
  if (saved === 'dark' || saved === 'light') return saved;
  return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
}

export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem('tdl_theme', t);
  document.documentElement.setAttribute('data-theme', t);
  window.dispatchEvent(new CustomEvent('tdl:theme-changed', { detail: { theme: t } }));
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function initTheme() {
  const t = getTheme();
  document.documentElement.setAttribute('data-theme', t);
}

