import { World } from './world.js';
import { initEditor } from './editor.js';
import { initEvolution } from './evolution.js';

const canvas = document.getElementById('canvas');
const world = new World(canvas);
world.start();
initEditor(world);

// Evolution mode: set world flag + rebuild panel when user picks that mode
document.getElementById('mode-evolution').addEventListener('click', () => {
  initEvolution(world);
});
