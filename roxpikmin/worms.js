import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";
import { LAYERS, config, addBite, findCakeDepth, tierNyRange } from "./cake.js";
import { chomp, swat as swatSfx } from "./sfx.js";

/* ------------------------------------------------------------------ *
 *  Bugs. They come in from the screen edges, chew scalloped bites out
 *  of whatever cake still exists, and leave when full. A fast-moving
 *  hand swats them into the stratosphere.
 *
 *  All species share one lifecycle (approach -> eat -> leave | flung)
 *  and the cake-targeting logic; they differ in sprite, size, speed,
 *  appetite and whether they fly. Everything scales off `base` (the
 *  player's shoulder width) so behaviour is the same at any camera
 *  distance or resolution.
 * ------------------------------------------------------------------ */

export const wormConfig = {
  enabled: true,
  maxWorms: 12,
  spawnEverySec: 0.9,
  speedMul: 1,        // global multiplier on every species' speed
  biteRate: 1,        // global multiplier on every species' chew rate
  // Absolute floor on sprite length, in device px. Species sizes are
  // fractions of the player's shoulder width, so someone standing well back
  // shrinks every bug toward invisibility — this keeps them readable (and
  // swattable) at any camera distance. Per-species `minPx` overrides it.
  minSizePx: 62,
  swatSpeedMul: 3.2,  // hand speed (base-widths/s) that counts as a swat
};

export const wormStats = { active: 0, swatted: 0, bites: 0 };

const OUTLINE = "#4A2C17";

/**
 * Species table. Sizes are fractions of `base`; biteR is a fraction of the
 * tier's width; weight is the spawn lottery. `fly` adds a hover-bob while
 * moving and an upward drift when leaving. `pack` spawns a little marching
 * line (ants). Each `sprite` draws facing RIGHT and returns {cv, ax, ay}
 * with the anchor the bug rotates about.
 *
 * `pen` is the species' sketch style — multipliers over the global
 * config.roughness / config.bowing plus a stroke weight, and `single`
 * to disable Rough.js's doubled strokes. The pen is characterization:
 * the worm is loose and noodly with a dotted body, the ladybug heavy
 * and scrawled, the dragonfly a light swooping line, and the ant a
 * neat ballpoint with a cross-hatched shell. Small sprites turn to
 * mush at high roughness, which is what `minPx` guards against.
 */
const SPECIES = {
  worm: {
    len: [0.42, 0.58], minPx: 92, speedMul: 0.6, biteEverySec: 1.3, bitesPerWorm: 6,
    biteR: 0.085, weight: 3, fly: false,
    pen: { rough: 1.0, bow: 1.7, stroke: 1.15 },
    skins: ["#FF9DB6", "#B9E85C", "#9FD8A4"],
    sprite: wormSprite,
  },
  ladybug: {
    len: [0.3, 0.38], minPx: 76, speedMul: 0.85, biteEverySec: 1.1, bitesPerWorm: 4,
    biteR: 0.06, weight: 2, fly: true, bob: 0.25,
    pen: { rough: 2.1, bow: 1.9, stroke: 1.05 },
    skins: ["#F25F5C", "#FF9F1C", "#FFD23F"],
    sprite: ladybugSprite,
  },
  dragonfly: {
    len: [0.5, 0.62], minPx: 98, speedMul: 1.25, biteEverySec: 0.55, bitesPerWorm: 2,
    biteR: 0.07, weight: 4, fly: true, bob: 0.5,
    pen: { rough: 0.8, bow: 2.4, stroke: 0.6, single: true },
    skins: ["#7FB5E6", "#8FD9B6", "#B9E85C"],
    sprite: dragonflySprite,
  },
  ant: {
    len: [0.3, 0.36], minPx: 70, speedMul: 1.15, biteEverySec: 0.7, bitesPerWorm: 3,
    biteR: 0.04, weight: 3, fly: false, pack: 3,
    pen: { rough: 0.5, bow: 0.8, stroke: 0.7, single: true },
    // warm mid-browns — true ant-black vanishes against dark backgrounds
    skins: ["#8A5A3C", "#6E564A", "#B0603F"],
    sprite: antSprite,
  },
};

const worms = [];
const crumbs = [];
const hearts = [];   // one per mouthful, floats up and fades
let spawnClock = 0;

const DIZZY_SEC = 1.8;   // how long the stars keep spinning after a swat
const STAR_COUNT = 3;

// debug/testing handles (used by the harness; not part of the game API)
export const _worms = worms;
export const _hearts = hearts;

/** Clear the swarm — used when the intro resets for the next player. */
export function resetWorms() {
  worms.length = 0;
  crumbs.length = 0;
  hearts.length = 0;
  spawnClock = 0;
  wormStats.active = 0;
}

function pickSpecies() {
  let total = 0;
  for (const k in SPECIES) total += SPECIES[k].weight;
  let roll = Math.random() * total;
  for (const k in SPECIES) {
    roll -= SPECIES[k].weight;
    if (roll <= 0) return k;
  }
  return "worm";
}

export function spawnWorm(env, speciesKey = null) {
  const eatable = LAYERS.filter((l) => l.state);
  if (!eatable.length) return null;

  const key = speciesKey && SPECIES[speciesKey] ? speciesKey : pickSpecies();
  const sp = SPECIES[key];
  const count = sp.pack ? 1 + ((Math.random() * sp.pack) | 0) : 1;
  let spawned = null;

  // Hunt for a spot where cake actually remains: sample random channels and
  // take the first with something left in it. When every try comes up empty
  // the cake is genuinely gone, and the bugs stop bothering to show up.
  for (let tries = 0; tries < 14; tries++) {
    const layer = eatable[(Math.random() * eatable.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    // Span the tier's whole drawn height. A fixed 0.2..0.8 window left the
    // mask tier's cake above the head (which lives at NEGATIVE ny) unreachable,
    // and spared a band at the top and bottom of every tier — exactly where
    // tiers meet, so the joins never got eaten.
    const [nyLo, nyHi] = tierNyRange(layer);
    const inset = (nyHi - nyLo) * 0.08;
    const nyBase = nyLo + inset + Math.random() * (nyHi - nyLo - inset * 2);
    if (findCakeDepth(layer, side, nyBase, sp.biteR * 0.6) === null) continue;

    // a pack marches to neighbouring spots on the same edge, in single file
    for (let i = 0; i < count; i++) {
      const ny = Math.min(nyHi - inset, nyBase + i * 0.07);
      const depth = findCakeDepth(layer, side, ny, sp.biteR * 0.6);
      if (depth === null) continue;
      const len = Math.max(
        sp.minPx ?? wormConfig.minSizePx,
        env.base * (sp.len[0] + Math.random() * (sp.len[1] - sp.len[0]))
      );
      worms.push({
        species: key, sp, layer, side,
        nx: depth, // first mouthful of real cake; may be deep in an old tunnel
        ny, len,
        skin: sp.skins[(Math.random() * sp.skins.length) | 0],
        x: (side < 0 ? -60 : env.w + 60) - side * i * len * 1.6,
        y: env.h * (0.25 + Math.random() * 0.6),
        angle: 0, state: "approach", chew: 0, bites: 0,
        vx: 0, vy: 0, spin: 0,
        phase: Math.random() * 7, bobOff: 0,
        headIdx: (Math.random() * HEAD_COUNT) | 0,
        // two flap groups, so a swarm of dragonflies isn't in lockstep
        wingPhase: Math.random() < 0.5 ? 0 : 1,
      });
      spawned = worms[worms.length - 1];
    }
    break;
  }
  return spawned;
}

// Where this bug's mouth meets the cake, in canvas space — recomputed every
// frame so a chewing bug rides along as the player moves. Also returns the
// tier's outward edge normal.
function attachWorld(wm) {
  const s = wm.layer.state;
  if (!s) return null;
  const lx = wm.nx * s.width; // burrows inward as the bug eats
  const ly = wm.ny * s.height;
  const cos = Math.cos(s.angle);
  const sin = Math.sin(s.angle);
  return {
    x: s.x + cos * lx - sin * ly,
    y: s.y + sin * lx + cos * ly,
    ox: cos * wm.side,
    oy: sin * wm.side,
  };
}

/* ---------------- per-frame update ---------------- */

export function updateWorms(dt, env) {
  dt = Math.min(dt, 0.06); // don't teleport after a hitch

  spawnClock -= dt;
  if (wormConfig.enabled && worms.length < wormConfig.maxWorms && spawnClock <= 0) {
    spawnClock = wormConfig.spawnEverySec * (0.7 + Math.random() * 0.6);
    spawnWorm(env);
  }

  const swatSpeed = env.base * wormConfig.swatSpeedMul;
  const now = performance.now();

  for (let i = worms.length - 1; i >= 0; i--) {
    const wm = worms[i];
    const sp = wm.sp;
    const speed = env.base * sp.speedMul * wormConfig.speedMul;
    const biteEvery = sp.biteEverySec / wormConfig.biteRate;

    // Travel animation, at full frame rate (the sprite's own articulation
    // steps at the boil rate): fliers hover-bob, crawlers do little hops,
    // and everyone rocks slightly along their body axis while moving.
    const moving = wm.state === "approach" || wm.state === "leave";
    wm.bobOff = !moving
      ? 0
      : sp.fly
        ? Math.sin(now * 0.006 + wm.phase) * (sp.bob ?? 0.3) * wm.len
        : -Math.abs(Math.sin(now * 0.02 + wm.phase)) * wm.len * 0.06;
    wm.rock = moving ? Math.sin(now * 0.013 + wm.phase) * 0.1 : 0;

    // ----- swat: a fast hand near the bug launches it -----
    if (wm.state !== "flung") {
      for (const hand of env.hands) {
        const hsp = Math.hypot(hand.vx, hand.vy);
        if (hsp > swatSpeed && Math.hypot(hand.x - wm.x, hand.y - wm.y) < wm.len * 0.8) {
          const d = Math.hypot(wm.x - hand.x, wm.y - hand.y) || 1;
          wm.vx = ((wm.x - hand.x) / d) * hsp * 0.35 + hand.vx * 0.45;
          wm.vy = ((wm.y - hand.y) / d) * hsp * 0.35 + hand.vy * 0.45 - env.base * 1.2;
          wm.spin = (Math.random() - 0.5) * 14;
          wm.state = "flung";
          wm.dizzy = DIZZY_SEC;
          swatSfx();
          wormStats.swatted++;
          break;
        }
      }
    }

    if (wm.state === "approach") {
      const a = attachWorld(wm);
      if (a) {
        const dx = a.x - wm.x;
        const dy = a.y - wm.y;
        const d = Math.hypot(dx, dy) || 1;
        wm.angle = Math.atan2(dy, dx);
        wm.x += (dx / d) * speed * dt;
        wm.y += (dy / d) * speed * dt;
        if (d < wm.len * 0.45) {
          // another bug may have eaten this spot while we travelled —
          // re-check, and chase the cake deeper if so
          const depth = findCakeDepth(wm.layer, wm.side, wm.ny, sp.biteR * 0.6, wm.nx);
          if (depth === null) {
            wm.state = "leave"; // channel's empty; shuffle off disappointed
          } else {
            wm.nx = depth;
            wm.state = "eat";
            wm.chew = 0;
          }
        }
      } // tier lost (player out of frame): bug just waits
    } else if (wm.state === "eat") {
      const a = attachWorld(wm);
      if (a) {
        wm.chew += dt;
        // lunge into the cake once per bite cycle
        const lunge =
          Math.max(0, Math.sin((wm.chew / biteEvery) * Math.PI * 2)) * wm.len * 0.08;
        wm.x = a.x + a.ox * (wm.len * 0.42 - lunge);
        wm.y = a.y + a.oy * (wm.len * 0.42 - lunge);
        wm.angle = Math.atan2(-a.oy, -a.ox); // head into the cake

        if (wm.chew >= biteEvery) {
          wm.chew = 0;
          // Bite exactly where hasCakeAt was consulted. Jittering ny here made
          // the recorded bites drift off the line the bug keeps testing, so it
          // keep finding "cake" in a column it had already hollowed out.
          addBite(wm.layer, wm.nx, wm.ny, sp.biteR);
          chomp();
          wormStats.bites++;
          wm.bites++;
          burstCrumbs(a.x, a.y, wm.layer.body, env.base * 0.03);
          // a happy little heart from the bug that just got a mouthful
          hearts.push({
            x: wm.x, y: wm.y - wm.len * 0.4,
            vy: -env.base * 0.55,
            wob: Math.random() * 7,
            size: Math.max(9, wm.len * 0.22),
            life: 1.15,
          });
          // burrow to the next mouthful that still has cake in it — skipping
          // straight through any hollow stretch another bug already ate
          const next = findCakeDepth(
            wm.layer, wm.side, wm.ny, sp.biteR * 0.6,
            wm.nx - wm.side * sp.biteR * 1.05
          );
          if (next === null || wm.bites >= sp.bitesPerWorm) wm.state = "leave";
          else wm.nx = next;
        }
      }
    } else if (wm.state === "leave") {
      const exitX = wm.x < env.w / 2 ? -80 : env.w + 80;
      wm.angle = exitX < wm.x ? Math.PI : 0;
      wm.x += Math.sign(exitX - wm.x) * speed * 0.8 * dt;
      if (sp.fly) wm.y -= speed * 0.5 * dt; // fliers soar off
      if (wm.x < -70 || wm.x > env.w + 70 || wm.y < -80) worms.splice(i, 1);
    } else if (wm.state === "flung") {
      wm.vy += env.base * 6 * dt; // gravity
      wm.x += wm.vx * dt;
      wm.y += wm.vy * dt;
      wm.angle += wm.spin * dt;
      if (wm.y > env.h + 100 || wm.x < -150 || wm.x > env.w + 150) worms.splice(i, 1);
    }
  }

  for (const wm of worms) if (wm.dizzy > 0) wm.dizzy -= dt;

  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y += h.vy * dt;
    h.vy *= 0.94;                       // slows as it rises
    h.x += Math.sin(now * 0.004 + h.wob) * env.base * 0.16 * dt;
    h.life -= dt;
    if (h.life <= 0) hearts.splice(i, 1);
  }

  for (let i = crumbs.length - 1; i >= 0; i--) {
    const c = crumbs[i];
    c.vy += env.base * 5 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.life -= dt;
    if (c.life <= 0) crumbs.splice(i, 1);
  }

  wormStats.active = worms.length;
}

function burstCrumbs(x, y, color, size) {
  for (let i = 0; i < 6; i++) {
    crumbs.push({
      x, y,
      vx: (Math.random() - 0.5) * 160,
      vy: -Math.random() * 140,
      s: size * (0.6 + Math.random()),
      life: 0.5 + Math.random() * 0.4,
      color,
    });
  }
}

/* ---------------- photo heads ---------------- */

/**
 * The bugs wear the birthday girl's face. Sources live in
 * assets/ROXPIKMIN/head*.png — circular cutouts produced by
 * tools/build_heads.py (the originals are mostly HEIC, which browsers can't
 * decode, so they have to be converted at build time).
 *
 * Loading is fire-and-forget: bugs draw their hand-sketched heads until the
 * photos arrive, and `headsReady` is part of the sprite cache key so every
 * cached sprite is rebuilt the moment they do.
 */
const HEAD_COUNT = 5;
const heads = [];
let headsReady = 0;

for (let i = 1; i <= HEAD_COUNT; i++) {
  const img = new Image();
  img.onload = () => { heads[i - 1] = img; headsReady++; };
  img.src = `assets/ROXPIKMIN/head${i}.png`;
}

/**
 * Draw a photo head clipped to a circle, with a sketchy rim over the cut so it
 * still belongs in a hand-drawn scene. Returns false if the photos haven't
 * loaded yet, so callers can fall back to drawing a plain head.
 */
function photoHead(ctx, rc, idx, cx, cy, r, pen, L, seed) {
  const img = heads[idx % HEAD_COUNT];
  if (!img) return false;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
  rc.circle(cx, cy, r * 2, rop(pen, L, seed, { strokeWidth: strokeFor(L) * pen.stroke * 1.3 }));
  return true;
}

/* ---------------- sprites ---------------- */

// One shared sprite per (species, size-bucket, skin, boil epoch): bugs wiggle
// at the boil rate for free, and a handful of sprite rebuilds per tick is far
// cheaper than drawing every bug with Rough.js every frame.
const sprites = new Map();

function getSprite(wm, epoch) {
  const L = Math.round(wm.len / 6) * 6;
  const key =
    `${wm.species}|${L}|${wm.skin}|${epoch}|${wm.headIdx}|${headsReady}|${wm.wingPhase}`;
  let s = sprites.get(key);
  if (s) return s;
  if (sprites.size > 40) sprites.clear();
  s = wm.sp.sprite(L, wm.skin, epoch, wm.sp.pen, wm.headIdx, wm.wingPhase);
  sprites.set(key, s);
  return s;
}

// Sprite sheets carry a margin that grows with config.roughness: a rough pen
// wanders well outside the nominal path, and at high settings an exactly-sized
// canvas shears the strokes off at the edges. Drawing is translated into the
// margin, so sprite code keeps using plain content coordinates — but the
// returned anchor has to add `m` to land in canvas pixels.
function newSheet(w, h) {
  const m = Math.max(3, (w + h) * 0.04 * Math.max(1, config.roughness));
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w + m * 2);
  cv.height = Math.ceil(h + m * 2);
  const ctx = cv.getContext("2d");
  ctx.translate(m, m);
  return { cv, ctx, rc: rough.canvas(cv), m };
}

const strokeFor = (L) => Math.max(1.1, L * 0.035) * config.strokeWidth;

// darker tone of a hex colour, for sketch-fill passes over a solid base
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (sh) => Math.round(((n >> sh) & 255) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rop(pen, L, seed, extra = {}) {
  return {
    roughness: config.roughness * pen.rough,
    bowing: config.bowing * pen.bow,
    stroke: OUTLINE,
    strokeWidth: strokeFor(L) * pen.stroke,
    disableMultiStroke: !!pen.single,
    seed: seed >>> 0,
    ...extra,
  };
}

function wormSprite(L, skin, epoch, pen, headIdx) {
  const H = L * 0.6;
  const { cv, ctx, rc, m } = newSheet(L * 1.5, H);
  const pad = L * 0.25;
  const midY = H / 2;
  const phase = epoch * 1.3;

  const segs = 5;
  let hx = 0, hy = 0;
  // inchworm scrunch: the whole body compresses and extends each epoch
  const scrunch = 0.93 + 0.07 * Math.sin(phase * 1.6);
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const x = pad + t * L * 0.92 * scrunch;
    const y = midY + Math.sin(t * 4.2 + phase) * L * 0.07;
    const r = L * (0.1 + 0.06 * t);
    rc.circle(x, y, r * 2, rop(pen, L, epoch * 31 + i * 7 + L, {
      fill: skin, fillStyle: "solid",
    }));
    // dotted speckle in a darker tone over the solid base — solid underneath
    // so the video can't show through the gaps, clipped so the fill can't
    // sprout spikes past the segment's outline
    const clip = new Path2D();
    clip.arc(x, y, r * 0.94, 0, Math.PI * 2);
    ctx.save();
    ctx.clip(clip);
    rc.circle(x, y, r * 2, rop(pen, L, epoch * 31 + i * 7 + L + 3, {
      stroke: "none",
      fill: shade(skin, 0.72),
      fillStyle: "dots",
      hachureGap: L * 0.085,
      fillWeight: strokeFor(L) * 1.1,
    }));
    ctx.restore();
    hx = x;
    hy = y;
  }
  // Pikmin-style: the head is a photo, deliberately oversized so the face
  // still reads when the bug is only a few dozen pixels on screen.
  if (!photoHead(ctx, rc, headIdx, hx + L * 0.06, hy, L * 0.26, pen, L, epoch * 31 + 91)) {
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(hx + L * 0.03, hy - L * 0.05, L * 0.028, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, strokeFor(L) * pen.stroke * 0.8);
    ctx.beginPath();
    ctx.arc(hx + L * 0.05, hy + L * 0.03, L * 0.05, 0.3, Math.PI - 0.5);
    ctx.stroke();
  }

  return { cv, ax: pad + L * 0.5 + m, ay: midY + m };
}

function ladybugSprite(L, skin, epoch, pen, headIdx) {
  const { cv, ctx, rc, m } = newSheet(L * 1.7, L * 1.4);
  const cx = L * 0.72, cy = L * 0.72;
  const sd = (i) => (epoch * 53 + i * 17 + L) >>> 0;

  const ph = epoch * 2.1;
  // legs peeking under the dome, alternating like a scuttle
  for (let i = 0; i < 4; i++) {
    const x = cx - L * 0.34 + i * L * 0.22;
    const swing = Math.sin(ph + i * Math.PI) * L * 0.07;
    rc.line(x, cy + L * 0.3, x - L * 0.09 + swing, cy + L * 0.54,
      rop(pen, L, sd(10 + i), { strokeWidth: strokeFor(L) * 0.8 }));
  }
  // dome + grid shading + wing split + spots
  rc.circle(cx, cy, L * 0.92, rop(pen, L, sd(1), { fill: skin, fillStyle: "solid" }));
  {
    // "grid" = cross-hatch at angle 0: horizontal + vertical passes
    const clip = new Path2D();
    clip.arc(cx, cy, L * 0.44, 0, Math.PI * 2);
    ctx.save();
    ctx.clip(clip);
    rc.circle(cx, cy, L * 0.92, rop(pen, L, sd(6), {
      stroke: "none",
      fill: shade(skin, 0.8),
      fillStyle: "cross-hatch",
      hachureAngle: 0,
      hachureGap: L * 0.16,
      fillWeight: strokeFor(L) * 0.5,
    }));
    ctx.restore();
  }
  rc.line(cx - L * 0.45, cy, cx + L * 0.4, cy, rop(pen, L, sd(2)));
  ctx.fillStyle = OUTLINE;
  for (const [dx, dy, r] of [[-0.2, -0.22, 0.09], [0.12, -0.26, 0.07], [-0.05, 0.24, 0.08], [0.24, 0.18, 0.06]]) {
    ctx.beginPath();
    ctx.arc(cx + dx * L, cy + dy * L, r * L, 0, Math.PI * 2);
    ctx.fill();
  }
  // head + antennae — photo face where the head disc used to be
  if (!photoHead(ctx, rc, headIdx, cx + L * 0.58, cy, L * 0.3, pen, L, sd(3))) {
    rc.circle(cx + L * 0.55, cy, L * 0.36, rop(pen, L, sd(3), { fill: "#5A4238", fillStyle: "solid" }));
  }
  const wag = Math.sin(ph * 1.3) * L * 0.05;
  rc.line(cx + L * 0.66, cy - L * 0.12, cx + L * 0.82, cy - L * 0.3 + wag, rop(pen, L, sd(4), { strokeWidth: strokeFor(L) * 0.7 }));
  rc.line(cx + L * 0.68, cy + L * 0.02, cx + L * 0.88, cy - L * 0.06 - wag, rop(pen, L, sd(5), { strokeWidth: strokeFor(L) * 0.7 }));
  return { cv, ax: cx + L * 0.1 + m, ay: cy + m };
}

function dragonflySprite(L, skin, epoch, pen, headIdx, wingPhase = 0) {
  const { cv, ctx, rc, m } = newSheet(L * 1.5, L * 1.25);
  const cy = L * 0.72;
  const pad = L * 0.15;
  const thoraxX = pad + L * 0.72;
  const sd = (i) => (epoch * 97 + i * 11 + L) >>> 0;

  // tail + segment ticks
  rc.line(pad, cy, pad + L * 0.62, cy, rop(pen, L, sd(1), { stroke: skin, strokeWidth: L * 0.07 }));
  for (let i = 0; i < 3; i++) {
    const x = pad + L * (0.12 + i * 0.17);
    rc.line(x, cy - L * 0.05, x, cy + L * 0.05, rop(pen, L, sd(10 + i), { strokeWidth: strokeFor(L) * 0.7 }));
  }
  // Wings alternate hard between up and down on consecutive epochs — the
  // classic two-frame trick for fast wings in hand-drawn animation. The old
  // sin(epoch * 2.4) ran at ~2.7 cycles/sec sampled at only 7 (the boil rate),
  // so it aliased into jitter instead of reading as a flap. Two frames sit
  // exactly on the boil grid, so it can't alias.
  const flap = (epoch + wingPhase) % 2 === 0 ? 0.5 : -0.5;
  ctx.globalAlpha = 0.62;
  for (const rot of [-0.55 + flap, -0.15 - flap]) {
    ctx.save();
    ctx.translate(thoraxX, cy - L * 0.06);
    ctx.rotate(rot);
    rc.ellipse(-L * 0.26, -L * 0.16, L * 0.58, L * 0.17,
      rop(pen, L, sd(20 + rot * 100), {
        fill: "#DCEBFA",
        fillStyle: "hachure",           // tight hachure reads as wing veins
        hachureGap: L * 0.05,
        fillWeight: strokeFor(L) * 0.45,
        hachureAngle: 25 + rot * 40,
        strokeWidth: strokeFor(L) * pen.stroke,
      }));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // thorax + head + eyes
  rc.circle(thoraxX, cy, L * 0.2, rop(pen, L, sd(2), { fill: skin, fillStyle: "solid" }));
  if (!photoHead(ctx, rc, headIdx, pad + L * 0.95, cy, L * 0.19, pen, L, sd(3))) {
    rc.circle(pad + L * 0.88, cy, L * 0.17, rop(pen, L, sd(3), { fill: skin, fillStyle: "solid" }));
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.arc(pad + L * 0.93, cy - L * 0.05, L * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }

  return { cv, ax: thoraxX - L * 0.1 + m, ay: cy + m };
}

function antSprite(L, skin, epoch, pen, headIdx) {
  const { cv, ctx, rc, m } = newSheet(L * 1.5, L * 0.95);
  const cy = L * 0.5;
  const pad = L * 0.12;
  const sd = (i) => (epoch * 41 + i * 19 + L) >>> 0;

  // legs from the thorax, swinging alternately like a march
  const ph = epoch * 2.3;
  for (let i = 0; i < 3; i++) {
    const x = pad + L * (0.5 + i * 0.1);
    const swing = Math.sin(ph + i * Math.PI) * L * 0.09;
    rc.line(x, cy, x - L * 0.12 + i * L * 0.12 + swing, cy + L * 0.34,
      rop(pen, L, sd(10 + i), { strokeWidth: strokeFor(L) * 0.7 }));
  }
  // abdomen, thorax, head — solid base with a dotted-speckle pass on top
  const parts = [
    [pad + L * 0.24, cy, L * 0.4],
    [pad + L * 0.58, cy - L * 0.02, L * 0.23],
    [pad + L * 0.85, cy, L * 0.29],
  ];
  for (let i = 0; i < parts.length; i++) {
    const [px, py, d] = parts[i];
    // parts[2] is the head — photo goes there instead of a shaded disc
    if (i === 2 && photoHead(ctx, rc, headIdx, px + L * 0.05, py, L * 0.24, pen, L, sd(9))) continue;
    rc.circle(px, py, d, rop(pen, L, sd(i + 1), { fill: skin, fillStyle: "solid" }));
    const clip = new Path2D();
    clip.arc(px, py, d * 0.45, 0, Math.PI * 2);
    ctx.save();
    ctx.clip(clip);
    rc.circle(px, py, d, rop(pen, L, sd(i + 30), {
      stroke: "none",
      fill: shade(skin, 0.68),
      fillStyle: "cross-hatch",
      hachureGap: L * 0.11,
      fillWeight: strokeFor(L) * 0.55,
    }));
    ctx.restore();
  }
  // antennae, waggling out of phase
  const awag = Math.sin(ph * 1.1) * L * 0.06;
  rc.line(pad + L * 0.94, cy - L * 0.12, pad + L * 1.1, cy - L * 0.3 + awag, rop(pen, L, sd(4), { strokeWidth: strokeFor(L) * 0.6 }));
  rc.line(pad + L * 0.98, cy - L * 0.06, pad + L * 1.18, cy - L * 0.16 - awag, rop(pen, L, sd(5), { strokeWidth: strokeFor(L) * 0.6 }));
  return { cv, ax: pad + L * 0.55 + m, ay: cy + m };
}

/* ---------------- reaction sprites ---------------- */

/**
 * Stars and hearts are STROKE-ONLY — a yellow star outline, a pink heart
 * outline, no fill at all.
 *
 * The wobble is still baked into the geometry (every vertex and control point
 * gets a seeded offset) rather than left entirely to Rough.js, because its own
 * jitter is in absolute pixels: one setting that suits a big heart mangles a
 * small star. A proportional offset looks the same at every size.
 */
// Vertex jitter, as a fraction of the shape's radius. Per-shape, because a
// heart is one chunky blob that survives a lot of mangling, while a star's
// points are thin — the same jitter turns it into an unreadable smear.
const FX_WOBBLE = { star: 0.18, heart: 0.3 };

// Seeded RNG so a given sprite's wobble is identical every time it's rebuilt
// at the same epoch (cake.js has its own copy; it isn't exported).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function starPath(r, rnd) {
  const wob = FX_WOBBLE.star;
  const j = () => (rnd() - 0.5) * 2 * r * wob;
  let d = "";
  for (let i = 0; i < 10; i++) {
    // fat inner radius (0.52) so the points stay chunky enough to survive
    const rad = (i % 2 ? r * 0.52 : r) * (1 + (rnd() - 0.5) * wob);
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + (rnd() - 0.5) * wob * 0.5;
    const x = Math.cos(a) * rad + j() * 0.3;
    const y = Math.sin(a) * rad + j() * 0.3;
    d += (i ? " L " : "M ") + x.toFixed(2) + " " + y.toFixed(2);
  }
  return d + " Z";
}

function heartPath(r, rnd) {
  const j = () => (rnd() - 0.5) * 2 * r * FX_WOBBLE.heart;
  const P = (x, y) => `${(x + j()).toFixed(2)} ${(y + j()).toFixed(2)}`;
  return (
    `M ${P(0, r * 0.9)}` +
    ` C ${P(-r * 1.35, -r * 0.12)} ${P(-r * 0.6, -r * 1.1)} ${P(0, -r * 0.36)}` +
    ` C ${P(r * 0.6, -r * 1.1)} ${P(r * 1.35, -r * 0.12)} ${P(0, r * 0.9)} Z`
  );
}

// Same cache-by-epoch trick the bugs use, so these wobble with the boil and
// cost a couple of sprite builds per tick rather than Rough.js every frame.
const fx = new Map();
function fxSprite(kind, r, epoch) {
  const R = Math.max(6, Math.round(r / 2) * 2);
  const key = `${kind}|${R}|${epoch}`;
  let s = fx.get(key);
  if (s) return s;
  if (fx.size > 30) fx.clear();

  const pad = R * (0.9 + Math.max(FX_WOBBLE.star, FX_WOBBLE.heart) * 2);
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.ceil(R * 2 + pad * 2);
  const ctx = cv.getContext("2d");
  ctx.translate(cv.width / 2, cv.height / 2);
  const rc = rough.canvas(cv);
  const seed = (epoch * 17 + R * 31) >>> 0;
  const rnd = mulberry32(seed);
  // Stroke only: no fill, and a chunky pen so the outline still reads at bug
  // scale. maxRandomnessOffset is tied to the radius because Rough.js measures
  // it in absolute pixels — untethered, it wrecks the small ones.
  rc.path(kind === "star" ? starPath(R, rnd) : heartPath(R, rnd), {
    roughness: 1.8,
    bowing: config.bowing * 1.4,
    maxRandomnessOffset: R * 0.09,
    stroke: kind === "star" ? "#FFD75E" : "#FF6B9D",
    strokeWidth: Math.max(2, R * 0.17),
    fill: undefined, // no fill
    seed,
  });

  s = { cv, a: cv.width / 2 };
  fx.set(key, s);
  return s;
}

/* ---------------- drawing ---------------- */

export function drawWorms(ctx) {
  for (const c of crumbs) {
    ctx.globalAlpha = Math.max(0, Math.min(1, c.life * 2.2));
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.s, c.s);
  }
  ctx.globalAlpha = 1;

  const epoch = config.boil > 0 ? Math.floor((performance.now() / 1000) * config.boil) : 0;
  const now = performance.now();

  // hearts drift up from whoever just got a mouthful
  for (const h of hearts) {
    const s = fxSprite("heart", h.size, epoch);
    ctx.globalAlpha = Math.max(0, Math.min(1, h.life * 1.6));
    ctx.drawImage(s.cv, h.x - s.a, h.y - s.a);
  }
  ctx.globalAlpha = 1;

  for (const wm of worms) {
    const s = getSprite(wm, epoch);
    ctx.save();
    ctx.translate(wm.x, wm.y + wm.bobOff);
    ctx.rotate(wm.angle + (wm.rock || 0));
    // keep the face upright when travelling leftward (flung bugs may tumble)
    if (Math.cos(wm.angle) < 0 && wm.state !== "flung") ctx.scale(1, -1);
    ctx.drawImage(s.cv, -s.ax, -s.ay);
    ctx.restore();

    // Dizzy stars ride ABOVE the bug in screen space — they must not inherit
    // the tumble, or they'd whirl around with it instead of reading as
    // "seeing stars". The squashed orbit sells it as a ring seen edge-on.
    if (wm.dizzy > 0) {
      const orbit = wm.len * 0.45;
      const cy = wm.y - wm.len * 0.6;
      const spin = now * 0.007;
      ctx.globalAlpha = Math.min(1, wm.dizzy * 1.4);
      for (let i = 0; i < STAR_COUNT; i++) {
        const a = spin + (i * Math.PI * 2) / STAR_COUNT;
        const depth = 0.72 + 0.28 * Math.sin(a); // nearer stars draw bigger
        const st = fxSprite("star", wm.len * 0.15 * depth, epoch);
        ctx.drawImage(
          st.cv,
          wm.x + Math.cos(a) * orbit - st.a,
          cy + Math.sin(a) * orbit * 0.34 - st.a
        );
      }
      ctx.globalAlpha = 1;
    }
  }
}
