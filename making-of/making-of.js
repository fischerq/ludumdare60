// Renders the making-of timeline from sessions/*.json (written by tools/ai_log.py).

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
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
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
const dayKey = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const timeOf = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function tokens(turn) {
  let read = 0, out = 0;
  for (const u of Object.values(turn.usage)) {
    read += u.input + u.cache_write_5m + u.cache_write_1h + u.cache_read;
    out += u.output;
  }
  return { read, out };
}

function renderStats(sessions) {
  const turns = sessions.flatMap((s) => s.turns);
  const cost = turns.reduce((a, t) => a + (t.cost_usd || 0), 0);
  const secs = turns.reduce((a, t) => a + t.duration_s, 0);
  const tk = turns.map(tokens).reduce((a, t) => ({ read: a.read + t.read, out: a.out + t.out }), { read: 0, out: 0 });
  const commits = new Set(turns.flatMap((t) => t.commits.map((c) => c.sha))).size;
  const weekly = turns.reduce((a, t) => a + Math.max(0, t.plan_usage_delta?.seven_day || 0), 0);
  const tracked = turns.some((t) => t.plan_usage_delta?.seven_day != null);
  const stats = [
    [turns.length, 'prompts sent'],
    [fmtUSD(cost), 'API-equivalent cost'],
    [fmtDur(secs), 'Claude working time'],
    [commits, 'commits'],
    [fmtNum(tk.out), 'tokens written'],
    [fmtNum(tk.read), 'tokens read (mostly cached)'],
  ];
  if (tracked) stats.splice(2, 0, [fmtPct(weekly), `of a weekly ${plan || 'plan'} limit`]);
  $('#stats').innerHTML = stats.map(([v, k]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('');
}

function renderTurn(turn, session, running, repoUrl) {
  const tk = tokens(turn);
  const tools = Object.entries(turn.tools).map(([n, c]) => `${n.replace(/^mcp__\w+?__/, '')} ×${c}`).join(', ');
  const long = turn.prompt.length > 600 || turn.prompt.split('\n').length > 12;
  const commits = turn.commits.map((c) => {
    const href = repoUrl ? `${repoUrl}/commit/${c.sha}` : null;
    const label = `<code>${c.sha.slice(0, 7)}</code> ${esc(c.subject)}`;
    return `<li>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>` : label}</li>`;
  }).join('');
  const notes = turn.progress_notes.length
    ? `<details class="notes"><summary>${turn.progress_notes.length} progress note${turn.progress_notes.length > 1 ? 's' : ''} while working</summary><ol>${turn.progress_notes.map((n) => `<li class="md">${md(n)}</li>`).join('')}</ol></details>`
    : '';

  const pu = turn.plan_usage_at_start;
  const pd = turn.plan_usage_delta;
  const sign = (f) => (f > 0 ? '+' : '') + fmtPct(f);
  const planChip = pd && (pd.five_hour != null || pd.seven_day != null)
    ? `<span class="chip">plan <b>${pd.five_hour != null ? sign(pd.five_hour) : '?'}</b> of 5h · <b>${pd.seven_day != null ? sign(pd.seven_day) : '?'}</b> of week</span>`
    : pu ? `<span class="chip">plan at start: 5h ${fmtPct(pu.five_hour)} · week ${fmtPct(pu.seven_day)}</span>` : '';

  const el = document.createElement('article');
  el.className = 'turn';
  el.innerHTML = `
    <div class="turn-meta"><span class="n">#${running.n}</span><span>${timeOf(turn.sent_at)}</span>
      <span>${fmtDur(turn.duration_s)}</span><span>${fmtUSD(turn.cost_usd)}</span>
      <span>running total ${fmtUSD(running.cost)}</span></div>
    <div class="prompt${long ? ' long' : ''}"><div class="who">Human</div><div class="body">${esc(turn.prompt)}</div>
      ${long ? '<button class="more" type="button">Show full prompt</button>' : ''}</div>
    <div class="reply"><div class="who">Claude</div><div class="md">${turn.reply ? md(turn.reply) : '<p><i>(still working when this log was exported)</i></p>'}</div>
      ${notes}
      <div class="facts">
        <span class="chip"><b>${fmtNum(tk.out)}</b> written</span>
        <span class="chip"><b>${fmtNum(tk.read)}</b> read</span>
        <span class="chip"><b>${turn.api_requests}</b> model calls</span>
        ${planChip}
        ${tools ? `<span class="chip">${esc(tools)}</span>` : ''}
      </div>
      ${commits ? `<ul class="commits">${commits}</ul>` : ''}
    </div>`;
  const btn = el.querySelector('.more');
  if (btn) btn.addEventListener('click', () => {
    const box = el.querySelector('.prompt');
    box.classList.toggle('open');
    btn.textContent = box.classList.contains('open') ? 'Show less' : 'Show full prompt';
  });
  return el;
}

async function main() {
  const meta = await getJSON('./meta.json').catch(() => ({}));
  if (meta.title) {
    $('#title').textContent = `How ${meta.title} was built`;
    document.title = `Making Of ${meta.title}`;
  }
  plan = meta.plan || '';
  if (meta.plan_note) $('#plan-note').textContent = meta.plan_note;
  $('#links').innerHTML = [
    meta.game_url && `<a href="${esc(meta.game_url)}">Play the game</a>`,
    meta.repo_url && `<a href="${esc(meta.repo_url)}" target="_blank" rel="noopener">Source code</a>`,
  ].filter(Boolean).join('');

  const { sessions: files } = await getJSON('./sessions/index.json');
  const sessions = (await Promise.all(files.map((f) => getJSON(`./sessions/${f}`).catch(() => null)))).filter(Boolean);
  sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));

  renderStats(sessions);

  const tl = $('#timeline');
  tl.textContent = '';
  if (!sessions.length) { tl.innerHTML = '<p class="empty">No sessions logged yet.</p>'; return; }

  const running = { n: 0, cost: 0 };
  let lastDay = null;
  for (const s of sessions) {
    let headerDone = false;
    for (const turn of s.turns) {
      const day = dayKey(turn.sent_at);
      if (day !== lastDay) {
        const d = document.createElement('h2');
        d.className = 'day';
        d.textContent = day;
        tl.append(d);
        lastDay = day;
        headerDone = false;
      }
      if (!headerDone) {
        const h = document.createElement('p');
        h.className = 'session-head';
        const name = esc(s.title || 'Claude Code session');
        h.innerHTML = `Session: ${s.session_url ? `<a href="${esc(s.session_url)}" target="_blank" rel="noopener">${name}</a>` : name}`;
        tl.append(h);
        headerDone = true;
      }
      running.n += 1;
      running.cost += turn.cost_usd || 0;
      tl.append(renderTurn(turn, s, running, meta.repo_url));
    }
  }
}

main().catch((err) => {
  $('#timeline').innerHTML = `<p class="empty">Couldn't load the log: ${esc(err.message)}</p>`;
});
