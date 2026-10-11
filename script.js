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
const playButton = document.querySelector('#gallery-play');
const progress = document.querySelector('#gallery-progress-fill');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const slideDelay = 5600;
let active = 0;
let moving = false;
let playing = !reducedMotion.matches;
let userOverride = false;
let autoTimer = 0;
let pointerStart = null;
let suppressClick = false;
let hovering = false;

function sizeCards() {
  const maxWidth = Math.min(stage.clientWidth * .86, 620);
  const maxHeight = Math.min(stage.clientHeight * .82, 470);
  cards.forEach((card) => {
    const image = card.querySelector('img');
    const ratio = Number(image.getAttribute('width')) / Number(image.getAttribute('height'));
    const style = getComputedStyle(card);
    const frame = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const imageWidth = Math.min(maxWidth - frame, (maxHeight - frame) * ratio);
    card.style.width = Math.round(imageWidth + frame) + 'px';
  });
}

function render() {
  cards.forEach((card, index) => {
    const depth = (index - active + cards.length) % cards.length;
    card.dataset.depth = depth < 4 ? String(depth) : 'hidden';
    card.setAttribute('aria-hidden', String(depth !== 0));
    card.tabIndex = depth === 0 ? 0 : -1;
    if (depth === 0) card.setAttribute('aria-label', 'Show next screenshot. Current image: ' + captions[index]);
  });
  caption.textContent = captions[active];
  count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
}

function updatePlayButton() {
  playButton.setAttribute('aria-pressed', String(playing));
  playButton.setAttribute('aria-label', playing ? 'Pause slideshow' : 'Play slideshow');
  playButton.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
}

function scheduleAuto() {
  window.clearTimeout(autoTimer);
  progress.style.animation = 'none';
  if (!playing || moving || (!userOverride && (hovering || gallery.contains(document.activeElement)))) return;
  void progress.offsetWidth;
  progress.style.animation = 'fill-progress ' + slideDelay + 'ms linear forwards';
  progress.style.animationPlayState = 'running';
  autoTimer = window.setTimeout(() => move(1), slideDelay);
}

function finishMove(nextIndex, animation) {
  active = nextIndex;
  render();
  if (animation) animation.cancel();
  if (!reducedMotion.matches) {
    const incoming = cards[active];
    incoming.animate([
      { transform: 'translate(-50%, -50%) translateY(18px) rotate(-7deg) scale(.83)', opacity: .25 },
      { transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)', opacity: 1 },
    ], {
      duration: 460,
      easing: 'cubic-bezier(.16,.72,.24,1)',
    });
  }
  window.setTimeout(() => {
    moving = false;
    gallery.setAttribute('aria-busy', 'false');
    scheduleAuto();
  }, reducedMotion.matches ? 0 : 500);
}

function move(step) {
  if (moving) return;
  moving = true;
  gallery.setAttribute('aria-busy', 'true');
  window.clearTimeout(autoTimer);
  progress.style.animation = 'none';
  const oldCard = cards[active];
  const nextIndex = (active + step + cards.length) % cards.length;

  if (reducedMotion.matches) {
    finishMove(nextIndex, null);
    return;
  }

  if (step < 0) cards[nextIndex].dataset.depth = '1';
  const direction = step > 0 ? 1 : -1;
  const distance = Math.min(stage.clientWidth * .38, 250);
  const animation = oldCard.animate([
    { transform: getComputedStyle(oldCard).transform, opacity: 1 },
    { transform: 'translate(-50%, -50%) translateX(' + (direction * distance) + 'px) rotate(' + (direction * 12) + 'deg) scale(.62)', opacity: 0 },
  ], {
    duration: 460,
    easing: 'cubic-bezier(.22,.64,.24,1)',
    fill: 'forwards',
  });

  animation.finished.then(() => finishMove(nextIndex, animation)).catch(() => {
    moving = false;
    gallery.setAttribute('aria-busy', 'false');
    scheduleAuto();
  });
}

cards.forEach((card, index) => {
  card.addEventListener('click', () => {
    if (index === active && !suppressClick) move(1);
  });
});
document.querySelector('#gallery-next').addEventListener('click', () => move(1));
document.querySelector('#gallery-prev').addEventListener('click', () => move(-1));
playButton.addEventListener('click', () => {
  playing = !playing;
  userOverride = playing;
  updatePlayButton();
  scheduleAuto();
});

gallery.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
});
gallery.addEventListener('mouseenter', () => {
  hovering = true;
  if (!userOverride) {
    window.clearTimeout(autoTimer);
    progress.style.animationPlayState = 'paused';
  }
});
gallery.addEventListener('mouseleave', () => {
  hovering = false;
  scheduleAuto();
});
gallery.addEventListener('focusin', () => {
  if (!userOverride) {
    window.clearTimeout(autoTimer);
    progress.style.animationPlayState = 'paused';
  }
});
gallery.addEventListener('focusout', () => {
  window.setTimeout(scheduleAuto, 0);
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
window.addEventListener('resize', sizeCards);

sizeCards();
render();
updatePlayButton();
scheduleAuto();
