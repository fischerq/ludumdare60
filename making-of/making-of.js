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

const MANUAL_KINDS = { human: 'By hand', 'claude-chat': 'Separate Claude chat', other: 'Outside Claude Code' };
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

// Six equally weighted headline tiles; each carries its related detail as a subtitle.
function renderStats(turns, meta, repo, manualCount, sessionCount) {
  const cost = turns.reduce((a, t) => a + (t.cost_usd || 0), 0);
  const secs = turns.reduce((a, t) => a + t.duration_s, 0);
  const tk = turns.map(tokens).reduce((a, t) => ({ read: a.read + t.read, out: a.out + t.out }), { read: 0, out: 0 });
  const weekly = turns.reduce((a, t) => a + planCounted(t, 'seven_day'), 0);
  const tracked = turns.some((t) => t.plan_usage?.seven_day?.delta != null);
  const below = weekly < 0.005;  // under the 1% resolution of the weekly reading
  const price = meta.plan_price_month;
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: meta.plan_currency || 'USD' }).format(n);
  const share = below ? `<${(1 / WEEKS_PER_MONTH).toFixed(2)}%` : `≈${(weekly / WEEKS_PER_MONTH * 100).toFixed(1)}%`;
  const amount = price ? (below ? `<${money(0.01 / WEEKS_PER_MONTH * price)}` : `≈${money(weekly / WEEKS_PER_MONTH * price)}`) : '';

  const tiles = [
    [turns.length, 'prompts', `${plural(sessionCount, 'session')} · ${manualCount} steps by hand`],
    repo ? [repo.prs_merged, 'pull requests merged', `${repo.lines_of_code.toLocaleString()} lines of code · ${plural(repo.commits, 'commit')}`] : null,
    tracked ? [share, `of a month of ${plan || 'the subscription'}`, `${amount ? `${amount} of ${money(price)} · ` : ''}${below ? '<1%' : fmtPct(weekly)} of a weekly limit`] : null,
    [fmtNum(tk.read + tk.out), 'tokens', `${fmtNum(tk.out)} written · ${fmtNum(tk.read)} read`],
    [fmtDur(secs), 'Claude working', `${fmtDur(Math.round(secs / Math.max(1, turns.length)))} per prompt on average`],
    [fmtUSD(cost), 'at API list prices', 'for reference; paid via the subscription'],
  ].filter(Boolean);
  $('#stats').innerHTML = tiles.map(([v, k, sub]) =>
    `<div class="stat"><div class="v">${esc(String(v))}</div><div class="k">${esc(k)}</div><div class="sub">${esc(sub)}</div></div>`).join('');
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

// ---- Chat rendering (shared by the timeline and the conversation dialog) ----------------------

const isLong = (t) => t.length > 500 || t.split('\n').length > 10;
const imgs = (list, who) => (list?.length
  ? `<div class="attach ${who}">${list.map((src) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="Screenshot" loading="lazy"></a>`).join('')}</div>`
  : '');
const meMsg = (text, { images = [], note = '' } = {}) => `
  <div class="msg me">
    ${note ? `<div class="msg-note">${esc(note)}</div>` : ''}
    ${text ? `<div class="bubble me${isLong(text) ? ' clamp' : ''}"><div class="text">${esc(text)}</div></div>` : ''}
    ${imgs(images, 'me')}
  </div>`;
const claudeMsg = (html, { images = [], model = '' } = {}) => `
  <div class="msg them">
    <div class="msg-note">Claude${model ? ` · ${esc(model)}` : ''}</div>
    <div class="bubble them"><div class="md">${html}</div></div>
    ${imgs(images, 'them')}
  </div>`;
const stepsMsg = (notes) => (notes.length
  ? `<details class="steps"><summary>Claude worked through ${plural(notes.length, 'step')}</summary>${notes.map((x) => `<div class="md">${md(x)}</div>`).join('')}</details>`
  : '');

// One Claude Code turn as chat: the prompt, anything sent while Claude worked, folded progress
// notes, the reply with its screenshots, and a small line of numbers at the end.
function chatTurn(t, ctx) {
  const texts = [...t.progress_notes, t.reply].filter(Boolean);
  const follow = t.followups || [];
  const out = [meMsg(t.prompt, { images: t.images })];
  let pending = [];
  const flush = () => { out.push(stepsMsg(pending)); pending = []; };
  texts.forEach((x, i) => {
    for (const f of follow.filter((f) => f.after_reply_index === i)) { flush(); out.push(meMsg(f.text, { note: 'Sent while Claude was working' })); }
    if (i === texts.length - 1) {
      flush();
      out.push(claudeMsg(md(x), { images: t.claude_images, model: modelsOf(t).join(' + ') }));
    } else pending.push(x);
  });
  for (const f of follow.filter((f) => f.after_reply_index >= texts.length)) out.push(meMsg(f.text, { note: 'Sent while Claude was working' }));
  if (!t.reply) out.push(`<div class="steps-line">Claude was still working when this log was exported.</div>`);
  const tk = tokens(t);
  const tools = Object.entries(t.tools).map(([k, c]) => `${k.split('__').pop()} ×${c}`).join(', ');
  out.push(`<div class="turn-facts">
      <span class="chip model">${esc(modelsOf(t).join(' + '))}</span>
      <span class="chip"><b>${fmtNum(tk.out)}</b> written · <b>${fmtNum(tk.read)}</b> read</span>
      <span class="chip">${fmtDur(t.duration_s)}</span>
      ${planChip(t)}
      ${tools ? `<span class="chip">${esc(tools)}</span>` : ''}
      <span class="chip fine">≈${fmtUSD(t.cost_usd)} at API list prices</span>
    </div>${commitList(t.commits, ctx.repoUrl)}`);
  return out.join('');
}

function chatPairs(conversation) {
  return conversation.map((c) => meMsg(c.q) + claudeMsg(md(c.a))).join('');
}

function wireChat(root) {
  root.querySelectorAll('.bubble.clamp').forEach((el) => el.addEventListener('click', () => el.classList.remove('clamp'), { once: true }));
}

// ---- Timeline -------------------------------------------------------------------------------

function timelineItem(item, ctx) {
  const li = document.createElement('li');
  const d = document.createElement('details');
  li.append(d);
  if (item.entry) {
    const e = item.entry;
    li.className = 'item manual';
    d.innerHTML = `
      <summary><span class="kicker">${esc(MANUAL_KINDS[e.kind] || MANUAL_KINDS.other)}${e.time ? ` · ${esc(e.time)}` : ''}</span>
        <span class="line">${esc(e.title)}</span></summary>
      <div class="body">
        ${e.body ? `<div class="md">${md(e.body)}</div>` : ''}
        ${e.conversation?.length ? `<div class="chat">${chatPairs(e.conversation)}</div>` : ''}
        ${e.links?.length ? `<ul class="commits">${e.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a></li>`).join('')}</ul>` : ''}
      </div>`;
    wireChat(d);
    return li;
  }
  const { turn, n } = item;
  const first = firstSentence(turn.prompt);
  const more = turn.prompt.replace(/\s+/g, ' ').trim().length > first.replace(/…$/, '').length + 1 || turn.images?.length;
  li.className = 'item';
  d.innerHTML = `
    <summary><span class="kicker">Claude prompt #${n}${turn.time ? ` · ${esc(turn.time)}` : ''}<span class="tok">${fmtNum(totalTokens(turn))} tokens</span></span>
      <span class="line">${esc(first)}${more && !first.endsWith('…') ? '<span class="more-dots"> …</span>' : ''}</span></summary>
    <div class="body chat">${chatTurn(turn, ctx)}
      <button class="open-thread" type="button">Show the whole conversation →</button>
    </div>`;
  wireChat(d);
  d.querySelector('.open-thread').addEventListener('click', () => openThread(ctx.threads.get(item.session), turn.index));
  return li;
}

// Newest first by default; the order button flips it.
let newestFirst = true;

function renderTimeline(items, ctx) {
  if (newestFirst) items = [...items].reverse();
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
function sessionThread(s, ctx) {
  return {
    kind: 'Claude Code session',
    title: s.title || 'Claude Code session',
    url: s.session_url,
    first: s.turns[0]?.prompt || '',
    meta: `${plural(s.turns.length, 'prompt')} · ${fmtNum(s.turns.reduce((a, t) => a + totalTokens(t), 0))} tokens · ${[...new Set(s.turns.flatMap(modelsOf))].join(', ')} · ${dayKey(s.first_date)}${s.last_date !== s.first_date ? ` – ${dayKey(s.last_date)}` : ''}`,
    seq: s.turns[0]?.seq || 0,
    render: () => s.turns.map((t) => `<div class="turn-sep" data-turn="${t.index}">Claude prompt #${ctx.numbering.get(t)}</div>${chatTurn(t, ctx)}`).join(''),
  };
}

function chatThread(e) {
  return {
    kind: 'Separate Claude chat',
    title: e.title,
    first: e.conversation[0]?.q || '',
    meta: `${plural(e.conversation.length, 'prompt')}${e.model ? ` · ${e.model}` : ''} · ${dayKey(e.date)}`,
    seq: e.seq,
    render: () => chatPairs(e.conversation),
  };
}

function renderConvos(threads) {
  const box = $('#convos');
  box.innerHTML = '';
  for (const th of [...threads].sort((a, b) => (newestFirst ? b.seq - a.seq : a.seq - b.seq))) {
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
  wireChat(body);
  if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  dlg.scrollTop = 0;
  const target = turnIndex ? body.querySelector(`.turn-sep[data-turn="${turnIndex}"]`) : null;
  if (target) {
    target.classList.add('target');
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
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
  const repo = await getJSON('./repo-stats.json').catch(() => null);
  renderStats(turns, meta, repo, manual.length, sessions.length);

  // Number Claude Code prompts across the whole project, in order.
  const numbering = new Map();
  [...turns].sort((a, b) => a.seq - b.seq).forEach((t, i) => numbering.set(t, i + 1));

  const threads = new Map();
  const ctx = { numbering, repoUrl: meta.repo_url, threads };
  for (const s of sessions) threads.set(s, sessionThread(s, ctx));
  for (const e of manual) if (e.conversation?.length) threads.set(e, chatThread(e));
  renderConvos(threads.values());
  const allThreads = [...threads.values()];

  const items = [
    ...sessions.flatMap((s) => s.turns.map((turn) => ({ seq: turn.seq, date: turn.date, turn, session: s, n: numbering.get(turn) }))),
    ...manual.map((entry) => ({ seq: entry.seq, date: entry.date, entry })),
  ].sort((x, y) => x.seq - y.seq);
  renderTimeline(items, ctx);

  const btn = $('#order');
  const paint = () => { btn.textContent = newestFirst ? 'Newest first ↓' : 'Oldest first ↑'; };
  paint();
  btn.addEventListener('click', () => {
    newestFirst = !newestFirst;
    paint();
    renderTimeline(items, ctx);
    renderConvos(allThreads);
  });
}

main().catch((err) => {
  $('#timeline').innerHTML = `<p class="empty">Couldn't load the log: ${esc(err.message)}</p>`;
});
