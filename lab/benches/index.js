// Every bench in the lab. Add a line here and a file next to this one: lab/benches/<id>.js.
export const BENCHES = [
  {
    id: 'movement',
    title: 'Touch-follow movement',
    summary: 'How the player chases the finger. Compare the current numbers in config.js with a proposal on the same finger paths.',
    doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/movement.md',
  },
  {
    id: 'maze-controls',
    title: 'Maze swipe controls',
    summary: 'Swipe to steer through the real maze. Tune speed, swipe distance, the turn window and how long a swipe is kept.',
    doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/arcade-maze.md',
  },
  {
    id: 'animation',
    title: 'Animation speed',
    summary: 'Game frames per animation frame, per character. Tune, download the settings file and save it over src/settings/animation.json.',
    doc: 'https://github.com/fischerq/ludumdare60/blob/main/design/systems/art.md',
  },
];
