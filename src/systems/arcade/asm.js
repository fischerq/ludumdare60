// A small two-pass Z80 assembler in plain JS (no Phaser), so the browser assembles the game's program at load
// and the CPU layer can show the real source next to its addresses and bytes.
//
// Syntax: `label:`, `NAME EQU expr` (or `NAME = expr`), ORG, DB/DEFB (numbers and "strings"), DW/DEFW,
// DS/DEFS n[,fill], comments after `;`. Numbers: 123, 0x7f, $7f, 7Fh, %1010; `$` alone is the current address.
// Expressions: + - * / % << >> & | ^ ~, parentheses, LOW(x), HIGH(x). Labels starting with `.` are local to
// the last global label. Covers the documented Z80 instruction set (no IXH/IXL halves).

const R8 = { b: 0, c: 1, d: 2, e: 3, h: 4, l: 5, '(hl)': 6, a: 7 };
const RP = { bc: 0, de: 1, hl: 2, sp: 3 };
const RP2 = { bc: 0, de: 1, hl: 2, af: 3 };
const CC = { nz: 0, z: 1, nc: 2, c: 3, po: 4, pe: 5, p: 6, m: 7 };
const ALU = { add: 0, adc: 1, sub: 2, sbc: 3, and: 4, xor: 5, or: 6, cp: 7 };
const ROT = { rlc: 0, rrc: 1, rl: 2, rr: 3, sla: 4, sra: 5, sll: 6, srl: 7 };
const BITOP = { bit: 0x40, res: 0x80, set: 0xc0 };
const SIMPLE = {
  nop: [0x00], halt: [0x76], di: [0xf3], ei: [0xfb], exx: [0xd9], cpl: [0x2f], neg: [0xed, 0x44], scf: [0x37],
  ccf: [0x3f], daa: [0x27], rlca: [0x07], rrca: [0x0f], rla: [0x17], rra: [0x1f], ret: [0xc9], reti: [0xed, 0x4d],
  retn: [0xed, 0x45], ldir: [0xed, 0xb0], lddr: [0xed, 0xb8], ldi: [0xed, 0xa0], ldd: [0xed, 0xa8],
  cpir: [0xed, 0xb1], cpi: [0xed, 0xa1], rld: [0xed, 0x6f], rrd: [0xed, 0x67],
};

// Split "a, (b, c), 'x,y'" on top-level commas.
function splitArgs(s) {
  const out = []; let depth = 0, q = null, cur = '';
  for (let k = 0; k < s.length; k++) {
    const ch = s[k];
    if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === '"' || (ch === "'" && s[k + 2] === "'")) { q = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// True if s is "( ... )" with the outer parentheses matching each other.
function wrapped(s) {
  if (s[0] !== '(' || s[s.length - 1] !== ')') return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { depth--; if (depth === 0 && i < s.length - 1) return false; }
  }
  return true;
}

export function assemble(source, predefined = {}) {
  const lines = source.split('\n');
  const symbols = { ...predefined };
  let pass, pc, out, listing, errors, global;

  const local = (name) => (name.startsWith('.') ? global + name : name);

  // Expression evaluator (recursive descent). Undefined symbols are 0 in pass 1.
  function evaluate(text) {
    let i = 0;
    const s = text.trim();
    const ws = () => { while (s[i] === ' ' || s[i] === '\t') i++; };
    const fail = (msg) => { throw new Error(`${msg} in "${text}"`); };
    function atom() {
      ws();
      const ch = s[i];
      if (ch === '(') { i++; const v = expr(); ws(); if (s[i++] !== ')') fail('missing )'); return v; }
      if (ch === '-') { i++; return -atom(); }
      if (ch === '+') { i++; return atom(); }
      if (ch === '~') { i++; return ~atom(); }
      if (ch === "'" && s[i + 2] === "'") { const v = s.charCodeAt(i + 1); i += 3; return v; }
      let m = /^(0x[0-9a-f]+|\$[0-9a-f]+|[0-9][0-9a-f]*h\b|%[01]+|[0-9]+)/i.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const t = m[0].toLowerCase();
        if (t.startsWith('0x')) return parseInt(t.slice(2), 16);
        if (t.startsWith('$')) return parseInt(t.slice(1), 16);
        if (t.startsWith('%')) return parseInt(t.slice(1), 2);
        if (t.endsWith('h')) return parseInt(t.slice(0, -1), 16);
        return parseInt(t, 10);
      }
      if (ch === '$') { i++; return pc; }
      m = /^\.?[a-z_][a-z0-9_.]*/i.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const name = m[0];
        ws();
        if (s[i] === '(' && /^(low|high)$/i.test(name)) {
          i++; const v = expr(); ws(); if (s[i++] !== ')') fail('missing )');
          return /^low$/i.test(name) ? v & 0xff : (v >> 8) & 0xff;
        }
        const key = local(name);
        if (key in symbols) return symbols[key];
        if (pass === 2) fail(`unknown symbol ${name}`);
        return 0;
      }
      fail('bad expression');
    }
    const levels = [['|'], ['^'], ['&'], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];
    function bin(level) {
      if (level === levels.length) return atom();
      let v = bin(level + 1);
      for (;;) {
        ws();
        const op = levels[level].find((o) => s.startsWith(o, i));
        if (!op) return v;
        i += op.length;
        const r = bin(level + 1);
        v = { '|': v | r, '^': v ^ r, '&': v & r, '<<': v << r, '>>': v >> r, '+': v + r, '-': v - r,
          '*': v * r, '/': Math.trunc(v / r), '%': v % r }[op];
      }
    }
    function expr() { return bin(0); }
    const v = expr();
    ws();
    if (i < s.length) fail('trailing characters');
    return v;
  }

  // Classify one operand.
  function operand(raw) {
    const t = raw.trim(), l = t.toLowerCase().replace(/\s+/g, '');
    if (l in R8) return { k: 'r', r: R8[l], s: l };
    if (l in RP || l === 'af') return { k: 'rp', s: l };
    if (l === "af'") return { k: 'afx' };
    if (l === 'ix' || l === 'iy') return { k: 'ix', pre: l === 'ix' ? 0xdd : 0xfd };
    if (l === 'i' || l === 'r') return { k: 'special', s: l };
    if (l in CC) return { k: 'cc', s: l };
    if (wrapped(t)) {
      const inner = t.slice(1, -1).trim(), il = inner.toLowerCase().replace(/\s+/g, '');
      if (il === 'bc' || il === 'de' || il === 'sp' || il === 'c') return { k: 'ind', s: il };
      if (il === 'ix' || il === 'iy') return { k: 'idx', pre: il === 'ix' ? 0xdd : 0xfd, d: 0 };
      const m = /^(ix|iy)\s*([+-].*)$/i.exec(inner);
      if (m) return { k: 'idx', pre: m[1].toLowerCase() === 'ix' ? 0xdd : 0xfd, d: evaluate(m[2]) };
      return { k: 'mem', v: evaluate(inner) };
    }
    return { k: 'imm', v: evaluate(t), s: l };
  }

  const b8 = (v) => {
    if (pass === 2 && (v < -128 || v > 255)) throw new Error(`byte out of range: ${v}`);
    return v & 0xff;
  };
  const w16 = (v) => [v & 0xff, (v >> 8) & 0xff];
  const disp = (d) => {
    if (pass === 2 && (d < -128 || d > 127)) throw new Error(`index offset out of range: ${d}`);
    return d & 0xff;
  };
  const rel = (target, size) => {
    const d = target - (pc + size);
    if (pass === 2 && (d < -128 || d > 127)) throw new Error(`relative jump out of range: ${d}`);
    return d & 0xff;
  };
  // r8 operand, or an (IX+d) one: returns { pre, code, d }.
  const r8x = (o) => {
    if (o.k === 'r') return { pre: null, code: o.r };
    if (o.k === 'idx') return { pre: o.pre, code: 6, d: o.d };
    return null;
  };
  const withIdx = (x, bytes, extra = []) => (x.pre ? [x.pre, ...bytes, disp(x.d), ...extra] : [...bytes, ...extra]);

  function encode(mn, args) {
    if (SIMPLE[mn] && !(mn === 'ret' && args.length)) return SIMPLE[mn];
    const o = args.map(operand);
    const [a, b] = o;
    const bad = () => { throw new Error(`can't encode ${mn} ${args.join(', ')}`); };
    switch (mn) {
      case 'ld': {
        const xa = r8x(a), xb = b && r8x(b);
        if (xa && xb) {
          if (xa.pre && xb.pre) bad();
          if (xa.code === 6 && xb.code === 6) bad();
          const x = xa.pre ? xa : xb;
          return withIdx(x, [0x40 | xa.code << 3 | xb.code]);
        }
        if (xa && b.k === 'imm') return withIdx(xa, [0x06 | xa.code << 3], [b8(b.v)]);
        if (a.k === 'r' && a.s === 'a') {
          if (b.k === 'ind' && b.s === 'bc') return [0x0a];
          if (b.k === 'ind' && b.s === 'de') return [0x1a];
          if (b.k === 'mem') return [0x3a, ...w16(b.v)];
          if (b.k === 'special') return [0xed, b.s === 'i' ? 0x57 : 0x5f];
        }
        if (b.k === 'r' && b.s === 'a') {
          if (a.k === 'ind' && a.s === 'bc') return [0x02];
          if (a.k === 'ind' && a.s === 'de') return [0x12];
          if (a.k === 'mem') return [0x32, ...w16(a.v)];
          if (a.k === 'special') return [0xed, a.s === 'i' ? 0x47 : 0x4f];
        }
        if (a.k === 'rp' && a.s !== 'af') {
          const p = RP[a.s];
          if (b.k === 'imm') return [0x01 | p << 4, ...w16(b.v)];
          if (b.k === 'mem') return a.s === 'hl' ? [0x2a, ...w16(b.v)] : [0xed, 0x4b | p << 4, ...w16(b.v)];
          if (a.s === 'sp' && b.k === 'rp' && b.s === 'hl') return [0xf9];
          if (a.s === 'sp' && b.k === 'ix') return [b.pre, 0xf9];
        }
        if (a.k === 'ix') {
          if (b.k === 'imm') return [a.pre, 0x21, ...w16(b.v)];
          if (b.k === 'mem') return [a.pre, 0x2a, ...w16(b.v)];
        }
        if (a.k === 'mem') {
          if (b.k === 'rp' && b.s === 'hl') return [0x22, ...w16(a.v)];
          if (b.k === 'rp' && b.s !== 'af') return [0xed, 0x43 | RP[b.s] << 4, ...w16(a.v)];
          if (b.k === 'ix') return [b.pre, 0x22, ...w16(a.v)];
        }
        return bad();
      }
      case 'push': case 'pop': {
        const base = mn === 'push' ? 0xc5 : 0xc1;
        if (a.k === 'rp' && a.s in RP2) return [base | RP2[a.s] << 4];
        if (a.k === 'ix') return [a.pre, base | 0x20];
        return bad();
      }
      case 'ex': {
        if (a.k === 'rp' && a.s === 'de' && b.k === 'rp' && b.s === 'hl') return [0xeb];
        if (a.k === 'rp' && a.s === 'af' && b.k === 'afx') return [0x08];
        if (a.k === 'ind' && a.s === 'sp' && b.k === 'rp' && b.s === 'hl') return [0xe3];
        if (a.k === 'ind' && a.s === 'sp' && b.k === 'ix') return [b.pre, 0xe3];
        return bad();
      }
      case 'add': case 'adc': case 'sbc': {
        if (o.length === 2 && a.k === 'rp' && a.s === 'hl' && b.k === 'rp' && b.s !== 'af') {
          if (mn === 'add') return [0x09 | RP[b.s] << 4];
          return [0xed, (mn === 'adc' ? 0x4a : 0x42) | RP[b.s] << 4];
        }
        if (mn === 'add' && o.length === 2 && a.k === 'ix') {
          const p = b.k === 'ix' ? 2 : b.k === 'rp' && b.s !== 'hl' && b.s !== 'af' ? RP[b.s] : bad();
          return [a.pre, 0x09 | p << 4];
        }
      }
      // fall through: 8-bit arithmetic
      case 'sub': case 'and': case 'xor': case 'or': case 'cp': {
        let src = o;
        if (o.length === 2) { if (!(a.k === 'r' && a.s === 'a')) bad(); src = [b]; }
        const s = src[0], op = ALU[mn], x = r8x(s);
        if (x) return withIdx(x, [0x80 | op << 3 | x.code]);
        if (s.k === 'imm') return [0xc6 | op << 3, b8(s.v)];
        return bad();
      }
      case 'inc': case 'dec': {
        const x = r8x(a);
        if (x) return withIdx(x, [(mn === 'inc' ? 0x04 : 0x05) | x.code << 3]);
        if (a.k === 'rp' && a.s !== 'af') return [(mn === 'inc' ? 0x03 : 0x0b) | RP[a.s] << 4];
        if (a.k === 'ix') return [a.pre, mn === 'inc' ? 0x23 : 0x2b];
        return bad();
      }
      case 'jp': {
        if (o.length === 1) {
          if (a.k === 'r' && a.s === '(hl)') return [0xe9];
          if (a.k === 'idx') return [a.pre, 0xe9];
          if (a.k === 'imm') return [0xc3, ...w16(a.v)];
        }
        if (o.length === 2 && args[0].toLowerCase() in CC) return [0xc2 | CC[args[0].toLowerCase()] << 3, ...w16(b.v)];
        return bad();
      }
      case 'jr': {
        if (o.length === 1) return [0x18, rel(a.v, 2)];
        const c = CC[args[0].toLowerCase()];
        if (c === undefined || c > 3) bad();
        return [0x20 | c << 3, rel(b.v, 2)];
      }
      case 'djnz': return [0x10, rel(a.v, 2)];
      case 'call': {
        if (o.length === 1) return [0xcd, ...w16(a.v)];
        return [0xc4 | CC[args[0].toLowerCase()] << 3, ...w16(b.v)];
      }
      case 'ret': return [0xc0 | CC[args[0].toLowerCase()] << 3];
      case 'rst': return [0xc7 | (a.v & 0x38)];
      case 'im': return [0xed, [0x46, 0x56, 0x5e][a.v]];
      case 'out': if (a.k === 'mem' && b.s === 'a') return [0xd3, b8(a.v)]; return bad();
      case 'in': if (a.s === 'a' && b.k === 'mem') return [0xdb, b8(b.v)]; return bad();
      default: {
        if (mn in ROT) {
          const x = r8x(a) ?? bad();
          return x.pre ? [x.pre, 0xcb, disp(x.d), ROT[mn] << 3 | 6] : [0xcb, ROT[mn] << 3 | x.code];
        }
        if (mn in BITOP) {
          const bit = a.v, x = r8x(b) ?? bad();
          if (bit < 0 || bit > 7) bad();
          return x.pre ? [x.pre, 0xcb, disp(x.d), BITOP[mn] | bit << 3 | 6] : [0xcb, BITOP[mn] | bit << 3 | x.code];
        }
        return bad();
      }
    }
  }

  function emit(bytes) {
    if (pass === 2) for (let k = 0; k < bytes.length; k++) out[(pc + k) & 0xffff] = bytes[k];
    pc += bytes.length;
  }

  for (pass = 1; pass <= 2; pass++) {
    pc = 0; out = new Uint8Array(0x10000); listing = []; errors = []; global = '';
    const labels = new Set();
    lines.forEach((line, n) => {
      const start = pc;
      let bytes = [];
      try {
        let text = line;
        // Strip the comment, keeping ';' inside quotes.
        let q = null;
        for (let k = 0; k < text.length; k++) {
          const ch = text[k];
          if (q) { if (ch === q) q = null; continue; }
          if (ch === '"' || (ch === "'" && text[k + 2] === "'")) { q = ch; continue; }
          if (ch === ';') { text = text.slice(0, k); break; }
        }
        text = text.trim();
        let m = /^(\.?[a-z_][a-z0-9_.]*)\s*:\s*/i.exec(text);
        if (m) {
          const name = m[1].startsWith('.') ? global + m[1] : m[1];
          if (!m[1].startsWith('.')) global = m[1];
          if (labels.has(name) || name in predefined) throw new Error(`duplicate label ${name}`);
          labels.add(name);
          symbols[name] = pc;
          text = text.slice(m[0].length);
        }
        m = /^([a-z_][a-z0-9_]*)\s+(?:equ\b|=)\s*(.+)$/i.exec(text);
        if (m) {
          if (m[1] in predefined) throw new Error(`${m[1]} is already defined`);
          symbols[m[1]] = evaluate(m[2]);
        }
        else if (text) {
          const sp = /^(\S+)\s*(.*)$/.exec(text);
          const mn = sp[1].toLowerCase().replace(/^\./, ''), args = splitArgs(sp[2]);
          if (mn === 'org') pc = evaluate(args[0]);
          else if (mn === 'db' || mn === 'defb') {
            for (const a of args) {
              if (/^".*"$/.test(a)) bytes.push(...[...a.slice(1, -1)].map((c) => c.charCodeAt(0)));
              else bytes.push(b8(evaluate(a)));
            }
          } else if (mn === 'dw' || mn === 'defw') for (const a of args) bytes.push(...w16(evaluate(a)));
          else if (mn === 'ds' || mn === 'defs') bytes = new Array(evaluate(args[0])).fill(args[1] ? b8(evaluate(args[1])) : 0);
          else bytes = encode(mn, args);
          emit(bytes);
        }
      } catch (e) {
        errors.push({ line: n + 1, message: e.message, source: line });
      }
      listing.push({ line: n + 1, addr: start, bytes: pass === 2 ? [...out.subarray(start, pc)].slice(0, Math.max(0, pc - start)) : [], source: line });
    });
  }
  return { rom: out.subarray(0, 0x4000), memory: out, symbols, listing, errors };
}
