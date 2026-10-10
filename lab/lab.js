// Lab harness: runs one bench (lab/benches/<id>.js) as side-by-side variants on the same input.
// A bench is plain data plus pure functions, so every variant sees exactly the same scenario and a
// scripted scenario can be scrubbed by re-simulating from t = 0.
import { BENCHES } from './benches/index.js';

const DT = 1 / 60; // the game runs at 60 Hz on most phones; benches step at a fixed rate
const SPEEDS = [0.25, 0.5, 1, 2];

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v, step) => (step < 1 ? Number(v).toFixed(String(step).split('.')[1]?.length || 2) : String(Math.round(v)));

async function main() {
  const id = new URLSearchParams(location.search).get('b');
  const entry = BENCHES.find((b) => b.id === id);
  if (!entry) {
    $('#bench').innerHTML = `<p class="empty">No bench called “${esc(id ?? '')}”. <a href="./">Back to the lab</a></p>`;
    return;
  }
  const bench = (await import(`./benches/${entry.id}.js`)).default;
  document.title = `${bench.title} · Lab`;
  $('#title').textContent = bench.title;
  $('#summary').textContent = bench.summary;
  if (bench.doc) $('#doc').href = bench.doc; else $('#doc').remove();

  const variants = bench.variants.map((v) => ({ ...v, params: { ...v.params }, state: null }));
  let scenario = bench.scenarios[0];
  let t = 0;
  let playing = true;
  let speed = 1;
  let liveTarget = null;

  // Controls
  $('#scenario').innerHTML = bench.scenarios.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  $('#speed').innerHTML = SPEEDS.map((s) => `<option value="${s}" ${s === 1 ? 'selected' : ''}>${s}× speed</option>`).join('');
  $('#scenario').addEventListener('change', (e) => {
    scenario = bench.scenarios.find((s) => s.id === e.target.value);
    restart();
  });
  $('#speed').addEventListener('change', (e) => { speed = Number(e.target.value); });
  $('#play').addEventListener('click', () => { playing = !playing; paintPlay(); });
  $('#restart').addEventListener('click', restart);
  $('#time').addEventListener('input', (e) => { seek(Number(e.target.value)); playing = false; paintPlay(); });
  const paintPlay = () => { $('#play').textContent = playing ? 'Pause' : 'Play'; };

  // Panels
  const grid = $('#panels');
  grid.style.setProperty('--cols', variants.length);
  grid.innerHTML = variants.map((v, i) => `
    <section class="panel" data-i="${i}">
      <h2>${esc(v.name)}</h2>
      <p class="note">${esc(v.note || '')}</p>
      <canvas></canvas>
      <p class="readout"></p>
      ${v.editable ? `
        <div class="sliders">${bench.params.map((p) => `
          <label><span>${esc(p.label)} <b data-k="${p.key}">${fmt(v.params[p.key], p.step)}</b></span>
            <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${v.params[p.key]}" data-k="${p.key}">
          </label>`).join('')}
        </div>
        <div class="row"><button type="button" class="reset-params">Reset to current</button>
          <button type="button" class="copy">Copy for config.js</button></div>
        <pre class="snippet" hidden></pre>` : ''}
    </section>`).join('');

  grid.querySelectorAll('.panel').forEach((el) => {
    const v = variants[Number(el.dataset.i)];
    v.canvas = el.querySelector('canvas');
    v.readout = el.querySelector('.readout');
    el.querySelectorAll('input[type=range]').forEach((input) => input.addEventListener('input', () => {
      v.params[input.dataset.k] = Number(input.value);
      el.querySelector(`b[data-k="${input.dataset.k}"]`).textContent = fmt(input.value, Number(input.step));
      el.querySelector('.snippet').hidden = true;
      seek(t); // replay this scenario with the new numbers
    }));
    el.querySelector('.reset-params')?.addEventListener('click', () => {
      Object.assign(v.params, bench.variants[Number(el.dataset.i)].params);
      el.querySelectorAll('input[type=range]').forEach((input) => {
        input.value = v.params[input.dataset.k];
        input.dispatchEvent(new Event('input'));
      });
    });
    el.querySelector('.copy')?.addEventListener('click', async () => {
      const text = bench.configSnippet(v.params);
      const pre = el.querySelector('.snippet');
      pre.textContent = text;
      pre.hidden = false;
      try { await navigator.clipboard.writeText(text); el.querySelector('.copy').textContent = 'Copied'; } catch (e) { /* shown below instead */ }
      setTimeout(() => { el.querySelector('.copy').textContent = 'Copy for config.js'; }, 1500);
    });
    bindPointer(v.canvas);
  });

  // Live scenarios: a finger or mouse on any panel drives every variant at once.
  function bindPointer(canvas) {
    const toWorld = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * bench.world.w, y: ((e.clientY - r.top) / r.height) * bench.world.h };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!scenario.live) return;
      canvas.setPointerCapture(e.pointerId);
      liveTarget = toWorld(e);
    });
    canvas.addEventListener('pointermove', (e) => { if (scenario.live && liveTarget) liveTarget = toWorld(e); });
    const up = () => { liveTarget = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  const inputAt = (time) => (scenario.live ? liveTarget : scenario.input(time));

  function restart() {
    t = 0;
    liveTarget = null;
    for (const v of variants) v.state = bench.init(v.params, scenario);
    $('#time').max = scenario.live ? 0 : scenario.duration;
    $('#time').disabled = !!scenario.live;
    $('#scenario-note').textContent = scenario.note || '';
    playing = true;
    paintPlay();
  }

  function stepAll() {
    const input = inputAt(t);
    for (const v of variants) bench.step(v.state, v.params, input, DT);
    t += DT;
  }

  // Scripted scenarios are deterministic, so jumping to a time means replaying from zero.
  function seek(target) {
    if (scenario.live) return;
    t = 0;
    for (const v of variants) v.state = bench.init(v.params, scenario);
    while (t + DT / 2 < target) stepAll();
  }

  function resize(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(w * (bench.world.h / bench.world.w));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function draw() {
    const css = getComputedStyle(document.documentElement);
    const colors = {
      bg: css.getPropertyValue('--surface-2').trim(),
      line: css.getPropertyValue('--line').trim(),
      text: css.getPropertyValue('--text').trim(),
      muted: css.getPropertyValue('--muted').trim(),
      accent: css.getPropertyValue('--accent').trim(),
    };
    const input = inputAt(t);
    for (const v of variants) {
      resize(v.canvas);
      const ctx = v.canvas.getContext('2d');
      const s = v.canvas.width / bench.world.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, v.canvas.width, v.canvas.height);
      ctx.setTransform(s, 0, 0, s, 0, 0);
      bench.draw(ctx, v.state, v.params, input, colors);
      v.readout.textContent = bench.readout ? bench.readout(v.state, v.params) : '';
    }
    $('#clock').textContent = scenario.live ? 'live' : `${t.toFixed(2)} s / ${scenario.duration} s`;
    if (!scenario.live) $('#time').value = t;
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing && !document.hidden) {
      acc += elapsed * speed;
      while (acc >= DT) {
        stepAll();
        acc -= DT;
        if (!scenario.live && t >= scenario.duration) seek(0); // loop
      }
    }
    draw();
    requestAnimationFrame(frame);
  }

  restart();
  requestAnimationFrame(frame);
}

main();
