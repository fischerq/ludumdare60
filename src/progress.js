// Which layers the player has opened this session. In memory only: a reload starts again with just the maze.
// - deeper:  won the maze once -> LAYER DOWN on the maze level
// - cabinet: lost the maze once -> LAYER UP on the maze level (insert a coin in the cabinet)
// - hall:    lost on the cabinet once -> LAYER UP on the cabinet (go find coins in the arcade hall)
// - depth:   deep layers cleared so far -> LAYER DOWN in the deep layers
export const progress = { deeper: false, cabinet: false, hall: false, depth: 0 };
