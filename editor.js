import { Worm } from './worm.js';
import { createCustomPersonality } from './personality.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world.js';

const PRESETS = [
  {
    name: 'Foodie',
    color: '#4ade80',
    description: 'Chases the nearest food. Avoids other worm bodies.',
    speed: 2,
    foodWeight: 10, aggroWeight: 0, wanderWeight: 1,
  },
  {
    name: 'Aggressor',
    color: '#ef4444',
    description: 'Hunts other worms. Falls back to food when alone.',
    speed: 2.5,
    foodWeight: 1, aggroWeight: 10, wanderWeight: 0,
  },
  {
    name: 'Wanderer',
    color: '#a78bfa',
    description: 'Drifts unpredictably. Gently pulled toward food.',
    speed: 1.5,
    foodWeight: 2, aggroWeight: 0, wanderWeight: 10,
  },
];

export function initEditor(world) {
  // ── Panel open/close ────────────────────────────────────────────────────────
  const panel  = document.getElementById('panel');
  const handle = document.getElementById('panel-handle');

  let open = false;
  handle.addEventListener('click', () => {
    open = !open;
    panel.classList.toggle('open', open);
  });

  // ── Custom builder expand/collapse ─────────────────────────────────────────
  const customToggle  = document.getElementById('custom-toggle');
  const customBuilder = document.getElementById('custom-builder');
  const chevron       = customToggle.querySelector('.chevron');

  customToggle.addEventListener('click', () => {
    const visible = customBuilder.classList.toggle('visible');
    chevron.classList.toggle('up', visible);
  });

  // ── Live slider labels ─────────────────────────────────────────────────────
  const bind = (id, valId, fmt = v => v) => {
    const input = document.getElementById(id);
    const label = document.getElementById(valId);
    input.addEventListener('input', () => { label.textContent = fmt(input.value); });
  };
  bind('ed-speed',  'ed-speed-val',  v => parseFloat(v).toFixed(1));
  bind('ed-food',   'ed-food-val');
  bind('ed-aggro',  'ed-aggro-val');
  bind('ed-wander', 'ed-wander-val');

  // ── Spawn helpers ──────────────────────────────────────────────────────────
  function makeWorm(archetype) {
    return new Worm({
      x: 200 + Math.random() * (WORLD_WIDTH - 400),
      y: 200 + Math.random() * (WORLD_HEIGHT - 400),
      angle: Math.random() * Math.PI * 2,
      color: archetype.color,
      speed: archetype.speed,
      personality: createCustomPersonality(archetype),
    });
  }

  function spawnArchetype(archetype) {
    world.addWorm(makeWorm(archetype));
    world.registerFactory(() => makeWorm(archetype));
    updateEmptyState();
    // Follow the new worm immediately
    world._followTarget = world.worms[world.worms.length - 1];
    // Open panel to confirm — already open since user just clicked inside it
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  const emptyState = document.getElementById('empty-state');
  function updateEmptyState() {
    emptyState.style.display = world.worms.length === 0 ? 'block' : 'none';
  }

  // ── Render preset cards ────────────────────────────────────────────────────
  const presetsList = document.getElementById('presets-list');
  for (const preset of PRESETS) {
    presetsList.appendChild(makeCreatureCard(preset, () => spawnArchetype(preset)));
  }

  // ── Save custom archetype ─────────────────────────────────────────────────
  const archetypes = [];
  const archetypesList  = document.getElementById('archetypes-list');
  const myArchetypesDiv = document.getElementById('my-archetypes');

  document.getElementById('ed-save').addEventListener('click', () => {
    const archetype = {
      name:         document.getElementById('ed-name').value.trim() || 'Custom',
      color:        document.getElementById('ed-color').value,
      speed:        parseFloat(document.getElementById('ed-speed').value),
      foodWeight:   parseInt(document.getElementById('ed-food').value),
      aggroWeight:  parseInt(document.getElementById('ed-aggro').value),
      wanderWeight: parseInt(document.getElementById('ed-wander').value),
    };
    const idx = archetypes.push(archetype) - 1;
    myArchetypesDiv.style.display = 'block';
    archetypesList.appendChild(makeSavedCard(archetype, idx));
  });

  // ── Card builders ──────────────────────────────────────────────────────────
  function traitBars(food, aggro, wander) {
    const max = 10;
    const row = (label, val, color) => `
      <span class="tlabel">${label}</span>
      <div class="ttrack"><div class="tfill" style="width:${val/max*100}%;background:${color}"></div></div>`;
    return `<div class="card-traits">
      ${row('Food',  food,   '#4ade80')}
      ${row('Aggro', aggro,  '#ef4444')}
      ${row('Wander',wander, '#a78bfa')}
    </div>`;
  }

  function makeCreatureCard(archetype, onSpawn) {
    const el = document.createElement('div');
    el.className = 'creature-card';
    el.innerHTML = `
      <div class="card-top">
        <div class="card-dot" style="background:${archetype.color}"></div>
        <span class="card-name">${archetype.name}</span>
      </div>
      ${archetype.description ? `<div class="card-desc">${archetype.description}</div>` : ''}
      ${traitBars(archetype.foodWeight, archetype.aggroWeight, archetype.wanderWeight)}
      <button class="spawn-btn">Spawn</button>
    `;
    el.querySelector('.spawn-btn').addEventListener('click', onSpawn);
    return el;
  }

  function makeSavedCard(archetype, idx) {
    const el = document.createElement('div');
    el.className = 'creature-card';
    const stats = `sp:${archetype.speed.toFixed(1)} f:${archetype.foodWeight} a:${archetype.aggroWeight} w:${archetype.wanderWeight}`;
    el.innerHTML = `
      <div class="card-top">
        <div class="card-dot" style="background:${archetype.color}"></div>
        <span class="card-name">${archetype.name}</span>
      </div>
      <div class="card-desc">${stats}</div>
      ${traitBars(archetype.foodWeight, archetype.aggroWeight, archetype.wanderWeight)}
      <div class="card-actions">
        <button class="spawn-btn">Spawn</button>
        <button class="delete-btn">✕</button>
      </div>
    `;
    el.querySelector('.spawn-btn').addEventListener('click', () => spawnArchetype(archetype));
    el.querySelector('.delete-btn').addEventListener('click', () => {
      archetypes.splice(idx, 1);
      el.remove();
      if (archetypesList.children.length === 0) myArchetypesDiv.style.display = 'none';
    });
    return el;
  }

  // Initial state
  updateEmptyState();
}
