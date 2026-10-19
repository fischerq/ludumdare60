# Credits / final screen

**Status:** decided, first slice built
**Parent:** [master](../master.md)
**Lab bench:** none
**Code:** `src/scenes/CreditsScene.js`, numbers and texts in `CREDITS` in `src/config.js`

## Purpose
A proper arcade ending: who made the game, a thank-you, and a calm close after the last win.

## Rules
- Classic arcade staff roll: black screen, pixel font, everything scrolls slowly upward (`CREDITS.rollSpeed`).
- Order: title (`GAME_TITLE`), STAFF, then role headings with names: PROMPTS / QUIRIN "ZERA", GRAPHICS /
  MAX "SADARENKO", CODE / CLAUDE (by Anthropic, via Claude Code); then SPECIAL THANKS / ZERA'S WIFE AND KIDS with
  🐁🐦 (emoji in the system font, the pixel font can't draw them). Nobody else is listed.
- THE END / THANK YOU FOR PLAYING rolls in last and is held on screen (`CREDITS.endY`).
- Along the bottom an intermission chase loops (maze textures reused): Pac-Man runs left with the ghosts behind,
  then chases them back frightened.
- Touch: holding the screen fast-forwards (`CREDITS.fastSpeed`); a tap that starts after the end leaves; a BACK
  button (top left, large padded hit area) leaves any time. Keyboard: hold SPACE/DOWN to fast-forward, ENTER after
  the end or ESC to leave.
- Sound: the menu bed (`CREDITS.bed`).
- API: `scene.start('Credits', { returnTo, returnData })`; on leaving it starts `returnTo` (default `Menu`) with
  `returnData`. Opened from a film reel in the lobby and after winning level 256 (wired by those scenes).
  `?scene=Credits` jumps straight to it.

## Slice scope
- Build: the roll, the chase, THE END hold, fast-forward, BACK.
- Not now: its own music bed, high-score entry, per-layer stats.

## Decision log
- 2026-10-19: Credits screen in the classic arcade staff-roll pattern; lists Quirin "Zera" (prompts), Max
  "sadarenko" (graphics) and thanks to Zera's wife and kids (🐁🐦); in-game credits are allowed now (Quirin)
- 2026-10-19: Claude added to the credits as CODE, by Anthropic via Claude Code, after PROMPTS and GRAPHICS (Quirin)
