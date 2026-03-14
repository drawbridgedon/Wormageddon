import { World } from './world.js';
import { initEditor } from './editor.js';

const canvas = document.getElementById('canvas');
const world = new World(canvas);
world.start();
initEditor(world);
