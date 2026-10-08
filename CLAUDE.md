# Working rules

Game jam project: a mobile-first Phaser 3 browser game deployed to Netlify as a static site.

## Hard constraints
- **No build, CDN only.** Plain ES modules served as static files. Don't add npm, `package.json`, bundlers,
  transpilers, or TypeScript. Phaser is loaded from jsdelivr in `index.html`, pinned to an exact 3.x version;
  any other library must likewise come from a pinned CDN URL.
- **Relative paths only** (`./src/...`, `assets/...`) so the game runs from any static host or subfolder.
- **Phone first.** Every change must keep the game playable on a phone. Touch input is the primary control
  scheme; keyboard is a bonus for laptops and must never be required. Keep tap targets large and text readable
  at the 720x1280 logical resolution.

## Conventions
- Placeholder art is drawn in code with `Graphics` + `generateTexture` in `BootScene`; no image files until real
  assets exist. When real art lands, put it in `assets/` and load it in `BootScene` under the same texture keys.
- All tunable numbers (speeds, sizes, colors, timings) go in `src/config.js`, not inline in scenes, so "feel"
  tweaks are one-line edits.
- One scene per file in `src/scenes/`, registered in the scene list in `src/main.js`.

## Workflow
- After committing and pushing work to the session's branch, always open a pull request against `main`
  automatically (no need to ask first). If a PR for the branch is already open, push to it instead of opening a new one.

## AI-use log (making-of)
Every human prompt and its token usage/cost is published in `making-of/` as a scrollable "making of" page.
- Run `python3 tools/ai_log.py` right before the **last commit of every turn** and include the changes under
  `making-of/sessions/` in that commit. A `UserPromptSubmit` hook (`.claude/settings.json`) also runs it at the
  start of each turn, so the previous turn's tail is picked up even if it was missed.
- Even a turn that changes no code (a question, a plan) must still commit and push the updated log.
- Never hand-edit `making-of/sessions/*.json`; regenerate them. Never delete a session file: the transcript it came
  from is gone once the cloud container is reclaimed. `making-of/meta.json` is the place for hand-written notes.
- The exporter only reads prompts, Claude's visible replies, tool names and token counts. Tool outputs, system
  prompts and thinking stay out. If a prompt ever contains a secret, tell the user before committing the log.
- If a new model shows up, add its prices to `PRICES` in `tools/ai_log.py`.

## Testing
- Run `python3 -m http.server` and open the page; check the browser console for errors.
- Sanity-check in a narrow portrait viewport with touch emulation (e.g. Playwright with `hasTouch`/`isMobile`).
