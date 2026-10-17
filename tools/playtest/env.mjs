// Makes the browser modules run in Node: config.js fetches src/settings/animation.json by a file URL, which
// Node's fetch can't read, so file URLs are read from disk. Import this before anything that imports config.js.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const netFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = url instanceof URL ? url : new URL(String(url), 'file:///');
  if (u.protocol !== 'file:') return netFetch(url, opts);
  try { return new Response(await readFile(fileURLToPath(u), 'utf8')); } catch { return new Response('', { status: 404 }); }
};
console.info = () => {}; // config.js reports the animation file on load
