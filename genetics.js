// Trait inheritance and color blending for evolution mode.

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Blend two trait sets together with ±15 % random mutation on each trait.
export function blendTraits(a, b) {
  const mix = (x, y) => (x + y) / 2 * (0.85 + Math.random() * 0.30);
  return {
    speed:        clamp(mix(a.speed,        b.speed),        0.8, 5.0),
    turnSpeed:    clamp(mix(a.turnSpeed,    b.turnSpeed),    0.04, 0.14),
    foodWeight:   Math.max(0, mix(a.foodWeight,   b.foodWeight)),
    aggroWeight:  Math.max(0, mix(a.aggroWeight,  b.aggroWeight)),
    wanderWeight: Math.max(0, mix(a.wanderWeight, b.wanderWeight)),
  };
}

// Mix two hex colors with a random blend weight so offspring look related
// to both parents but aren't identical to either.
export function blendColors(hexA, hexB) {
  const parse = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [rA, gA, bA] = parse(hexA);
  const [rB, gB, bB] = parse(hexB);
  const t = 0.35 + Math.random() * 0.30; // random lean toward one parent
  const mix = (x, y) => Math.round(clamp(x * t + y * (1 - t), 30, 230));
  return '#' + [mix(rA, rB), mix(gA, gB), mix(bA, bB)].map(c => c.toString(16).padStart(2, '0')).join('');
}
