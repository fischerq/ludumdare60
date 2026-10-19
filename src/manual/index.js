// The service manual for our machine: a fullscreen HTML overlay over the game (sharp text and diagrams on a
// phone), opened from the booklet on the hall's table. Old yellowed paper, one page per layer, the live page last.
// ?manual opens it straight away, for debugging the emulator.
import { MANUAL } from '../config.js';
import { pages } from './pages.js';

let root = null;

export function openManual(onClose) {
  if (root) return;
  injectStyle();
  let at = 0, live = null;
  root = el('div', 'manual');
  const sheet = el('div', 'manual-page');
  const bar = el('div', 'manual-bar');
  const prev = el('button', 'manual-btn', '◀');
  const next = el('button', 'manual-btn', '▶');
  const num = el('span', 'manual-num');
  const close = el('button', 'manual-btn manual-close', '✕');
  bar.append(prev, num, next);
  root.append(sheet, bar, close);
  document.body.append(root);

  const show = (i) => {
    at = Math.max(0, Math.min(pages.length - 1, i));
    live?.stop?.();
    live = null;
    const p = pages[at];
    sheet.innerHTML = '';
    sheet.scrollTop = 0;
    sheet.style.backgroundImage = paper(at, !!p.mount);
    sheet.append(el('h1', '', p.title));
    const body = el('div', 'manual-body');
    body.innerHTML = p.html ?? '';
    sheet.append(body);
    if (p.mount) live = p.mount(body, { goto: show });
    sheet.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', () => show(Number(a.dataset.goto))));
    num.textContent = `${at + 1} / ${pages.length}`;
    prev.disabled = at === 0;
    next.disabled = at === pages.length - 1;
  };
  const shut = () => {
    live?.stop?.();
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('popstate', shut);
    root.remove();
    root = null;
    // Mobile browsers can leave the page scrolled or resized under a tall overlay: put it back and let Phaser
    // measure the screen again, so the game fills it like before.
    window.scrollTo(0, 0);
    requestAnimationFrame(() => window.game?.scale.refresh());
    onClose?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowRight') show(at + 1);
    else if (e.key === 'ArrowLeft') show(at - 1);
    else return;
    e.preventDefault();
    e.stopPropagation(); // the game underneath doesn't get it
  };
  prev.onclick = () => show(at - 1);
  next.onclick = () => show(at + 1);
  close.onclick = shut;
  window.addEventListener('keydown', onKey, true);
  // The phone's back gesture (caught in main.js, so it doesn't leave the game) closes the manual.
  window.addEventListener('popstate', shut);
  // Swipe sideways to turn pages; vertical moves scroll the page.
  let sx = null, sy = null;
  sheet.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > MANUAL.swipe && Math.abs(dx) > Math.abs(dy) * 1.5) show(at + (dx < 0 ? 1 : -1));
  });
  show(0);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Each page's own wear, as gradients over the yellowed base: maybe a coffee ring (a full or a partly dried one),
// a smudge or two, a few foxing specks. Seeded by the page, so a page looks the same every time it's opened.
function paper(i, clean) {
  const C = MANUAL.colors, W = MANUAL.wear;
  let s = (W.seed * 7919 + i * 104729) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const between = ([a, b]) => a + Math.floor(rnd() * (b - a + 1));
  const at = () => `${Math.round(5 + rnd() * 90)}% ${Math.round(3 + rnd() * 94)}%`;
  const layers = [];
  if (!clean) {
    if (rnd() < W.ring) {
      const r = Math.round(26 + rnd() * 14), pos = at();
      layers.push(`radial-gradient(circle at ${pos}, transparent ${r}px, ${C.stain} ${r + 1}px, ${C.stain} ${r + 3}px, transparent ${r + 5}px)`);
      // A second, fainter rim where the cup was set down again (not always).
      if (rnd() < 0.5) {
        const [x, y] = pos.split(' ').map(parseFloat);
        layers.push(`radial-gradient(circle at ${x + 2}% ${y + 1}%, transparent ${r - 2}px, ${C.smudge} ${r - 1}px, transparent ${r + 2}px)`);
      }
    }
    for (let k = between(W.smudges); k > 0; k--) {
      layers.push(`radial-gradient(ellipse ${Math.round(60 + rnd() * 120)}px ${Math.round(40 + rnd() * 90)}px at ${at()}, ${C.smudge}, transparent)`);
    }
    for (let k = between(W.specks); k > 0; k--) {
      const r = (1 + rnd() * 2.5).toFixed(1);
      layers.push(`radial-gradient(circle at ${at()}, ${C.stain} ${r}px, transparent ${(+r + 1.5).toFixed(1)}px)`);
    }
  }
  layers.push(`radial-gradient(ellipse at center, ${C.paper} 55%, ${C.paperEdge} 100%)`);
  return layers.join(', ');
}

// Yellowed paper (each page's wear comes from paper()), a typewriter face.
function injectStyle() {
  if (document.getElementById('manual-style')) return;
  const C = MANUAL.colors, P = MANUAL.print;
  // The ink filter the figures print through (src/manual/pages.js): grain eats specks out of the ink, a slow warp
  // makes ruled lines wander a little, like a worn office copier.
  const defs = document.createElement('div');
  defs.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <filter id="mk-ink" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="grain"/>
      <feColorMatrix in="grain" type="luminanceToAlpha" result="ga"/>
      <feComposite in="SourceGraphic" in2="ga" operator="arithmetic" k1="0" k2="1" k3="-${P.grain}" k4="0" result="inked"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="9" result="warp"/>
      <feDisplacementMap in="inked" in2="warp" scale="${P.warp}" xChannelSelector="R" yChannelSelector="G"/>
    </filter></defs></svg>`;
  document.body.append(defs.firstChild);
  const style = el('style');
  style.id = 'manual-style';
  style.textContent = `
  .manual { position: fixed; inset: 0; z-index: 100; background: ${C.desk}; display: flex; flex-direction: column;
    align-items: center; touch-action: pan-y; font-family: ${MANUAL.font}; color: ${C.ink}; }
  .manual-page { flex: 1; width: min(100%, 720px); box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; padding: 22px 20px 30px;
    background: ${C.paper}; background-attachment: local;
    box-shadow: inset 0 0 40px ${C.paperEdge}; font-size: 17px; line-height: 1.45; -webkit-user-select: none; user-select: none; }
  .manual-page h1, .manual-page h2 { font-family: ${MANUAL.heading}; }
  .manual-page h1 { font-size: 22px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 3px double ${C.ink};
    padding-bottom: 6px; margin: 4px 44px 14px 0; }
  .manual-page h2 { font-size: 17px; text-transform: uppercase; margin: 18px 0 6px; }
  .manual-page p { margin: 0 0 10px; }
  .manual-page svg { display: block; width: 100%; height: auto; margin: 10px 0 14px; mix-blend-mode: multiply; }
  .manual-page canvas { mix-blend-mode: multiply; }
  .manual-page .live-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .manual-page .live-hold { font: 13px ${MANUAL.font}; color: ${C.ink}; background: none; border: 1px solid ${C.rule};
    border-radius: 3px; padding: 6px 12px; min-height: 36px; white-space: nowrap; }
  .manual-page .live-hold.on { color: ${C.accent}; border-color: ${C.accent}; }
  .manual-page .live-kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 0;
    border-top: 1px solid ${C.rule}; border-left: 1px solid ${C.rule}; margin: 6px 0 12px; }
  .manual-page .live-kv > div { border-right: 1px solid ${C.rule}; border-bottom: 1px solid ${C.rule}; padding: 3px 7px; }
  .manual-page .live-kv > div.wide { grid-column: 1 / -1; }
  .manual-page .live-kv span { display: block; font-size: 11px; opacity: 0.75; }
  .manual-page .live-kv b { font-size: 14px; font-family: ${MANUAL.mono}; }
  .manual-page .live-kv small { font-weight: 400; font-size: 11px; }
  .manual-page td:has(.bar) { width: 35%; }
  .manual-page .bar { display: inline-block; height: 9px; border: 1px solid ${C.ink}; box-sizing: border-box;
    background: repeating-linear-gradient(45deg, ${C.ink} 0 1px, transparent 1px 3px); }
  .manual-page .fig { font-size: 13px; text-align: center; font-style: italic; margin-top: -8px; }
  .manual-page table { border-collapse: collapse; font-size: 14px; margin: 6px 0 12px; width: 100%; }
  .manual-page td, .manual-page th { border: 1px solid ${C.rule}; padding: 3px 6px; text-align: left; vertical-align: top; }
  .manual-page .live-t { overflow-x: auto; margin: 6px 0 12px; }
  .manual-page table.live { font-size: 13px; margin: 0; }
  .manual-page table.live th { font-size: 11px; font-weight: 400; opacity: 0.75; white-space: nowrap; }
  .manual-page table.live td { padding: 2px 5px; white-space: nowrap; }
  .manual-page table.live td.n { text-align: right; font-family: ${MANUAL.mono}; }
  .manual-page code, .manual-page .mono { font-family: ${MANUAL.mono}; font-size: 0.9em; }
  .manual-page .toc a { display: block; padding: 9px 0; border-bottom: 1px dotted ${C.rule}; cursor: pointer; }
  .manual-bar { width: min(100%, 720px); display: flex; align-items: center; justify-content: space-between;
    background: ${C.cover}; padding: 6px 10px calc(6px + env(safe-area-inset-bottom)); box-sizing: border-box; }
  .manual-num { color: ${C.paper}; font-size: 16px; }
  .manual-btn { min-width: 64px; min-height: 52px; font-size: 22px; border: 2px solid ${C.paper}; background: ${C.cover};
    color: ${C.paper}; border-radius: 6px; font-family: inherit; }
  .manual-btn:disabled { opacity: 0.3; }
  .manual-close { position: fixed; top: 8px; right: max(8px, calc(50vw - 352px)); min-width: 52px; z-index: 101; }
  `;
  document.head.append(style);
}
