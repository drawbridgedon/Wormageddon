import { World } from './world.js';
import { initEditor } from './editor.js';
import { initEvolution } from './evolution.js';

const canvas     = document.getElementById('canvas');
const homeScreen = document.getElementById('home-screen');
const evoScreen  = document.getElementById('evolution-screen');

function dismissHome(then) {
  homeScreen.classList.add('fade-out');
  then(); // start the mode immediately; don't wait for the CSS fade
  setTimeout(() => { homeScreen.style.display = 'none'; }, 500);
}

document.getElementById('mode-sandbox').addEventListener('click', () => {
  dismissHome(() => {
    const world = new World(canvas);
    world.start();
    initEditor(world);
  });
});

document.getElementById('mode-evolution').addEventListener('click', () => {
  dismissHome(() => {
    evoScreen.classList.add('visible');
    initEvolution();
  });
});

document.getElementById('evo-back').addEventListener('click', () => {
  evoScreen.classList.remove('visible');
  homeScreen.style.display = '';
  // reflow trick so the fade-in transition plays from opacity 0
  homeScreen.getBoundingClientRect();
  homeScreen.classList.remove('fade-out');
});
