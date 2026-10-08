# Working rules

Game jam project: **mini-gurke** (working title) for Ludum Dare 60, a mobile-first Phaser 3 browser game deployed
to Netlify as a static site. Keep branding light: who made it and where lives in one note on the making-of page
(`about` in `making-of/meta.json`), not in the game or README.

When the title changes, update `GAME_TITLE` in `src/config.js`, `<title>` in `index.html`, `title` in
`making-of/meta.json` and the README heading.

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
- **Plan usage:** call the claude-code-remote `list_events` tool twice per turn: once at the **start** (before
  any other work) and once at the **end**, right before running the exporter for the final commit. Use
  `session_id` = `session_` + the part of `$CLAUDE_CODE_REMOTE_SESSION_ID` after `cse_`,
  `kinds: ["rate_limit_event"]`, `limit: 100`. The exporter reads the 5-hour and weekly utilization from those tool
  results in the transcript. Events fire whenever the session sees the value change, so the start call also catches
  the tail of the previous turn and the end call catches this turn's changes. An empty result is fine. Skip silently
  when the tool isn't available (e.g. local CLI sessions). Plan usage is account-wide and concurrent work happens:
  the exporter only counts changes inside a turn, and the making-of page drops jumps that the turn's token cost
  can't explain. Don't try to correct the numbers by hand.
- Even a turn that changes no code (a question, a plan) must still commit and push the updated log.
- Never hand-edit `making-of/sessions/*.json`; regenerate them. Never delete a session file: the transcript it came
  from is gone once the cloud container is reclaimed. `making-of/meta.json` is the place for hand-written notes.
- The exporter only reads prompts, Claude's visible replies, tool names and token counts. Tool outputs, system
  prompts and thinking stay out. If a prompt ever contains a secret, tell the user before committing the log.
- If a new model shows up, add its prices to `PRICES` in `tools/ai_log.py`.

## Testing
- Run `python3 -m http.server` and open the page; check the browser console for errors.
- Sanity-check in a narrow portrait viewport with touch emulation (e.g. Playwright with `hasTouch`/`isMobile`).
