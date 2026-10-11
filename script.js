const gallery = document.querySelector('.gallery');
const stage = document.querySelector('#photo-stage');
const cards = [...document.querySelectorAll('.photo-card')];
const videoCard = cards.find((card) => card.querySelector('video'));
const demoVideo = videoCard?.querySelector('video');
const captions = [
  'In motion',
  'The wardrobe',
  'Character',
  'Weaponry',
  'Saved looks',
  'Weapon display',
  'Appearance browser',
];
const caption = document.querySelector('#photo-caption');
const count = document.querySelector('#photo-count');
const playButton = document.querySelector('#gallery-play');
const progress = document.querySelector('#gallery-progress-fill');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const installButton = document.querySelector('.button-gold');
const cardMedia = cards.map((card) => card.querySelector('img, video'));
let resizeFrame = 0;
const slideDelay = 5600;
let active = 0;
let moving = false;
let playing = true;
let userOverride = true;
let autoTimer = 0;
let pointerStart = null;
let suppressClick = false;
let hovering = false;
let videoPlaybackFailed = false;

installButton.addEventListener('click', () => {
  if (reducedMotion.matches) return;
  installButton.classList.remove('is-pulsing');
  void installButton.offsetWidth;
  installButton.classList.add('is-pulsing');
});
installButton.addEventListener('animationend', (event) => {
  if (event.animationName === 'install-golden-pulse') installButton.classList.remove('is-pulsing');
});

function sizeCards() {
  const maxWidth = Math.min(stage.clientWidth * .86, 620);
  const maxHeight = Math.min(stage.clientHeight * .82, 470);
  const widths = cards.map((card, index) => {
    const media = cardMedia[index];
    const ratio = Number(media.getAttribute('width')) / Number(media.getAttribute('height'));
    const style = getComputedStyle(card);
    const frame = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const imageWidth = Math.min(maxWidth - frame, (maxHeight - frame) * ratio);
    return Math.round(imageWidth + frame) + 'px';
  });
  cards.forEach((card, index) => { card.style.width = widths[index]; });
}

function render(exitingCard = null) {
  cards.forEach((card, index) => {
    const depth = (index - active + cards.length) % cards.length;
    if (card !== exitingCard) card.dataset.depth = depth < 4 ? String(depth) : 'hidden';
    card.setAttribute('aria-hidden', String(depth !== 0));
    card.tabIndex = depth === 0 ? 0 : -1;
    if (depth === 0) card.setAttribute('aria-label', 'Show next preview. Current: ' + captions[index]);
  });
  caption.textContent = captions[active];
  count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  syncVideo(exitingCard);
  updatePlayButton();
}

function syncVideo(exitingCard = null) {
  if (!demoVideo) return;
  if (cards[active] !== videoCard) {
    if (videoCard === exitingCard) return;
    demoVideo.pause();
    if (demoVideo.readyState) demoVideo.currentTime = 0;
    return;
  }
  if (demoVideo.readyState) demoVideo.currentTime = 0;
  videoPlaybackFailed = false;
  if (!playing || document.hidden) {
    demoVideo.pause();
    return;
  }
  demoVideo.play().catch(() => {
    videoPlaybackFailed = true;
    scheduleAuto();
  });
}

function updatePlayButton() {
  playButton.setAttribute('aria-pressed', String(playing));
  const subject = cards[active] === videoCard ? 'video and slideshow' : 'slideshow';
  playButton.setAttribute('aria-label', (playing ? 'Pause ' : 'Play ') + subject);
  playButton.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
}

function scheduleAuto() {
  window.clearTimeout(autoTimer);
  progress.style.animation = 'none';
  if (document.hidden || !playing || moving || (!userOverride && (hovering || gallery.contains(document.activeElement)))) return;
  if (cards[active] === videoCard && !videoPlaybackFailed) {
    const remaining = Number.isFinite(demoVideo.duration)
      ? Math.max(1000, (demoVideo.duration - demoVideo.currentTime) * 1000 + 1000)
      : 22000;
    autoTimer = window.setTimeout(() => move(1), remaining);
    return;
  }
  progress.style.width = '0%';
  void progress.offsetWidth;
  progress.style.animation = 'fill-progress ' + slideDelay + 'ms linear forwards';
  progress.style.animationPlayState = 'running';
  autoTimer = window.setTimeout(() => move(1), slideDelay);
}

function finishMove(oldCard, animation) {
  const oldIndex = cards.indexOf(oldCard);
  const depth = (oldIndex - active + cards.length) % cards.length;
  oldCard.dataset.depth = depth < 4 ? String(depth) : 'hidden';
  oldCard.classList.remove('is-exiting');
  animation.cancel();
  if (oldCard === videoCard) syncVideo();
  window.setTimeout(() => {
    moving = false;
    gallery.setAttribute('aria-busy', 'false');
    scheduleAuto();
  }, reducedMotion.matches ? 0 : 100);
}

function move(step) {
  if (moving) return;
  moving = true;
  gallery.setAttribute('aria-busy', 'true');
  window.clearTimeout(autoTimer);
  progress.style.animation = 'none';
  const oldCard = cards[active];
  const nextIndex = (active + step + cards.length) % cards.length;

  if (step < 0) {
    cards[nextIndex].dataset.depth = '1';
    void cards[nextIndex].offsetWidth;
  }
  const direction = step > 0 ? -1 : 1;
  const distance = Math.min(stage.clientWidth * .38, 250);
  const startTransform = getComputedStyle(oldCard).transform;
  oldCard.classList.add('is-exiting');
  const frames = reducedMotion.matches
    ? [{ opacity: 1 }, { opacity: 0 }]
    : [
      { transform: startTransform, opacity: 1 },
      { transform: 'translate(-50%, -50%) translateX(' + (direction * distance) + 'px) rotate(' + (direction * 12) + 'deg) scale(.62)', opacity: 0 },
    ];
  const animation = oldCard.animate(frames, {
    duration: reducedMotion.matches ? 180 : 460,
    easing: 'cubic-bezier(.22,.64,.24,1)',
    fill: 'forwards',
  });

  active = nextIndex;
  render(oldCard);
  if (reducedMotion.matches) {
    cards[active].animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: 'ease-out',
    });
  }
  animation.finished.then(
    () => finishMove(oldCard, animation),
    () => finishMove(oldCard, animation),
  );
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
  if (cards[active] === videoCard) {
    if (playing) {
      if (demoVideo.ended && demoVideo.readyState) demoVideo.currentTime = 0;
      videoPlaybackFailed = false;
      demoVideo.play().catch(() => {
        videoPlaybackFailed = true;
        scheduleAuto();
      });
    } else {
      demoVideo.pause();
    }
  }
  updatePlayButton();
  scheduleAuto();
});

if (demoVideo) {
  demoVideo.addEventListener('timeupdate', () => {
    if (cards[active] === videoCard && Number.isFinite(demoVideo.duration)) {
      progress.style.width = (demoVideo.currentTime / demoVideo.duration * 100) + '%';
    }
  });
  demoVideo.addEventListener('ended', () => {
    if (cards[active] === videoCard && playing) move(1);
  });
}

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
window.addEventListener('resize', () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(sizeCards);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(autoTimer);
    progress.style.animationPlayState = 'paused';
    demoVideo?.pause();
    return;
  }
  if (playing && cards[active] === videoCard) {
    demoVideo.play().catch(() => {
      videoPlaybackFailed = true;
      scheduleAuto();
    });
  }
  scheduleAuto();
});

sizeCards();
render();
stage.classList.add('is-sized');
scheduleAuto();
