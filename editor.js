import { Worm } from './worm.js';
import { createCustomPersonality } from './personality.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './world.js';

export function initEditor(world) {
  const panel   = document.getElementById('editor');
  const tab     = document.getElementById('editor-tab');
  const nameEl  = document.getElementById('ed-name');
  const colorEl = document.getElementById('ed-color');
  const speedEl = document.getElementById('ed-speed');
  const foodEl  = document.getElementById('ed-food');
  const aggroEl = document.getElementById('ed-aggro');
  const wanderEl= document.getElementById('ed-wander');
  const saveBtn = document.getElementById('ed-save');
  const listEl  = document.getElementById('ed-list');

  const speedVal = document.getElementById('ed-speed-val');
  const foodVal  = document.getElementById('ed-food-val');
  const aggroVal = document.getElementById('ed-aggro-val');
  const wanderVal= document.getElementById('ed-wander-val');

  // ── Toggle panel ───────────────────────────────────────────────────────────
  tab.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('collapsed');
    tab.classList.toggle('collapsed', collapsed);
  });

  // ── Live value labels ──────────────────────────────────────────────────────
  speedEl.addEventListener('input',  () => speedVal.textContent  = parseFloat(speedEl.value).toFixed(1));
  foodEl.addEventListener('input',   () => foodVal.textContent   = foodEl.value);
  aggroEl.addEventListener('input',  () => aggroVal.textContent  = aggroEl.value);
  wanderEl.addEventListener('input', () => wanderVal.textContent = wanderEl.value);

  // ── Save archetype ─────────────────────────────────────────────────────────
  const archetypes = [];

  saveBtn.addEventListener('click', () => {
    const archetype = {
      name:         nameEl.value.trim() || 'Custom',
      color:        colorEl.value,
      speed:        parseFloat(speedEl.value),
      foodWeight:   parseInt(foodEl.value),
      aggroWeight:  parseInt(aggroEl.value),
      wanderWeight: parseInt(wanderEl.value),
    };
    archetypes.push(archetype);
    renderList();
  });

  // ── Spawn a worm from an archetype ────────────────────────────────────────
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
    // Register factory so it respawns on death
    world.registerFactory(() => makeWorm(archetype));
  }

  // ── Render saved archetype cards ──────────────────────────────────────────
  function renderList() {
    // Clear everything after the title div
    const title = document.getElementById('ed-list-title');
    while (listEl.lastChild !== title) listEl.removeChild(listEl.lastChild);

    for (const archetype of archetypes) {
      const card = document.createElement('div');
      card.className = 'ed-card';

      const stats = `sp:${archetype.speed.toFixed(1)} `
        + `f:${archetype.foodWeight} `
        + `a:${archetype.aggroWeight} `
        + `w:${archetype.wanderWeight}`;

      card.innerHTML = `
        <div class="ed-swatch" style="background:${archetype.color}"></div>
        <div class="ed-card-info">
          <div class="ed-card-name">${archetype.name}</div>
          <div class="ed-card-stats">${stats}</div>
        </div>
        <button class="ed-spawn">Spawn</button>
      `;
      card.querySelector('.ed-spawn').addEventListener('click', () => spawnArchetype(archetype));
      listEl.appendChild(card);
    }
  }
}
