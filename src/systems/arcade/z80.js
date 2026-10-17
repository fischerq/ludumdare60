// Loads the pinned Z80 core. It's a classic script defining a global Z80 function, so we fetch it and wrap it
// instead of importing it. Works in the browser and in Node 18+ (global fetch).

import { ARCADE } from '../../config.js';

let pending = null;

export function loadZ80(url = ARCADE.z80Url) {
  pending ??= fetch(url).then(r => {
    if (!r.ok) throw new Error(`Z80 core: HTTP ${r.status}`);
    return r.text();
  }).then(src => new Function("window", `${src}\nreturn Z80;`)(globalThis)); // it checks `this === window`
  return pending;
}
