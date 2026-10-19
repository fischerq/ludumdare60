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
- **Our cabinet** *(decided, Quirin, 2026-10-19)*: walking into it zooms straight down into the cabinet layer (no
  coin: the INSERT COIN line instead, once per push). Talking to it shows a dialog (`HALL.text.pac`) with
  PLAY (1 COIN) / NOT NOW; PLAY does the same zoom.
- **Talking:** the four ghosts in caps stand at the machines, one line each, hinting at how they hunt in the maze.
  Every machine and decoration has a line (`HALL.text`, `HALL.cellText`). The **shop owner** sleeps on the tile
  above the counter's left end (`O` in the map, `arcade/owner-sleep-0/1`, a "z" rising); talking to him only gets
  snoring. The counter itself shows its sign.
- **The other cabinets** play famous games of the time (named only in the text, a tiny picture on each screen, no
  logos): red Space Invaders (1978), blue Asteroids (1979), green Donkey Kong (1981), violet Galaxian (1979, out of
  order). Each has one line with a fact about how it worked.
- **Playing the other cabinets** *(decided, Quirin, defaults accepted 2026-10-19)*: talking to one shows its line,
  then PLAY (1 COIN) / NOT NOW (no coin: the line plus "YOU NEED A COIN TO PLAY"). Walking into them does nothing.
  PLAY spends the coin and zooms into that machine; one level of its game runs full screen
  (`src/scenes/MiniGameScene.js`, `?scene=Mini&game=invaders|asteroids|kong`), rules in pure modules under
  `src/systems/minigames/`, numbers in `MINI` in `src/config.js`, art in `assets/games/` (characters 16x16 or
  smaller, like the originals). 3 lives each. Win or lose (or LAYER UP to quit), the hall zooms back out of the
  machine with Pac-Man in front of it and a line with the score. No reward beyond that, so they're no coin farm.
  - **Space Invaders:** 6x3 invaders march and speed up as they die; drag anywhere to move the cannon, it fires by
    itself (one shot at a time).
  - **Asteroids:** 4 big rocks split into medium and small; hold a finger down and the ship turns toward it,
    thrusts and fires; tap (or a second finger) fires once. The field wraps.
  - **Donkey Kong:** five flat girders with ladders, Kong rolls barrels that drop down girder by girder; drag
    left/right to walk, up/down to climb, tap (or a second finger) to jump; reach the top.
  - **Galaxian is broken:** PLAY takes the coin, the screen flashes, "THE MACHINE SWALLOWS YOUR COIN... NOTHING."
  - **A mini-Gurke hides in each** (the hall's `arcade/mini-gurke` tile): it flies across the top like the mystery
    ship once 6 invaders are left (shoot it); it's inside one of the big asteroids (shoot that rock open, then fly
    into it); it lies at the right end of the second girder from the top, where the barrels fall (walk to it).
    300 points and "MINI-GURKE!"; the hall's result line mentions it.
  - Each machine has its own background bed (`MUSIC.beds.invaders`, `asteroids`, `kong`, see [audio](audio.md)).
- **The Game Boy Color** *(decided, Quirin, defaults accepted 2026-10-19)*: a yellow Game Boy Color (in the game the **GURK BOY COLOR**, playing **GURKEMON RED**) lying on the rug, left of the
  sweater (`x`, `arcade/gameboy`) with Pokemon Red's red cartridge in it. Without batteries: you flip the switch,
  nothing, the batteries are dead. **Two AA batteries** lie below the potted plant (`z`, `arcade/batteries`): walk
  over them to pick them up (kept for the session). Then the Game Boy offers PUT THEM IN, and it plays **the start
  of Pokemon Red, our way** (`src/scenes/GameBoyScene.js`, `GB` in `src/config.js`, art in `assets/gameboy/`):
  - A big Game Boy fills the screen; its 160x144 screen at 4x shows PROF. DILL's lab. Play with the on-screen D-pad
    and A/B (tap the screen to go on or pick a choice; arrows, Space/Enter and X on a keyboard). Walking reuses the
    hall's grid rules (`src/systems/hall.js`).
  - Three **pickle jars** on the table (lid colored by kind; an empty jar once taken) hold three **Gurken**: FEUERGURK
    (fire, a red-hot chili pickle), SALZGURK (water, a pickle in a brine bubble), BLATTGURK (grass, leaves sprouting).
    A on a jar shows it and asks YES/NO. The one you pick is named **MINI-GURKE** (that's its name in the fight) and
    RED carries it from then on (`gameboy/red-carry-<dir>-<f>-<kind>`).
  - BLUE (the rival) then takes the one that beats yours and fights you right away: FIGHT (TACKLE or the type move)
    or RUN (not from a trainer battle), HP bars, super/not very effective, BLUE sometimes makes a sour face
    (rules in `src/systems/gameboy/battle.js`). Win or lose, PROF. DILL heals MINI-GURKE.
  - The door won't let you out before the fight; after it, walking out fades the screen to black and you're back in
    the hall: "THE BATTERIES ARE DEAD AGAIN." Once per session.
  - Own names, no Pokemon branding in the game itself (GURK BOY COLOR printed under the screen, RED, BLUE, PROF. DILL); its own beds `gbLab` and `gbBattle`.
- **Pickles:** the owner's bitten Gurke and a jar of cornichons on the counter next to him (`k`, `j`), a mini-Gurke
  in the top right corner where a plant stood (`u`). Details to talk to, nothing to collect.
- **The counter** is three tiles wide (Gurke, paper sign, jar) with the owner centered behind it. Only the paper sign
  (`s`) shows "BACK IN 5 MIN".
- **Manuals:** a two-tile table near the door. The stack (`n`) lists four booklets as choices in the text box (tap
  one, or arrows + Enter): three give a one-line blurb, Galaxian's was ripped out. Ours lies on its own next to it
  (`p`, a yellowed booklet with Pac-Man on the cover) and offers READ MORE, which opens the
  [service manual](manual.md) over the paused hall.
- **The snow globe** (`w`, bottom left corner): a pink base, a white unicorn with a rainbow mane and tail, lots of
  glitter. Talking to it: one line with the note taped to the bottom ("MY SISTER LOVED THIS ONE AS A KID."), then
  LOOK CLOSER / CLOSE. LOOK CLOSER shows it big over the dimmed hall: turn it, tap it to shake, tap outside to put
  it down. Turning stirs the water and the glitter flies, then slowly settles; a soft chime plays. The note is in the
  text, and also taped under the base of the 3D globe (tip it over to read it). *(Quirin, defaults accepted 2026-10-19)*
  - **3D close-up** *(decided, Quirin, defaults accepted 2026-10-19)*: LOOK CLOSER shows the globe in 3D (the FLAT
    picture and its switch are gone). The camera looks down on it from a little above (`HALL.globe3d.pitch`), so the
    settled globe shows the top of the meadow and the base's rim. The glass has a 52 px radius; the unicorn is about
    a fifth bigger than at first; the base is a flat stand (14 px tall, same width as before). Inside: the unicorn on
    a green meadow hill, a fluffy cloud fixed overhead (upper left, behind the horn). The note
    (`assets/arcade/globe-note.png`, written in the 3x5 pixel font) is taped under the stand. The globe is
    a model of colored spheres (`src/settings/globe-model.json`: unicorn shapes, the cloud, mane and tail strands, the
    meadow mound and the base) drawn by a small pixel renderer (`src/systems/globeRender.js`, 152x152 art px at the hall's
    4x): three light bands per part with a 2x2 dither at their edges, a 1 px outline wherever the depth jumps,
    glitter as single pixels, the glass rim and a shine that stays put while the globe turns. Colors come from
    `assets/arcade/globe-palette.png` (one row per part: outline, dark, mid, light; rows in `HALL.globe3d.palette`).
    No library, no tinting.
  - **Physics** (`src/systems/globe3d.js`, numbers in `HALL.globe3d`): a finger grabs the spot it lands on and pulls
    it along on a spring, so the globe turns any way (tip it, spin it, upside down) about its glass center; it never
    slides across the screen. The base is heavy: let go and it swings back upright, wobbling a little. The water
    lags behind the glass, and that lag stirs it; glitter flakes ride the water, sink slowly and flash as they
    tumble. Mane and tail are 12 thick bead chains that float in the water, trail behind turns and fall back into shape;
    they collide with the unicorn's body, so they never pass through it.
    A tap jolts the globe, spins it a little and churns the water, with the chime. Arrow keys tip it, Space shakes.
  - Not built: a lab bench for the globe (add one if the feel needs tuning), 3D in the hall tile.
- **More decorations** *(decided, Quirin, 2026-10-19)*: a stuffed **rabbit** with long floppy limbs, red/pink, on
  the floor under the claw machine (`h`, `arcade/rabbit`). An **Urmel figurine** on a small stand in the bottom right
  corner (`e`): each talk shows the next stage and its tile changes with it (`arcade/urmel-0..3`, texts in
  `HALL.urmel`): an iceberg with an egg inside (the first time), the egg under a blanket, a small Urmel drinking a milk
  bottle, the Urmel saying "OKOPUSPAPAT!", then the iceberg again; the stage is kept for the session. A **blue piece
  of paper** on the floor below the rug (`l`, `arcade/paper`, walkable): "BLAU!", with a 10% chance
  (`HALL.paperRareChance`) "GRÜN!". An **old sweater with Anna and Elsa** lying in the middle of the rug
  (`a`, `arcade/sweater`, drawn over the rug, solid).
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
- Build (done, other machines): one level each of Space Invaders, Asteroids and Donkey Kong for a coin, a broken
  Galaxian, a mini-Gurke hidden in each game, a background bed per machine, the Game Boy Color, walking into our
  cabinet plays it, a dialog when talking to it.
- Not now: more dialogue, collecting the mini-gurke, footstep sounds, a street outside; high scores, more levels,
  shields or sloped girders in the mini-games, a playtest bot or lab bench for them.
- Build (done, Game Boy): batteries under the plant, the Game Boy on the rug playing the lab scene (pick a mini-Gurke,
  the rival fight, out the door and off).
- Not now (Game Boy): leaving the lab (Pallet Town and beyond), levels and experience, naming, saving, replaying.

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
- 2026-10-19: The ghost visitors face down (toward the player) while standing at their machines, so their faces show. (Quirin)
- 2026-10-19: A snow globe in the bottom left corner (pink base, white unicorn with rainbow mane and tail, glitter), with a note taped to the bottom; LOOK CLOSER to turn and shake it and make the glitter fly. Defaults accepted (place, close-up overlay, tilt and shake instead of a full spin, note in the text, a chime). (Quirin)
- 2026-10-19: The snow globe close-up in 3D (sphere model drawn as pixel art, grab-anywhere rotation, heavy base that rights it, simulated glitter, mane and tail, tap to jolt), with a 3D/FLAT switch to the old picture. Defaults accepted (own renderer, 136 px, palette PNG + model JSON for Max, no bench). (Quirin)
- 2026-10-19: More decoration: a long-limbed red/pink plush rabbit, an Urmel figurine on a stand that cycles iceberg with egg, egg under a blanket, small Urmel with a milk bottle, Urmel saying OKOPUSPAPAT, a blue paper on the floor saying BLAU! (10% GRÜN!), an old Anna and Elsa sweater on the side. (Quirin) Claude picked the spots (rabbit under the claw machine, Urmel in the bottom right corner, paper below the rug, sweater on the back wall's right side).
- 2026-10-19: Snow globe close-up: glass and unicorn bigger (glass radius 36 to 44, unicorn scaled with it), base unchanged; the camera looks down from a little above (0.35 rad) so the settled globe is seen diagonally from above; the FLAT mode and its switch dropped. (Quirin)
- 2026-10-19: The sweater moves from the back wall (unreachable there) to the floor, lying in the middle of the rug. (Quirin)
- 2026-10-19: The other cabinets become playable, one level each for a coin (Space Invaders, Asteroids, Donkey Kong); Galaxian is broken and eats the coin; a Game Boy Color with Pokemon Red lies on the floor, batteries dead; walking into our cabinet zooms straight down, talking to it asks PLAY / NOT NOW; a mini-Gurke hidden in each game; each machine gets its own background track. Defaults accepted (full-screen scene per game, touch controls, no reward, no bot). (Quirin) Claude picked where the mini-Gurke hides in each game and wrote the dialog lines.
- 2026-10-19: Snow globe close-up: glass bigger again (radius 52, unicorn kept), flat stand (14 px instead of 28), thicker mane and tail that collide with the body, a green meadow instead of snow (also in the hall tile), a fluffy cloud overhead, and the note taped under the stand (read it by tipping the globe over). (Quirin) Claude picked the cloud's spot (upper left, behind the horn) and that the note only shows on the underside.
- 2026-10-19: The Game Boy moves onto the rug (left of the sweater); batteries to pick up under the potted plant; with them it plays the start of Pokemon Red with mini-Gurken: choose a starter in the professor's lab, the rival takes the counter and fights you, leaving the lab turns the Game Boy off. Defaults accepted (on-screen D-pad, grass/fire/water mini-Gurken BLATTGURK, FEUERGURK, SALZGURK, a short fight, once per session, own names RED/BLUE/PROF. DILL, own tunes). (Quirin)
- 2026-10-19: The Game Boy Color is yellow, in the hall and up close. (Quirin)
- 2026-10-19: Game Boy game: the kinds are Gurken, not mini-Gurken; the one you pick is named MINI-GURKE; the balls become pickle jars with colored lids; the device is the GURK BOY COLOR playing GURKEMON RED; RED visibly carries his Gurke after choosing. (Quirin) Claude picked the jars, the brand name, the nickname moment ("RED NAMES IT MINI-GURKE!") and an orange carried fire Gurke (red vanished on RED's shirt).
- 2026-10-20: The other machines get the maze game's arcade HUD: 1UP and HIGH SCORE across the top (best per machine
  in localStorage), spare lives as icons right of LAYER UP; Kong's HELP! moved left of the lady, out from under the
  sound button. (Quirin)
