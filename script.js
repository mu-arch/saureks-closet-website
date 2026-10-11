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
const previewDialog = document.querySelector('#preview-dialog');
const previewControls = previewDialog.querySelector('.gallery-controls');
const previewTitle = document.querySelector('#preview-title');
const previewCount = document.querySelector('#preview-count');
let previewCard = null;
let previewHome = null;
let previewBusy = false;
let previewClosing = false;
let previewCloseRequested = false;
let resumePreviewVideo = false;
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

async function loadInstallVersion() {
  const badge = installButton.querySelector('.button-version');
  if (!badge) return;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch('https://api.github.com/repos/mu-arch/SaureksCloset/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return;
    const release = await response.json();
    if (typeof release.tag_name !== 'string') return;
    const version = release.tag_name.trim();
    if (!version || version.length > 64) return;
    badge.textContent = version;
    badge.title = 'Latest release: ' + version;
    badge.hidden = false;
    installButton.classList.add('has-version');
  } catch {
    // This optional lookup must never interrupt the Install link.
  } finally {
    window.clearTimeout(timeout);
  }
}

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
  cards.forEach((card, index) => {
    if (card === previewCard) previewHome.width = widths[index];
    else card.style.width = widths[index];
  });
}

function render(exitingCard = null, updateVideo = true) {
  cards.forEach((card, index) => {
    const depth = (index - active + cards.length) % cards.length;
    if (card !== exitingCard) card.dataset.depth = depth < 4 ? String(depth) : 'hidden';
    card.setAttribute('aria-hidden', String(depth !== 0));
    card.tabIndex = depth === 0 ? 0 : -1;
    if (depth === 0) card.setAttribute('aria-label', 'Enlarge preview: ' + captions[index]);
  });
  caption.textContent = captions[active];
  count.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  if (updateVideo) syncVideo(exitingCard);
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
  if (!playing || document.hidden || previewDialog.open) {
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
  if (document.hidden || previewDialog.open || !playing || moving || (!userOverride && (hovering || gallery.contains(document.activeElement)))) return;
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

function fadeBackCard(card) {
  // Keep the rear card at its current pose while render moves it to hidden.
  // The visibility override lasts only until this fade finishes.
  const transform = getComputedStyle(card).transform;
  card.classList.add('is-fading-back');
  const fade = card.animate([
    { transform, opacity: 1 },
    { transform, opacity: 0 },
  ], {
    duration: reducedMotion.matches ? 140 : 240,
    easing: 'ease-out',
    fill: 'both',
  });
  const finishFade = () => {
    card.classList.remove('is-fading-back');
    fade.cancel();
  };
  fade.finished.then(finishFade, finishFade);
}

function finishMove(oldCard, animation) {
  const oldIndex = cards.indexOf(oldCard);
  const depth = (oldIndex - active + cards.length) % cards.length;
  oldCard.dataset.depth = depth < 4 ? String(depth) : 'hidden';
  oldCard.classList.remove('is-exiting', 'is-retreating');
  animation.cancel();
  if (oldCard === videoCard) syncVideo();
  window.setTimeout(() => {
    moving = false;
    gallery.setAttribute('aria-busy', 'false');
    scheduleAuto();
  }, reducedMotion.matches ? 0 : 100);
}

function move(step) {
  if (moving || previewDialog.open) return;
  moving = true;
  gallery.setAttribute('aria-busy', 'true');
  window.clearTimeout(autoTimer);
  progress.style.animation = 'none';
  const oldCard = cards[active];
  const nextIndex = (active + step + cards.length) % cards.length;
  const incomingCard = cards[nextIndex];

  if (step < 0) incomingCard.classList.add('is-entering');
  const distance = Math.min(stage.clientWidth * .38, 250);
  const startTransform = getComputedStyle(oldCard).transform;
  const goingBack = step < 0;
  if (goingBack) fadeBackCard(cards[(active + 3) % cards.length]);
  oldCard.classList.add(goingBack ? 'is-retreating' : 'is-exiting');
  // Previous returns the current card directly to the second stack position.
  // Keep its final CSS transform underneath the animation so cleanup cannot pop it back in.
  if (goingBack) oldCard.dataset.depth = '1';
  const endTransform = goingBack
    ? getComputedStyle(oldCard).transform
    : 'translate(-50%, -50%) translateX(' + (-distance) + 'px) rotate(-12deg) scale(.62)';
  const endOpacity = goingBack ? 1 : 0;
  const frames = reducedMotion.matches
    ? [{ opacity: 1 }, { opacity: endOpacity }]
    : [
      { transform: startTransform, opacity: 1 },
      { transform: endTransform, opacity: endOpacity },
    ];
  const animation = oldCard.animate(frames, {
    duration: reducedMotion.matches ? 180 : 460,
    easing: 'cubic-bezier(.22,.64,.24,1)',
    fill: 'forwards',
  });

  active = nextIndex;
  render(oldCard);
  if (step < 0) {
    const arrivalFrames = reducedMotion.matches
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
        { transform: 'translate(-50%, -50%) translateX(' + (-distance) + 'px) rotate(-12deg) scale(.62)', opacity: 0 },
        { transform: 'translate(-50%, -50%) rotate(-2deg) scale(1)', opacity: 1 },
      ];
    const arrival = incomingCard.animate(arrivalFrames, {
      duration: reducedMotion.matches ? 180 : 460,
      easing: 'cubic-bezier(.16,.72,.24,1)',
      fill: 'both',
    });
    const finishArrival = () => {
      incomingCard.classList.remove('is-entering');
      arrival.cancel();
    };
    arrival.finished.then(finishArrival, finishArrival);
  } else if (reducedMotion.matches) {
    incomingCard.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 180,
      easing: 'ease-out',
    });
  }
  animation.finished.then(
    () => finishMove(oldCard, animation),
    () => finishMove(oldCard, animation),
  );
}

function cardPose(card) {
  const bounds = card.getBoundingClientRect();
  const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform);
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
    width: card.offsetWidth,
    angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
  };
}

function fitPreview() {
  if (!previewCard) return;
  const source = cardMedia[active];
  const ratio = Number(source.getAttribute('width')) / Number(source.getAttribute('height'));
  const style = getComputedStyle(previewCard);
  const frameWidth = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
    + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
  const frameHeight = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
    + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const bounds = previewDialog.getBoundingClientRect();
  const controls = previewControls.getBoundingClientRect();
  const padding = Math.min(28, Math.max(16, previewDialog.clientWidth * .025));
  const gap = Math.min(36, Math.max(24, previewDialog.clientHeight * .035));
  // Center the card in the clear area above the measured controls, including safe-area spacing.
  const availableBottom = Math.min(previewDialog.clientHeight - padding, controls.top - bounds.top - gap);
  const maxHeight = Math.max(frameHeight + 1, availableBottom - padding);
  const maxWidth = Math.min(previewDialog.clientWidth - padding * 2, 1440);
  const imageWidth = Math.max(1, Math.min(maxWidth - frameWidth, (maxHeight - frameHeight) * ratio));
  previewCard.style.width = Math.floor(imageWidth + frameWidth) + 'px';
  previewCard.style.top = (padding + maxHeight / 2) + 'px';
}

function attachPreview(index) {
  const card = cards[index];
  const anchor = document.createComment('preview card position');
  card.before(anchor);
  previewHome = { anchor, width: card.style.width, top: card.style.top, tabIndex: card.tabIndex, hidden: card.getAttribute('aria-hidden') };
  previewCard = card;
  card.classList.add('is-preview');
  card.setAttribute('aria-hidden', 'false');
  card.tabIndex = -1;
  previewDialog.append(card);
  fitPreview();
  previewTitle.textContent = captions[index];
  previewCount.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
  const video = card.querySelector('video');
  if (video) {
    video.controls = true;
    if (!document.hidden) video.play().catch(() => {});
  }
}

function restorePreviewCard(removeAnchor = true) {
  if (!previewCard) return;
  previewCard.classList.add('is-restoring');
  previewHome.anchor.before(previewCard);
  previewCard.classList.remove('is-preview');
  previewCard.style.width = previewHome.width;
  previewCard.style.top = previewHome.top;
  previewCard.tabIndex = previewHome.tabIndex;
  previewCard.setAttribute('aria-hidden', previewHome.hidden);
  // Commit the stack pose without starting a second CSS transition on return.
  getComputedStyle(previewCard).transform;
  previewCard.classList.remove('is-restoring');
  if (removeAnchor) {
    const video = previewCard.querySelector('video');
    if (video) { video.controls = false; video.pause(); }
    previewHome.anchor.remove();
    previewCard = null;
    previewHome = null;
  }
}

function previewTransform(pose) {
  const centered = cardPose(previewCard);
  return 'translate(-50%, -50%) translate(' + (pose.x - centered.x) + 'px,' + (pose.y - centered.y) + 'px) rotate(' + pose.angle + 'deg) scale(' + (pose.width / centered.width) + ')';
}

function animatePreview(frames, duration, done) {
  previewBusy = true;
  const animation = previewCard.animate(frames, {
    duration: reducedMotion.matches ? 0 : duration,
    easing: 'cubic-bezier(.2,.75,.25,1)',
    fill: 'both',
  });
  const finish = () => {
    animation.cancel();
    previewBusy = false;
    done?.();
    if (previewDialog.open && !previewClosing) fitPreview();
    if (previewCloseRequested && previewDialog.open && !previewClosing) closePreview();
  };
  animation.finished.then(finish, finish);
}

function openPreview(index) {
  if (moving || previewDialog.open) return;
  const origin = cardPose(cards[index]);
  window.clearTimeout(autoTimer);
  progress.style.animationPlayState = 'paused';
  if (cards[index] !== videoCard) demoVideo?.pause();
  document.body.classList.add('preview-open');
  previewDialog.classList.remove('is-visible');
  previewDialog.showModal();
  attachPreview(index);
  // Establish the hidden controls before starting their entrance transition.
  getComputedStyle(previewControls).opacity;
  previewDialog.classList.add('is-visible');
  animatePreview([
    { transform: previewTransform(origin), opacity: 1 },
    { transform: 'translate(-50%, -50%)', opacity: 1 },
  ], 420);
}

function navigatePreview(step) {
  if (!previewDialog.open || previewBusy || previewClosing) return;
  restorePreviewCard();
  active = (active + step + cards.length) % cards.length;
  render(null, false);
  attachPreview(active);
  animatePreview([
    { transform: 'translate(-50%, -50%) translateX(' + (step * 35) + 'px)', opacity: 0 },
    { transform: 'translate(-50%, -50%)', opacity: 1 },
  ], 220);
}

function closePreview() {
  if (!previewDialog.open || previewClosing) return;
  if (previewBusy) { previewCloseRequested = true; return; }
  previewCloseRequested = false;
  previewClosing = true;
  previewDialog.classList.remove('is-visible');
  // Measure the card in its real stack position, then animate to that exact pose.
  restorePreviewCard(false);
  const destination = cardPose(previewCard);
  previewCard.classList.add('is-preview');
  previewCard.setAttribute('aria-hidden', 'false');
  previewCard.tabIndex = -1;
  previewDialog.append(previewCard);
  fitPreview();
  animatePreview([
    { transform: 'translate(-50%, -50%)', opacity: 1 },
    { transform: previewTransform(destination), opacity: 1 },
  ], 340, () => {
    const returningCard = previewCard;
    restorePreviewCard();
    previewDialog.close();
    returningCard.focus({ preventScroll: true });
  });
}

document.querySelector('#preview-close').addEventListener('click', closePreview);
document.querySelector('#preview-prev').addEventListener('click', () => navigatePreview(-1));
document.querySelector('#preview-next').addEventListener('click', () => navigatePreview(1));
previewDialog.addEventListener('cancel', (event) => { event.preventDefault(); closePreview(); });
previewDialog.addEventListener('click', (event) => {
  if (event.target === previewDialog) closePreview();
});
previewDialog.addEventListener('keydown', (event) => {
  if (event.target.closest('video')) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); navigatePreview(-1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); navigatePreview(1); }
});
previewDialog.addEventListener('close', () => {
  restorePreviewCard();
  previewDialog.classList.remove('is-visible');
  document.body.classList.remove('preview-open');
  previewClosing = false;
  previewCloseRequested = false;
  resumePreviewVideo = false;
  if (playing && cards[active] === videoCard && !document.hidden) {
    demoVideo.play().catch(() => {
      videoPlaybackFailed = true;
      scheduleAuto();
    });
  }
  scheduleAuto();
});

cards.forEach((card, index) => {
  card.setAttribute('aria-haspopup', 'dialog');
  card.setAttribute('aria-controls', 'preview-dialog');
  card.addEventListener('click', () => {
    if (index === active && !suppressClick) openPreview(index);
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
  resizeFrame = window.requestAnimationFrame(() => {
    sizeCards();
    if (previewDialog.open && !previewBusy) fitPreview();
  });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    window.clearTimeout(autoTimer);
    progress.style.animationPlayState = 'paused';
    const previewVideo = previewCard?.querySelector('video');
    resumePreviewVideo = previewVideo ? !previewVideo.paused : false;
    previewVideo?.pause();
    demoVideo?.pause();
    return;
  }
  if (previewDialog.open) {
    if (resumePreviewVideo) previewCard?.querySelector('video')?.play().catch(() => {});
    resumePreviewVideo = false;
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

if (document.readyState === 'complete') {
  loadInstallVersion();
} else {
  window.addEventListener('load', loadInstallVersion, { once: true });
}
