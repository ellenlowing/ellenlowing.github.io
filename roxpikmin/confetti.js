import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";
import { config } from "./cake.js";

/* ------------------------------------------------------------------ *
 *  Hand confetti.
 *
 *  Both hands throw confetti while they move, and the amount is mapped
 *  to how fast they're moving — a lazy wave is a trickle, a big swing
 *  is a burst. Wave your arms and the room fills up.
 *
 *  Speed is measured in BASE-WIDTHS PER SECOND, not pixels: `base` is
 *  the player's shoulder width, so the same physical gesture throws the
 *  same confetti whether you're close to the camera or across the room
 *  (the swat threshold in worms.js is scaled the same way).
 * ------------------------------------------------------------------ */

export const confettiConfig = {
  enabled: true,
  // Hand speed where confetti starts, and where it hits full blast.
  // Below `minSpeed` nothing comes out at all, so a hand resting in frame
  // (or the small jitter pose puts on a still wrist) stays quiet.
  minSpeed: 0.7,
  maxSpeed: 4.0,
  maxRate: 55,       // pieces per second per hand, at full blast
  maxPieces: 320,    // hard ceiling on live pieces
  sizeMul: [0.05, 0.085], // piece size as a fraction of shoulder width
  minSizePx: 12,     // floor, so a distant player still throws visible bits
  life: [0.8, 1.6],  // seconds
  gravity: 2.4,      // × base per second²
  drag: 1.8,         // exponential velocity decay, per second
};

// The cake's sprinkle palette, so the confetti belongs to the same party.
const COLORS = ["#FF6B9D", "#6C8CFF", "#FFC93C", "#3FC98A", "#8ACE00", "#FF8FA3"];
const SHAPES = ["strip", "dot", "tri", "squiggle"];
const VARIANTS = 3; // distinct sketches per (shape, size, colour)

const pieces = [];

/**
 * Per-hand emission state, keyed by landmark index so it survives the `hands`
 * array being rebuilt from scratch every pose frame.
 *
 *   acc    fractional pieces owed — carrying the remainder is what makes the
 *          rate frame-rate independent instead of quantising to 1/frame
 *   px,py  where the hand was last frame, so a burst can be smeared along the
 *          swing arc rather than stacked at a single point
 */
const emitters = new Map();

// debug/testing handle (used by the harness; not part of the game API)
export const _pieces = pieces;

export function resetConfetti() {
  pieces.length = 0;
  emitters.clear();
}

const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- per-frame update ---------------- */

export function updateConfetti(dt, env) {
  dt = Math.min(dt, 0.06); // don't teleport after a hitch

  if (confettiConfig.enabled) {
    for (const hand of env.hands) emit(hand, dt, env);
  }

  const g = env.base * confettiConfig.gravity;
  const decay = Math.exp(-confettiConfig.drag * dt);

  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    p.vy += g * dt;
    p.vx *= decay;
    p.vy *= decay;
    // Flutter: a sideways sway that fights the drop, which is most of what
    // makes falling paper read as paper rather than gravel.
    p.x += (p.vx + Math.sin(p.t * p.flutterHz + p.phase) * p.flutter) * dt;
    p.y += p.vy * dt;
    p.rot += p.spin * dt;
    p.flip += p.flipSpeed * dt;
    p.t += dt;
    p.life -= dt;
    if (p.life <= 0 || p.y > env.h + 60) pieces.splice(i, 1);
  }
}

/** One hand's contribution this frame. */
function emit(hand, dt, env) {
  const id = hand.id ?? 0;
  let e = emitters.get(id);
  if (!e) {
    e = { acc: 0, px: hand.x, py: hand.y };
    emitters.set(id, e);
  }

  // A hand that vanished and came back (pose lost the player for a moment)
  // would otherwise smear a streak of confetti across the whole gap.
  if (Math.hypot(hand.x - e.px, hand.y - e.py) > env.base * 3) {
    e.px = hand.x;
    e.py = hand.y;
  }

  const speed = Math.hypot(hand.vx, hand.vy) / Math.max(env.base, 1);
  const { minSpeed, maxSpeed, maxRate } = confettiConfig;
  const t = Math.min(1, Math.max(0, (speed - minSpeed) / (maxSpeed - minSpeed)));
  // Superlinear, so the payoff is concentrated in real swings — that's what
  // makes flinging your arms about feel like it's doing something. Squaring it
  // went too far (a brisk wave managed 8 pieces/sec, which reads as broken);
  // 1.5 keeps the curve without starving the middle of the range.
  const rate = maxRate * Math.pow(t, 1.5);

  e.acc += rate * dt;
  let n = Math.floor(e.acc);
  e.acc -= n;

  const room = confettiConfig.maxPieces - pieces.length;
  if (n > room) n = Math.max(0, room);

  for (let i = 0; i < n; i++) {
    // Spread the burst along the path the hand travelled, so a fast swing
    // leaves a streak of confetti instead of a clump at its end point.
    const u = Math.random();
    spawn(e.px + (hand.x - e.px) * u, e.py + (hand.y - e.py) * u, hand, env);
  }

  e.px = hand.x;
  e.py = hand.y;
}

function spawn(x, y, hand, env) {
  const size = Math.max(
    confettiConfig.minSizePx,
    env.base * rand(confettiConfig.sizeMul[0], confettiConfig.sizeMul[1])
  );
  const a = Math.random() * Math.PI * 2;
  const burst = env.base * rand(0.4, 1.7);
  const off = env.base * 0.06;

  pieces.push({
    x: x + Math.cos(a) * off,
    y: y + Math.sin(a) * off,
    // Inherit a slice of the hand's own velocity so the confetti flies the way
    // the arm swung, then add an outward pop and a bias upward — thrown, not
    // dropped.
    vx: hand.vx * 0.28 + Math.cos(a) * burst,
    vy: hand.vy * 0.28 + Math.sin(a) * burst - env.base * 0.5,
    rot: Math.random() * Math.PI * 2,
    spin: rand(-9, 9),
    flip: Math.random() * Math.PI * 2,
    flipSpeed: rand(4, 11),
    flutter: env.base * rand(0.15, 0.5),
    flutterHz: rand(6, 13),
    phase: Math.random() * 7,
    t: 0,
    size,
    life: rand(confettiConfig.life[0], confettiConfig.life[1]),
    life0: 0, // filled below
    color: COLORS[(Math.random() * COLORS.length) | 0],
    shape: SHAPES[(Math.random() * SHAPES.length) | 0],
    variant: (Math.random() * VARIANTS) | 0,
  });
  const p = pieces[pieces.length - 1];
  p.life0 = p.life;
}

/* ---------------- sprites ---------------- */

/**
 * One cached Rough.js sketch per (shape, size bucket, colour, variant).
 *
 * Unlike the cake and the bugs these are NOT rebuilt on the boil: a piece lives
 * about a second while tumbling and flipping, so a 7fps redraw would be invisible
 * churn on hundreds of sprites. The three seeded variants supply the "no two
 * drawn alike" variety instead, and every piece has its own rotation anyway.
 */
const sprites = new Map();

function getSprite(p) {
  const S = Math.max(8, Math.round(p.size / 3) * 3);
  const key = `${p.shape}|${S}|${p.color}|${p.variant}`;
  let s = sprites.get(key);
  if (s) return s;
  if (sprites.size > 140) sprites.clear();
  s = buildSprite(p.shape, S, p.color, p.variant);
  sprites.set(key, s);
  return s;
}

// darker tone of a hex colour, for the outline over its own fill
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh) => Math.round(((n >> sh) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function buildSprite(shape, S, color, variant) {
  // Same margin trick the bug sprites use: a rough pen wanders well outside the
  // nominal path, and an exactly-sized canvas shears the strokes off.
  const pad = Math.max(4, S * 0.5 * Math.max(1, config.roughness));
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.ceil(S + pad * 2);
  const ctx = cv.getContext("2d");
  ctx.translate(cv.width / 2, cv.height / 2);
  const rc = rough.canvas(cv);

  const seed = (S * 131 + variant * 977 + shape.length * 31) >>> 0;
  const stroke = Math.max(1, S * 0.13) * config.strokeWidth;
  // Confetti is a few pixels across. The global roughness is tuned for a cake
  // filling the screen; at 3.2 a 12px square dissolves into a scribble, so the
  // pen is scaled down here — the same lesson as the bugs' per-species pen.
  const rough1 = config.roughness * 0.8;

  const fillPass = {
    roughness: rough1,
    bowing: config.bowing * 1.2,
    seed,
    stroke: "none",
    fill: color,
    fillStyle: "solid",
  };
  // The outline is sketched from a DIFFERENT seed, so it doesn't sit exactly on
  // the edge of its own fill. That mismatch is the whole hand-coloured look —
  // one clean pass reads as vector art no matter how rough the pen is.
  const linePass = {
    roughness: rough1 * 1.25,
    bowing: config.bowing * 1.4,
    seed: (seed + 7919) >>> 0,
    stroke: shade(color, 0.55),
    strokeWidth: stroke,
    fill: undefined,
  };

  const h = S / 2;
  const both = (draw) => { draw(fillPass); draw(linePass); };
  if (shape === "strip") {
    both((o) => rc.rectangle(-h, -S * 0.28, S, S * 0.56, o));
  } else if (shape === "dot") {
    both((o) => rc.circle(0, 0, S * 0.82, o));
  } else if (shape === "tri") {
    both((o) => rc.polygon([[-h, h * 0.7], [0, -h], [h, h * 0.7]], o));
  } else {
    // streamer: a stroke-only curl in its own colour — the loose one in the mix
    rc.curve(
      [[-h, h * 0.5], [-h * 0.3, -h * 0.6], [h * 0.3, h * 0.55], [h, -h * 0.4]],
      { ...linePass, stroke: color, strokeWidth: Math.max(1.6, S * 0.22) }
    );
  }

  return { cv, a: cv.width / 2 };
}

/* ---------------- drawing ---------------- */

export function drawConfetti(ctx) {
  for (const p of pieces) {
    const s = getSprite(p);
    // Fake the third dimension: squashing horizontally on a cosine makes each
    // piece read as a flat scrap turning edge-on and back, which is the shimmer
    // real confetti has. Clamped away from 0 so it never fully disappears.
    const f = Math.cos(p.flip);
    const sx = f >= 0 ? Math.max(0.12, f) : Math.min(-0.12, f);

    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life / (p.life0 * 0.35));
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(sx, 1);
    ctx.drawImage(s.cv, -s.a, -s.a);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Testing handle: how many pieces are in the air. */
export function confettiCount() {
  return pieces.length;
}
