# Top-down mechanics survey (for the deep layers)

**Status:** research notes; the per-layer proposals were taken (built 2026-10-17, see [layer-deep](layer-deep.md))
**Parent:** [layer-deep](layer-deep.md) · [master](../master.md)

## Purpose
The seven [deep layers](layer-deep.md) all play alike today: walk a grid, grab dots, dodge something sweeping.
This page collects room mechanics from top-down games (mostly Zelda and Pokémon) that work with one-tile grid
steps and swipes, and matches them to what each layer shows of the machine. Sources: the games themselves plus a
web check (links at the bottom); names are the common fan names.

## Survey
| Mechanic | Where it's from | How it plays | Feels like (in our machine) |
|---|---|---|---|
| Spin tiles that rotate the room | Pokémon Emerald Mossdeep Gym | Stepping on certain tiles rotates obstacles and warp directions, which can swing a trainer's line of sight onto you | Flags or mode changes re-routing everything at once |
| Switch-linked conveyors | Zelda A Link Between Worlds | A crystal switch flips the direction of a conveyor belt | A read/write line flipping which way data flows |
| Beat-locked enemies | Crypt of the NecroDancer | Every enemy moves on the music's beat with its own fixed pattern (e.g. every second beat); learn the pattern | The vblank tick: the program only acts once a frame |
| Dark room, light source | Zelda dark rooms (lantern), Pokémon Flash caves | You only see what's near a light; the rest is a memory | The picture tube: phosphor only glows right after the beam |
| Ice floor / sliding | Pokémon ice caves (Ice Path), Zelda ice rooms | One swipe slides you until something stops you | A signal on a wire: once driven, it runs to the end of the line |
| Arrow / spinner tiles | Pokémon Rocket Hideout, Viridian Gym | Stepping on an arrow pushes you that way, chains of them form routes | Data being carried along the bus, the pixel pipeline |
| Conveyor belts | Zelda (Minish Cap, ALttP), many puzzle rooms | The floor moves you; walk against it or ride it | Cycles moving down the bus, tiles moving through the fetcher |
| Warp panels | Pokémon Silph Co, Saffron Gym | Step on a pad, appear on its partner pad | `JP` / `CALL` / `RET`: the program counter jumps |
| Crystal switch blocks | Zelda ALttP / Link's Awakening (orange/blue pegs) | Hit a switch: one color of blocks lowers, the other rises (in Link's Awakening one switch flips every block in the dungeon) | CPU flags: Z and C flip which branch is taken |
| Pressure plates | Zelda floor switches | Stand on it (or put a block on it) to hold a door open | Joystick microswitches pulling an input bit low |
| Push blocks (Sokoban) | Zelda block puzzles, Pokémon Strength boulders | Push a block one tile; it can't be pulled; get it onto a target | Moving a byte into an address; holding a switch down |
| Line of sight | Pokémon trainers ("!"), Zelda guards (Minish Cap castle) | Cross their line of sight and they come after you; out of sight is safe | Ghost target vectors: each ghost "looks" at its target tile |
| Beamos / turret | Zelda Beamos (rotating eye, fires when it sees you) | A turret sweeps its view; stay out of the beam's line | The program counter scanning down the listing |
| Blade traps | Zelda blade traps (rush when you line up) | Invulnerable; harmless until you share a row or column, then they dash; blocks and switches change how far they reach | The CPU's write head, rushing to the next address |
| Timed traps / rhythm | Zelda flame jets and spikes on a beat | Hazards fire on a fixed clock; learn the beat | The vblank interrupt: the machine's 60 Hz heartbeat |
| Cracked / collapsing floor | Zelda cracked floors | A tile breaks after you leave it; no going back | Phosphor burn-out, memory that gets overwritten |
| Carry and deliver | Zelda pots and trading items, Pokémon errands | Pick something up, carry it to a place (can't do other things meanwhile) | A color index carried from the tile fetcher to the palette and DAC |
| Keys and locked doors | Zelda small keys, Pokémon gym badges | A key opens one door; doors gate areas | Address decoding: an address selects (opens) one chip |
| Follower / escort | Pokémon walking partner, Zelda escort missions | Something trails behind you, follows your path | The light trail; a signal following the path you laid |

## Per-layer proposals · decided (Quirin took the defaults; bus as the spatial variant)
Each layer gets its own verb, so no two play alike; the sweeping beam stays only on the screen layer.

- **-1 Screen: dark room.** Keep the beam (the only sweep). The tube is dark; you only see what glowed recently,
  like a lantern room. Dots glow after the beam; eat them while lit; stay in the dark when the beam comes.
- **-2 Signals: carry and deliver.** No row sweep. The tile fetcher hands out a color index at a dot tile; you
  carry it (it trails behind you) to the palette chip and then the DAC at the edge of the screen. Sprites stay
  hazards. Sound commands pulse from the sound chip (a timed trap, not a sweep).
- **-3 Video RAM: blade trap + push blocks.** No read sweep. The CPU's write head is a blade trap: it waits at
  the edge of a row and dashes along it to the next address it writes. Dirty bytes are collected as now; maybe
  push a byte onto a target address.
- **-4 Bus: arrows and sliding.** Lanes are rails: on a lane carrying a 1 you're pushed along it (spinner tiles);
  0 lanes are ice you slide over. Address decoding opens the door to one chip at a time (keys and doors).
- **-5 CPU: warps and switch blocks.** Jump and call lines are warp pads (`CALL` warps to the routine, `RET`
  back). Z and C flags raise and lower two colors of blocks like crystal switches. The program counter is a
  Beamos moving down the listing.
- **-6 Logic: line of sight.** Ghosts look along their target vectors like Pokémon trainers: crossing a vector
  gets you spotted and that ghost chases you (instead of instant death). Out of sight is safe; frightened ghosts
  can't see.
- **-7 Input wires: pressure plates + push block.** Keep standing on pads to steer; add a block you can push onto
  a pad to hold a direction while you walk to another (e.g. hold START or a turn).

## Sources
- Blade traps: [Zelda Dungeon wiki](https://www.zeldadungeon.net/wiki/Blade_Trap); crystal switches, conveyors and
  beam statues in A Link Between Worlds: [HonestGamers guide](https://www.honestgamers.com/guides/the-legend-of-zelda-a-link-between-worlds/58/read/1040.html);
  toggling barriers: [TV Tropes](https://www.tvtropes.org/pmwiki/pmwiki.php/Main/TogglingSetpiecePuzzle).
- Pokémon: [ice tiles](https://bulbapedia.bulbagarden.net/wiki/Ice_tile), [warp panels](https://bulbapedia.bulbagarden.net/wiki/Warp_panel),
  [Mossdeep Gym spin tiles](https://m.bulbapedia.bulbagarden.net/wiki/Mossdeep_Gym), [Trick House](https://strategywiki.org/wiki/Pok%C3%A9mon_Ruby_and_Sapphire/Trick_House) (Bulbapedia, StrategyWiki).
- Push blocks, ice and pressure plates in small puzzle games: [Push Pull ice devlog](https://abso1ution.itch.io/push-pull/devlog/53774/ice-mechanics),
  [Ricoco On Ice](https://anaellemncs.myportfolio.com/ricoco-on-ice).
- Beat-locked enemies: [Crypt of the NecroDancer game club recap](https://seattleindies.org/crypt-of-the-necrodancer-game-club-recap/),
  [GameSpot review](https://gamespot.com/reviews/crypt-of-the-necrodancer-review/1900-6416119/).

## Decision log
- 2026-10-17: Survey written for the gameplay pass over the deep layers; proposals wait for Quirin's answers. (Claude)
- 2026-10-17: Proposals taken with their defaults; the bus is rebuilt as a spatial bus (chip rooms behind decoder
  doors) instead of spinner lanes. Each layer also gets 3-5 objectives to win and its own enemy. (Quirin)
