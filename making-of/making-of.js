// Renders the making-of page: a timeline of one-line entries (Claude Code turns and work done
// outside Claude Code), a conversations view, and a thread dialog that shows a whole conversation.

const $ = (sel) => document.querySelector(sel);

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Small, safe markdown subset: code fences, inline code, bold, links, bullet lists, headings.
function md(src) {
  const blocks = [];
  src = src.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  const inline = (t) => {
    const codes = [];
    t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(`<code>${esc(c)}</code>`); return `\u0001${codes.length - 1}\u0001`; });
    t = esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*(\S[^*\n]*?\S|\S)\*(?!\w)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\[([^\]]+)\]\((\.{1,2}\/[^)\s]*)\)/g, '<a href="$2">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return t.replace(/\u0001(\d+)\u0001/g, (_, i) => codes[i]);
  };
  const out = [];
  for (const para of src.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (/^\u0000\d+\u0000$/.test(p)) { out.push(blocks[p.slice(1, -1)]); continue; }
    const h = p.match(/^#{1,4}\s+(.*)$/);
    if (h && !p.includes('\n')) { out.push(`<h4>${inline(h[1])}</h4>`); continue; }
    // Split the paragraph into runs of list lines and plain lines.
    const isItem = (l) => /^\s*([-*]|\d+\.)\s/.test(l);
    let text = [], items = null;
    const flushText = () => { if (text.length) out.push(`<p>${text.map(inline).join('<br>')}</p>`); text = []; };
    const flushList = () => { if (items) out.push(`<ul>${items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`); items = null; };
    for (const l of p.split('\n')) {
      if (isItem(l) && !/^\s{2,}/.test(l)) { flushText(); (items ||= []).push(l.replace(/^\s*([-*]|\d+\.)\s/, '')); }
      else if (items && (/^\s{2,}\S/.test(l))) items[items.length - 1] += ' ' + l.trim().replace(/^([-*]|\d+\.)\s/, '· ');
      else { flushList(); text.push(l); }
    }
    flushList();
    flushText();
  }
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

let plan = '';
const fmtPct = (f) => `${Math.round(f * 100)}%`;
const fmtUSD = (n) => (n == null ? '—' : n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
const fmtNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
function fmtDur(s) {
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
const dayKey = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
// The data only has a date and a sequence number per item; a clock time ("HH:MM", Munich)
// exists only for items during the jam itself.
const timeSpan = (item) => (item.time ? `<span>${esc(item.time)}</span>` : '');

function tokens(turn) {
  let read = 0, out = 0;
  for (const u of Object.values(turn.usage)) {
    read += u.input + u.cache_write_5m + u.cache_write_1h + u.cache_read;
    out += u.output;
  }
  return { read, out };
}

// Plan-usage readings are account-wide, so concurrent Claude work leaks into them. The exporter
// already leaves out idle gaps between turns; here the in-turn changes are checked against what
// the turn's own token cost would predict. The rate (% of limit per API-dollar) is pooled over
// all turns, and a turn whose jump is far above it is flagged as concurrent use and not counted.
// Readings have 1% resolution, so small turns usually read +0% and the total is what matters.
function filterPlanUsage(turns) {
  for (const w of ['seven_day', 'five_hour']) {
    const rows = turns.filter((t) => t.plan_usage?.[w]?.delta != null && t.cost_usd != null);
    rows.forEach((t) => { t.plan_usage[w].concurrent = false; });
    for (let pass = 0; pass < 2; pass++) {
      const kept = rows.filter((t) => !t.plan_usage[w].concurrent);
      const cost = kept.reduce((a, t) => a + t.cost_usd, 0);
      const used = kept.reduce((a, t) => a + Math.max(0, t.plan_usage[w].delta), 0);
      const rate = cost > 0 ? used / cost : 0;
      for (const t of rows) {
        const d = t.plan_usage[w].delta;
        t.plan_usage[w].concurrent = d >= 0.02 && d > 3 * rate * t.cost_usd + 0.01;
      }
    }
  }
}

const planCounted = (t, w) => {
  const u = t.plan_usage?.[w];
  return u && u.delta != null && !u.concurrent ? Math.max(0, u.delta) : 0;
};

const MANUAL_KINDS = { human: 'By hand', 'claude-chat': 'Claude chat', other: 'Outside' };
const sign = (f) => (f > 0 ? '+' : '') + fmtPct(f);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// The prompt's own first sentence (or first line, if that ends sooner): the timeline row.
function firstSentence(text, max = 140) {
  const firstLine = text.trim().split('\n')[0].trim();
  const m = firstLine.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : firstLine;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// Models used in a turn, as short names ("claude-opus-5-5" → "Opus 5.5").
const MODEL_NAMES = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable', mythos: 'Mythos' };
function modelName(id) {
  const m = String(id).match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/);
  return m ? `${MODEL_NAMES[m[1]] || m[1]} ${m[2]}${m[3] ? `.${m[3]}` : ''}` : String(id);
}
// Main model first (most output), helpers after.
const modelsOf = (turn) => Object.entries(turn.usage).sort((a, b) => b[1].output - a[1].output).map(([id]) => modelName(id));
const totalTokens = (turn) => { const t = tokens(turn); return t.read + t.out; };

// Share of the subscription: the weekly limit resets every 7 days, so one month holds
// 30.44 / 7 ≈ 4.35 weekly allowances.
const WEEKS_PER_MONTH = 30.44 / 7;

function renderStats(turns, meta) {
  const cost = turns.reduce((a, t) => a + (t.cost_usd || 0), 0);
  const secs = turns.reduce((a, t) => a + t.duration_s, 0);
  const tk = turns.map(tokens).reduce((a, t) => ({ read: a.read + t.read, out: a.out + t.out }), { read: 0, out: 0 });
  const commits = new Set(turns.flatMap((t) => t.commits.map((c) => c.sha))).size;
  const weekly = turns.reduce((a, t) => a + planCounted(t, 'seven_day'), 0);
  const tracked = turns.some((t) => t.plan_usage?.seven_day?.delta != null);
  const month = weekly / WEEKS_PER_MONTH;
  const price = meta.plan_price_month;
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: meta.plan_currency || 'USD' }).format(n);
  const models = [...new Set(turns.flatMap(modelsOf))];

  const stats = [];
  if (tracked) {
    const v = weekly < 0.005 ? `<${(1 / WEEKS_PER_MONTH).toFixed(2)}%` : `≈${(month * 100).toFixed(1)}%`;
    const below = weekly < 0.005;  // under the 1% resolution of the weekly reading
    const amount = below ? `<${money(0.01 / WEEKS_PER_MONTH * price)}` : `≈${money(month * price)}`;
    const k = `of a month of ${plan || 'the subscription'}${price ? ` (${amount} of ${money(price)})` : ''}`;
    stats.push([v, k, 'hero']);
  }
  stats.push([fmtNum(tk.read + tk.out), 'tokens'], [turns.length, 'prompts'], [fmtDur(secs), 'Claude working']);
  $('#stats').innerHTML = stats.map(([v, k, cls]) => `<div class="stat${cls ? ` ${cls}` : ''}"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('')
    + `<div class="stats-sub">${esc(models.join(' · '))} · ${fmtNum(tk.out)} written, ${fmtNum(tk.read)} read · ${plural(commits, 'commit')}
      · ${tracked ? `${weekly < 0.005 ? '<1%' : fmtPct(weekly)} of a weekly limit · ` : ''}${fmtUSD(cost)} at API list prices</div>`;
}

function planChip(turn) {
  const part = (w, label) => {
    const u = turn.plan_usage?.[w];
    if (!u || u.delta == null) return null;
    return u.concurrent ? `<s>${sign(u.delta)}</s> ${label} (concurrent, not counted)` : `<b>${sign(u.delta)}</b> ${label}`;
  };
  const parts = [part('five_hour', '5h'), part('seven_day', 'week')].filter(Boolean);
  return parts.length ? `<span class="chip">plan ${parts.join(' · ')}</span>` : '';
}

function commitList(commits, repoUrl) {
  if (!commits?.length) return '';
  return `<ul class="commits">${commits.map((c) => {
    const label = `<code>${c.sha.slice(0, 7)}</code> ${esc(c.subject)}`;
    return `<li>${repoUrl ? `<a href="${esc(`${repoUrl}/commit/${c.sha}`)}" target="_blank" rel="noopener">${label}</a>` : label}</li>`;
  }).join('')}</ul>`;
}

const humanBubble = (text, { clamp = false, sub = '' } = {}) =>
  `<div class="bubble human${clamp ? ' clamp' : ''}"><div class="who">Human${sub ? `<span class="note-sub">${esc(sub)}</span>` : ''}</div><div class="text">${esc(text)}</div></div>`;
const claudeBubble = (html) => `<div class="bubble claude"><div class="who">Claude</div><div class="md">${html}</div></div>`;
const isLong = (t) => t.length > 400 || t.split('\n').length > 8;

// ---- Timeline -------------------------------------------------------------------------------

function timelineItem(item, ctx) {
  const li = document.createElement('li');
  const d = document.createElement('details');
  li.append(d);
  if (item.entry) {
    const e = item.entry;
    li.className = 'item manual';
    d.innerHTML = `
      <summary><span class="tag">${esc(MANUAL_KINDS[e.kind] || MANUAL_KINDS.other)}</span>
        <span class="line">${esc(e.title)}</span>${e.time ? `<span class="side">${esc(e.time)}</span>` : ''}</summary>
      <div class="body">
        ${e.body ? `<div class="md">${md(e.body)}</div>` : ''}
        ${e.conversation?.length ? `<button class="open-thread" type="button">Read the conversation (${plural(e.conversation.length, 'prompt')}) →</button>` : ''}
        ${e.links?.length ? `<ul class="commits">${e.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a></li>`).join('')}</ul>` : ''}
      </div>`;
    d.querySelector('.open-thread')?.addEventListener('click', () => openThread(ctx.threads.get(e), 0));
    return li;
  }
  const { turn, n } = item;
  const tk = tokens(turn);
  const tools = Object.entries(turn.tools).map(([k, c]) => `${k.replace(/^mcp__\w+?__/, '')} ×${c}`).join(', ');
  li.className = 'item';
  d.innerHTML = `
    <summary><span class="tag">#${n}</span><span class="line">${esc(firstSentence(turn.prompt))}</span>
      <span class="side">${turn.time ? `${esc(turn.time)} · ` : ''}${fmtNum(totalTokens(turn))} tok</span></summary>
    <div class="body">
      <button class="tap" type="button" aria-label="Open this conversation">${humanBubble(turn.prompt, { clamp: isLong(turn.prompt) })}</button>
      <div class="hint">Tap the message to read the whole conversation →</div>
      ${claudeBubble(turn.reply ? md(turn.reply) : '<p><i>(still working when this log was exported)</i></p>')}
      <div class="facts">
        <span class="chip model">${esc(modelsOf(turn).join(' + '))}</span>
        <span class="chip"><b>${fmtNum(tk.out)}</b> written · <b>${fmtNum(tk.read)}</b> read</span>
        <span class="chip"><b>${turn.api_requests}</b> model calls</span>
        <span class="chip">${fmtDur(turn.duration_s)}</span>
        ${planChip(turn)}
        ${tools ? `<span class="chip">${esc(tools)}</span>` : ''}
      </div>
      <p class="fine">≈${fmtUSD(turn.cost_usd)} at API list prices</p>
      ${commitList(turn.commits, ctx.repoUrl)}
    </div>`;
  d.querySelector('button.tap').addEventListener('click', () => openThread(ctx.threads.get(item.session), turn.index));
  return li;
}

function renderTimeline(items, ctx) {
  const tl = $('#timeline');
  tl.textContent = '';
  if (!items.length) { tl.innerHTML = '<p class="empty">Nothing logged yet.</p>'; return; }
  let day = null;
  let list = null;
  for (const item of items) {
    const k = dayKey(item.date);
    if (k !== day) {
      day = k;
      const h = document.createElement('h2');
      h.className = 'day';
      h.textContent = k;
      list = document.createElement('ol');
      list.className = 'list';
      tl.append(h, list);
    }
    list.append(timelineItem(item, ctx));
  }
}

// ---- Conversations --------------------------------------------------------------------------

// A thread is a whole conversation: a Claude Code session (all its turns) or an imported chat.
function sessionThread(s, numbering) {
  return {
    kind: 'Claude Code session',
    title: s.title || 'Claude Code session',
    url: s.session_url,
    first: s.turns[0]?.prompt || '',
    meta: `${plural(s.turns.length, 'prompt')} · ${fmtNum(s.turns.reduce((a, t) => a + totalTokens(t), 0))} tokens · ${[...new Set(s.turns.flatMap(modelsOf))].join(', ')} · ${dayKey(s.first_date)}${s.last_date !== s.first_date ? ` – ${dayKey(s.last_date)}` : ''}`,
    seq: s.turns[0]?.seq || 0,
    render: () => s.turns.map((t) => {
      const texts = [...t.progress_notes, t.reply].filter(Boolean);
      const follow = t.followups || [];
      // Claude's in-between notes fold away; messages sent mid-turn go where they arrived.
      const parts = [];
      let pending = [];
      const flush = () => {
        if (pending.length) parts.push(`<details class="steps"><summary>${plural(pending.length, 'progress note')}</summary><div class="md">${pending.map((x) => `<div>${md(x)}</div>`).join('')}</div></details>`);
        pending = [];
      };
      texts.forEach((x, i) => {
        follow.filter((f) => f.after_reply_index === i).forEach((f) => { flush(); parts.push(`<div class="msg human">${humanBubble(f.text, { clamp: isLong(f.text), sub: 'while Claude was working' })}</div>`); });
        if (i === texts.length - 1) { flush(); parts.push(`<div class="msg claude">${claudeBubble(md(x))}</div>`); } else pending.push(x);
      });
      follow.filter((f) => f.after_reply_index >= texts.length).forEach((f) => parts.push(`<div class="msg human">${humanBubble(f.text, { sub: 'while Claude was working' })}</div>`));
      return `<div class="turn-sep">#${numbering.get(t)} · ${esc(modelsOf(t).join(' + '))} · ${fmtNum(totalTokens(t))} tokens · ${fmtDur(t.duration_s)}</div>
        <div class="msg human" data-turn="${t.index}">${humanBubble(t.prompt, { clamp: isLong(t.prompt) })}</div>
        ${parts.join('')}`;
    }).join(''),
  };
}

function chatThread(e) {
  return {
    kind: 'Separate Claude chat',
    title: e.title,
    first: e.conversation[0]?.q || '',
    meta: `${plural(e.conversation.length, 'prompt')}${e.model ? ` · ${e.model}` : ''} · ${dayKey(e.date)}`,
    seq: e.seq,
    render: () => e.conversation.map((c) => `
      <div class="msg human">${humanBubble(c.q, { clamp: isLong(c.q) })}</div>
      <div class="msg claude">${claudeBubble(md(c.a))}</div>`).join(''),
  };
}

function renderConvos(threads) {
  const box = $('#convos');
  box.innerHTML = '';
  for (const th of [...threads].sort((a, b) => a.seq - b.seq)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'convo-card';
    b.innerHTML = `<div class="k">${esc(th.kind)}</div><div class="t">${esc(th.title)}</div>
      <div class="first">${esc(th.first)}</div><div class="m">${esc(th.meta)}</div>`;
    b.addEventListener('click', () => openThread(th, 0));
    box.append(b);
  }
}

function openThread(th, turnIndex) {
  const dlg = $('#thread');
  $('#thread-kind').textContent = th.kind;
  $('#thread-title').innerHTML = th.url ? `<a href="${esc(th.url)}" target="_blank" rel="noopener">${esc(th.title)}</a>` : esc(th.title);
  const body = $('#thread-body');
  body.innerHTML = th.render();
  // Long messages expand on tap.
  body.querySelectorAll('.bubble.clamp').forEach((el) => el.addEventListener('click', () => el.classList.remove('clamp')));
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  const target = turnIndex ? body.querySelector(`[data-turn="${turnIndex}"]`) : null;
  dlg.scrollTop = 0;
  if (target) {
    target.classList.add('target');
    requestAnimationFrame(() => target.previousElementSibling?.scrollIntoView({ block: 'start' }));
  }
}

function setupDialog() {
  const dlg = $('#thread');
  const close = () => (typeof dlg.close === 'function' ? dlg.close() : dlg.removeAttribute('open'));
  dlg.querySelector('.close').addEventListener('click', close);
  dlg.addEventListener('click', (ev) => { if (ev.target === dlg) close(); });
}

function setupTabs() {
  const tabs = { 'tab-timeline': '#timeline', 'tab-convos': '#convos' };
  for (const [id, panel] of Object.entries(tabs)) {
    $(`#${id}`).addEventListener('click', () => {
      for (const [other, p] of Object.entries(tabs)) {
        $(`#${other}`).setAttribute('aria-selected', String(other === id));
        $(p).hidden = p !== panel;
      }
    });
  }
}

// ---- Main -----------------------------------------------------------------------------------

async function main() {
  const meta = await getJSON('./meta.json').catch(() => ({}));
  if (meta.title) {
    $('#title').textContent = `How ${meta.title} was built`;
    document.title = `Making of ${meta.title}`;
  }
  if (meta.about) $('#lede').innerHTML = md(meta.about);
  plan = meta.plan || '';
  if (meta.plan_note) $('#plan-note').textContent = meta.plan_note;
  $('#links').innerHTML = [
    meta.game_url && `<a href="${esc(meta.game_url)}">Play the game</a>`,
    meta.repo_url && `<a href="${esc(meta.repo_url)}" target="_blank" rel="noopener">Source code</a>`,
  ].filter(Boolean).join('');
  setupTabs();
  setupDialog();

  const { sessions: files } = await getJSON('./sessions/index.json');
  const sessions = (await Promise.all(files.map((f) => getJSON(`./sessions/${f}`).catch(() => null)))).filter(Boolean);
  const manual = (await getJSON('./manual-log.json').catch(() => ({ entries: [] }))).entries || [];

  const turns = sessions.flatMap((s) => s.turns);
  filterPlanUsage(turns);
  renderStats(turns, meta);

  // Number Claude Code prompts across the whole project, in order.
  const numbering = new Map();
  [...turns].sort((a, b) => a.seq - b.seq).forEach((t, i) => numbering.set(t, i + 1));

  const threads = new Map();
  for (const s of sessions) threads.set(s, sessionThread(s, numbering));
  for (const e of manual) if (e.conversation?.length) threads.set(e, chatThread(e));
  renderConvos(threads.values());

  const items = [
    ...sessions.flatMap((s) => s.turns.map((turn) => ({ seq: turn.seq, date: turn.date, turn, session: s, n: numbering.get(turn) }))),
    ...manual.map((entry) => ({ seq: entry.seq, date: entry.date, entry })),
  ].sort((x, y) => x.seq - y.seq);
  renderTimeline(items, { threads, repoUrl: meta.repo_url });
}

main().catch((err) => {
  $('#timeline').innerHTML = `<p class="empty">Couldn't load the log: ${esc(err.message)}</p>`;
});
