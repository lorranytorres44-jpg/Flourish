import { renderNavbar, renderFooter } from './navbar.js';
import { renderBookGrid, initRevealAnimations } from './book-card.js';
import { authReady, getMostLikedBooks } from './storage.js';

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
