# Layer: the arcade hall (zoom out further)

**Status:** decided, first slice built 2026-10-17
**Parent:** [layers](layers.md) · [master](../master.md)
**Lab bench:** none yet
**Code:** rules `src/systems/hall.js` (no Phaser), scene `src/scenes/HallScene.js`, art `makeHall` in
`src/scenes/BootScene.js` (tileset and characters in `assets/arcade/`), map and numbers in `HALL` in
`src/config.js`. Playtest directly: `?scene=Hall`.

## Purpose
One layer above the [cabinet](layer-cabinet.md): we pull back from the machine and see the arcade shop it
stands in. Pac-Man himself walks around the hall, seen from above like a classic Pokémon game. Theme: Old Tech,
the arcade as a place.

## Rules · decided
- **A small, cozy room** (11x15 tiles with walls) that fits one screen, shown at 4x (`HALL.zoom`; the other
  layers use 2x), so characters are Pokémon-sized. Warm wooden floor, a red rug, a wallpapered back wall with
  windows, a Pac-Man poster, a ghost poster and a clock, plants, five cabinets (our yellow one in the middle), a
  claw machine, a soda machine, a bin, the counter with the shop owner asleep behind it, the change machine, the
  door at the bottom.
- **Same movement as Pac-Man, on the grid:** one tile per step, four directions (`HALL.walkSpeed` 4 tiles/s).
  Hold a finger down and drag to keep walking; a short tap talks to or uses whatever Pac-Man faces. Arrow keys +
  Space/Enter on a laptop. Text appears in an RPG text box at the bottom, sized to the text; tap to close.
- **Only bonus coins to collect** (like the fruit in the maze): 5 on the floor. Coins go into the global wallet
  (`src/wallet.js`, shown as COINS n) and stay picked up for the session. With at least one coin (`COINS.perGame`)
  you can play our cabinet, which zooms down into the cabinet layer. *(proposed)*
- **Talking:** the four ghosts in caps stand at the machines, one line each, hinting at how they hunt in the maze.
  Every machine and decoration has a line (`HALL.text`, `HALL.cellText`). The **shop owner** sleeps on the tile
  above the counter's left end (`O` in the map, `arcade/owner-sleep-0/1`, a "z" rising); talking to him only gets
  snoring. The counter itself shows its sign.
- **The other cabinets** play famous games of the time (named only in the text, a tiny picture on each screen, no
  logos): red Space Invaders (1978), blue Asteroids (1979), green Donkey Kong (1981), violet Galaxian (1979, out of
  order). Each has one line with a fact about how it worked.
- **Pickles:** the owner's bitten Gurke and a jar of cornichons on the counter next to him (`k`, `j`), a mini-Gurke
  in the top right corner where a plant stood (`u`). Details to talk to, nothing to collect.
- **The counter** is three tiles wide (Gurke, paper sign, jar) with the owner centered behind it. Only the paper sign
  (`s`) shows "BACK IN 5 MIN".
- **Manuals:** a two-tile table near the door. The stack (`n`) lists four booklets as choices in the text box (tap
  one, or arrows + Enter): three give a one-line blurb, Galaxian's was ripped out. Ours lies on its own next to it
  (`p`, a yellowed booklet with Pac-Man on the cover) and offers READ MORE, which opens the
  [service manual](manual.md) over the paused hall.
- **Portraits:** the text box shows a large portrait (48x48, `HALL.portraitSize`) in a frame on its top left edge:
  ghosts and the owner have their own (`arcade/portrait-<name>.png`, `portrait-ghosts` for the four together),
  things show their tile at 3x (a machine its top half). Pickup and chase messages have none.
- **The chase:** reading the **ghost poster** makes the visitors recognize Pac-Man: like Pokémon trainers, a
  "!" pops over each of them (`arcade/exclaim`, 0.9 s, everyone frozen), then together: "WAIT A MINUTE... WE KNOW
  YOU!". After that line all four chase Pac-Man with their maze rules (Blinky straight at him, Pinky 2 tiles
  ahead, Inky mirrored around Blinky, Clyde backs off when close), at 3.2 tiles/s after a 2 s head start (the
  poster leaves him in a dead end), never turning back. Ways out: walk out the **door**, or enter **our cabinet**
  (needs a coin). **Caught:** they take every coin and the hall starts over (floor coins back, Pac-Man at the
  start). After 20 s they give up. Happens every time the poster is read while they're calm. The frightened siren
  plays during the chase.
- **Transitions:** from the cabinet (LAYER UP) the hall starts zoomed in on our small cabinet and zooms out; going
  down zooms back into it, then the cabinet layer starts at its full view.

## Slice scope
- Build (done): cozy room, grid walking, coins, talking, Blinky's chase with the maze rules, escapes, text box,
  layer transitions both ways.
- Build (done, polish): the sleeping shop owner, text box portraits, the poster-triggered chase with the "!"
  moment, losing all coins and resetting the hall when caught.
- Build (done, details): the other cabinets as other games, the pickles, the manuals table with choices.
- Not now: more dialogue, collecting the mini-gurke, footstep sounds, a street outside.

## Open questions
- Should entering the machine work as an escape even without a coin? *Default now: no, a coin is needed.*
- Does drag-to-walk feel right? Is the chase too easy or too hard (`HALL.chase`)?

## Decision log
- 2026-10-17: Another layer up: a Pokémon-like top-down view of Pac-Man walking around the arcade shop. (Quirin)
- 2026-10-17: Defaults accepted for all eight questions; built the first slice. (Quirin)
- 2026-10-17: The hall becomes smaller and more detailed, Pokémon-like cozy. (Quirin)
- 2026-10-17: Map it to Pac-Man: same movement, only bonus coins to collect, talking to people and machines; one
  ghost gets angry when talked to and all of them chase like in Pac-Man; escape into the machine or out the door.
  (Quirin) Claude picked Blinky as the angry one, a 1 s head start, giving up after 20 s, coins kept when caught.
- 2026-10-17: Hall characters get their own 32x32 sprites (`arcade/pac-*`, `arcade/ghost-*` with the cap drawn in),
  shown 2x2 tiles big standing on their tile, lower ones in front. See [art](art.md). (Quirin)
- 2026-10-17: Coins are global (one wallet for all layers), spent one per game in the cabinet; the hall needs one coin, not 3. Start with 1 coin, picked-up coins don't respawn (Claude's defaults, proposed). (Quirin)
- 2026-10-17: Hall characters now fill exactly one tile (`HALL.charSize` 16), centered on it like a Pokémon game; the 32x32 art is shown at half size. Replaces the 2x2-tile size above. (Quirin)
- 2026-10-18: Polish: a shop owner who only snores, a large portrait in the text box, and the chase now starts
  from the ghost poster (a "!" over each ghost, "WAIT A MINUTE... WE KNOW YOU!"); caught costs all coins and resets
  the hall. Blinky no longer gets angry. Defaults accepted for all eight questions. (Quirin) Claude put the portrait
  above the box rather than beside the text (the box is too narrow) and raised the head start to 2 s, since the
  poster spot is a dead end and the playtest bot was always caught with 1 s.
- 2026-10-18: The other cabinets become other famous games of the time; the owner's bitten Gurke, a cornichon jar
  and a mini-Gurke; a table with four manuals, ours opening the full service manual. Defaults accepted for all eight
  questions (game picks and names, placement, choices in the text box, the manual as an HTML overlay). (Quirin)
- 2026-10-18: The counter is three tiles (Gurke, a paper sign that alone says BACK IN 5 MIN, jar) with the owner
  centered behind; our manual gets its own tile next to the stack on one table, the stack's fourth booklet is ripped
  out; the mini-Gurke moves to the top right plant's spot. (Quirin)
