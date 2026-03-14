import { World } from './world.js';
import { Worm } from './worm.js';
import { Foodie, Aggressor, Wanderer } from './personality.js';

const WORM_COLORS = [
  '#22c55e', '#3b82f6', '#ef4444', '#f97316',
  '#a855f7', '#06b6d4', '#eab308', '#ec4899',
  '#14b8a6', '#f43f5e',
];

const PERSONALITIES = [Foodie, Aggressor, Wanderer];

const canvas = document.getElementById('canvas');
const world = new World(canvas);

// Spawn 10 worms with varied personalities and starting positions
for (let i = 0; i < 10; i++) {
  const worm = new Worm({
    x: 100 + Math.random() * (canvas.width - 200),
    y: 100 + Math.random() * (canvas.height - 200),
    angle: Math.random() * Math.PI * 2,
    color: WORM_COLORS[i],
    personality: PERSONALITIES[i % PERSONALITIES.length],
  });

  world.addWorm(worm);

  // Register a factory so this worm respawns after death
  world.registerFactory(() => new Worm({
    x: 100 + Math.random() * (canvas.width - 200),
    y: 100 + Math.random() * (canvas.height - 200),
    angle: Math.random() * Math.PI * 2,
    color: WORM_COLORS[i],
    personality: PERSONALITIES[i % PERSONALITIES.length],
  }));
}

world.start();
