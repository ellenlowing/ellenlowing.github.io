const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('.work-card')];
filters.forEach(button => button.addEventListener('click', event => {
  if (button.getAttribute('aria-pressed') === 'true') return;
  const animate = event.isTrusted && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const before = new Map(cards.filter(card => !card.hidden).map(card => [card, card.getBoundingClientRect()]));
  document.querySelectorAll('.filter-ghost').forEach(ghost => ghost.remove());
  cards.forEach(card => card.getAnimations().forEach(animation => animation.cancel()));
  filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
  cards.forEach(card => {
    const hide = button.dataset.filter !== 'all' && !card.dataset.tags.split(' ').includes(button.dataset.filter);
    if (animate && hide && before.has(card)) {
      const rect = before.get(card);
      if (rect.bottom > 0 && rect.top < innerHeight) {
        const ghost = card.cloneNode(true);
        ghost.removeAttribute('href');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.classList.add('filter-ghost');
        ghost.querySelectorAll('iframe').forEach(frame => frame.remove());
        ghost.querySelectorAll('video').forEach(video => {
          const image = document.createElement('img'); image.src = video.poster; image.alt = ''; video.replaceWith(image);
        });
        ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;margin:0;pointer-events:none;z-index:2`;
        document.body.append(ghost);
        ghost.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}], {duration:140,easing:'ease-out'}).finished.finally(() => ghost.remove());
      }
    }
    card.hidden = hide;
  });
  layoutMasonry();
  if (!animate) return;
  let entering = 0;
  cards.filter(card => !card.hidden).forEach(card => {
    const rect = card.getBoundingClientRect(), old = before.get(card);
    if (old) {
      card.animate([{transform:`translate(${old.left-rect.left}px,${old.top-rect.top}px)`},{transform:'translate(0,0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
    } else {
      card.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:Math.min(entering++ * 20,100),fill:'backwards',easing:'ease-out'});
    }
  });
}));

const previews = [...document.querySelectorAll('.work-card video')];
const visiblePreviews = new Set();
const syncPreviews = () => previews.forEach(video => {
  if (visiblePreviews.has(video) && !document.hidden && !video.closest('.work-card').hidden) video.play().catch(() => {});
  else video.pause();
});
const previewObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => entry.isIntersecting ? visiblePreviews.add(entry.target) : visiblePreviews.delete(entry.target));
  syncPreviews();
});
previews.forEach(video => previewObserver.observe(video));
document.addEventListener('visibilitychange', syncPreviews);
filters.forEach(button => button.addEventListener('click', syncPreviews));

// Place projects in source order into the next available column.
const gallery = document.querySelector('.work-grid');
const layoutMasonry = () => {
  const visible = cards.filter(card => !card.hidden);
  const columns = innerWidth <= 640 ? 1 : innerWidth <= 1000 ? 2 : 3;
  const gap = columns === 1 ? 30 : 28;
  const width = (gallery.clientWidth - gap * (columns - 1)) / columns;
  const bottoms = Array(columns).fill(0);
  visible.forEach(card => { card.style.width = `${width}px`; });
  visible.forEach((card, index) => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    card.style.left = `${column * (width + gap)}px`;
    card.style.top = `${bottoms[column]}px`;
    bottoms[column] += card.offsetHeight + 32;
  });
  gallery.style.height = `${Math.max(0, ...bottoms) - (visible.length ? 32 : 0)}px`;
};
cards.forEach(card => {
  const media = card.querySelector('img,video');
  media.addEventListener(media.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', layoutMasonry);
});
filters.forEach(button => button.addEventListener('click', layoutMasonry));
new ResizeObserver(layoutMasonry).observe(gallery);
document.fonts.ready.then(layoutMasonry);
layoutMasonry();

// Return to the same place in the gallery, including its selected filter.
const galleryPositionKey = 'portfolio-gallery-position';
const saveGalleryPosition = () => {
  const selected = filters.find(button => button.getAttribute('aria-pressed') === 'true');
  try { sessionStorage.setItem(galleryPositionKey, JSON.stringify({ y: window.scrollY, filter: selected?.dataset.filter || 'all' })); } catch {}
};
cards.forEach(card => card.addEventListener('click', saveGalleryPosition));
const restoreGalleryPosition = () => {
  if (location.hash !== '#work-home' && performance.getEntriesByType('navigation')[0]?.type !== 'back_forward') return;
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(galleryPositionKey)); } catch {}
  if (!saved || !Number.isFinite(saved.y)) return;
  filters.find(button => button.dataset.filter === saved.filter)?.click();
  const restore = () => {
    layoutMasonry();
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, saved.y);
    document.documentElement.style.scrollBehavior = previous;
  };
  requestAnimationFrame(() => requestAnimationFrame(restore));
  document.fonts.ready.then(restore);
};
window.addEventListener('pageshow', restoreGalleryPosition);
window.addEventListener('hashchange', restoreGalleryPosition);
restoreGalleryPosition();

// Embedded thumbnail clips use the same visible-only playback rule.
const embeddedPreviews = [...document.querySelectorAll('.thumbnail-embed')];
const visibleEmbeds = new Set();
const syncEmbeds = () => embeddedPreviews.forEach(frame => {
  const playing = visibleEmbeds.has(frame) && !document.hidden && !frame.closest('.work-card').hidden;
  if (playing && !frame.src) frame.src = frame.dataset.src;
  if (frame.src) frame.contentWindow?.postMessage(JSON.stringify({ method: playing ? 'play' : 'pause' }), 'https://player.vimeo.com');
});
const embedObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => entry.isIntersecting ? visibleEmbeds.add(entry.target) : visibleEmbeds.delete(entry.target));
  syncEmbeds();
});
embeddedPreviews.forEach(frame => {
  frame.addEventListener('load', () => { frame.classList.add('is-loaded'); syncEmbeds(); });
  embedObserver.observe(frame);
});
filters.forEach(button => button.addEventListener('click', syncEmbeds));
document.addEventListener('visibilitychange', syncEmbeds);
