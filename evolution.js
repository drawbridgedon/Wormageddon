import { Worm, DEFAULT_TURN_SPEED } from './worm.js';
import { createCustomPersonality } from './personality.js';
import { generateName } from './names.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world.js';

// A small but varied palette so randomly spawned worms look distinct.
const EVO_COLORS = [
  '#4ade80','#ef4444','#a78bfa','#f97316','#22d3ee',
  '#fb7185','#fbbf24','#34d399','#60a5fa','#e879f9',
  '#f472b6','#38bdf8','#86efac','#fca5a5','#c4b5fd',
];

export function initEvolution(world) {
  world.evolutionMode = true;
  world._factories    = [];
  world._respawnQueue = [];

  // Rename panel handle and rebuild panel body for evolution UI
  const handle = document.getElementById('panel-handle');
  const body   = document.getElementById('panel-body');
  if (handle) handle.textContent = 'WORMS';
  if (!body) return;

  body.innerHTML = evoPanelHTML();

  // Re-bind speed slider (we just replaced the HTML so the old listeners are gone)
  const slider = document.getElementById('sim-speed');
  const label  = document.getElementById('sim-speed-val');
  if (slider) {
    const sync = () => {
      world.ticksPerFrame = +slider.value;
      if (label) label.textContent = slider.value + '×';
    };
    slider.addEventListener('input',  sync);
    slider.addEventListener('change', sync);
  }

  // Spawn button
  document.getElementById('evo-spawn-btn').addEventListener('click', () => {
    const worm = spawnRandom(world);
    world._followTarget = worm;
    refreshList(world);
  });

  // Live callbacks from the world
  world.onWormBorn = () => refreshList(world);
  world.onWormDied = () => refreshList(world);

  refreshList(world);
}

// ─── Spawn a random named worm ────────────────────────────────────────────────

function spawnRandom(world) {
  const name  = generateName();
  const color = EVO_COLORS[Math.floor(Math.random() * EVO_COLORS.length)];
  const speed = 1.2 + Math.random() * 1.8;

  // Random trait split that always sums to ~10
  const foodW   = Math.floor(Math.random() * 11);
  const aggroW  = Math.floor(Math.random() * (11 - foodW));
  const wanderW = 10 - foodW - aggroW;

  const traits = {
    speed, turnSpeed: DEFAULT_TURN_SPEED,
    foodWeight: foodW, aggroWeight: aggroW, wanderWeight: wanderW,
  };

  const worm = new Worm({
    x: 200 + Math.random() * (WORLD_WIDTH  - 400),
    y: 200 + Math.random() * (WORLD_HEIGHT - 400),
    angle: Math.random() * Math.PI * 2,
    color, name, traits, speed,
    personality: createCustomPersonality({ name, foodWeight: foodW, aggroWeight: aggroW, wanderWeight: wanderW }),
  });

  world.addWorm(worm);
  return worm;
}

// ─── Panel HTML skeleton ──────────────────────────────────────────────────────

function evoPanelHTML() {
  return `
    <h2>EVOLUTION</h2>

    <div class="section-label">SIMULATION</div>
    <div class="field-label">Speed <span id="sim-speed-val">1×</span></div>
    <input id="sim-speed" type="range" min="1" max="8" step="1" value="1">

    <div style="margin-top:14px">
      <button class="evo-spawn-btn" id="evo-spawn-btn">+ SPAWN WORM</button>
    </div>

    <div id="evo-count" class="evo-count">0 alive</div>

    <div class="section-label" style="margin-top:14px">LIVING WORMS</div>
    <div id="evo-worm-list"></div>
  `;
}

// ─── Worm list renderer ───────────────────────────────────────────────────────

function refreshList(world) {
  const list  = document.getElementById('evo-worm-list');
  const count = document.getElementById('evo-count');
  if (!list) return;

  if (count) count.textContent = `${world.worms.length} alive`;

  list.innerHTML = '';

  if (world.worms.length === 0) {
    list.innerHTML = '<div class="evo-empty">No worms alive.<br>Spawn some above.</div>';
    return;
  }

  // Sort: first generation ascending, then length descending
  const sorted = [...world.worms].sort((a, b) =>
    a.generation - b.generation || b.length - a.length
  );

  for (const worm of sorted) {
    list.appendChild(makeWormCard(worm, world));
  }
}

function makeWormCard(worm, world) {
  const el = document.createElement('div');
  el.className = 'evo-worm-card' + (worm.matingState === 'courting' ? ' evo-courting' : '');

  const parents = worm.parentNames && worm.parentNames.length
    ? `<div class="evo-parents">⊕ ${worm.parentNames.join(' × ')}</div>`
    : '';

  const t = worm.traits;
  const traits = `sp:${t.speed.toFixed(1)} · f:${Math.round(t.foodWeight)} a:${Math.round(t.aggroWeight)} w:${Math.round(t.wanderWeight)}`;

  el.innerHTML = `
    <div class="evo-card-top">
      <div class="card-dot" style="background:${worm.color}"></div>
      <span class="evo-name">${worm.name}</span>
      <span class="evo-gen">G${worm.generation}</span>
    </div>
    ${parents}
    <div class="evo-traits">${traits}</div>
  `;

  el.addEventListener('click', () => { world._followTarget = worm; });
  return el;
}
