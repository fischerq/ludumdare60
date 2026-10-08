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
- Placeholder art is drawn in code with `Graphics` + `generateTexture` in `BootScene`, unless the user provides
  assets. When real art lands, put it in `assets/` and load it in `BootScene` under the same texture keys.
- All tunable numbers (speeds, sizes, colors, timings) go in `src/config.js`, not inline in scenes, so "feel"
  tweaks are one-line edits.
- One scene per file in `src/scenes/`, registered in the scene list in `src/main.js`.
- Don't use localStorage for anything important. A best score is fine; game state isn't.
- Keep the mobile pitfalls handled: no pull-to-refresh, no pinch or double-tap zoom, multi-touch works, and the game
  pauses while the tab is hidden.

## Working style
- Make small, focused changes and commit each one with a clear message, so the user can playtest after every push.
- After each change, tell the user in one or two sentences what to test on the phone.

## Workflow
- **Every push must end up in an open pull request against `main`. Open it yourself, without asking.**
  - Before pushing, check whether the branch's previous PR is still open. If it is, push to it.
  - If it was merged or closed, start the branch again from the latest `main`, rebase any commits that weren't merged
    onto it, push, and open a new PR in the same turn. Never leave pushed commits that no open PR covers.
  - Put the PR link in your reply.

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
- Messages the user sends while Claude is working are logged as `followups` on that turn automatically.
- The timeline row for a prompt is the prompt's own first sentence; don't write summaries.
- Tokens and the model per prompt are the main numbers; the headline cost is the share of the subscription
  (`plan`, `plan_price_month` and `plan_currency` in `meta.json`; the billed price is 214,20 € a month). API list prices are reference only.
- **Screenshots:** images pasted into prompts are published automatically (status bar cropped, resized). When you
  check a change in a headless browser, save one or two representative screenshots as
  `making-of/media/<first 8 chars of session id>-<turn index>-c<n>.jpg` (use `publish_image` in `tools/ai_log.py`);
  the exporter attaches them to that turn as Claude's images.
- If a new model shows up, add its prices to `PRICES` in `tools/ai_log.py` (models are read from the transcript).
- **Work outside Claude Code** goes in `making-of/manual-log.json` (format in its `_readme`): separate claude.ai
  chats, repo or Netlify setup, merges, playtests, art made by hand. When the user mentions such work, or you notice it
  (e.g. a PR was merged), add an entry. Use exact times from GitHub where available; otherwise use a date-only `at`
  and say the time wasn't recorded. Never invent details the user didn't give.

## Event page
`event/index.html` is a shareable page for the in-person Ludum Dare 60 site in Munich (Die Gamerei, hosted by
Munich eSports). It only states facts with a source. The official start (Sat 17 Oct 00:00 CEST) is from the ldjam.com countdown.
Venue hours (Sat 9:00 to Sun 17:00) are the user's current plan, and coordination happens on the Gamedev/Muc Discord
(https://discord.gg/FeZ96Z89A). Update the page when the plan changes.
The Games card shows one tile per game (thumbnail in `event/games/`, title, author, Play and Making-of
buttons); add a tile for each game as people share them.

## Times in the published log
The repo must not contain detailed timestamps. Every timeline item (Claude Code turn or `manual-log.json` entry) has
only a `date` (Munich) and a project-wide `seq` for ordering. A clock time (`time: "HH:MM"`, Munich) is allowed only
during the jam (`show_times_between` in `making-of/meta.json`). `tools/ai_log.py` uses exact times from the local
transcript internally and never writes them. Durations are fine. When adding a manual entry, set `seq` to the current
max + 1, or to a fraction between two neighbours for something that happened earlier.
The making-of timeline shows newest first by default, with a button to flip the order.

## Testing
- Run `python3 -m http.server` and open the page; check the browser console for errors.
- Sanity-check in a narrow portrait viewport with touch emulation (e.g. Playwright with `hasTouch`/`isMobile`).
