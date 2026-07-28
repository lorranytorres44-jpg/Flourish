import { renderNavbar, renderFooter } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { initTheme } from './theme.js';
import { authReady, getMostLikedBooks } from './storage.js';

initTheme();
await authReady;
renderNavbar('index.html');
renderFooter();

const featured = await getMostLikedBooks(5);
const featuredTrack = document.getElementById('featuredBooks');
await renderBookGrid(featuredTrack, featured, 'Ainda não há livros curtidos o suficiente para aparecer aqui.');

const prevBtn = document.getElementById('featuredPrev');
const nextBtn = document.getElementById('featuredNext');
if (featured.length > 3) {
  const scrollByCard = (dir) => {
    const card = featuredTrack.querySelector(':scope > *');
    const amount = card ? card.getBoundingClientRect().width + 22 : featuredTrack.clientWidth / 3;
    featuredTrack.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };
  prevBtn?.addEventListener('click', () => scrollByCard(-1));
  nextBtn?.addEventListener('click', () => scrollByCard(1));
} else {
  prevBtn?.remove();
  nextBtn?.remove();
}

initRevealAnimations();

function initBenefitsAnimation() {
  const section = document.getElementById('beneficios');
  if (!section) return;
  const icons = Array.from(section.querySelectorAll('.benefit-gif[data-src]'));
  const freezeTimers = new WeakMap();

  function playOnce(img) {
    clearTimeout(freezeTimers.get(img));
    img.classList.remove('is-playing');
    img.src = `${img.dataset.src}?t=${Date.now()}`;
    requestAnimationFrame(() => img.classList.add('is-playing'));

    const duration = Number(img.dataset.duration) || 2000;
    freezeTimers.set(img, setTimeout(() => {
      if (!img.naturalWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      img.src = canvas.toDataURL('image/png');
    }, duration));
  }

  function reset(img) {
    clearTimeout(freezeTimers.get(img));
    img.classList.remove('is-playing');
    img.removeAttribute('src');
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      icons.forEach(entry.isIntersecting ? playOnce : reset);
    });
  }, { threshold: 0.2 });

  io.observe(section);
}
initBenefitsAnimation();

