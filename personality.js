// Each personality has a steer(worm, world) function returning a turn delta.
// Return value: -1 (hard left) to +1 (hard right). 0 = go straight.

// ─── Helpers ────────────────────────────────────────────────────────────────

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function steerToward(currentAngle, targetAngle) {
  let diff = targetAngle - currentAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff / Math.PI;
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function avoidWalls(worm, world) {
  const { x, y } = worm.head;
  const margin = 300;
  let turn = 0;
  if (x < margin)                     turn += steerToward(worm.angle, 0)            * (1 - x / margin);
  if (x > world.worldWidth - margin)  turn += steerToward(worm.angle, Math.PI)      * (1 - (world.worldWidth - x) / margin);
  if (y < margin)                     turn += steerToward(worm.angle, Math.PI / 2)  * (1 - y / margin);
  if (y > world.worldHeight - margin) turn += steerToward(worm.angle, -Math.PI / 2) * (1 - (world.worldHeight - y) / margin);
  return turn;
}

// Extracted so createCustomPersonality can reuse them
function _foodieSteer(worm, world) {
  const head = worm.head;
  let nearestFood = null, bestDist = Infinity;
  for (const food of world.food) {
    const d = distSq(head, food);
    if (d < bestDist) { bestDist = d; nearestFood = food; }
  }
  if (!nearestFood) return 0;
  let turn = steerToward(worm.angle, angleTo(head, nearestFood));
  for (const other of world.worms) {
    if (other === worm) continue;
    for (const seg of other.segments) {
      const d = distSq(head, seg);
      if (d < 60 * 60) turn -= steerToward(worm.angle, angleTo(head, seg)) * 0.4;
    }
  }
  return turn;
}

function _aggressorSteer(worm, world) {
  const head = worm.head;
  let target = null, bestScore = -Infinity;
  for (const other of world.worms) {
    if (other === worm) continue;
    const d = Math.sqrt(distSq(head, other.head));
    if (d > 400) continue;
    const score = other.length - d * 0.1;
    if (score > bestScore) { bestScore = score; target = other; }
  }
  if (!target) return _foodieSteer(worm, world);
  const predicted = {
    x: target.head.x + Math.cos(target.angle) * target.speed * 20,
    y: target.head.y + Math.sin(target.angle) * target.speed * 20,
  };
  return steerToward(worm.angle, angleTo(head, predicted));
}

// Per-worm wander noise (WeakMap so multiple worms using the same personality
// object don't share noise state)
const _wanderNoise = new WeakMap();

function _wandererSteer(worm, world, noiseMap) {
  let noise = noiseMap.get(worm) || 0;
  noise += (Math.random() - 0.5) * 0.3;
  noise = Math.max(-1, Math.min(1, noise));
  noiseMap.set(worm, noise);

  let foodPull = 0, bestDist = Infinity;
  for (const food of world.food) {
    const d = distSq(worm.head, food);
    if (d < bestDist) { bestDist = d; foodPull = steerToward(worm.angle, angleTo(worm.head, food)); }
  }
  return noise * 0.8 + foodPull * 0.2;
}

// ─── Built-in personalities ──────────────────────────────────────────────────

export const Foodie = {
  name: 'Foodie',
  steer(worm, world) {
    return _foodieSteer(worm, world) + avoidWalls(worm, world) * 2;
  },
};

export const Aggressor = {
  name: 'Aggressor',
  steer(worm, world) {
    return _aggressorSteer(worm, world) + avoidWalls(worm, world) * 2;
  },
};

export const Wanderer = {
  name: 'Wanderer',
  steer(worm, world) {
    return _wandererSteer(worm, world, _wanderNoise) + avoidWalls(worm, world) * 2;
  },
};

// ─── Custom personality factory ──────────────────────────────────────────────

export function createCustomPersonality({ name, foodWeight = 1, aggroWeight = 0, wanderWeight = 0 }) {
  const noiseMap = new WeakMap();

  return {
    name,
    steer(worm, world) {
      const total = foodWeight + aggroWeight + wanderWeight;
      if (total === 0) return avoidWalls(worm, world) * 2;

      let turn = 0;
      if (foodWeight > 0)   turn += _foodieSteer(worm, world)                    * (foodWeight / total);
      if (aggroWeight > 0)  turn += _aggressorSteer(worm, world)                 * (aggroWeight / total);
      if (wanderWeight > 0) turn += _wandererSteer(worm, world, noiseMap)        * (wanderWeight / total);

      return turn + avoidWalls(worm, world) * 2;
    },
  };
}
