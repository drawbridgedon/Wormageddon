const SEGMENT_RADIUS = 6;
const HEAD_RADIUS = 8;
export const DEFAULT_TURN_SPEED = 0.07; // radians per tick

let _nextId = 0;

export class Worm {
  constructor({
    x, y, angle, color, personality,
    speed = 2, turnSpeed = DEFAULT_TURN_SPEED,
    // Evolution fields
    name, generation = 0, parents = [], parentNames = [], traits = null,
  }) {
    this.id = _nextId++;
    this.color = color;
    this.angle = angle;
    this.speed = speed;
    this.turnSpeed = turnSpeed;
    this.personality = personality;
    this.alive = true;

    // Identity & lineage (used in both modes; defaults to personality-based name in sandbox)
    this.name = name ?? (personality.name + ' ' + this.id);
    this.generation = generation;
    this.parents = parents;         // parent IDs
    this.parentNames = parentNames; // parent names (snapshotted at birth so dead parents still readable)

    // Numeric trait snapshot — used for inheritance; mirrors the constructor params
    this.traits = traits ?? {
      speed, turnSpeed, foodWeight: 1, aggroWeight: 0, wanderWeight: 0,
    };

    // Mating state machine (evolution mode only)
    this.matingState  = 'idle'; // 'idle' | 'courting' | 'cooldown'
    this.courtingWith = null;
    this.courtingTicks = 0;
    this.matingCooldown = 0;
    this._savedPersonality = null;

    // Start with 10 segments all at the same position; they'll spread out naturally
    this.segments = Array.from({ length: 10 }, () => ({ x, y }));
  }

  get head() {
    return this.segments[0];
  }

  get length() {
    return this.segments.length;
  }

  // Called each tick. Returns food pellets to add to the world if this worm dies.
  tick(world) {
    if (!this.alive) return;

    // Ask personality how much to turn (-1 = full left, 0 = straight, +1 = full right)
    const turn = this.personality.steer(this, world);
    this.angle += Math.max(-1, Math.min(1, turn)) * this.turnSpeed;

    // Move head forward
    const newHead = {
      x: this.head.x + Math.cos(this.angle) * this.speed,
      y: this.head.y + Math.sin(this.angle) * this.speed,
    };

    this.segments.unshift(newHead);
    this.segments.pop(); // tail follows naturally; growth is handled by World
  }

  // Grow by adding segments at the tail
  grow(amount) {
    const tail = this.segments[this.segments.length - 1];
    for (let i = 0; i < amount; i++) {
      this.segments.push({ ...tail });
    }
  }

  draw(ctx) {
    // Worms grow slightly wider as they get longer
    const scale = 1 + Math.sqrt(this.segments.length) * 0.025;
    const bodyR = SEGMENT_RADIUS * scale;
    const headR = HEAD_RADIUS * scale;

    // Courting: pulsing pink ring around the head
    if (this.matingState === 'courting') {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.012);
      ctx.beginPath();
      ctx.arc(this.head.x, this.head.y, headR + 5 + pulse * 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff69b4';
      ctx.globalAlpha = 0.55 + pulse * 0.25;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Draw body segments back-to-front so the head is on top
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const r = i === 0 ? headR : bodyR;
      const alpha = i === 0 ? 1 : 0.7 - (i / this.segments.length) * 0.3;

      ctx.beginPath();
      ctx.arc(seg.x, seg.y, r, 0, Math.PI * 2);
      ctx.fillStyle = i === 0
        ? lighten(this.color, 30)
        : this.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// Lighten a hex color by amt (0-255)
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

export { SEGMENT_RADIUS, HEAD_RADIUS };
