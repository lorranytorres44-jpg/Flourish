import { getTheme, setTheme } from './storage.js';

export function initTheme() {
  const theme = getTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
