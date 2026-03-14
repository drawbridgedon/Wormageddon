// Each personality has a steer(worm, world) function that returns a turn delta.
// Return value: -1 (hard left) to +1 (hard right). 0 = go straight.
//
// Personalities are plain objects so tuning knobs are easy to see and adjust.

// ─── Helpers ────────────────────────────────────────────────────────────────

// Angle from point a to point b
function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Shortest signed turn needed to face targetAngle from currentAngle
function steerToward(currentAngle, targetAngle) {
  let diff = targetAngle - currentAngle;
  // Normalize to [-π, π]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff / Math.PI; // normalize to [-1, 1]
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// ─── Foodie ─────────────────────────────────────────────────────────────────
// Seeks the nearest food. Mildly avoids other worm bodies.

export const Foodie = {
  name: 'Foodie',

  steer(worm, world) {
    const head = worm.head;

    // Find nearest food
    let nearestFood = null;
    let bestDist = Infinity;
    for (const food of world.food) {
      const d = distSq(head, food);
      if (d < bestDist) { bestDist = d; nearestFood = food; }
    }

    if (!nearestFood) return 0;

    let turn = steerToward(worm.angle, angleTo(head, nearestFood));

    // Nudge away from nearby worm body segments
    for (const other of world.worms) {
      if (other === worm) continue;
      for (const seg of other.segments) {
        const d = distSq(head, seg);
        if (d < 60 * 60) {
          turn -= steerToward(worm.angle, angleTo(head, seg)) * 0.4;
        }
      }
    }

    return turn;
  },
};

// ─── Aggressor ───────────────────────────────────────────────────────────────
// Targets the head of the biggest nearby worm and tries to cut in front of it.

export const Aggressor = {
  name: 'Aggressor',

  steer(worm, world) {
    const head = worm.head;

    // Find largest other worm within 400px
    let target = null;
    let bestScore = -Infinity;
    for (const other of world.worms) {
      if (other === worm) continue;
      const d = Math.sqrt(distSq(head, other.head));
      if (d > 400) continue;
      const score = other.length - d * 0.1;
      if (score > bestScore) { bestScore = score; target = other; }
    }

    if (!target) {
      // No nearby target — collect food as fallback
      return Foodie.steer(worm, world);
    }

    // Predict where the target head will be in 20 ticks and aim ahead of it
    const predicted = {
      x: target.head.x + Math.cos(target.angle) * target.speed * 20,
      y: target.head.y + Math.sin(target.angle) * target.speed * 20,
    };

    return steerToward(worm.angle, angleTo(head, predicted));
  },
};

// ─── Wanderer ────────────────────────────────────────────────────────────────
// Mostly random. Gently attracted to food. Hard to predict.

export const Wanderer = {
  name: 'Wanderer',
  _noise: 0,

  steer(worm, world) {
    const head = worm.head;

    // Drift the noise value slowly
    this._noise += (Math.random() - 0.5) * 0.3;
    this._noise = Math.max(-1, Math.min(1, this._noise));

    // Weak pull toward food
    let foodPull = 0;
    let bestDist = Infinity;
    for (const food of world.food) {
      const d = distSq(head, food);
      if (d < bestDist) { bestDist = d; foodPull = steerToward(worm.angle, angleTo(head, food)); }
    }

    return this._noise * 0.8 + foodPull * 0.2;
  },
};
