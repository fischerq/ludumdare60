; Layers of Pac: the maze game, for our arcade board (Zilog Z80, 3.072 MHz).
; Assembled in the browser by src/systems/arcade/asm.js. Upper-case constants come from src/config.js
; (see program.js); the memory map is in memmap.js.
;
; Like the original, the work happens once per video frame: the vblank interrupt wakes the CPU from HALT,
; the main loop runs one frame of the game, then halts again until the next vblank.

BLINK_FRAMES    equ 12              ; power pellets blink on and off (about 200 ms)

; ---- work RAM ------------------------------------------------------------------------------------
FRAME           equ RAM+0x00        ; word: frames since reset
BLINK_TIMER     equ RAM+0x02
BLINK_ON        equ RAM+0x03        ; palette of the power pellets right now (0 hidden, 1 shown)

        org 0x0000
        jp reset

; Interrupt vector table (IM 2): the CPU reads the handler's address from I*256 + the byte on the bus.
        org 0x0010
VECTORS:
        dw vblank

reset:  di
        ld sp, STACK_TOP
        ld a, high(VECTORS)         ; interrupt mode 2: the vector table is at I*256 + the byte on the bus
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

frame:  ld hl, (FRAME)
        inc hl
        ld (FRAME), hl
        ld (WATCHDOG), a            ; tell the watchdog we're alive
        call blink
        ret

; ---- setup --------------------------------------------------------------------------------------
clear_ram:
        ld hl, RAM
        ld de, RAM+1
        ld bc, STACK_TOP-RAM-0x40   ; leave the top of RAM to the stack
        ld (hl), 0
        ldir
        ld a, BLINK_FRAMES
        ld (BLINK_TIMER), a
        ld a, 1
        ld (BLINK_ON), a
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
        ret

; Every BLINK_FRAMES frames, flip the palette of every power pellet cell between 0 (black) and 1.
blink:  ld hl, BLINK_TIMER
        dec (hl)
        ret nz
        ld (hl), BLINK_FRAMES
        ld a, (BLINK_ON)
        xor 1
        ld (BLINK_ON), a
        ld c, a
        ld hl, VRAM
        ld de, CRAM
.row:   ld b, MAZE_W
.cell:  ld a, (hl)
        cp CELL_POWER
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
