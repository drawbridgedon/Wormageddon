import { SEGMENT_RADIUS } from './worm.js';

const FOOD_RADIUS = 4;
const FOOD_COUNT = 40;       // food pellets to maintain
const GROWTH_PER_FOOD = 5;   // segments added when a worm eats
const FOOD_COLORS = ['#f9e642', '#f97316', '#22d3ee', '#a78bfa', '#4ade80'];
const RESPAWN_DELAY = 120;   // ticks before a dead worm respawns

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.food = [];
    this.worms = [];
    this._respawnQueue = []; // { ticksLeft, factory }
    this._tick = 0;

    this._spawnFood(FOOD_COUNT);
  }

  // Register a worm factory function. Called by main.js for each worm.
  addWorm(worm) {
    this.worms.push(worm);
  }

  // Register a factory so dead worms can respawn
  registerFactory(factory) {
    this._factories = this._factories || [];
    this._factories.push(factory);
  }

  start() {
    const loop = () => {
      this.tick();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  tick() {
    this._tick++;

    // Move all worms
    for (const worm of this.worms) {
      worm.tick(this);
    }

    // Check boundary collisions
    for (const worm of this.worms) {
      const h = worm.head;
      if (h.x < 0 || h.x > this.width || h.y < 0 || h.y > this.height) {
        this._killWorm(worm);
      }
    }

    // Check worm-body collisions (head vs other worms' bodies)
    for (const worm of this.worms) {
      if (!worm.alive) continue;
      const h = worm.head;
      for (const other of this.worms) {
        if (other === worm || !other.alive) continue;
        // Skip the first few segments of the other worm's head (avoid false positives)
        for (let i = 3; i < other.segments.length; i++) {
          const seg = other.segments[i];
          const dx = h.x - seg.x;
          const dy = h.y - seg.y;
          if (dx * dx + dy * dy < (SEGMENT_RADIUS * 2) ** 2) {
            this._killWorm(worm);
            break;
          }
        }
        if (!worm.alive) break;
      }
    }

    // Remove dead worms, scatter their body as food
    const dead = this.worms.filter(w => !w.alive);
    this.worms = this.worms.filter(w => w.alive);
    for (const worm of dead) {
      this._scatterFood(worm);
    }

    // Check food collisions
    for (const worm of this.worms) {
      const h = worm.head;
      this.food = this.food.filter(f => {
        const dx = h.x - f.x;
        const dy = h.y - f.y;
        if (dx * dx + dy * dy < (SEGMENT_RADIUS + FOOD_RADIUS) ** 2) {
          worm.grow(GROWTH_PER_FOOD);
          return false; // consumed
        }
        return true;
      });
    }

    // Top up food supply
    const deficit = FOOD_COUNT - this.food.length;
    if (deficit > 0) this._spawnFood(deficit);

    // Process respawn queue
    this._respawnQueue = this._respawnQueue.filter(entry => {
      entry.ticksLeft--;
      if (entry.ticksLeft <= 0) {
        this.worms.push(entry.factory());
        return false;
      }
      return true;
    });
  }

  draw() {
    const { ctx, width, height } = this;

    // Background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    // Food
    for (const f of this.food) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, FOOD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
    }

    // Worms
    for (const worm of this.worms) {
      worm.draw(ctx);
    }

    // HUD
    this._drawHUD();
  }

  _drawHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const sorted = [...this.worms].sort((a, b) => b.length - a.length).slice(0, 5);
    const lines = [`Worms alive: ${this.worms.length}`, ''];
    for (const w of sorted) {
      lines.push(`<span style="color:${w.color}">■</span> ${w.personality.name} — ${w.length} segs`);
    }
    hud.innerHTML = lines.join('<br>');
  }

  _spawnFood(count) {
    for (let i = 0; i < count; i++) {
      this.food.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      });
    }
  }

  _scatterFood(worm) {
    // Every 4th segment becomes a food pellet
    for (let i = 0; i < worm.segments.length; i += 4) {
      const seg = worm.segments[i];
      this.food.push({
        x: seg.x + (Math.random() - 0.5) * 10,
        y: seg.y + (Math.random() - 0.5) * 10,
        color: worm.color,
      });
    }
  }

  _killWorm(worm) {
    worm.alive = false;
  }
}
