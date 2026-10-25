import fragment from './blackhole.frag.glsl?raw';

/** Written by the hero's scroll timeline, read here every frame. */
export type SkyShared = {
  /** 0 at rest beside the name, 1 once the camera has fallen through the horizon. */
  dolly: number;
  /** True once the timeline has faded the canvas out. */
  hidden: boolean;
};

export type BlackHoleOptions = {
  canvas: HTMLCanvasElement;
  /** The box the canvas fills: the whole hero. */
  host: HTMLElement;
  /** Rendering stops while this is off screen. */
  section: HTMLElement;
  shared: SkyShared;
  finePointer: boolean;
  /** Draw a single frame (and redraw it on resize) instead of animating. */
  still: boolean;
  /** Called if the GPU context is lost or the device is too slow to animate it. */
  onLost: () => void;
};

const VERTEX = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Lengths are in horizon radii, as in the shader.
const DISTANCE = 24; // the camera at rest
const FALL_END = 2.6; // where the fall ends: close enough that the shadow fills the screen
const DISK_EDGE = 11; // the disk's outer edge

// Where the camera starts as the intro opens, before it settles into place.
const ARRIVE_FROM = { dist: 38, elevation: 0.3, azimuth: -0.25, roll: -0.5, exposure: 0.25 };
const ARRIVAL = 3.6; // seconds

// GPU time a frame may take, in ms: at rest the picture must be sharp; while
// falling it is moving fast, so it can trade some sharpness for smoothness.
const REST_BUDGET = 10;
const FALL_BUDGET = 11;
const MIN_SCALE = 0.6; // render pixels per CSS pixel, at the very least
const HOPELESS = 33; // ms a frame would still take at MIN_SCALE: show the still picture instead
const IDLE_AFTER = 20000; // ms without input before it drops to 30 frames a second

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type Vec3 = [number, number, number];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const targetScale = (dpr: number) => (dpr >= 1.75 ? Math.min(dpr, 2) : Math.min(dpr * 2, 2.5));

/** Where the hole sits before the scroll takes over, and how big, in CSS pixels. */
type Rest = { cx: number; cy: number; focal: number };

function restFor(w: number, h: number): Rest {
  // Beside the name on wide screens; below it on tall ones, wider than the screen.
  const wide = w >= 900 && w / h >= 1.05;
  const cx = wide ? w * (w < 1280 ? 0.74 : 0.72) : w * 0.5;
  const cy = wide ? h * 0.5 : h * 0.77;
  const reach = wide ? Math.min(w * 0.27, h * 0.44) : Math.min(w * 0.64, h * 0.3);
  return { cx, cy, focal: (reach * DISTANCE) / DISK_EDGE };
}

const UNIFORMS = ['uCenter', 'uFocal', 'uTime', 'uCamPos', 'uCamBasis', 'uFade', 'uExposure'] as const;
type UniformName = (typeof UNIFORMS)[number];
type Mode = 'rest' | 'fall';

/**
 * Gargantua, more or less: a black hole whose light is traced through curved
 * space on the GPU, in one full-screen shader. It swings into place as the
 * intro opens, and scrolling flies the camera in until the horizon fills the
 * screen. At rest it renders at the screen's full resolution when the GPU can
 * afford it, measured once while the intro still covers the page.
 */
export class BlackHole {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly shaders: WebGLShader[] = [];
  private readonly buffer: WebGLBuffer;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms = {} as Record<UniformName, WebGLUniformLocation | null>;
  private readonly io: IntersectionObserver;
  private readonly ro: ResizeObserver;
  // Pixels traced per CSS pixel when the GPU allows. A high-density screen
  // gets one per screen pixel; a standard one gets four, which the browser
  // averages down, so fine detail at a distance stays smooth instead of
  // breaking into jagged, crawling pixels.
  private readonly target = targetScale(window.devicePixelRatio || 1);

  private size = { w: 0, h: 0 };
  private rest: Rest = { cx: 0, cy: 0, focal: 1 };
  /** Render pixels per CSS pixel, at rest and while falling. */
  private quality: Record<Mode, number> = { rest: this.target, fall: this.target };
  /** What the measurement chose, and for how many CSS pixels; resizes keep the traced-pixel count. */
  private chosen: Record<Mode, number> = { rest: this.target, fall: this.target };
  private chosenArea = 0;
  private mode: Mode = 'rest';
  private raf = 0;
  private last = 0;
  private time = 0;
  private arrival = 0;
  private started = false;
  private startedAt = 0;
  private ready = false;
  private inView = true;
  private disposed = false;
  private pointer = { x: 0, y: 0 };
  private hasPointer = false;
  private look = { x: 0, y: 0 };
  private lastInput = 0;
  private lastDolly = 0;
  private frames = 0;
  private avg = 0;
  private slowChecks = 0;
  private fastChecks = 0;
  /** The device's own frame interval (a phone in low power mode runs at 30, which is not a slow GPU). */
  private cadence = 1 / 60;
  private cadenceSamples: number[] = [];

  constructor(private readonly opts: BlackHoleOptions) {
    const gl = opts.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    if (opts.still) this.arrival = 1;

    this.program = gl.createProgram()!;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(this.program, shader);
      this.shaders.push(shader);
    }
    gl.bindAttribLocation(this.program, 0, 'aPos');
    // Linking starts the compile; with KHR_parallel_shader_compile it runs off the main thread.
    gl.linkProgram(this.program);

    // One triangle that covers the screen.
    this.buffer = gl.createBuffer()!;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.io = new IntersectionObserver((entries) => {
      this.inView = entries[entries.length - 1].isIntersecting;
      this.sync();
    });
    this.io.observe(opts.section);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(opts.host);

    opts.canvas.addEventListener('webglcontextlost', this.handleLost);
    document.addEventListener('visibilitychange', this.sync);
    if (opts.finePointer && !opts.still) {
      window.addEventListener('pointermove', this.handlePointer, { passive: true });
      window.addEventListener('pointerout', this.handleLeave, { passive: true });
    }
  }

  /**
   * Waits for the shader to compile, measures how fast this GPU traces it,
   * and draws the first frame, so the reveal is neither a stutter nor blurry.
   */
  async warmup() {
    const { gl, program } = this;
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (parallel) {
      const until = performance.now() + 15000;
      while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
        if (this.disposed) return;
        if (performance.now() > until) throw new Error('The black hole shader took too long to compile');
        await new Promise((r) => setTimeout(r, 32));
      }
    }
    if (this.disposed) return;
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = this.shaders.map((s) => gl.getShaderInfoLog(s)).join('\n') + (gl.getProgramInfoLog(program) ?? '');
      throw new Error(`The black hole shader failed to build: ${log}`);
    }
    gl.useProgram(program);
    for (const name of UNIFORMS) this.uniforms[name] = gl.getUniformLocation(program, name);
    this.ready = true;
    this.resize();
    if (!this.opts.still) this.chooseQuality();
    this.draw(0);
    this.opts.canvas.classList.add('is-drawn');
  }

  start() {
    if (this.started || this.disposed) return;
    this.started = true;
    this.startedAt = performance.now();
    this.lastInput = this.startedAt;
    this.sync();
  }

  /** Gives the GPU context back at once, for when the effect is abandoned. */
  release() {
    this.dispose();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    this.opts.canvas.removeEventListener('webglcontextlost', this.handleLost);
    document.removeEventListener('visibilitychange', this.sync);
    window.removeEventListener('pointermove', this.handlePointer);
    window.removeEventListener('pointerout', this.handleLeave);
    const { gl } = this;
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.buffer);
    this.shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteProgram(this.program);
  }

  /* ---------- quality ---------- */

  /** Times a few frames at the target resolution and picks the sharpest sizes that keep 60 frames a second. */
  private chooseQuality() {
    const timeAt = (dolly: number, arrival: number) => {
      const pixel = new Uint8Array(4);
      const frame = () => {
        this.draw(0, dolly, arrival);
        // Reading one pixel back waits for the GPU to finish the frame.
        this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
      };
      frame();
      frame();
      const times: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const t0 = performance.now();
        frame();
        times.push(performance.now() - t0);
      }
      return times.sort((a, b) => a - b)[1];
    };
    this.quality = { rest: this.target, fall: this.target };
    this.applyScale();
    const rest = timeAt(0, 1);
    const fall = timeAt(0.62, 1);
    // Cost grows with the pixel count, so this is what the smallest size would take.
    const atMinimum = (ms: number) => ms * (MIN_SCALE / this.target) ** 2;
    if (atMinimum(rest) > HOPELESS || atMinimum(fall) > HOPELESS) {
      throw new Error(`This GPU is too slow for the black hole (${rest.toFixed(0)} ms a frame at full size)`);
    }
    const fit = (ms: number, budget: number) =>
      ms <= budget ? this.target : Math.max(MIN_SCALE, this.target * Math.sqrt(budget / ms));
    this.quality.rest = fit(rest, REST_BUDGET);
    this.quality.fall = Math.min(this.quality.rest, fit(fall, FALL_BUDGET));
    this.chosen = { ...this.quality };
    this.chosenArea = this.size.w * this.size.h;
    this.mode = 'rest';
    this.applyScale();
  }

  /* ---------- layout ---------- */

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.opts.host;
    if (!w || !h) return;
    this.size = { w, h };
    this.rest = restFor(w, h);
    if (this.chosenArea) {
      // Keep the number of traced pixels the GPU was measured at: a window
      // made bigger renders a little coarser rather than slower.
      const k = Math.sqrt(this.chosenArea / (w * h));
      this.quality.rest = Math.max(MIN_SCALE, Math.min(this.target, this.chosen.rest * k));
      this.quality.fall = Math.max(MIN_SCALE, Math.min(this.quality.rest, this.chosen.fall * k));
    }
    this.applyScale();
    if (this.ready && !this.raf && !this.disposed) this.draw(0);
  };

  private applyScale() {
    const { canvas } = this.opts;
    const k = this.quality[this.mode];
    const width = Math.max(1, Math.round(this.size.w * k));
    const height = Math.max(1, Math.round(this.size.h * k));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  /* ---------- runtime ---------- */

  private sync = () => {
    const shouldRun = this.started && this.ready && !this.opts.still && !this.disposed && this.inView && !document.hidden;
    if (shouldRun && !this.raf) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.frame);
    } else if (!shouldRun && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  };

  private handlePointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = 1 - (e.clientY / window.innerHeight) * 2;
    this.hasPointer = true;
    this.lastInput = performance.now();
  };

  private handleLeave = (e: PointerEvent) => {
    if (e.relatedTarget !== null) return;
    this.hasPointer = false;
  };

  private handleLost = (e: Event) => {
    e.preventDefault();
    this.opts.onLost();
  };

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.time += dt;
    this.frames += 1;
    if (this.arrival < 1) this.arrival = Math.min(1, this.arrival + dt / ARRIVAL);
    this.watchSpeed(dt, now);
    if (this.disposed) return; // the speed check may have given up on the effect

    const { dolly, hidden } = this.opts.shared;
    if (hidden) return; // faded out by the scroll timeline

    // Moving through the fall trades a little sharpness for smoothness; back at rest it is sharp again.
    const mode: Mode = dolly > 0.03 ? 'fall' : dolly < 0.01 ? 'rest' : this.mode;
    if (mode !== this.mode) {
      this.mode = mode;
      this.applyScale();
    }

    // Left alone for a while, it draws every other frame: the motion is slow, and laptops stay cool.
    if (dolly !== this.lastDolly) {
      this.lastDolly = dolly;
      this.lastInput = now;
    }
    if (this.arrival >= 1 && now - this.lastInput > IDLE_AFTER && this.frames % 2) return;
    this.draw(dt);
  };

  /** Puts the camera where the intro, the scroll and the pointer say, and traces a frame. */
  private draw(dt: number, dollyAt?: number, arrivalAt?: number) {
    const { gl, uniforms: u } = this;
    const { w, h } = this.size;
    if (!w || !this.ready || this.disposed) return;
    const dolly = dollyAt ?? (this.opts.still ? 0 : this.opts.shared.dolly);
    const settle = 1 - Math.pow(1 - (arrivalAt ?? this.arrival), 3);

    // A slow drift on touch screens; on a desktop the view leans after the pointer.
    const tx = this.hasPointer ? this.pointer.x : Math.sin(this.time * 0.13) * 0.35;
    const ty = this.hasPointer ? this.pointer.y : Math.sin(this.time * 0.09 + 1) * 0.25;
    const follow = 1 - Math.exp(-dt * 2.5);
    this.look.x += (tx - this.look.x) * follow;
    this.look.y += (ty - this.look.y) * follow;

    const toCentre = smoothstep(0, 0.42, dolly);
    const fall = smoothstep(0.04, 0.95, dolly);
    const calm = (1 - toCentre) * settle;
    // Swinging in from further out and higher up as the intro opens...
    const restDist = mix(ARRIVE_FROM.dist, DISTANCE, settle);
    // ...then falling: the distance shrinks geometrically, which reads as a
    // steady fall that quickens near the end. The shadow fills the screen at about 0.85.
    const dist = restDist * Math.pow(FALL_END / restDist, Math.pow(fall, 1.25));
    const elevation = mix(mix(ARRIVE_FROM.elevation, 0.12, settle), 0.035, fall) + this.look.y * 0.045 * calm;
    const azimuth = mix(ARRIVE_FROM.azimuth, 0.35, settle) + this.look.x * 0.14 * calm + fall * 1.1;
    const roll = mix(ARRIVE_FROM.roll, -0.16, settle) + fall * 0.55;

    const cam: Vec3 = [
      dist * Math.cos(elevation) * Math.sin(azimuth),
      dist * Math.sin(elevation),
      dist * Math.cos(elevation) * Math.cos(azimuth),
    ];
    const forward = norm([-cam[0], -cam[1], -cam[2]]);
    const flatRight = norm(cross(forward, [0, 1, 0]));
    const flatUp = cross(flatRight, forward);
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const right: Vec3 = [flatRight[0] * c + flatUp[0] * s, flatRight[1] * c + flatUp[1] * s, flatRight[2] * c + flatUp[2] * s];
    const up: Vec3 = [flatUp[0] * c - flatRight[0] * s, flatUp[1] * c - flatRight[1] * s, flatUp[2] * c - flatRight[2] * s];

    const k = this.opts.canvas.width / w;
    const r = this.rest;
    const cx = mix(r.cx, w / 2, toCentre);
    const cy = mix(r.cy, h / 2, toCentre);
    const focal = r.focal * mix(1, 0.7, smoothstep(0.45, 1, dolly));
    // Light comes up as it arrives, and dims as the disk comes close, so
    // skimming over it does not burn out to white.
    const exposure = mix(ARRIVE_FROM.exposure, 1.1, settle) * mix(1, 0.65, smoothstep(0.35, 0.8, dolly));

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    // WebGL counts y from the bottom.
    gl.uniform2f(u.uCenter, cx * k, (h - cy) * k);
    gl.uniform1f(u.uFocal, focal * k);
    gl.uniform1f(u.uTime, this.time % 3600);
    gl.uniform3f(u.uCamPos, cam[0], cam[1], cam[2]);
    gl.uniformMatrix3fv(u.uCamBasis, false, [...right, ...up, ...forward]);
    gl.uniform1f(u.uFade, smoothstep(0.84, 0.96, dolly));
    gl.uniform1f(u.uExposure, exposure);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Renders fewer pixels if the GPU falls behind for real, ignoring the busy
   * first seconds after landing, and gives up on the effect if even that is
   * not enough. Measured against the device's own frame rate, so a phone
   * capped at 30 frames a second is not mistaken for a slow one, and it climbs
   * back towards the chosen sharpness when frames are on time again.
   */
  private watchSpeed(dt: number, now: number) {
    if (now < this.startedAt + 2500) return;
    if (this.cadenceSamples.length < 90) {
      this.cadenceSamples.push(dt);
      if (this.cadenceSamples.length === 90) {
        const sorted = [...this.cadenceSamples].sort((x, y) => x - y);
        this.cadence = Math.max(1 / 144, sorted[9]); // the 10th percentile: the device's best rhythm
      }
    }
    this.avg = this.avg ? this.avg * 0.92 + dt * 0.08 : dt;
    if (this.frames % 60) return;
    const q = this.quality;
    const slow = Math.max(1 / 40, this.cadence * 1.4);
    if (this.avg <= this.cadence * 1.15) {
      this.slowChecks = 0;
      // On time for a while and below what was chosen: step back up.
      if (q[this.mode] < this.chosen[this.mode] - 1e-3 && (this.fastChecks += 1) >= 3) {
        this.fastChecks = 0;
        q[this.mode] = Math.min(this.chosen[this.mode], q[this.mode] / 0.85);
        this.applyScale();
      }
      return;
    }
    this.fastChecks = 0;
    if (this.avg <= slow) {
      this.slowChecks = 0;
      return;
    }
    if ((this.slowChecks += 1) < 2) return; // a hiccup, not a slow GPU
    this.slowChecks = 0;
    if (q[this.mode] > MIN_SCALE + 1e-3) {
      q[this.mode] = Math.max(MIN_SCALE, q[this.mode] * 0.85);
      q.fall = Math.min(q.fall, q.rest);
      this.applyScale();
    } else if (this.avg > Math.max(1 / 24, this.cadence * 2)) {
      this.opts.onLost();
    }
  }
}
