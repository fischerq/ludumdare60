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
    root.remove();
    root = null;
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

// Yellowed, slightly dirty paper: a warm base, coffee rings and smudges as gradients, a typewriter face.
function injectStyle() {
  if (document.getElementById('manual-style')) return;
  const C = MANUAL.colors;
  const style = el('style');
  style.id = 'manual-style';
  style.textContent = `
  .manual { position: fixed; inset: 0; z-index: 100; background: ${C.desk}; display: flex; flex-direction: column;
    align-items: center; touch-action: pan-y; font-family: ${MANUAL.font}; color: ${C.ink}; }
  .manual-page { flex: 1; width: min(100%, 720px); box-sizing: border-box; overflow-y: auto; padding: 22px 20px 30px;
    background:
      radial-gradient(circle at 82% 14%, transparent 34px, ${C.stain} 35px, ${C.stain} 38px, transparent 40px),
      radial-gradient(ellipse at 12% 88%, ${C.smudge}, transparent 22%),
      radial-gradient(ellipse at 70% 60%, ${C.smudge}, transparent 30%),
      radial-gradient(ellipse at center, ${C.paper} 55%, ${C.paperEdge} 100%);
    box-shadow: inset 0 0 40px ${C.paperEdge}; font-size: 17px; line-height: 1.45; -webkit-user-select: none; user-select: none; }
  .manual-page h1, .manual-page h2 { font-family: ${MANUAL.heading}; }
  .manual-page h1 { font-size: 22px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 3px double ${C.ink};
    padding-bottom: 6px; margin: 4px 44px 14px 0; }
  .manual-page h2 { font-size: 17px; text-transform: uppercase; margin: 18px 0 6px; }
  .manual-page p { margin: 0 0 10px; }
  .manual-page svg { display: block; width: 100%; height: auto; margin: 10px 0 14px; }
  .manual-page .fig { font-size: 13px; text-align: center; font-style: italic; margin-top: -8px; }
  .manual-page table { border-collapse: collapse; font-size: 14px; margin: 6px 0 12px; width: 100%; }
  .manual-page td, .manual-page th { border: 1px solid ${C.rule}; padding: 3px 6px; text-align: left; vertical-align: top; }
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
