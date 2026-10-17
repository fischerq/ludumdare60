# Layers of Pac

*(working title)*

Mobile-first browser game for Ludum Dare 60, built with [Phaser 3](https://phaser.io/) (loaded from CDN)
and Claude Code.
No build step, no npm: plain ES modules served as static files.

## Play locally

Serve the repo root with any static server (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. To test on your phone, open `http://<your-laptop-ip>:8000` on the same Wi-Fi.

### Windows: VS Code + Live Server

1. Open the repo folder in VS Code and install the recommended **Live Server** extension (ritwickdey.LiveServer;
   VS Code offers it from `.vscode/extensions.json`).
2. Open `index.html` and click **Go Live** in the status bar (or right-click → *Open with Live Server*).
3. The game opens at `http://<your-pc-ip>:5500/` and reloads on every save. The same URL works on your phone on
   the same Wi-Fi; allow Windows Firewall access for *Code* on private networks when asked.

The lab is at `/lab/` and the making-of page at `/making-of/`. Settings live in `.vscode/settings.json` (port 5500,
LAN access, no reload for docs or log files).

**Art:** the game loads its sprites and tiles from `assets/` (one PNG per texture). Overwrite a file there, reload,
and the game shows it (Live Server reloads by itself); `?codeart` shows the code-drawn placeholders instead.

**Controls:** touch and drag (or click and hold) to move toward your finger. On a laptop, arrow keys / WASD also work.

## Deploy

Netlify deploys automatically on every push. `netlify.toml` publishes the repo root with no build command and
serves `index.html` and `src/**` with `Cache-Control: no-cache`, so a reload on the phone picks up the latest push.

## Design docs and lab

`design/master.md` is the game's design doc, with one doc per system under `design/systems/`; see
`design/README.md` for how features go from questions to a decided slice. The lab at [`/lab/`](lab/) has small
testing grounds that run one mechanic side by side in several variants.

## Making-of / AI-use log

This game is built with Claude Code. Every prompt, Claude's replies, token usage and API-equivalent cost are
logged in `making-of/` and shown at [`/making-of/`](making-of/) as a scrollable timeline.
`python3 tools/ai_log.py` regenerates `making-of/sessions/*.json` from the local Claude Code transcripts.

## Layout

```
index.html            viewport + Phaser CDN script + loads src/main.js
src/main.js           Phaser config (720x1280 portrait, Scale.FIT, arcade physics), scene list
src/config.js         tunable constants: speeds, sizes, colors
src/scenes/           Boot (placeholder textures), Menu, Game (maze), Cabinet, Hall
src/systems/          pure mechanic logic shared by the game and the lab (no Phaser)
design/               design docs: master.md, systems/*.md
lab/                  testing grounds: harness (lab.js) + benches/*.js
assets/               the game's art, one PNG per texture (edit in place; the export keeps edited files)
making-of/            AI-use log + making-of page (index.html, sessions/*.json)
tools/ai_log.py       exports Claude Code transcripts into making-of/sessions/
tools/export_assets.py writes assets/*.png from BootScene (via tools/export-assets.html)
```
