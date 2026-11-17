// Defer video requests until near the viewport or explicitly opened.
const loadVideo = video => {
  let changed = false;
  video.querySelectorAll('source[data-src]').forEach(source => {
    source.src = source.dataset.src;
    delete source.dataset.src;
    changed = true;
  });
  if (changed) video.load();
};

// Reference images stay off the reading surface until requested.
document.querySelectorAll('[data-reference]').forEach((trigger) => {
  const panel = document.getElementById(trigger.dataset.reference);
  let closeTimer;
  const close = () => {
    clearTimeout(closeTimer);
    panel.querySelectorAll('video').forEach(video => { video.dispatchEvent(new Event('previewclose')); video.pause(); });
    panel.hidePopover();
    trigger.setAttribute('aria-expanded', 'false');
  };
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    const bounds = panel.getBoundingClientRect();
    const below = rect.bottom + 10;
    const top = below + bounds.height <= window.innerHeight - 16
      ? below : Math.max(16, rect.top - bounds.height - 10);
    panel.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - bounds.width - 16))}px`;
    panel.style.top = `${top}px`;
  };
  const open = () => {
    clearTimeout(closeTimer);
    panel.showPopover();
    panel.querySelectorAll('video').forEach(video => { loadVideo(video); video.dataset.userPaused = 'false'; video.dispatchEvent(new Event('previewopen')); video.play().catch(() => {}); });
    trigger.setAttribute('aria-expanded', 'true');
    position();
  };
  const scheduleClose = () => { closeTimer = setTimeout(close, 180); };
  trigger.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') open();
  });
  trigger.addEventListener('pointerleave', scheduleClose);
  trigger.addEventListener('focus', () => {
    if (trigger.matches(':focus-visible')) open();
  });
  trigger.addEventListener('blur', scheduleClose);
  trigger.addEventListener('click', () => {
    if (panel.matches(':popover-open')) close();
    else open();
  });
  panel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  panel.addEventListener('focusin', () => clearTimeout(closeTimer));
  panel.addEventListener('focusout', event => { if (!panel.contains(event.relatedTarget)) scheduleClose(); });
  panel.addEventListener('pointerleave', scheduleClose);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!trigger.contains(event.target) && !panel.contains(event.target)) close();
  });
  window.addEventListener('resize', close);
  window.addEventListener('scroll', close, { passive: true });
});

let sharedVideoAudioContext;

// One accessible playback control per clip; no native video chrome.
document.querySelectorAll('main video').forEach((video) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'video-toggle';
  const indicator = document.createElement('span');
  indicator.className = 'video-toggle-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  video.parentNode.insertBefore(button, video);
  button.append(video, indicator);
  video.removeAttribute('controls');
  video.setAttribute('tabindex', '-1');

  const sync = () => {
    const paused = video.paused || video.ended;
    button.classList.toggle('is-paused', paused);
    button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'}: ${video.getAttribute('aria-label') || 'video'}`);
    indicator.innerHTML = paused
      ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 4l12 8-12 8z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  };
  // Keep the picture muted: unmuting an autoplaying video can pause it.
  // A separate audio element lets a blocked sound attempt leave video alone.
  const audio = new Audio();
  audio.preload = 'none';
  audio.loop = video.loop;
  audio.volume = 0;
  let hovered = false;
  let soundEnabled = false;
  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.className = 'video-sound-toggle';
  button.parentElement.classList.add('has-sound-control');
  button.after(soundButton);
  const syncSound = () => {
    soundButton.setAttribute('aria-label', `${soundEnabled ? 'Mute' : 'Unmute'}: ${video.getAttribute('aria-label') || 'video'}`);
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/>${soundEnabled ? '<path d="M15 8a6 6 0 010 8M18 5a10 10 0 010 14"/>' : '<path d="M16 9l5 6M21 9l-5 6"/>'}</svg>`;
  };
  syncSound();
  let fadeFrame;
  let audioRequest = 0;
  let startingAudio = false;
  let gainNode;
  const setLevel = value => {
    if (gainNode) gainNode.gain.value = value;
    else audio.volume = value;
  };

  const fadeTo = (target) => {
    cancelAnimationFrame(fadeFrame);
    const from = gainNode ? gainNode.gain.value : audio.volume;
    const started = performance.now();
    const step = (now) => {
      const t = Math.min((now - started) / 500, 1);
      const eased = t * t * (3 - 2 * t);
      setLevel(Math.max(0, Math.min(1, from + (target - from) * eased)));
      if (t < 1) fadeFrame = requestAnimationFrame(step);
      else if (target === 0) audio.pause();
    };
    fadeFrame = requestAnimationFrame(step);
  };
  const silence = () => {
    audioRequest++;
    fadeTo(0);
  };
  const startSound = () => {
    if (video.hasAttribute('data-silent') || (!hovered && !soundEnabled) || video.paused || startingAudio) return;
    const source = video.currentSrc || video.querySelector('source').src;
    // Avoid restarting or seeking a track already playing from a previous event.
    if (audio.src === source && !audio.paused) { fadeTo(1); return; }
    document.dispatchEvent(new CustomEvent('video-audio-claim', { detail: video }));
    const request = ++audioRequest;
    startingAudio = true;
    cancelAnimationFrame(fadeFrame);
    if (!gainNode) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        sharedVideoAudioContext ||= new Context();
        gainNode = sharedVideoAudioContext.createGain();
        gainNode.gain.value = 0;
        sharedVideoAudioContext.createMediaElementSource(audio).connect(gainNode);
        gainNode.connect(sharedVideoAudioContext.destination);
        audio.volume = 1;
      }
    }
    if (sharedVideoAudioContext?.state === 'suspended') sharedVideoAudioContext.resume().catch(() => {});
    setLevel(0);
    if (audio.src !== source) audio.src = source;
    audio.currentTime = video.currentTime;
    // Keep play synchronous with the gesture, then fade once playback is ready.
    audio.play().then(() => {
      if (request !== audioRequest || (!hovered && !soundEnabled) || video.paused) return;
      fadeTo(1);
    }).catch(() => {
      if (request === audioRequest) fadeTo(0);
    }).finally(() => { startingAudio = false; });
  };
  document.addEventListener('video-audio-claim', event => {
    if (event.detail === video) return;
    hovered = false;
    soundEnabled = false;
    audioRequest++;
    cancelAnimationFrame(fadeFrame);
    audio.pause();
    setLevel(0);
    syncSound();
  });
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    hovered = false;
    syncSound();
    if (soundEnabled) {
      loadVideo(video);
      video.dataset.userPaused = 'false';
      if (video.paused) video.play().catch(sync);
      startSound();
    } else silence();
  });
  video.addEventListener('previewopen', () => { hovered = window.matchMedia('(hover: hover) and (pointer: fine)').matches; startSound(); });
  video.addEventListener('previewclose', () => { hovered = false; soundEnabled = false; syncSound(); silence(); });
  button.addEventListener('click', () => {
    if (video.paused || video.ended) {
      loadVideo(video);
      video.dataset.userPaused = 'false';
      video.play().catch(sync);
      startSound();
    } else { video.dataset.userPaused = 'true'; video.pause(); }
  });
  button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    startSound();
  });
  button.addEventListener('pointerleave', () => { hovered = false; if (!soundEnabled) silence(); });
  button.addEventListener('pointercancel', () => { hovered = false; silence(); });
  // Retry audio from a real gesture if the initial hover was blocked.
  document.addEventListener('pointerdown', startSound);
  document.addEventListener('keydown', startSound);
  window.addEventListener('blur', () => { hovered = false; soundEnabled = false; syncSound(); silence(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hovered = false; soundEnabled = false; syncSound(); silence(); }
  });
  video.addEventListener('emptied', () => {
    const carousel = Boolean(video.closest('.island-teaser'));
    hovered = carousel && window.matchMedia('(hover: hover) and (pointer: fine)').matches && button.matches(':hover');
    if (!carousel) soundEnabled = false;
    syncSound();
    silence();
    sync();
  });
  video.addEventListener('pause', silence);
  video.addEventListener('play', startSound);
  // Align on explicit seeks, not on every timeupdate: repeated seeks cause
  // audible stuttering while mobile audio is still buffering.
  video.addEventListener('seeked', () => {
    if (!audio.paused && !audio.seeking && audio.readyState >= 3) audio.currentTime = video.currentTime;
  });
  ['play', 'pause', 'ended', 'error'].forEach((event) => video.addEventListener(event, sync));
  sync();
});

const islandTeaser = document.querySelector('.island-teaser');
if (islandTeaser) {
  const video = islandTeaser.querySelector('video');
  const source = video.querySelector('source');
  const empty = islandTeaser.querySelector('.island-teaser-empty');
  const caption = islandTeaser.querySelector('figcaption');
  const stage = islandTeaser.querySelector('.island-teaser-stage');
  const progress = islandTeaser.querySelector('.island-teaser-progress');
  let progressFrame;
  const updateProgress = () => {
    const value = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(video.currentTime / video.duration, 1) : 0;
    progress.value = value;
  };
  const trackProgress = () => {
    cancelAnimationFrame(progressFrame);
    updateProgress();
    if (!video.paused && !video.ended) progressFrame = requestAnimationFrame(trackProgress);
  };
  video.addEventListener('playing', trackProgress);
  video.addEventListener('pause', () => { cancelAnimationFrame(progressFrame); updateProgress(); });
  ['loadedmetadata', 'timeupdate', 'emptied', 'seeked'].forEach(event => video.addEventListener(event, updateProgress));
  updateProgress();
  const dissolve = document.createElement('canvas');
  dissolve.className = 'island-teaser-dissolve';
  dissolve.setAttribute('aria-hidden', 'true');
  stage.append(dissolve);
  let transitionId = 0;
  let fadeAnimation;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const teasers = {
    meadow: ['Sunny Meadows', 'meadow-teaser-trimmed.mp4', 'Island gameplay preview.'],
    lava: ['Lava Caves', 'lava-teaser.mp4', 'Island gameplay preview.'],
    snow: ['Snowlands', 'snowlands-teaser.mp4', 'Island gameplay preview.'],
    desert: ['Desert Ruins', 'desert-teaser-trimmed.mp4', 'Island gameplay preview.'],
    beach: ['Pirate Beach', 'pirate-beach-teaser-trimmed.mp4', 'Island gameplay preview.']
  };
  const buttons = [...document.querySelectorAll('[data-island]')];
  const rotation = Object.keys(teasers).filter(key => teasers[key][1]);
  let activeIsland = buttons.find(button => button.getAttribute('aria-pressed') === 'true').dataset.island;
  const selectIsland = (key) => {
    const request = ++transitionId;
    fadeAnimation?.cancel();
    if (video.readyState >= 2 && !reducedMotion.matches) {
      dissolve.width = video.videoWidth;
      dissolve.height = video.videoHeight;
      dissolve.getContext('2d').drawImage(video, 0, 0);
      dissolve.style.opacity = '1';
    } else dissolve.style.opacity = '0';
    activeIsland = key;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.island === key)));
    const [name, file, description] = teasers[key];
    video.pause();
    video.closest('.video-toggle').hidden = !file;
    empty.hidden = Boolean(file);
    caption.textContent = `${name} — ${description}`;
    video.setAttribute('aria-label', `${name} gameplay teaser`);
    if (file) {
      delete source.dataset.src;
      source.src = `../assets/videos/superadventureland/${file}`;
      video.dataset.userPaused = 'false';
      video.load();
      const reveal = () => {
        if (request !== transitionId) return;
        fadeAnimation = dissolve.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: reducedMotion.matches ? 0 : 450, fill: 'forwards', easing: 'ease-in-out'
        });
        fadeAnimation.finished.then(() => {
          if (request === transitionId) dissolve.style.opacity = '0';
        }).catch(() => {});
      };
      video.addEventListener('playing', reveal, { once: true });
      video.play().catch(() => { dissolve.style.opacity = '0'; });
    }
  };
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.island !== activeIsland) selectIsland(button.dataset.island);
    });
  });
  video.addEventListener('ended', () => {
    const next = (rotation.indexOf(activeIsland) + 1) % rotation.length;
    selectIsland(rotation[next]);
  });
}

const conceptPanel = document.getElementById('mama-pengo-concepts');
if (conceptPanel) {
  const slides = [...conceptPanel.querySelectorAll('.concept-slide')];
  const counter = conceptPanel.querySelector('.concept-counter');
  let selected = 0;
  const show = offset => {
    selected = (selected + offset + slides.length) % slides.length;
    slides.forEach((slide, index) => { slide.hidden = index !== selected; });
    counter.textContent = `${selected + 1} / ${slides.length}`;
  };
  conceptPanel.querySelector('[data-concept-prev]').addEventListener('click', () => show(-1));
  conceptPanel.querySelector('[data-concept-next]').addEventListener('click', () => show(1));
  conceptPanel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
}

// Loading and playback have separate boundaries: prepare nearby clips, but
// only run visible ones. A manual pause persists across scroll-away/return.
const viewportVideos = [...document.querySelectorAll('main video')].filter(video => !video.closest('[popover]'));
const visibleVideos = new Set();
const updateVideoPlayback = video => {
  if (!document.hidden && visibleVideos.has(video) && video.dataset.userPaused !== 'true' && video.hasAttribute('data-autoplay')) {
    loadVideo(video);
    video.play().catch(() => {});
  } else video.pause();
};
if ('IntersectionObserver' in window) {
  const preloadObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { loadVideo(entry.target); preloadObserver.unobserve(entry.target); }
    });
  }, { rootMargin: '250px 0px' });
  const playbackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.05) visibleVideos.add(entry.target);
      else visibleVideos.delete(entry.target);
      updateVideoPlayback(entry.target);
    });
  }, { threshold: [0, 0.05] });
  viewportVideos.forEach(video => { preloadObserver.observe(video); playbackObserver.observe(video); });
} else {
  viewportVideos.forEach(video => { visibleVideos.add(video); updateVideoPlayback(video); });
}
document.addEventListener('visibilitychange', () => viewportVideos.forEach(updateVideoPlayback));

// Inspect case-study images without leaving the page.
(() => {
  const images = [...document.querySelectorAll('main img')].filter(img => !img.closest('button'));
  if (!images.length) return;
  const viewer = document.createElement('dialog');
  viewer.className = 'image-zoom';
  viewer.setAttribute('aria-label', 'Enlarged image');
  viewer.innerHTML = '<button type="button" class="image-zoom-close" aria-label="Close enlarged image"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M5 19L19 5"/></svg></button><img alt=""><p class="image-zoom-caption"></p>';
  document.body.append(viewer);
  const largeImage = viewer.querySelector('img');
  const caption = viewer.querySelector('p');
  let opener;
  const close = () => viewer.close();
  viewer.querySelector('button').addEventListener('click', close);
  viewer.addEventListener('click', event => {
    const rect = viewer.getBoundingClientRect();
    if (event.target === viewer && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  viewer.addEventListener('close', () => {
    document.body.classList.remove('image-zoom-open');
    largeImage.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
  images.forEach(img => {
    const link = img.closest('a');
    // Preserve ordinary navigation links; only direct image links become zoom triggers.
    if (link && !/\.(?:png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(link.getAttribute('href') || '')) return;
    const trigger = link || img;
    if (link) link.removeAttribute('target');
    trigger.classList.add('image-zoom-trigger');
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', `Enlarge image: ${img.alt || 'project image'}`);
    const open = event => {
      event.preventDefault();
      opener = trigger;
      largeImage.src = link?.href || img.currentSrc || img.src;
      largeImage.alt = img.alt;
      caption.textContent = img.closest('figure')?.querySelector('figcaption')?.textContent || img.alt;
      caption.hidden = !caption.textContent;
      document.body.classList.add('image-zoom-open');
      if (!viewer.open) viewer.showModal();
    };
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); open(event); }
    });
  });
})();
