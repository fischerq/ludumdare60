# Audio (background sound per layer)

**Status:** decided, first slice built 2026-10-18
**Parent:** [master](../master.md)
**Lab bench:** none yet (a jukebox bench to tune the beds is the next step)
**Code:** `src/sound.js` (synth, beds, mute), numbers and patterns in `MUSIC` in `src/config.js`

## Purpose
Every layer sounds different and fits its tech, so the player hears where they are in the machine.

## Rules · decided (Quirin, 2026-10-18)
- **All synthesized, the way the tech of the time did it.** No audio files. The machine's own layers use
  wavetable voices like Pac-Man's Namco sound chip (32 steps of 4 bits, `MUSIC.waves` as hex). The radio in the
  hall plays 80s FM synth-pop (two-operator FM like a DX7, plus a noise/sine drum kit), heard through a small
  speaker (band-pass filter).
- **One bed per layer** (`MUSIC.beds`), started by each scene on create; switching layers crossfades
  (`MUSIC.fade`). The start screen has its own tune (below).
  - **Hall:** the arcade is not busy: just the radio loop and now and then a bleep from one of the machines.
  - **Cabinet:** the machine's mains hum and fan, the same radio muffled behind you.
  - **Board lobby (2026-10-19):** inside the running machine, calm enough to read text boxes over: the mains hum
    with a slowly breathing transformer buzz, a soft clock tick once a second, a low drone and the game's bleeps
    muffled through the board. Its own bed (`lobby`), no longer the cabinet's.
  - **Maze:** like the original, no music: the siren, rising in 5 stages as the dots go; silent while ghosts are
    frightened (the fright wobble plays instead), before the start and after game over.
  - **Deep layers (CRT to input wires):** the machine's sound chip playing Tron-style synth, each layer its own
    key, tempo and texture from its tech: CRT flyback whine and buzz, the video board's pixel-clock ticks, the
    VRAM refresh pulse, data chatter on the bus, a fast clocked arpeggio in the CPU, a step sequencer in the game
    logic, hum and switch clicks in the input wires.
  - **Start screen (2026-10-19):** an upbeat original tune on the wavetable chip (pulse lead, triangle bass, a soft
    organ arpeggio, C major, about 15 s loop; not the Pac-Man melody). Where the browser blocks sound until a tap
    (phones), the first tap starts the music and the second starts the game; with sound already allowed or muted,
    one tap starts the game. *(proposed)*
- **Mute:** one ♪ / × button bottom left over every scene (an HTML button); the choice is kept in localStorage.

## Slice scope
- Build: the synth engine, the beds (one per layer, the start screen and the lobby), the siren tied to the dots, crossfades, the mute button.
- Not now: the jukebox lab bench, beds reacting to gameplay beyond the siren, sound for the mini-gurke.

## Open questions
- Do the deep beds feel distinct enough, or should some get their own melody? *Default: tune after playtest.*

## Decision log
- 2026-10-18: Background sound for every layer, synthesized like the era's hardware (Namco-style wavetables for
  the machine, FM synth-pop radio in the hall). Hall is quiet: radio plus the odd machine bleep. Maze keeps the
  original's siren only. Other defaults (crossfade, mute button) accepted.
- 2026-10-19: The start screen gets background music, an original wavetable tune (replaces "the menu is silent"). Defaults accepted; Claude made the first tap start the music where phones block sound, since the menu's first tap otherwise starts the game at once. (Quirin)
- 2026-10-19: lobby gets its own bed (Quirin)
- 2026-10-19: Each of the hall's other machines gets its own bed: a four-note bass march (Space Invaders), two alternating thumps over a vector hum (Asteroids), a bouncy original tune over a walking bass (Donkey Kong). (Quirin)
- 2026-10-19: The Game Boy gets two beds of its own: an original bouncy lab tune (gbLab) and a faster battle tune (gbBattle). (Quirin)
