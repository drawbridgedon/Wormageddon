import { SEGMENT_RADIUS } from './worm.js';

const FOOD_RADIUS = 4;
const FOOD_CAP = 400;          // max food pellets allowed at once
const FOOD_SPAWN_RATE = 3;     // new pellets added every tick
const GROWTH_PER_FOOD = 5;     // segments added when a worm eats
const FOOD_COLORS = ['#f9e642', '#f97316', '#22d3ee', '#a78bfa', '#4ade80'];

export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 3000;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Viewport size = window size, resizes dynamically
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.worldWidth = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;

    // Camera tracks the centroid of all worms (world coordinates)
    this.camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };

    this.food = [];
    this.worms = [];
    this._respawnQueue = [];
    this._factories = [];
    this._tick = 0;

    this._spawnFood(150); // initial food scattered across the world
  }

  addWorm(worm) {
    this.worms.push(worm);
  }

  registerFactory(factory) {
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

    // Boundary collisions (world edges, not canvas edges)
    for (const worm of this.worms) {
      const h = worm.head;
      if (h.x < 0 || h.x > this.worldWidth || h.y < 0 || h.y > this.worldHeight) {
        this._killWorm(worm);
      }
    }

    // Worm-body collisions (head hits another worm's body)
    for (const worm of this.worms) {
      if (!worm.alive) continue;
      const h = worm.head;
      for (const other of this.worms) {
        if (other === worm || !other.alive) continue;
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
      // Queue a respawn using a random factory
      if (this._factories.length > 0) {
        const factory = this._factories[Math.floor(Math.random() * this._factories.length)];
        this._respawnQueue.push({ ticksLeft: 120, factory });
      }
    }

    // Food collisions
    for (const worm of this.worms) {
      const h = worm.head;
      this.food = this.food.filter(f => {
        const dx = h.x - f.x;
        const dy = h.y - f.y;
        if (dx * dx + dy * dy < (SEGMENT_RADIUS + FOOD_RADIUS) ** 2) {
          worm.grow(GROWTH_PER_FOOD);
          return false;
        }
        return true;
      });
    }

    // Constantly trickle in new food up to the cap
    if (this.food.length < FOOD_CAP) {
      this._spawnFood(FOOD_SPAWN_RATE);
    }

    // Respawn queue
    this._respawnQueue = this._respawnQueue.filter(entry => {
      entry.ticksLeft--;
      if (entry.ticksLeft <= 0) {
        this.worms.push(entry.factory());
        return false;
      }
      return true;
    });

    // Update camera to follow the centroid of all worms
    this._updateCamera();
  }

  draw() {
    const { ctx } = this;
    const vw = this.canvas.width;
    const vh = this.canvas.height;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, vw, vh);

    // Apply camera transform: shift world so camera center = viewport center
    ctx.save();
    ctx.translate(
      Math.round(vw / 2 - this.camera.x),
      Math.round(vh / 2 - this.camera.y),
    );

    this._drawWorldBorder();

    for (const f of this.food) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, FOOD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
    }

    for (const worm of this.worms) {
      worm.draw(ctx);
    }

    ctx.restore(); // back to screen space

    this._drawHUD();
  }

  _updateCamera() {
    if (this.worms.length === 0) return;
    let cx = 0, cy = 0;
    for (const w of this.worms) { cx += w.head.x; cy += w.head.y; }
    const target = { x: cx / this.worms.length, y: cy / this.worms.length };

    // Smooth follow
    this.camera.x += (target.x - this.camera.x) * 0.05;
    this.camera.y += (target.y - this.camera.y) * 0.05;
  }

  _drawWorldBorder() {
    const { ctx } = this;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);
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
        x: Math.random() * this.worldWidth,
        y: Math.random() * this.worldHeight,
        color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
      });
    }
  }

  _scatterFood(worm) {
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

  _resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
