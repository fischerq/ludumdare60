; Layers of Pac: the maze game, for our arcade board (Zilog Z80, 3.072 MHz).
; Assembled in the browser by src/systems/arcade/asm.js. Upper-case constants come from src/config.js
; (see program.js); the memory map is in memmap.js. The rules follow src/systems/maze.js, stepped once per
; video frame, with positions in world pixels (16 per tile, a tile center at a multiple of 16).
;
; Like the original, the work happens once per video frame: the vblank interrupt wakes the CPU from HALT,
; the main loop runs one frame of the game, then halts again until the next vblank.
;
; Directions: 0 up, 1 left, 2 down, 3 right (the original's tie-break order), 0xFF none. Opposite = dir XOR 2.

; ---- game phases -------------------------------------------------------------------------------
PH_ATTRACT      equ 0               ; after reset: waiting for START
PH_READY        equ 1
PH_PLAY         equ 2
PH_DYING        equ 3
PH_CLEARING     equ 4               ; the maze flashes after the last dot
PH_CLEARED      equ 5               ; round won: waiting for START
PH_OVER         equ 6               ; game over: waiting for START

; ghost states
GS_HOUSE        equ 0
GS_EXIT         equ 1
GS_ACTIVE       equ 2
GS_EYES         equ 3
GS_ENTER        equ 4

NONE            equ 0xff

; ---- work RAM ------------------------------------------------------------------------------------
FRAME           equ RAM+0x00        ; word: frames since reset
BLINK_T         equ RAM+0x02        ; power pellet blink timer
BLINK_ON        equ RAM+0x03        ; palette of the power pellets right now (0 hidden, 1 shown)
PHASE           equ RAM+0x04
PHASE_T         equ RAM+0x05        ; word: frames left in this phase
SCORE           equ RAM+0x07        ; word
LIVES_LEFT      equ RAM+0x09
PELLETS         equ RAM+0x0a        ; word: dots and power pellets left
FREEZE          equ RAM+0x0c        ; frames the game stands still after eating a ghost
FRIGHT          equ RAM+0x0d        ; word: frames of fright left
COMBO           equ RAM+0x0f        ; ghosts eaten during this fright
MODE_I          equ RAM+0x10        ; scatter/chase index: even = scatter, odd = chase
MODE_T          equ RAM+0x11        ; word: frames left in this mode (0 = forever)
RNG             equ RAM+0x13
EATEN           equ RAM+0x14        ; ghost showing its points during the freeze (NONE if none)
EATEN_PTS       equ RAM+0x15        ; which points sprite (0..3)
DIE_T           equ RAM+0x16        ; death animation timer
DIE_F           equ RAM+0x17        ; death animation frame
FLASH_T         equ RAM+0x18        ; fright flash / maze flash tick timer
FLASH_ON        equ RAM+0x19
CLEAR_T         equ RAM+0x1a
CLEAR_ON        equ RAM+0x1b
ADV_LEFT        equ RAM+0x1c        ; pixels left in advance
ADV_CB          equ RAM+0x1d        ; word: routine advance calls at tile centers
TGT_X           equ RAM+0x1f        ; ghost target tile (signed)
TGT_Y           equ RAM+0x20
GX              equ RAM+0x21        ; tile the ghost is choosing from
GY              equ RAM+0x22
BEST_D          equ RAM+0x23        ; word
BEST_DIR        equ RAM+0x25
NOPTS           equ RAM+0x26        ; number of open directions
OPTS            equ RAM+0x27        ; 4 bytes: the open directions
MOVE_TX         equ RAM+0x2b        ; word: move_straight target x px
MOVE_TY         equ RAM+0x2d        ; word
NO_REVERSE      equ RAM+0x2f        ; 1 while choosing without the reverse direction
WALL_PAL        equ RAM+0x30        ; palette the walls have now
COIN_LAST       equ RAM+0x31        ; the coin switch last frame
LEVEL           equ RAM+0x32        ; round counter, one byte: 0 = level 1, 255 = level 256
REPAIRS         equ RAM+0x33        ; level 256 strips to repair, a bit each (set by the host: the hard-mode wins)
REPAIRED        equ RAM+0x34        ; strips repaired this round

; Actors: Pac-Man, then the four ghosts (blinky, pinky, inky, clyde), 32 bytes each.
ACTORS          equ RAM+0x40
ACTOR_SIZE      equ 32
PAC             equ ACTORS
GHOST0          equ ACTORS+ACTOR_SIZE
A_X             equ 0               ; word: px, 0..303, wraps through the tunnel
A_Y             equ 2               ; word: px
A_DIR           equ 4
A_FRAC          equ 5               ; sub-pixel part of the speed
A_STATE         equ 6               ; ghosts: GS_*
A_FRIGHT        equ 7               ; ghosts: 1 while frightened
A_RELEASE       equ 8               ; word: ghosts: frames until they leave the house
A_CORNX         equ 10              ; ghosts: scatter corner tile (signed)
A_CORNY         equ 11
A_NEXT          equ 12              ; Pac-Man: the wanted direction
A_AGE           equ 13              ; Pac-Man: frames since it was wanted
A_ANIM_T        equ 14              ; animation timer
A_ANIM_F        equ 15              ; animation frame (Pac-Man: index into PAC_CYCLE, ghosts: skirt)
A_ID            equ 16              ; ghosts: 0 blinky, 1 pinky, 2 inky, 3 clyde
A_ANIM_RATE     equ 17              ; ghosts: frames per skirt frame

; =================================================================================================
        org 0x0000
        jp reset

; Interrupt vector table (IM 2): the CPU reads the handler's address from I*256 + the byte on the bus.
        org 0x0010
VECTORS:
        dw vblank

; The level shelf's fruits, one entry per level: cell code, palette. From level FRUIT_LEVELS on it's keys.
; draw_fruit walks this table with a pointer; whatever follows it in ROM (the code below) is what it reads
; if it ever runs past the end.
FRUIT_TABLE:
        db CELL_CHERRY, 1,  CELL_STRAWBERRY, 1,  CELL_ORANGE, 1,  CELL_ORANGE, 1
        db CELL_APPLE, 1,   CELL_APPLE, 1,       CELL_MELON, 1,   CELL_MELON, 1
        db CELL_SHIP, 1,    CELL_SHIP, 1,        CELL_BELL, 1,    CELL_BELL, 1
        db CELL_KEY, 1,     CELL_KEY, 1,         CELL_KEY, 1,     CELL_KEY, 1
        db CELL_KEY, 1,     CELL_KEY, 1,         CELL_KEY, 1
FRUIT_LEVELS    equ ($-FRUIT_TABLE)/2

reset:  di
        ld sp, STACK_TOP
        ld a, high(VECTORS)
        ld i, a
        im 2
        ld a, low(VECTORS)
        out (0), a                  ; the board puts this byte on the bus when it interrupts
        call clear_ram
        call draw_maze
        ld a, 1
        ld (IRQ_ENABLE), a          ; let the video hardware interrupt us at every vblank
        ei
main:   halt                        ; sleep until the next vblank
        call frame
        jr main

; The interrupt only wakes the CPU; the frame's work runs in the main loop.
vblank: ei
        reti

; ---- one frame ----------------------------------------------------------------------------------
frame:  ld hl, (FRAME)
        inc hl
        ld (FRAME), hl
        ld (WATCHDOG), a            ; tell the watchdog we're alive
        call blink
        call tick_flash
        call read_input
        call repair
        ld a, (IN0_PORT)            ; a coin dropping in starts a fresh game, whatever is going on
        cpl
        and IN_COIN
        ld hl, COIN_LAST
        ld b, (hl)
        ld (hl), a
        cp b
        jr z, .phase
        or a
        call nz, new_game
.phase: ld a, (PHASE)
        cp PH_READY
        jp z, ph_ready
        cp PH_PLAY
        jp z, ph_play
        cp PH_DYING
        jp z, ph_dying
        cp PH_CLEARING
        jp z, ph_clearing
        ; attract, cleared, over: wait for START (after a clear it starts the next round)
        ld a, (IN1_PORT)
        and IN_START
        jp nz, sprites
        ld a, (PHASE)
        cp PH_CLEARED
        jr nz, .new
        call next_round
        jp sprites
.new:   call new_game
        jp sprites

ph_ready:
        call phase_tick
        jp nz, sprites
        ld a, PH_PLAY
        ld (PHASE), a
        ld a, SND_GO
        ld (SOUND_CMD), a
        jp sprites

ph_play:
        ld a, (FREEZE)              ; standing still after eating a ghost
        or a
        jr z, .run
        dec a
        ld (FREEZE), a
        jp nz, sprites
        ld a, NONE
        ld (EATEN), a
        jp sprites
.run:   call update_modes
        ld ix, PAC
        call move_pac
        ld a, (PHASE)
        cp PH_PLAY
        jp nz, sprites
        call check_hits
        ld a, (PHASE)
        cp PH_PLAY
        jp nz, sprites
        ld a, (FREEZE)
        or a
        jp nz, sprites
        ld ix, GHOST0
        ld b, 4
.ghost: push bc
        call move_ghost
        call ghost_anim
        ld de, ACTOR_SIZE
        add ix, de
        pop bc
        djnz .ghost
        call check_hits
        jp sprites

ph_dying:
        ld hl, DIE_T                ; death animation: one frame every ANIM_DEATH frames
        inc (hl)
        ld a, (hl)
        cp ANIM_DEATH
        jr c, .wait
        ld (hl), 0
        ld hl, DIE_F
        inc (hl)
.wait:  call phase_tick
        jp nz, sprites
        ld a, (DSW_PORT)            ; demo play (the bot) doesn't cost lives
        and DSW_DEMO
        jr nz, .again
        ld hl, LIVES_LEFT
        dec (hl)
        jr nz, .again
        ld a, PH_OVER
        ld (PHASE), a
        ld a, SND_OVER
        ld (SOUND_CMD), a
        jp sprites
.again: call reset_actors
        call to_ready
        ld a, SND_READY
        ld (SOUND_CMD), a
        jp sprites

ph_clearing:
        ld a, (CLEAR_ON)            ; the walls flash white
        inc a
        call wall_palette
        call phase_tick
        jp nz, sprites
        ld a, 1
        call wall_palette
        ld a, PH_CLEARED
        ld (PHASE), a
        ld a, SND_CLEARED
        ld (SOUND_CMD), a
        jp sprites

; Counts PHASE_T down. Z set when it reaches 0.
phase_tick:
        ld hl, (PHASE_T)
        dec hl
        ld (PHASE_T), hl
        ld a, h
        or l
        ret

to_ready:
        ld a, PH_READY
        ld (PHASE), a
        ld hl, READY_FRAMES
        ld (PHASE_T), hl
        ret

; ---- setup --------------------------------------------------------------------------------------
clear_ram:
        ld hl, RAM
        ld de, RAM+1
        ld bc, STACK_TOP-RAM-0x40   ; leave the top of RAM to the stack
        ld (hl), 0
        ldir
        ld a, ANIM_BLINK
        ld (BLINK_T), a
        ld a, 1
        ld (BLINK_ON), a
        ld a, 0x5a
        ld (RNG), a
        ld a, NONE
        ld (EATEN), a
        ret

new_game:
        ld hl, 0
        ld (SCORE), hl
        ld a, LIVES
        ld (LIVES_LEFT), a
        xor a                       ; level 1
        ld (LEVEL), a
        call start_round
        ld a, SND_START
        ld (SOUND_CMD), a
        ret

; The maze was cleared: the next level, same score and lives.
next_round:
        ld hl, LEVEL
        inc (hl)                    ; one byte: after level 256 (255) comes level 1 (0) again
        call start_round
        ld a, SND_READY
        ld (SOUND_CMD), a
        ret

; A fresh maze full of dots, the level shelf, everyone at the start, READY.
start_round:
        ld hl, PELLET_COUNT
        ld (PELLETS), hl
        xor a
        ld (MODE_I), a
        ld hl, (MODE_TIMES)
        ld (MODE_T), hl
        call draw_maze
        call draw_fruit
        xor a                       ; a fresh round: the overflow just drew the garbage again
        ld (REPAIRED), a
        call repair
        call reset_actors
        jp to_ready

; Level 256 only: puts back the clean maze (cells from MAZE_ROM, palette 1) on every strip of the garbage half
; whose bit is set in REPAIRS and not yet in REPAIRED (REPAIR_TABLE, top to bottom). Runs at the start of a
; round and every frame, so a repair shows at once. A dot under the garbage was never eaten (garbage blocks
; Pac-Man) and is still counted in PELLETS, so with every strip back the maze can be cleared.
repair:
        ld a, (LEVEL)
        inc a
        ret nz                      ; not level 256 (counter 255)
        ld a, (REPAIRED)
        cpl
        ld hl, REPAIRS
        and (hl)
        ret z                       ; nothing new
        ld c, a
        ld hl, REPAIRED
        or (hl)
        ld (hl), a
        ld hl, REPAIR_TABLE
        ld b, REPAIR_COUNT
.strip: srl c
        jr nc, .skip
        push bc
        push hl
        call repair_strip
        pop hl
        pop bc
.skip:  ld de, 5
        add hl, de
        djnz .strip
        ret

; One strip, HL at its REPAIR_TABLE entry.
repair_strip:
        ld e, (hl)                  ; DE: source in MAZE_ROM
        inc hl
        ld d, (hl)
        inc hl
        ld c, (hl)                  ; BC: video RAM
        inc hl
        ld b, (hl)
        inc hl
        ld a, (hl)                  ; rows
        ex de, hl                   ; HL: source
        ld d, b
        ld e, c                     ; DE: video RAM
.row:   push af
        push de
        ld bc, SHELF_COLS
        ldir                        ; the row's cells
        ex (sp), hl                 ; HL: the row in video RAM, source on the stack
        push hl
        ld a, h                     ; palette 1 in color RAM, same place 0x400 higher
        add a, high(CRAM-VRAM)
        ld h, a
        ld b, SHELF_COLS
.pal:   ld (hl), 1
        inc hl
        djnz .pal
        pop hl
        ld de, VRAM_STRIDE          ; next row in video RAM
        add hl, de
        ex de, hl
        pop hl                      ; next row in MAZE_ROM
        ld bc, MAZE_W-SHELF_COLS
        add hl, bc
        pop af
        dec a
        jr nz, .row
        ret

; The level shelf under the right half of the maze: one fruit per level so far, right to left, at most the
; last 7. A full shelf row would carry on in the row above (with 7 fruits it never fills up).
; The count is the 8-bit level number, counter + 1, like the original's: on level 256 it wraps to 0, which
; is less than 8 and goes to DJNZ as 0, so the loop runs 256 times, reading on past the end of FRUIT_TABLE
; and writing row after row up the right half of the maze.
SHELF_END       equ VRAM + MAZE_H*VRAM_STRIDE + MAZE_W - 1   ; rightmost shelf cell, the row under the maze
draw_fruit:
        ld hl, SHELF_END-SHELF_COLS+1   ; clear the shelf
        ld b, SHELF_COLS
.clear: ld (hl), CELL_EMPTY
        inc hl
        djnz .clear
        ld a, (LEVEL)
        inc a                       ; the level number, in 8 bits
        cp 8
        jr c, .few                  ; levels 1..7: a fruit for every level so far
        cp FRUIT_LEVELS+1
        jr c, .last7
        ld a, FRUIT_LEVELS          ; past the table: its last 7 entries
.last7: sub 7                       ; the 7 levels ending at this one
        add a, a
        ld e, a
        ld d, 0
        ld hl, FRUIT_TABLE
        add hl, de
        ex de, hl
        ld b, 7
        jr .draw
.few:   ld b, a
        ld de, FRUIT_TABLE
.draw:  ld hl, SHELF_END
        ld c, SHELF_COLS
.fruit: ld a, (de)                  ; cell code into video RAM
        ld (hl), a
        inc de
        push hl
        ld a, h                     ; palette into color RAM, same place 0x400 higher
        add a, high(CRAM-VRAM)
        ld h, a
        ld a, (de)
        ld (hl), a
        pop hl
        inc de
        dec hl                      ; next fruit to the left
        dec c
        jr nz, .next
        push de                     ; shelf row full: carry on at the right end of the row above
        ld de, SHELF_COLS-VRAM_STRIDE
        add hl, de
        pop de
        ld c, SHELF_COLS
.next:  djnz .fruit
        ret

; Pac-Man and the ghosts back to their starts (after a death the modes keep running).
reset_actors:
        ld hl, ACTORS               ; clear all actor records
        ld de, ACTORS+1
        ld bc, ACTOR_SIZE*5-1
        ld (hl), 0
        ldir
        ld ix, PAC
        ld hl, PAC_START_X
        ld (ix+A_X), l
        ld (ix+A_X+1), h
        ld hl, PAC_START_Y
        ld (ix+A_Y), l
        ld (ix+A_Y+1), h
        ld (ix+A_DIR), 1            ; facing left
        ld (ix+A_NEXT), NONE
        ld ix, GHOST0
        ld hl, GHOST_INIT
        ld b, 0
.ghost: ld e, (hl)                  ; start x
        inc hl
        ld d, (hl)
        inc hl
        ld (ix+A_X), e
        ld (ix+A_X+1), d
        ld e, (hl)                  ; start y
        inc hl
        ld d, (hl)
        inc hl
        ld (ix+A_Y), e
        ld (ix+A_Y+1), d
        ld a, (hl)                  ; release time
        ld (ix+A_RELEASE), a
        inc hl
        ld a, (hl)
        ld (ix+A_RELEASE+1), a
        inc hl
        ld a, (hl)
        ld (ix+A_CORNX), a
        inc hl
        ld a, (hl)
        ld (ix+A_CORNY), a
        inc hl
        ld a, (hl)
        ld (ix+A_ANIM_RATE), a
        inc hl
        ld (ix+A_ID), b
        ld (ix+A_DIR), 1
        ; starts outside the house (on the exit tile) with no delay: active at once
        ld (ix+A_STATE), GS_HOUSE
        ld a, (ix+A_RELEASE)
        or (ix+A_RELEASE+1)
        jr nz, .next
        ld a, e
        cp low(HOUSE_EXIT_Y*TILE)
        jr nz, .next
        ld a, d
        cp high(HOUSE_EXIT_Y*TILE)
        jr nz, .next
        ld (ix+A_STATE), GS_ACTIVE
.next:  ld de, ACTOR_SIZE
        add ix, de
        inc b
        ld a, b
        cp 4
        jr nz, .ghost
        xor a
        ld (FRIGHT), a
        ld (FRIGHT+1), a
        ld (FREEZE), a
        ld (DIE_T), a
        ld (DIE_F), a
        ld a, NONE
        ld (EATEN), a
        ret

; Copy the maze from ROM into video RAM (19 cells per row, 32 bytes apart) and give every cell palette 1.
draw_maze:
        ld hl, MAZE_ROM
        ld de, VRAM
        ld a, MAZE_H
.row:   push af
        push de
        ld bc, MAZE_W
        ldir
        pop de
        ex de, hl
        ld bc, VRAM_STRIDE
        add hl, bc
        ex de, hl
        pop af
        dec a
        jr nz, .row
        ld hl, CRAM
        ld de, CRAM+1
        ld bc, 0x3ff
        ld (hl), 1
        ldir
        ld a, 1
        ld (WALL_PAL), a
        ret

; ---- input --------------------------------------------------------------------------------------
; The joystick is active low. While a direction is held, Pac-Man wants it (and the wish stays fresh).
read_input:
        ld a, (IN0_PORT)
        cpl
        and IN_UP|IN_LEFT|IN_DOWN|IN_RIGHT
        ret z
        ld b, 0                     ; the lowest bit wins: up, left, down, right
.find:  rrca
        jr c, .got
        inc b
        jr .find
.got:   ld ix, PAC
        ld (ix+A_NEXT), b
        ld (ix+A_AGE), 0
        ret

; ---- timers for blinking and flashing ----------------------------------------------------------
; Every ANIM_BLINK frames, flip the palette of the power pellets between 0 (black) and 1.
blink:  ld hl, BLINK_T
        dec (hl)
        ret nz
        ld (hl), ANIM_BLINK
        ld a, (BLINK_ON)
        xor 1
        ld (BLINK_ON), a
        ld c, a
        ld hl, POWER_CELLS
        ld b, POWER_COUNT
.cell:  ld e, (hl)
        inc hl
        ld d, (hl)
        inc hl
        ld a, c
        ld (de), a
        djnz .cell
        ret

tick_flash:
        ld hl, FLASH_T
        inc (hl)
        ld a, (hl)
        cp ANIM_FLASH
        jr c, .clear
        ld (hl), 0
        ld a, (FLASH_ON)
        xor 1
        ld (FLASH_ON), a
.clear: ld hl, CLEAR_T
        inc (hl)
        ld a, (hl)
        cp ANIM_CLEAR
        ret c
        ld (hl), 0
        ld a, (CLEAR_ON)
        xor 1
        ld (CLEAR_ON), a
        ret

; Sets palette A on every wall cell (1 normal, 2 flashing white), if they don't have it already.
wall_palette:
        ld hl, WALL_PAL
        cp (hl)
        ret z
        ld (hl), a
        ld c, a
        ld hl, VRAM
        ld de, CRAM
.row:   ld b, MAZE_W
.cell:  ld a, (hl)
        cp CELL_WALL
        jr nz, .next
        ld a, c
        ld (de), a
.next:  inc hl
        inc de
        djnz .cell
        push bc
        ld bc, VRAM_STRIDE-MAZE_W
        add hl, bc
        ex de, hl
        add hl, bc
        ex de, hl
        pop bc
        ld a, h                     ; until HL passes the last row
        cp high(VRAM) + (MAZE_H*VRAM_STRIDE)/256
        jr c, .row
        ld a, l
        cp low(MAZE_H*VRAM_STRIDE)
        jr c, .row
        ret

; ---- maze helpers -------------------------------------------------------------------------------
; Tile of actor IX (the nearest tile center): B = x, C = y.
tile_of:
        ld l, (ix+A_X)
        ld h, (ix+A_X+1)
        ld de, 8
        add hl, de
        ld de, MAZE_PX_W
        or a
        sbc hl, de
        jr nc, .x
        add hl, de
.x:     call shr4
        ld b, a
        ld l, (ix+A_Y)
        ld h, (ix+A_Y+1)
        ld de, 8
        add hl, de
        call shr4
        ld c, a
        ret

shr4:   srl h
        rr l
        srl h
        rr l
        srl h
        rr l
        srl h
        rr l
        ld a, l
        ret

; Address of cell (B, C) in VRAM in HL (x wraps through the tunnel). Carry set if C is off the maze.
cell_addr:
        ld a, c
        cp MAZE_H
        ccf
        ret c                       ; off the top (negative) or the bottom
        ld a, b
        bit 7, a
        jr z, .pos
        add a, MAZE_W
        jr .ok
.pos:   cp MAZE_W
        jr c, .ok
        sub MAZE_W
.ok:    ld l, c
        ld h, 0
        add hl, hl
        add hl, hl
        add hl, hl
        add hl, hl
        add hl, hl
        add a, l
        ld l, a
        ld a, h
        add a, high(VRAM)
        ld h, a
        or a
        ret

; Cell code at (B, C) in A; walls outside the maze.
cell_at:
        push hl
        call cell_addr
        ld a, CELL_WALL
        jr c, .out
        ld a, (hl)
.out:   pop hl
        ret

; Carry set if nobody may enter cell (B, C): walls, the ghost door and the inside of the house.
can_enter:
        call cell_at
        cp CELL_DOOR
        jr z, .no
        cp CELL_HOUSE
        jr z, .no
        cp CELL_WALL                ; walls, and every code above them (fruit, garbage)
        jr nc, .no
        or a
        ret
.no:    scf
        ret

; Moves tile (B, C) one step in direction A. Keeps A, HL; uses DE.
step_tile:
        push hl
        push af
        ld e, a
        ld d, 0
        ld hl, DIR_DX
        add hl, de
        ld a, b
        add a, (hl)
        ld b, a
        ld hl, DIR_DY
        add hl, de
        ld a, c
        add a, (hl)
        ld c, a
        pop af
        pop hl
        ret

DIR_DX: db 0, -1, 0, 1
DIR_DY: db -1, 0, 1, 0

; Z set if actor IX sits exactly on a tile center.
at_center:
        ld a, (ix+A_X)
        or (ix+A_Y)
        and 15
        ret

; Moves actor IX one pixel in its direction; x wraps through the tunnel.
move_px:
        ld a, (ix+A_DIR)
        ld e, a
        ld d, 0
        ld hl, DIR_DX
        add hl, de
        ld a, (hl)
        or a
        jr z, .y
        ld l, (ix+A_X)
        ld h, (ix+A_X+1)
        bit 7, a
        jr z, .right
        ld a, h
        or l
        jr nz, .left
        ld hl, MAZE_PX_W
.left:  dec hl
        jr .setx
.right: inc hl
        ld a, l
        cp low(MAZE_PX_W)
        jr nz, .setx
        ld a, h
        cp high(MAZE_PX_W)
        jr nz, .setx
        ld hl, 0
.setx:  ld (ix+A_X), l
        ld (ix+A_X+1), h
        ret
.y:     ld hl, DIR_DY
        add hl, de
        ld a, (hl)
        ld l, (ix+A_Y)
        ld h, (ix+A_Y+1)
        bit 7, a
        jr z, .down
        dec hl
        jr .sety
.down:  inc hl
.sety:  ld (ix+A_Y), l
        ld (ix+A_Y+1), h
        ret

; Adds speed DE (8.8 px per frame) to actor IX's sub-pixel counter: A = whole pixels to move this frame.
accum:  ld a, (ix+A_FRAC)
        add a, e
        ld (ix+A_FRAC), a
        ld a, d
        adc a, 0
        ret

; Moves actor IX by A pixels along the maze. At every tile center it calls the routine at HL (which may
; change the direction), and it stops early when the way ahead is blocked. ADV_LEFT = pixels not moved.
advance:
        ld (ADV_LEFT), a
        or a
        ret z
        ld (ADV_CB), hl
.loop:  call at_center
        jr nz, .move
        ld hl, (ADV_CB)
        call call_hl
        ld a, (ix+A_DIR)
        cp NONE
        ret z
        call tile_of
        ld a, (ix+A_DIR)
        call step_tile
        call can_enter
        ret c
.move:  call move_px
        ld hl, ADV_LEFT
        dec (hl)
        jr nz, .loop
        ret

call_hl:
        jp (hl)

; ---- Pac-Man ------------------------------------------------------------------------------------
move_pac:
        ld a, (ix+A_AGE)            ; how long the wish has waited
        inc a
        jr z, .aged
        ld (ix+A_AGE), a
.aged:  ld a, (ix+A_NEXT)
        cp NONE
        jr z, .go
        cp (ix+A_DIR)
        jr z, .go
        ld a, (ix+A_AGE)            ; a wish that didn't fit in time is dropped
        cp BUFFER_FRAMES+1
        jr c, .fresh
        ld (ix+A_NEXT), NONE
        jr .go
.fresh: ld a, (ix+A_DIR)            ; reversing works at once
        xor 2
        cp (ix+A_NEXT)
        jr nz, .turn
        ld (ix+A_DIR), a
        jr .go
.turn:  call corner_turn
.go:    ld de, SPD_PAC
        call accum
        ld b, a
        push bc
        ld hl, pac_center
        call advance
        pop bc
        ld a, (ADV_LEFT)            ; animate only while moving
        cp b
        jr z, .eat
        inc (ix+A_ANIM_T)
        ld a, (ix+A_ANIM_T)
        cp ANIM_PAC
        jr c, .eat
        ld (ix+A_ANIM_T), 0
        ld a, (ix+A_ANIM_F)
        inc a
        cp 12
        jr c, .frame
        xor a
.frame: ld (ix+A_ANIM_F), a
.eat:   call tile_of
        jp eat

; At a tile center: take the wanted direction if it's open.
pac_center:
        ld a, (ix+A_NEXT)
        cp NONE
        ret z
        call tile_of
        ld a, (ix+A_NEXT)
        call step_tile
        call can_enter
        ret c
        ld a, (ix+A_NEXT)
        ld (ix+A_DIR), a
        ret

; Forgiving turns: a sideways wish up to TURN_WINDOW_PX before or after a junction snaps Pac-Man onto it.
corner_turn:
        ld a, (ix+A_DIR)
        and 1                       ; 0 = moving up/down (along y), 1 = left/right (along x)
        ld a, (ix+A_Y)
        jr z, .along
        ld a, (ix+A_X)
.along: and 15                      ; pixels past the last center
        ret z
        cp 9
        jr c, .near                 ; 1..8: the center behind is nearest
        neg
        add a, 16                   ; 9..15: the one ahead, 16-off pixels away
.near:  cp TURN_WINDOW_PX+1
        ret nc
        call tile_of                ; the nearest tile
        push bc
        call can_enter
        pop bc
        ret c
        push bc
        ld a, (ix+A_NEXT)
        call step_tile
        call can_enter
        pop bc
        ret c
        ld a, (ix+A_DIR)            ; snap onto the center
        and 1
        jr z, .snapy
        ld l, b
        ld h, 0
        call shl4
        ld (ix+A_X), l
        ld (ix+A_X+1), h
        jr .turn
.snapy: ld l, c
        ld h, 0
        call shl4
        ld (ix+A_Y), l
        ld (ix+A_Y+1), h
.turn:  ld a, (ix+A_NEXT)
        ld (ix+A_DIR), a
        ret

shl4:   add hl, hl
        add hl, hl
        add hl, hl
        add hl, hl
        ret

; Eats whatever is on cell (B, C).
eat:    call cell_addr
        ret c
        ld a, (hl)
        cp CELL_DOT
        jr z, .dot
        cp CELL_POWER
        ret nz
        ld (hl), CELL_EMPTY
        ld de, POWER_POINTS
        call add_score
        ld hl, FRIGHT_FRAMES
        ld (FRIGHT), hl
        xor a
        ld (COMBO), a
        ld ix, GHOST0               ; every ghost that isn't just eyes gets scared and turns around
        ld b, 4
.scare: ld a, (ix+A_STATE)
        cp GS_EYES
        jr z, .skip
        cp GS_ENTER
        jr z, .skip
        ld (ix+A_FRIGHT), 1
        cp GS_ACTIVE
        jr nz, .skip
        ld a, (ix+A_DIR)
        xor 2
        ld (ix+A_DIR), a
.skip:  ld de, ACTOR_SIZE
        add ix, de
        djnz .scare
        ld ix, PAC
        ld a, SND_POWER
        jr .eaten
.dot:   ld (hl), CELL_EMPTY
        ld de, DOT_POINTS
        call add_score
        ld a, SND_DOT
.eaten: ld (SOUND_CMD), a
        ld hl, (PELLETS)
        dec hl
        ld (PELLETS), hl
        ld a, h
        or l
        ret nz
        ld a, PH_CLEARING           ; that was the last one
        ld (PHASE), a
        ld hl, CLEAR_FRAMES
        ld (PHASE_T), hl
        ld a, SND_CLEAR
        ld (SOUND_CMD), a
        ret

add_score:
        ld hl, (SCORE)
        add hl, de
        ld (SCORE), hl
        ret

; ---- ghosts -------------------------------------------------------------------------------------
move_ghost:
        ld a, (ix+A_STATE)
        cp GS_HOUSE
        jr nz, .exit
        ld l, (ix+A_RELEASE)        ; waiting in the house
        ld h, (ix+A_RELEASE+1)
        ld a, h
        or l
        jr z, .out
        dec hl
        ld (ix+A_RELEASE), l
        ld (ix+A_RELEASE+1), h
        ld a, h
        or l
        ret nz
.out:   ld (ix+A_STATE), GS_EXIT
        ret
.exit:  cp GS_EXIT
        jr nz, .enter
        ld hl, HOUSE_EXIT_X*TILE
        ld (MOVE_TX), hl
        ld hl, HOUSE_EXIT_Y*TILE
        ld (MOVE_TY), hl
        ld de, SPD_HOUSE
        call accum
        call move_straight
        ret nz
        ld (ix+A_STATE), GS_ACTIVE
        ld (ix+A_DIR), 1
        ret
.enter: cp GS_ENTER
        jr nz, .maze
        ld hl, HOUSE_IN_X*TILE
        ld (MOVE_TX), hl
        ld hl, HOUSE_IN_Y*TILE
        ld (MOVE_TY), hl
        ld de, SPD_ENTER
        call accum
        call move_straight
        ret nz
        ld (ix+A_STATE), GS_EXIT
        ld (ix+A_FRIGHT), 0
        ret
.maze:  ld de, SPD_EYES
        cp GS_EYES
        jr z, .speed
        ld de, SPD_FRIGHT
        ld a, (ix+A_FRIGHT)
        or a
        jr nz, .tunnel
        ld de, SPD_GHOST
.tunnel:
        push de
        call tile_of                ; slow in the tunnel
        call cell_at
        pop de
        cp CELL_TUNNEL
        jr nz, .speed
        ld de, SPD_TUNNEL
.speed: call accum
        ld hl, ghost_center
        jp advance

; Moves actor IX straight toward (MOVE_TX, MOVE_TY) px by A pixels, ignoring walls (the ghost house only):
; first sideways, then up or down. Z set when it has arrived.
move_straight:
        ld b, a
.loop:  ld l, (ix+A_X)
        ld h, (ix+A_X+1)
        ld de, (MOVE_TX)
        or a
        sbc hl, de
        jr z, .yaxis
        ld a, 1                     ; left
        jr nc, .stepx
        ld a, 3                     ; right
.stepx: ld (ix+A_DIR), a
        jr .step
.yaxis: ld l, (ix+A_Y)
        ld h, (ix+A_Y+1)
        ld de, (MOVE_TY)
        or a
        sbc hl, de
        ret z                       ; arrived
        ld a, 0                     ; up
        jr nc, .stepy
        ld a, 2                     ; down
.stepy: ld (ix+A_DIR), a
.step:  ld a, b
        or a
        jr z, .check
        push bc
        call move_px
        pop bc
        dec b
        jr .loop
.check: ld l, (ix+A_X)              ; out of pixels: Z only if exactly there
        ld h, (ix+A_X+1)
        ld de, (MOVE_TX)
        or a
        sbc hl, de
        ret nz
        ld l, (ix+A_Y)
        ld h, (ix+A_Y+1)
        ld de, (MOVE_TY)
        or a
        sbc hl, de
        ret

; At a tile center: eyes that reach the house door go in, everyone else picks the next direction.
ghost_center:
        ld a, (ix+A_STATE)
        cp GS_EYES
        jr nz, .choose
        call tile_of
        ld a, b
        cp HOUSE_EXIT_X
        jr nz, .choose
        ld a, c
        cp HOUSE_EXIT_Y
        jr nz, .choose
        ld (ix+A_STATE), GS_ENTER
        ld (ix+A_DIR), NONE
        ret
.choose:
        call choose_dir
        ld (ix+A_DIR), a
        ret

; The next direction at a tile center: never reverse, head for the target tile (the open neighbour nearest
; to it, ties going up, left, down, right); frightened ghosts pick at random.
choose_dir:
        call tile_of
        ld a, b
        ld (GX), a
        ld a, c
        ld (GY), a
        ld a, 1
        ld (NO_REVERSE), a
        call options
        ld a, (NOPTS)
        or a
        jr nz, .some
        xor a                       ; a dead end: reversing is allowed
        ld (NO_REVERSE), a
        call options
        ld a, (NOPTS)
        or a
        ld a, NONE
        ret z
.some:  ld a, (ix+A_FRIGHT)
        or a
        jr z, .chase
        ld a, (ix+A_STATE)
        cp GS_ACTIVE
        jr nz, .chase
        call random                 ; frightened: a random open direction
        ld hl, NOPTS
.mod:   cp (hl)
        jr c, .pick
        sub (hl)
        jr .mod
.pick:  ld e, a
        ld d, 0
        ld hl, OPTS
        add hl, de
        ld a, (hl)
        ret
.chase: call ghost_target
        ld hl, 0xffff
        ld (BEST_D), hl
        ld a, (NOPTS)
        ld b, a
        ld hl, OPTS
.each:  push bc
        push hl
        ld a, (hl)
        push af
        ld a, (GX)
        ld b, a
        ld a, (GY)
        ld c, a
        pop af
        push af
        call step_tile
        call distance               ; HL = squared distance from (B, C) to the target
        pop af
        ld de, (BEST_D)
        or a
        sbc hl, de
        jr nc, .worse
        add hl, de
        ld (BEST_D), hl
        ld (BEST_DIR), a
.worse: pop hl
        inc hl
        pop bc
        djnz .each
        ld a, (BEST_DIR)
        ret

; Collects the open directions from (GX, GY) into OPTS / NOPTS, in the order up, left, down, right.
options:
        xor a
        ld (NOPTS), a
        ld d, 0                     ; D = direction being tried (step_tile uses E)
.try:   ld a, (NO_REVERSE)
        or a
        jr z, .open
        ld a, (ix+A_DIR)
        xor 2
        cp d
        jr z, .next
.open:  ld a, (GX)
        ld b, a
        ld a, (GY)
        ld c, a
        ld a, d
        push de
        call step_tile
        call can_enter
        pop de
        jr c, .next
        ld hl, NOPTS
        ld a, (hl)
        inc (hl)
        ld hl, OPTS
        add a, l
        ld l, a
        ld a, h
        adc a, 0
        ld h, a
        ld (hl), d
.next:  inc d
        ld a, d
        cp 4
        jr nz, .try
        ret

; HL = (B - TGT_X)^2 + (C - TGT_Y)^2
distance:
        ld a, (TGT_X)
        ld e, a
        ld a, b
        sub e
        call square
        push hl
        ld a, (TGT_Y)
        ld e, a
        ld a, c
        sub e
        call square
        pop de
        add hl, de
        ret

; HL = A * A for a signed A (-127..127). Uses B? no: keeps BC.
square: bit 7, a
        jr z, .pos
        neg
.pos:   push bc
        ld e, a
        ld d, 0
        ld hl, 0
        ld b, 8
.bit:   add hl, hl
        rla
        jr nc, .skip
        add hl, de
.skip:  djnz .bit
        pop bc
        ret

; 8-bit Galois LFSR: A = the next random byte.
random: ld a, (RNG)
        srl a
        jr nc, .done
        xor 0xb8
.done:  ld (RNG), a
        ret

; The tile ghost IX is heading for, in TGT_X / TGT_Y.
ghost_target:
        ld a, (ix+A_STATE)
        cp GS_EYES
        jr nz, .mode
        ld a, HOUSE_EXIT_X
        ld (TGT_X), a
        ld a, HOUSE_EXIT_Y
        ld (TGT_Y), a
        ret
.mode:  ld a, (MODE_I)              ; scatter: the ghost's own corner
        and 1
        jr z, .corner
        push ix                     ; chase: where is Pac-Man?
        ld ix, PAC
        call tile_of
        ld a, (ix+A_DIR)
        pop ix
        ld e, a                     ; E = Pac-Man's direction (kept in D below)
        ld d, a
        ld a, (ix+A_ID)
        or a
        jr z, .set                  ; blinky: Pac-Man's tile
        cp 1
        jr nz, .inky
        ld a, d                     ; pinky: PINKY_AHEAD tiles in front of Pac-Man
        ld h, PINKY_AHEAD
        call ahead
        jr .set
.inky:  cp 2
        jr nz, .clyde
        ld a, d                     ; inky: 2 * (INKY_AHEAD in front of Pac-Man) - blinky
        ld h, INKY_AHEAD
        call ahead
        push bc
        push ix
        ld ix, GHOST0
        call tile_of
        pop ix
        ld d, b
        ld e, c
        pop bc
        ld a, b
        add a, a
        sub d
        ld b, a
        ld a, c
        add a, a
        sub e
        ld c, a
        jr .set
.clyde: ld a, b                     ; clyde: Pac-Man, unless closer than CLYDE_SHY tiles
        ld (TGT_X), a
        ld a, c
        ld (TGT_Y), a
        push ix
        call tile_of                ; clyde's own tile... (IX is clyde)
        pop ix
        call distance
        ld de, CLYDE_SHY2+1
        or a
        sbc hl, de
        ret nc                      ; far away: chase Pac-Man (target already set)
.corner:
        ld a, (ix+A_CORNX)
        ld (TGT_X), a
        ld a, (ix+A_CORNY)
        ld (TGT_Y), a
        ret
.set:   ld a, b
        ld (TGT_X), a
        ld a, c
        ld (TGT_Y), a
        ret

; Moves tile (B, C) H steps in direction A.
ahead:  call step_tile
        dec h
        jr nz, ahead
        ret

; Skirt animation of ghost IX.
ghost_anim:
        inc (ix+A_ANIM_T)
        ld a, (ix+A_ANIM_T)
        cp (ix+A_ANIM_RATE)
        ret c
        ld (ix+A_ANIM_T), 0
        ld a, (ix+A_ANIM_F)
        xor 1
        ld (ix+A_ANIM_F), a
        ret

; ---- scatter / chase / fright -------------------------------------------------------------------
update_modes:
        ld hl, (FRIGHT)
        ld a, h
        or l
        jr z, .modes
        dec hl                      ; the scatter/chase clock stops while ghosts are frightened
        ld (FRIGHT), hl
        ld a, h
        or l
        ret nz
        ld ix, GHOST0
        ld b, 4
.calm:  ld (ix+A_FRIGHT), 0
        ld de, ACTOR_SIZE
        add ix, de
        djnz .calm
        ld a, SND_FRIGHT_END
        ld (SOUND_CMD), a
        ret
.modes: ld hl, (MODE_T)
        ld a, h
        or l
        ret z                       ; the last mode lasts forever
        dec hl
        ld (MODE_T), hl
        ld a, h
        or l
        ret nz
        ld hl, MODE_I               ; next mode, and every ghost out in the maze turns around
        inc (hl)
        ld a, (hl)
        add a, a
        ld e, a
        ld d, 0
        ld hl, MODE_TIMES
        add hl, de
        ld e, (hl)
        inc hl
        ld d, (hl)
        ld (MODE_T), de
        ld ix, GHOST0
        ld b, 4
.turn:  ld a, (ix+A_STATE)
        cp GS_ACTIVE
        jr nz, .next
        ld a, (ix+A_DIR)
        xor 2
        ld (ix+A_DIR), a
.next:  ld de, ACTOR_SIZE
        add ix, de
        djnz .turn
        ret

; ---- collisions ---------------------------------------------------------------------------------
; Pac-Man touches a ghost (active or leaving the house) when |dx| + |dy| <= HIT_PX (dx across the tunnel).
check_hits:
        ld ix, GHOST0
        ld b, 0
.each:  ld a, (ix+A_STATE)
        cp GS_ACTIVE
        jr z, .test
        cp GS_EXIT
        jr nz, .next
.test:  push bc
        call pac_gap
        pop bc
        ld de, HIT_PX+1
        or a
        sbc hl, de
        jr c, .hit
.next:  ld de, ACTOR_SIZE
        add ix, de
        inc b
        ld a, b
        cp 4
        jr nz, .each
        ret
.hit:   ld a, (ix+A_FRIGHT)
        or a
        jr z, .death
        ld a, b                     ; eat the ghost
        ld (EATEN), a
        ld a, (COMBO)
        cp 4
        jr c, .pts
        ld a, 3
.pts:   ld (EATEN_PTS), a
        add a, a
        ld e, a
        ld d, 0
        ld hl, GHOST_POINTS
        add hl, de
        ld e, (hl)
        inc hl
        ld d, (hl)
        call add_score
        ld hl, COMBO
        inc (hl)
        ld (ix+A_FRIGHT), 0
        ld (ix+A_STATE), GS_EYES
        call tile_of                ; eyes navigate from the nearest tile center
        ld l, b
        ld h, 0
        call shl4
        ld (ix+A_X), l
        ld (ix+A_X+1), h
        ld l, c
        ld h, 0
        call shl4
        ld (ix+A_Y), l
        ld (ix+A_Y+1), h
        ld a, EAT_PAUSE_FRAMES
        ld (FREEZE), a
        ld a, SND_GHOST
        ld (SOUND_CMD), a
        ret
.death: ld a, PH_DYING
        ld (PHASE), a
        ld hl, DYING_FRAMES
        ld (PHASE_T), hl
        xor a
        ld (DIE_T), a
        ld (DIE_F), a
        ld a, SND_DEATH
        ld (SOUND_CMD), a
        ret

; HL = |dx| + |dy| between Pac-Man and ghost IX in px, dx the short way around through the tunnel.
pac_gap:
        ld hl, (PAC+A_X)
        ld e, (ix+A_X)
        ld d, (ix+A_X+1)
        or a
        sbc hl, de
        call abs_hl
        push hl
        ld de, MAZE_PX_W/2+1
        or a
        sbc hl, de
        pop hl
        jr c, .dy                   ; the short way is direct
        ex de, hl                   ; the short way is around: 304 - |dx|
        ld hl, MAZE_PX_W
        or a
        sbc hl, de
.dy:    push hl
        ld hl, (PAC+A_Y)
        ld e, (ix+A_Y)
        ld d, (ix+A_Y+1)
        or a
        sbc hl, de
        call abs_hl
        pop de
        add hl, de
        ret

abs_hl: bit 7, h
        ret z
        ld a, h
        cpl
        ld h, a
        ld a, l
        cpl
        ld l, a
        inc hl
        ret

; ---- sprites ------------------------------------------------------------------------------------
; Writes the 8 hardware sprites: 0 Pac-Man, 1-4 the ghosts, 5-7 unused.
sprites:
        ld ix, PAC
        call pac_sprite
        ld b, 0
        call put_sprite
        ld ix, GHOST0
        ld b, 1
.ghost: push bc
        call ghost_sprite
        pop bc
        push bc
        call put_sprite
        pop bc
        ld de, ACTOR_SIZE
        add ix, de
        inc b
        ld a, b
        cp 5
        jr nz, .ghost
        ret

; Sprite code for Pac-Man in A, palette in C.
pac_sprite:
        ld c, 1
        ld a, (PHASE)
        cp PH_ATTRACT
        jr z, .none
        cp PH_OVER
        jr z, .none
        cp PH_DYING
        jr nz, .alive
        ld a, (DIE_F)
        cp 10
        jr nc, .none
        add a, SPR_PAC_DIE
        ret
.alive: ld e, (ix+A_ANIM_F)
        cp PH_READY
        jr nz, .frame
        ld e, 0
.frame: ld d, 0
        ld hl, PAC_CYCLE
        add hl, de
        ld a, (ix+A_DIR)
        cp NONE
        jr nz, .dir
        ld a, 1
.dir:   add a, a
        add a, a
        add a, a
        add a, (hl)
        add a, SPR_PAC
        ret
.none:  xor a
        ret

PAC_CYCLE: db 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1

; Sprite code for ghost IX in A (B = its sprite slot), palette in C.
ghost_sprite:
        ld c, 1
        ld a, (PHASE)
        cp PH_READY
        jr z, .shown
        cp PH_PLAY
        jr nz, .none
.shown: ld a, (EATEN)               ; showing its points
        inc a
        cp b
        jr nz, .eyes
        ld a, (FREEZE)
        or a
        jr z, .eyes
        ld c, 7
        ld a, (EATEN_PTS)
        add a, SPR_POINTS
        ret
.eyes:  ld a, (ix+A_DIR)
        cp NONE
        jr nz, .dir
        ld a, 1
.dir:   ld e, a                     ; E = direction
        ld a, (ix+A_STATE)
        cp GS_EYES
        jr z, .eyeson
        cp GS_ENTER
        jr nz, .body
.eyeson:
        ld a, e
        add a, SPR_EYES
        ret
.body:  ld a, (ix+A_FRIGHT)
        or a
        jr z, .normal
        ld hl, (FRIGHT)             ; flashing near the end of the fright
        ld a, h
        or a
        jr nz, .blue
        ld a, l
        cp FLASH_FRAMES
        jr nc, .blue
        ld a, (FLASH_ON)
        or a
        jr z, .blue
        ld a, (ix+A_ANIM_F)
        add a, SPR_FLASH
        ret
.blue:  ld a, (ix+A_ANIM_F)
        add a, SPR_FRIGHT
        ret
.normal:
        ld a, (ix+A_ID)             ; ghost*8 + dir*2 + skirt
        add a, a
        add a, a
        add a, e
        add a, a
        add a, (ix+A_ANIM_F)
        add a, SPR_GHOST
        ret
.none:  xor a
        ret

; Sprite B gets code A, palette C, and actor IX's position (its center in world px; x wraps).
put_sprite:
        push af
        ld a, b                     ; attributes: SPRITE_ATTR + 2*B
        add a, a
        ld e, a
        ld d, 0
        ld hl, SPRITE_ATTR
        add hl, de
        pop af
        ld (hl), a
        inc hl
        ld (hl), c
        ld a, b                     ; position registers: SPRITE_POS + 4*B
        add a, a
        add a, a
        ld e, a
        ld hl, SPRITE_POS
        add hl, de
        push hl
        ld l, (ix+A_X)
        ld h, (ix+A_X+1)
        ld de, 8
        add hl, de
        ld de, MAZE_PX_W            ; past the right edge: show it coming in on the left
        or a
        sbc hl, de
        jr nc, .x
        add hl, de
.x:     ex de, hl
        pop hl
        ld (hl), e
        inc hl
        ld (hl), d
        inc hl
        push hl
        ld l, (ix+A_Y)
        ld h, (ix+A_Y+1)
        ld de, 8
        add hl, de
        ex de, hl
        pop hl
        ld (hl), e
        inc hl
        ld (hl), d
        ret
