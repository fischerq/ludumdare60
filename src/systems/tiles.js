// Which tileset tile goes where in the maze. Pure logic, no Phaser.
//
// Walls use a "dual grid": a wall piece sits where four cells meet and is picked by which of those four
// cells are walls (bits TL 1, TR 2, BR 4, BL 8), so 16 pieces cover every straight, outer and inner corner.
// Floor and ghost door tiles sit on the normal cell grid.

// A tileset is a folder of tiles, one file each: texture key '<tileset>/<tile>', file assets/<tileset>/<tile>.png.
// The maze environment uses wall-1 .. wall-15 (no wall, no piece), door and floor.
export const MAZE_TILES = ['door', 'floor', ...Array.from({ length: 15 }, (_, i) => `wall-${i + 1}`)];
export const tileKey = (tileset, tile) => `${tileset}/${tile}`;

// layout: rows of '#' wall, '-' ghost door, 'T' tunnel, anything else floor.
// Returns cells [{x, y, tile}] on the cell grid and walls [{x, y, tile}] on the corner grid (tile names
// from MAZE_TILES): piece (x, y) is centered on the top-left corner of cell (x, y), so x runs 0..w and y 0..h.
export function mazeTiles(layout) {
  const h = layout.length, w = layout[0].length;
  const isWall = (x, y) => {
    if (y < 0 || y >= h) return true;
    // Outside the left/right edge is wall, except where a tunnel leaves the maze.
    if (x < 0) return layout[y][0] !== 'T';
    if (x >= w) return layout[y][w - 1] !== 'T';
    return layout[y][x] === '#';
  };

  const cells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (layout[y][x] !== '#') cells.push({ x, y, tile: layout[y][x] === '-' ? 'door' : 'floor' });
    }
  }

  const walls = [];
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      const tile = isWall(x - 1, y - 1) | isWall(x, y - 1) << 1 | isWall(x, y) << 2 | isWall(x - 1, y) << 3;
      if (tile) walls.push({ x, y, tile: `wall-${tile}` });
    }
  }
  return { w, h, cells, walls };
}
