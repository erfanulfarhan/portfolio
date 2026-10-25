#version 300 es
// A Schwarzschild black hole with a thin accretion disk, drawn by tracing each
// pixel's ray of light backwards through curved space. Lengths are in units of
// the event horizon's radius, so the horizon is r = 1, light can orbit at
// r = 1.5, and the shadow you see is about 2.6 across.
precision highp float;

uniform vec2 uCenter;     // where the hole sits on screen, in pixels
uniform float uFocal;     // focal length, in pixels
uniform float uTime;      // seconds, drives the disk's rotation
uniform vec3 uCamPos;
uniform mat3 uCamBasis;   // columns: right, up, forward
uniform float uFade;      // 1 once the camera has crossed into the dark
uniform float uExposure;

out vec4 fragColor;

const float R_IN = 2.6;
const float R_OUT = 11.0;
const int MAX_STEPS = 180;
const float TAU = 6.28318531;
// Rays that never come closer than FAR are bent with a formula instead of
// being traced, and a traced ray is finished the same way once it is heading
// out past EXIT, beyond the disk, where nothing else can happen to it.
const float FAR = 14.0;
const float EXIT = 13.0;
// Rays aimed closer than this to the hole fall in: the edge of the shadow.
const float B_EDGE = 2.598;
// Rays aimed just outside the edge wind round the hole before they leave, and
// what they then meet comes in images finer than any pixel. Within this much
// of the edge (in aim) that light is drawn as the smooth ring it adds up to.
const float WOUND = 0.08;
// The ring's fine line and its soft glow, as angles on screen (radians), so it
// keeps its look as the camera falls in. A line thinner than a pixel and a bit
// is widened to that, and dimmed to match.
const float RING_LINE = 0.001;
const float RING_GLOW = 0.0082;
// The page's own space colour, in sRGB, so the canvas edge disappears into it.
const vec3 SPACE = vec3(0.0196, 0.0275, 0.0431);

/* ---------- hashing and noise ---------- */

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise whose x axis repeats every `period` cells: x runs around the disk.
float noiseRing(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  float a = hash12(vec2(x0, i.y));
  float b = hash12(vec2(x1, i.y));
  float c = hash12(vec2(x0, i.y + 1.0));
  float d = hash12(vec2(x1, i.y + 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), u.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), u.x), u.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), u.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

/* ---------- the disk ---------- */

// Black-body-ish colour for a temperature from 0 (cool, deep orange) to 1 (white hot).
vec3 heat(float t) {
  vec3 c = mix(vec3(0.55, 0.11, 0.02), vec3(1.0, 0.42, 0.1), smoothstep(0.0, 0.4, t));
  c = mix(c, vec3(1.0, 0.74, 0.44), smoothstep(0.3, 0.7, t));
  return mix(c, vec3(1.0, 0.95, 0.88), smoothstep(0.65, 1.0, t));
}

// Light and opacity of the disk where a ray crosses its plane. `ray` is the
// direction the traced ray travels, the reverse of the light reaching us, and
// `footprint` is how much of the disk one pixel covers there. Streaks finer
// than a pixel would only shimmer, so they fade to their average instead.
vec4 disk(vec3 p, vec3 ray, float footprint) {
  float r = length(p.xz);
  if (r < R_IN || r > R_OUT) return vec4(0.0);

  // Gas closer in orbits faster, so the pattern winds into streaks.
  float turns = atan(p.z, p.x) / TAU - uTime * 0.11 * pow(3.0 / r, 1.5);
  float n = 0.0;
  float amp = 0.55;
  float around = 9.0;
  float across = 2.6;
  for (int o = 0; o < 4; o++) {
    float keep = smoothstep(1.0, 2.5, 1.0 / (across * footprint));
    n += amp * mix(0.5, noiseRing(vec2(turns * around, r * across), around), keep);
    around *= 2.0;
    across *= 2.1;
    amp *= 0.5;
  }
  n = clamp(n / 1.03, 0.0, 1.0);

  float x = (r - R_IN) / (R_OUT - R_IN);
  // The inner rim is soft over at least a pixel or so, so it does not step.
  float rim = max(0.02, 1.5 * footprint / (R_OUT - R_IN));
  float edge = smoothstep(0.0, rim, x) * (1.0 - smoothstep(0.3, 1.0, x));
  float temp = pow(R_IN / r, 1.1);

  // The side of the disk turning towards us is brighter and hotter, a little.
  vec3 orbit = normalize(vec3(-p.z, 0.0, p.x));
  float beta = min(0.6, sqrt(0.5 / max(r - 1.0, 0.6)));
  float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(orbit, -ray));
  float beam = mix(1.0, g * g * g, 0.15);
  // Light climbing out of the well loses a little energy.
  float lift = sqrt(1.0 - 1.0 / r);

  float streaks = 0.35 + 0.95 * n * n;
  vec3 color = heat(clamp(temp * (0.75 + 0.25 * g) + (n - 0.5) * 0.2, 0.0, 1.0));
  float light = 3.2 * temp * temp * streaks * beam * lift * edge;
  float alpha = clamp(edge * (0.55 + 0.45 * n) * (0.35 + 0.65 * temp), 0.0, 0.97);
  return vec4(color * light, alpha);
}

/* ---------- the sky behind it ---------- */

// Stars on the faces of a cube around us: each cell holds at most one, kept away
// from the cell's edges so a star is never cut in half.
vec3 starLayer(vec3 d, float cells, float chance, float pixel) {
  vec3 a = abs(d);
  vec2 uv;
  float face;
  if (a.x >= a.y && a.x >= a.z) {
    uv = d.yz / a.x;
    face = d.x > 0.0 ? 0.0 : 1.0;
  } else if (a.y >= a.z) {
    uv = d.xz / a.y;
    face = d.y > 0.0 ? 2.0 : 3.0;
  } else {
    uv = d.xy / a.z;
    face = d.z > 0.0 ? 4.0 : 5.0;
  }
  vec2 grid = (uv * 0.5 + 0.5) * cells;
  vec2 cell = floor(grid);
  vec3 h = hash32(cell + face * 131.7 + cells);
  if (h.x > chance) return vec3(0.0);
  vec2 spot = cell + 0.25 + 0.5 * hash32(cell * 1.7 + face * 17.3 + 4.1).xy;
  // Distance across the cube face, converted to an angle on the sky.
  float dist = length(grid - spot) * 2.0 / cells / (1.0 + dot(uv, uv));
  float size = pixel * 0.7;
  float bright = 0.035 + 1.8 * pow(h.y, 12.0);
  // A slow twinkle, each star at its own pace.
  bright *= 0.72 + 0.28 * sin(uTime * (0.8 + 2.4 * h.z) + h.y * 60.0);
  vec3 tint = mix(vec3(1.0, 0.8, 0.6), vec3(0.75, 0.85, 1.0), h.z);
  return tint * bright * exp(-dist * dist / (size * size));
}

vec3 sky(vec3 d, float pixel) {
  vec3 c = starLayer(d, 42.0, 0.14, pixel);
  c += starLayer(d, 120.0, 0.05, pixel) * 0.6;
  // A faint band of the galaxy, which the hole bends into an arc around itself.
  vec3 normal = normalize(vec3(0.35, 0.82, -0.45));
  float b = dot(d, normal);
  float band = exp(-b * b * 22.0);
  float cloud = noise3(d * 3.2) * 0.6 + noise3(d * 7.5) * 0.3 + noise3(d * 17.0) * 0.1;
  float lanes = smoothstep(0.35, 0.7, noise3(d * 5.0 + 3.0));
  c += vec3(0.5, 0.55, 0.7) * band * cloud * (1.0 - 0.6 * lanes) * 0.05;
  return c;
}

/* ---------- weak-field bending ---------- */

// Far from the hole a ray barely curves, so its remaining bend has a closed
// form: about (1/b)(1 + s) for a ray still coming in and (1/b)(1 - s) for one
// going out, where b is how close its straight line passes and s says how far
// along that line it already is. A second-order term keeps it within a pixel
// or two of the traced rays where the two methods meet.
vec3 bendRest(vec3 p, vec3 v) {
  vec3 c = p - dot(p, v) * v;
  float b = max(length(c), 1e-3);
  float s = sqrt(max(0.0, 1.0 - (b * b) / dot(p, p)));
  float f = dot(p, v) < 0.0 ? 1.0 + s : 1.0 - s;
  float bend = f / b + 1.4726 * f / (b * b);
  return normalize(v - bend * c / b);
}

/* ---------- tone ---------- */

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uCenter) / uFocal;
  vec3 ray = normalize(uCamBasis * vec3(uv, 1.0));
  float pixel = 1.0 / uFocal;

  vec3 pos = uCamPos;
  vec3 vel = ray;
  // Angular momentum is conserved along the ray; it sets how hard space bends it.
  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);
  // How fast that changes from pixel to pixel, taken before any branching.
  float aim = sqrt(h2);
  float aimStep = max(fwidth(aim), 1e-4);

  // A ray heading in falls if its aim is inside the shadow's edge: B_EDGE
  // seen from far off, a little less from close in, where it starts deeper in
  // the well. Measured from the aim rather than from where each traced ray
  // ended up, the edge is exact and anti-aliased over a pixel either side.
  // Just outside it the light winds round the hole (`wound`), and is drawn as
  // the ring below. A ray heading out from the start always escapes.
  bool inbound = dot(uCamPos, ray) < 0.0;
  float r0 = length(uCamPos);
  float edgeAim = inversesqrt(1.0 / (B_EDGE * B_EDGE) + 1.0 / (r0 * r0 * r0));
  float open = inbound ? smoothstep(edgeAim - aimStep, edgeAim + aimStep, aim) : 1.0;
  float wound = inbound ? 1.0 - smoothstep(edgeAim, edgeAim + max(WOUND, 4.0 * aimStep), aim) : 0.0;

  vec3 light = vec3(0.0);
  vec3 glow = vec3(0.0);
  float cover = 0.0;
  bool fell = false;
  bool circling = false;

  if (aim > FAR && dot(pos, pos) > FAR * FAR) {
    // Passes wide of everything: no disk, no haze, just a bend.
    vel = bendRest(pos, vel);
  } else {
    float travelled = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      // Small steps near the hole, long strides far away.
      float dt = r * mix(0.055, 0.12, smoothstep(4.0, 10.0, r));
      vel += -1.5 * h2 * pos / (r2 * r2 * r) * dt;
      vec3 next = pos + vel * dt;
      // Once past its closest approach the ray is on its way out; for a wound
      // ray, what it meets from here on is the ring's to draw.
      float keep = dot(pos, vel) > 0.0 ? 1.0 - wound : 1.0;

      if (pos.y * next.y < 0.0) {
        float t = pos.y / (pos.y - next.y);
        vec3 hit = mix(pos, next, t);
        vec3 dir = normalize(vel);
        // A pixel's cone has widened with the distance travelled, and lands
        // stretched on the disk when it arrives at a glancing angle.
        float footprint = (travelled + dt * t) * pixel / max(abs(dir.y), 0.04);
        vec4 d = disk(hit, dir, footprint);
        d.a *= keep;
        light += (1.0 - cover) * d.rgb * d.a;
        cover += (1.0 - cover) * d.a;
      }

      // Hot haze just above and below the disk (it has faded to nothing by 1.6 out).
      if (abs(next.y) < 1.6) {
        float rr = length(next.xz);
        if (rr < R_OUT) {
          float q = R_IN / max(rr, R_IN);
          float haze = exp(-abs(next.y) * 3.0) * smoothstep(R_IN, R_IN * 1.3, rr) * (1.0 - smoothstep(R_IN * 1.2, R_OUT, rr));
          glow += keep * (1.0 - cover) * vec3(1.0, 0.6, 0.28) * haze * q * sqrt(q) * dt * 0.06;
        }
      }

      pos = next;
      travelled += dt;
      float nr = length(pos);
      if (nr < 1.45 && dot(pos, vel) < 0.0) {
        // Inside the orbit at r = 1.5 and still heading in: nothing can stop it now.
        fell = true;
        break;
      }
      if (i == MAX_STEPS - 1) {
        // Still circling when the steps run out: it belongs to the ring.
        circling = true;
        break;
      }
      if (cover > 0.95) break;
      if (nr > EXIT && dot(pos, vel) > 0.0) {
        vel = bendRest(pos, normalize(vel));
        break;
      }
    }
  }

  // Haze in front of the hole would fog its shadow; keep the shadow dark.
  vec3 color = light + glow * mix(0.2, 1.0, open);
  if (!fell && !circling) color += sky(normalize(vel), pixel) * (1.0 - cover) * open * (1.0 - wound);
  if (inbound) {
    // Light that skims the orbit at r = 1.5 piles up in a ring hugging the
    // shadow: a soft glow, with a fine bright line at its inner edge, the sum
    // of the ever thinner images of the disk wound into it.
    float perAngle = aimStep * uFocal; // aim per radian on screen, here
    float past = max(aim - edgeAim, 0.0);
    float lineWidth = max(RING_LINE * perAngle, 1.25 * aimStep);
    float across = (past - 0.6 * lineWidth) / lineWidth;
    float line = exp(-2.0 * across * across) * (RING_LINE * perAngle / lineWidth);
    float ring = 0.32 * exp(-past / (RING_GLOW * perAngle)) + 0.55 * line;
    color += vec3(1.0, 0.82, 0.6) * ring * (1.0 - cover) * open;
  }

  color = aces(color * uExposure);
  color = pow(color, vec3(1.0 / 2.2));
  // Lift the darks to the page colour, then fade to it as the camera falls in.
  color = 1.0 - (1.0 - color) * (1.0 - SPACE);
  color = mix(color, SPACE, uFade);
  // Dither, so the faint glows do not band.
  color += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;
  fragColor = vec4(color, 1.0);
}
