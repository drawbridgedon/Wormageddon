import { SEGMENT_RADIUS } from './worm.js';

const FOOD_CAP = 3000;
const FOOD_SPAWN_RATE = 30;
const GROWTH_PER_FOOD = 5;
const FOOD_COLORS = ['#f9e642', '#f97316', '#22d3ee', '#a78bfa', '#4ade80', '#fb7185', '#34d399'];

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

    // Camera: free by default, follows a worm reference when set
    this.camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    this._followTarget = null; // worm ref or null (free camera)
    this._drag = null;
    this.zoom = 1.0;
    this._pinch = null; // two-finger pinch state
    this.ticksPerFrame = 1;

    this._bindInput();
    this._spawnFood(500);
  }

  addWorm(worm) {
    this.worms.push(worm);
  }

  registerFactory(factory) {
    this._factories.push(factory);
  }

  start() {
    // Wire up the speed slider now that the DOM is ready
    const slider = document.getElementById('sim-speed');
    const label  = document.getElementById('sim-speed-val');
    if (slider) {
      const sync = () => {
        this.ticksPerFrame = +slider.value;
        if (label) label.textContent = slider.value + '×';
      };
      slider.addEventListener('input',  sync);
      slider.addEventListener('change', sync); // fallback for some mobile browsers
    }

    const loop = () => {
      for (let i = 0; i < this.ticksPerFrame; i++) this.tick();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ─── Input ────────────────────────────────────────────────────────────────

  _bindInput() {
    const canvas = this.canvas;

    const onStart = (x, y) => {
      this._drag = { startX: x, startY: y, camX: this.camera.x, camY: this.camera.y };
    };
    const onMove = (x, y) => {
      if (!this._drag) return;
      // Divide by zoom so a drag covers the same world distance regardless of zoom level
      this.camera.x = this._drag.camX - (x - this._drag.startX) / this.zoom;
      this.camera.y = this._drag.camY - (y - this._drag.startY) / this.zoom;
    };
    const onEnd = (x, y) => {
      if (!this._drag) return;
      const moved = Math.hypot(x - this._drag.startX, y - this._drag.startY);
      if (moved < 8) {
        this._cycleFollow();        // tap = cycle through worms
      } else {
        this._followTarget = null;  // drag = free camera, stays put
      }
      this._drag = null;
    };

    canvas.addEventListener('mousedown', e => onStart(e.clientX, e.clientY));
    document.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    document.addEventListener('mouseup',   e => onEnd(e.clientX, e.clientY));

    // Desktop scroll-to-zoom (zoom toward cursor)
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this._applyZoom(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Touch: single-finger drag, two-finger pinch-to-zoom
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        this._pinch = {
          dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
          zoom: this.zoom,
          camX: this.camera.x,
          camY: this.camera.y,
          midX: (t1.clientX + t2.clientX) / 2,
          midY: (t1.clientY + t2.clientY) / 2,
        };
        this._drag = null;
      } else if (e.touches.length === 1) {
        this._pinch = null;
        const t = e.touches[0];
        onStart(t.clientX, t.clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 2 && this._pinch) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const newZoom = Math.max(0.25, Math.min(2.0, this._pinch.zoom * (dist / this._pinch.dist)));
        const vw = this.canvas.width, vh = this.canvas.height;
        const { midX, midY } = this._pinch;
        // Keep the pinch midpoint fixed in world space as zoom changes
        const dx = midX - vw / 2;
        const dy = midY - vh / 2;
        this.camera.x = this._pinch.camX + dx * (1 / this._pinch.zoom - 1 / newZoom);
        this.camera.y = this._pinch.camY + dy * (1 / this._pinch.zoom - 1 / newZoom);
        this.zoom = newZoom;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      this._pinch = null;
      if (e.touches.length === 0) {
        if (this._drag) {
          const t = e.changedTouches[0];
          onEnd(t.clientX, t.clientY);
        }
      } else if (e.touches.length === 1) {
        // Dropped from 2 fingers to 1 — restart drag from current finger
        const t = e.touches[0];
        onStart(t.clientX, t.clientY);
      }
    }, { passive: false });
  }

  _applyZoom(factor, screenX, screenY) {
    const oldZoom = this.zoom;
    const newZoom = Math.max(0.25, Math.min(2.0, oldZoom * factor));
    const vw = this.canvas.width, vh = this.canvas.height;
    // Shift camera so the world point under (screenX, screenY) stays fixed
    const dx = screenX - vw / 2;
    const dy = screenY - vh / 2;
    this.camera.x += dx * (1 / oldZoom - 1 / newZoom);
    this.camera.y += dy * (1 / oldZoom - 1 / newZoom);
    this.zoom = newZoom;
  }

  _cycleFollow() {
    if (this.worms.length === 0) { this._followTarget = null; return; }
    const idx = this.worms.indexOf(this._followTarget);
    // indexOf returns -1 if not found → idx+1=0 → first worm. At end → null (free).
    if (idx < this.worms.length - 1) {
      this._followTarget = this.worms[idx + 1];
    } else {
      this._followTarget = null;
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
        if (dx * dx + dy * dy < (SEGMENT_RADIUS + f.r) ** 2) {
          worm.grow(GROWTH_PER_FOOD);
          return false;
        }
        return true;
      });
    }

    if (this.food.length < FOOD_CAP) this._spawnFood(FOOD_SPAWN_RATE);

    this._respawnQueue = this._respawnQueue.filter(entry => {
      if (--entry.ticksLeft <= 0) { this.worms.push(entry.factory()); return false; }
      return true;
    });

    if (!this._drag) this._updateCamera();
  }

  // ─── Camera ───────────────────────────────────────────────────────────────

  _updateCamera() {
    // If the followed worm died, release it (camera stays put)
    if (this._followTarget && !this.worms.includes(this._followTarget)) {
      this._followTarget = null;
    }
    if (!this._followTarget) return; // free camera — no movement
    const { x, y } = this._followTarget.head;
    this.camera.x += (x - this.camera.x) * 0.08;
    this.camera.y += (y - this.camera.y) * 0.08;
  }

  // ─── Draw ─────────────────────────────────────────────────────────────────

  draw() {
    const { ctx } = this;
    const dpr = this._dpr || 1;
    // Use CSS pixel dimensions so all coordinate math stays in CSS pixels
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    ctx.save();
    // Scale once for device pixel ratio so the buffer fills at full resolution
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, vw, vh);

    ctx.save();
    // Zoom toward screen center, then translate for camera position
    ctx.translate(vw / 2, vh / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, this.worldWidth, this.worldHeight);

    // Draw food — smaller pellets are plain circles, larger ones get an outer ring
    for (const f of this.food) {
      if (f.r > 4.5) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r + 2, 0, Math.PI * 2);
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.fill();
    }

    for (const worm of this.worms) worm.draw(ctx);

    ctx.restore(); // restore zoom+camera transform
    ctx.restore(); // restore dpr scale

    this._drawHUD();
  }

  _drawHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const ft = this._followTarget;
    const camLine = ft
      ? `<span style="color:${ft.color}">■</span> ${ft.personality.name} — tap to change`
      : `free camera — tap to follow`;

    const sorted = [...this.worms].sort((a, b) => b.length - a.length).slice(0, 5);
    const lines = [
      `${this.worms.length} worm${this.worms.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${camLine}`,
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
        r: 2 + Math.random() * 5, // radius 2–7, adds visual variety
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
        r: 2 + Math.random() * 4,
      });
    }
  }

  _killWorm(worm) {
    worm.alive = false;
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this._dpr = dpr;
    // CSS size = window size; buffer size = window * DPR for sharp rendering
    this.canvas.style.width  = window.innerWidth  + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.canvas.width  = Math.round(window.innerWidth  * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }
}
