import { SEGMENT_RADIUS } from './worm.js';

const FOOD_RADIUS = 4;
const FOOD_CAP = 800;          // max food pellets at once
const FOOD_SPAWN_RATE = 10;    // new pellets added every tick
const GROWTH_PER_FOOD = 5;
const FOOD_COLORS = ['#f9e642', '#f97316', '#22d3ee', '#a78bfa', '#4ade80'];

export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 3000;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this.worldWidth = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;

    this.food = [];
    this.worms = [];
    this._respawnQueue = [];
    this._factories = [];
    this._tick = 0;

    // Camera state
    this.camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    this._followIndex = -1;  // -1 = centroid, 0+ = specific worm
    this._drag = null;       // { startX, startY, camX, camY } while dragging

    this._bindInput();
    this._spawnFood(200);
  }

  addWorm(worm) {
    this.worms.push(worm);
  }

  registerFactory(factory) {
    this._factories.push(factory);
  }

  start() {
    const loop = () => { this.tick(); this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  _bindInput() {
    const canvas = this.canvas;

    // Unified pointer handling (works for mouse and touch)
    const onStart = (x, y) => {
      this._drag = { startX: x, startY: y, camX: this.camera.x, camY: this.camera.y };
    };
    const onMove = (x, y) => {
      if (!this._drag) return;
      this.camera.x = this._drag.camX - (x - this._drag.startX);
      this.camera.y = this._drag.camY - (y - this._drag.startY);
    };
    const onEnd = (x, y) => {
      if (!this._drag) return;
      const moved = Math.hypot(x - this._drag.startX, y - this._drag.startY);
      if (moved < 8) this._cycleFollow(); // small movement = click
      this._drag = null;
    };

    canvas.addEventListener('mousedown',  e => onStart(e.clientX, e.clientY));
    canvas.addEventListener('mousemove',  e => onMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup',    e => onEnd(e.clientX, e.clientY));
    canvas.addEventListener('mouseleave', e => onEnd(e.clientX, e.clientY));

    canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; onStart(t.clientX, t.clientY); }, { passive: false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: false });
    canvas.addEventListener('touchend',   e => { e.preventDefault(); const t = e.changedTouches[0]; onEnd(t.clientX, t.clientY); }, { passive: false });
  }

  _cycleFollow() {
    // Click cycles: centroid → worm 0 → worm 1 → … → centroid
    if (this._followIndex < this.worms.length - 1) {
      this._followIndex++;
    } else {
      this._followIndex = -1;
    }
  }

  // ─── Tick ─────────────────────────────────────────────────────────────────

  tick() {
    this._tick++;

    for (const worm of this.worms) worm.tick(this);

    // Boundary deaths
    for (const worm of this.worms) {
      const h = worm.head;
      if (h.x < 0 || h.x > this.worldWidth || h.y < 0 || h.y > this.worldHeight) {
        this._killWorm(worm);
      }
    }

    // Body collision deaths
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

    // Remove dead worms
    const dead = this.worms.filter(w => !w.alive);
    this.worms = this.worms.filter(w => w.alive);
    for (const worm of dead) {
      this._scatterFood(worm);
      if (this._factories.length > 0) {
        const factory = this._factories[Math.floor(Math.random() * this._factories.length)];
        this._respawnQueue.push({ ticksLeft: 120, factory });
      }
    }

    // Food collection
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

    // Trickle food
    if (this.food.length < FOOD_CAP) this._spawnFood(FOOD_SPAWN_RATE);

    // Respawns
    this._respawnQueue = this._respawnQueue.filter(entry => {
      if (--entry.ticksLeft <= 0) { this.worms.push(entry.factory()); return false; }
      return true;
    });

    // Only auto-move camera when not dragging
    if (!this._drag) this._updateCamera();
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  _updateCamera() {
    // If following a specific worm, track its head
    if (this._followIndex >= 0 && this._followIndex < this.worms.length) {
      const target = this.worms[this._followIndex].head;
      this.camera.x += (target.x - this.camera.x) * 0.08;
      this.camera.y += (target.y - this.camera.y) * 0.08;
      return;
    }

    // If the followed worm died, fall back to centroid
    this._followIndex = -1;

    if (this.worms.length === 0) return;
    let cx = 0, cy = 0;
    for (const w of this.worms) { cx += w.head.x; cy += w.head.y; }
    const target = { x: cx / this.worms.length, y: cy / this.worms.length };
    this.camera.x += (target.x - this.camera.x) * 0.05;
    this.camera.y += (target.y - this.camera.y) * 0.05;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  draw() {
    const { ctx } = this;
    const vw = this.canvas.width;
    const vh = this.canvas.height;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    ctx.translate(Math.round(vw / 2 - this.camera.x), Math.round(vh / 2 - this.camera.y));

    // World border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

    for (const f of this.food) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, FOOD_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
    }

    for (const worm of this.worms) worm.draw(ctx);

    ctx.restore();

    this._drawHUD();
  }

  _drawHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const following = this._followIndex >= 0 && this._followIndex < this.worms.length
      ? `Following: <span style="color:${this.worms[this._followIndex].color}">■</span> ${this.worms[this._followIndex].personality.name}`
      : 'Following: centroid';

    const sorted = [...this.worms].sort((a, b) => b.length - a.length).slice(0, 5);
    const lines = [
      `Worms alive: ${this.worms.length} &nbsp; ${following}`,
      `<span style="color:#555;font-size:12px">click = follow next &nbsp; drag = pan</span>`,
      '',
    ];
    for (const w of sorted) {
      lines.push(`<span style="color:${w.color}">■</span> ${w.personality.name} — ${w.length} segs`);
    }
    hud.innerHTML = lines.join('<br>');
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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
