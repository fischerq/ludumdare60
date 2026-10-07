# ludumdare60

Mobile-first browser game for Ludum Dare 60, built with [Phaser 3](https://phaser.io/) (loaded from CDN).
No build step, no npm: plain ES modules served as static files.

## Play locally

Serve the repo root with any static server (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To test on your phone, open `http://<your-laptop-ip>:8000` on the same Wi-Fi.

**Controls:** touch and drag (or click and hold) to move toward your finger. On a laptop, arrow keys / WASD also work.

## Deploy

Netlify deploys automatically on every push. `netlify.toml` publishes the repo root with no build command and
serves `index.html` and `src/**` with `Cache-Control: no-cache`, so a reload on the phone picks up the latest push.

## Layout

```
index.html            viewport + Phaser CDN script + loads src/main.js
src/main.js           Phaser config (720x1280 portrait, Scale.FIT, arcade physics), scene list
src/config.js         tunable constants: speeds, sizes, colors
src/scenes/           Boot (placeholder textures), Menu, Game, GameOver
assets/               real art/audio goes here later
```
