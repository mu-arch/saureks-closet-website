const gallery = document.querySelector('.gallery');
const stage = document.querySelector('#photo-stage');
const cards = [...document.querySelectorAll('.photo-card')];
const captions = [
  'The wardrobe',
  'Character',
  'Weaponry',
  'Saved looks',
  'Weapon display',
  'Visible bags',
  'Appearance browser',
];
const caption = document.querySelector('#photo-caption');
const count = document.querySelector('#photo-count');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let active = 0;
let moving = false;
let pointerStart = null;
let suppressClick = false;

function render() {
  cards.forEach((card, index) => {
    const depth = (index - active + cards.length) % cards.length;
    card.dataset.depth = depth < 4 ? String(depth) : 'hidden';
    card.setAttribute('aria-hidden', String(depth !== 0));
  });
  caption.textContent = captions[active];
  count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
}

function move(step) {
  if (moving) return;
  moving = true;
  gallery.setAttribute('aria-busy', 'true');
  const oldCard = cards[active];
  const nextIndex = (active + step + cards.length) % cards.length;

  if (reducedMotion.matches) {
    active = nextIndex;
    render();
    moving = false;
    gallery.setAttribute('aria-busy', 'false');
    return;
  }

  // Bring the previous photo into the visible stack before sliding back.
  if (step < 0) cards[nextIndex].dataset.depth = '1';

  const direction = step > 0 ? 1 : -1;
  const distance = Math.min(stage.clientWidth * .7, 430);
  const animation = oldCard.animate([
    { transform: getComputedStyle(oldCard).transform, opacity: 1 },
    { transform: 'translate3d(' + (direction * distance) + 'px, 30px, 0) rotate(' + (direction * 14) + 'deg) scale(.93)', opacity: .15 },
  ], {
    duration: 330,
    easing: 'cubic-bezier(.22,.7,.25,1)',
    fill: 'forwards',
  });

  animation.finished.then(() => {
    active = nextIndex;
    render();
    animation.cancel();
    window.setTimeout(() => { moving = false; gallery.setAttribute('aria-busy', 'false'); }, 510);
  }).catch(() => { moving = false; gallery.setAttribute('aria-busy', 'false'); });
}

document.querySelector('#photo-hit').addEventListener('click', () => {
  if (!suppressClick) move(1);
});
document.querySelector('#gallery-next').addEventListener('click', () => move(1));
document.querySelector('#gallery-prev').addEventListener('click', () => move(-1));

gallery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
});

stage.addEventListener('pointerdown', (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});
stage.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;
  const dx = event.clientX - pointerStart.x;
  const dy = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
  suppressClick = true;
  move(dx < 0 ? 1 : -1);
  window.setTimeout(() => { suppressClick = false; }, 100);
});
stage.addEventListener('pointercancel', () => { pointerStart = null; });

render();
