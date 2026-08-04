import rough from "https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.esm.js";

/* ------------------------------------------------------------------ *
 *  Cake tiers — hand-drawn with Rough.js, shared by the live app
 *  (main.js) and the no-camera dev harness (preview.html).
 *
 *  Each tier rides one pair of MediaPipe pose landmarks and reaches
 *  down to the NEXT pair, so the tiers always meet with no dead space:
 *
 *    top    ears      7,8   ->  shoulders 11,12
 *    middle shoulders 11,12 ->  hips      23,24
 *    bottom hips      23,24 ->  knees     25,26
 *
 *  Those midpoints double as hinge pins — see `config.hinge`.
 *
 *  The top tier is worn as a MASK: it rises above its pin to clear the
 *  head, and a face-shaped hole is punched clean through it so the
 *  player's real face shows through from the video underneath.
 *
 *  Because tiers are drawn procedurally rather than sliced out of a
 *  bitmap, a tier is simply built to whatever height it needs. The cap,
 *  pearls and candles are sized off the tier's WIDTH, so they keep their
 *  proportions while only the body's length changes. (The old 3-slice
 *  band system, and its rule that the stretched band could hold no
 *  horizontal detail, is gone — nothing here is ever stretched.)
 * ------------------------------------------------------------------ */

const OUTLINE = "#4A2C17";
// declared up here because LAYERS below references it
const ICING_FAMILY = '"Flavors"';
const CREAM = "#FFF8EE";
const SPRINKLES = ["#FF6B9D", "#6C8CFF", "#FFC93C", "#3FC98A", "#9B5DE5"];

export const LAYERS = [
  {
    key: "bottom",
    pair: [23, 24],
    next: [25, 26],
    prev: [11, 12], // used to aim the tier when the knees are out of frame
    widthMul: 1.6,
    fallbackSpanMul: 1.15,
    body: "#A8E6CF",
    pipe: "#7FD3B2",
    hachureAngle: -41,
    board: true,
    candles: 0,
    text: ["FROM WINGPIKMIN <3"],
    textFont: ICING_FAMILY,
  },
  {
    key: "middle",
    pair: [11, 12],
    next: [23, 24],
    prev: [7, 8],
    widthMul: 1.3,
    fallbackSpanMul: 1.15,
    body: "#FFC2D6",
    pipe: "#FF9CBE",
    hachureAngle: 34,
    board: false,
    candles: 0,
    text: ["HAPPY", "BIRTHDAY", "ROXPIKMIN"],
    textFont: ICING_FAMILY,
  },
  {
    key: "top",
    pair: [7, 8], // ears — head position and head tilt
    next: [11, 12],
    prev: null,
    // The mask is sized off the FACE, not off shoulder width, so the whole
    // thing shrinks with the face instead of only its hole shrinking inside a
    // fixed-size cake. maxWidthMul stops a proportionally large head (kids)
    // making the mask wider than the tier below it and inverting the taper.
    faceWidthMul: 2.2,
    // Must stay below the middle tier's widthMul (1.3) or a large head clamps
    // the mask to exactly the tier below it and the taper flattens out.
    maxWidthMul: 1.2,
    fallbackSpanMul: 1.0,
    body: "#FFE3A0",
    pipe: "#FFCD62",
    hachureAngle: 72,
    board: false,
    candles: 3,
    // Worn as a mask: a face-shaped hole is punched through it, and `riseMul`
    // lifts the tier above its pin so there's cake over the forehead rather
    // than a slab across the eyes.
    mask: true,
    riseMul: 1.5,
  },
];

/**
 * hinge — how hard each tier swings to point at the next joint, 0..1.
 *
 * Every tier's top is pinned exactly at its own landmark midpoint, and those
 * midpoints are the hinge pins. What's left to decide is each tier's ANGLE,
 * and the two things we want from it are in direct conflict:
 *
 *   0 = angle comes purely from the tier's own landmark pair. Tiers roll with
 *       your shoulders/hips/knees, but neither end aims at the next pin, so
 *       under a twist they slide past each other instead of hinging.
 *   1 = angle comes purely from the pin-to-pin direction. A true articulated
 *       chain, but the pair rotation stops mattering at all.
 *
 * boil — times per second the sketch is redrawn with fresh randomness, for
 * that hand-animated wobble. 0 holds the lines perfectly still. This is also
 * the main cost knob: a full redraw is ~20ms of Rough.js geometry, so keep it
 * well under frame rate. Between boils the tiers are cached bitmaps.
 *
 * fillStyle — how the coloured part of each tier is filled. Rough.js offers
 * "hachure" | "zigzag" | "cross-hatch" | "dots" | "dashed" | "zigzag-line"
 * | "solid". Anything but "solid" leaves gaps, which is why the body is drawn
 * as a solid pass with the sketch pass on top (see buildTier).
 */
export const config = {
  hinge: 0.7,
  boil: 7,
  roughness: 3.2,   // how shaky the pen is (0 = ruler, 3 = espresso overdose)
  bowing: 2.8,      // how much straight lines bow
  strokeWidth: 0.5, // multiplier on every outline/pen width
  fillStyle: "zigzag", // "hachure" | "zigzag" | "cross-hatch" | "dots"
};

// Tiers overrun slightly into each other so rotation differences can't crack a
// seam open. Keep this small: most of the seam hiding comes from the lower tier
// drawing in front (see drawCake), and a large overrun buries each tier's
// pearl border behind the cap below it.
const SPAN_OVERLAP = 1.03;

/* ---------------- shape helpers ---------------- */

// Deterministic RNG so a tier's drips/sprinkles stay put between redraws.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return (
    `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r}` +
    ` V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h}` +
    ` H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r}` +
    ` V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`
  );
}

/**
 * The icing's lower edge: one continuous smooth wave, walked right-to-left.
 *
 * Each half-period gets its own wavelength and amplitude, so it reads as an
 * irregular sine rather than a repeating scallop. Every segment is a single
 * cubic whose control points sit at 4/3 of the target amplitude — a cubic with
 * both handles at height `k` peaks at 0.75k, so 4/3 lands the crest exactly on
 * the amplitude we asked for.
 *
 * Endpoints all sit on the centreline, which keeps the joins between segments
 * tangent-continuous (no visible corner where two half-periods meet).
 */
function icingWave(xRight, xLeft, yMid, amp, rnd) {
  const span = xRight - xLeft;
  let d = "";
  let x = xRight;
  let dir = 1; // 1 dips below the centreline, -1 rises above it

  while (x - xLeft > span * 0.02) {
    let L = span * (0.11 + rnd() * 0.17);
    // Absorb a runt tail into this segment rather than leaving a stub.
    if (x - L - xLeft < span * 0.07) L = x - xLeft;
    const a = amp * (0.55 + rnd() * 0.85) * dir;
    const cy = yMid + (4 * a) / 3;
    d += ` C ${x - L / 3} ${cy} ${x - (2 * L) / 3} ${cy} ${x - L} ${yMid}`;
    x -= L;
    dir *= -1;
  }
  return d;
}

// Frosting cap as ONE path — its wavy underside has to be part of the same
// outline, or the cap's own edge would run visibly across the top of it.
function capPath(x0, x1, yTop, yMid, r, wave) {
  return (
    `M ${x0} ${yTop + r} Q ${x0} ${yTop} ${x0 + r} ${yTop}` +
    ` H ${x1 - r} Q ${x1} ${yTop} ${x1} ${yTop + r}` +
    ` V ${yMid}` +
    wave +
    ` Z`
  );
}

function flamePath(cx, base, h) {
  const w = h * 0.42;
  return (
    `M ${cx} ${base - h}` +
    ` C ${cx + w} ${base - h * 0.45} ${cx + w * 0.85} ${base} ${cx} ${base}` +
    ` C ${cx - w * 0.85} ${base} ${cx - w} ${base - h * 0.45} ${cx} ${base - h} Z`
  );
}

/* ---------------- icing font ---------------- *
 * Flavors is bundled in assets/fonts and registered here rather than in a
 * stylesheet, because preview.html has its own inline CSS and would otherwise
 * silently fall back — cake.js owns its own font dependency.
 *
 * Canvas doesn't wait for webfonts — text drawn before they load silently uses
 * the fallback — so `fontsReady` gates into the tier cache key and every tier
 * rebuilds once the face arrives.
 */
const FALLBACK_FONT = '"Chalkboard SE", "Marker Felt", "Comic Sans MS", ui-rounded, system-ui, sans-serif';
export let fontsReady = 0;

if (typeof document !== "undefined" && !document.getElementById("cake-fonts")) {
  const st = document.createElement("style");
  st.id = "cake-fonts";
  st.textContent = `
    @font-face { font-family: "Flavors"; src: url("assets/fonts/Flavors-Regular.ttf") format("truetype"); font-weight: normal; font-display: block; }
  `;
  document.head.appendChild(st);

  document.fonts
    .load(`40px ${ICING_FAMILY}`)
    .then(() => { fontsReady = 1; })
    .catch(() => { fontsReady = 1; }); // fall back rather than never drawing text
}

/**
 * Piped-icing lettering, drawn letter by letter.
 *
 * Canvas has no hand-drawn text and Rough.js can't stroke a font, so the wobble
 * is faked the way real piping looks: every character gets its own small offset
 * and rotation, then a dark outline under a cream fill. Placement uses the
 * LAYOUT rng (stable across boils) — letters that danced every tick would be
 * unreadable, unlike the outlines where the wobble is the point.
 *
 * Sizes come off the tier's WIDTH, so the message stays put as the player's
 * torso stretches and squashes; it only shrinks if the body gets too short.
 */
function drawIcingText(ctx, lines, w, top, bottom, stroke, rnd, family) {
  const avail = bottom - top;
  if (!lines?.length || avail < w * 0.18) return; // no room — skip rather than squash

  // These faces ship one weight each; asking for 700 would just trigger the
  // browser's synthetic bold and smear the letterforms.
  const stack = `${family ? family + ", " : ""}${FALLBACK_FONT}`;
  const maxW = w * 0.8;
  let size = Math.min(w * 0.17, (avail / lines.length) * 0.72);
  ctx.font = `${size}px ${stack}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > maxW) {
    size *= maxW / widest;
    ctx.font = `${size}px ${stack}`;
  }

  const lineH = size * 1.12;
  const blockTop = (top + bottom) / 2 - (lines.length - 1) * lineH / 2;

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;
  // Thin outline: just enough to separate the letters from the tier colour.
  // A heavy one clogs the counters of a display face at cake scale.
  ctx.lineWidth = Math.max(1, stroke * 1.1);
  ctx.fillStyle = CREAM;

  lines.forEach((line, li) => {
    const chars = [...line];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    const y = blockTop + li * lineH;
    for (let i = 0; i < chars.length; i++) {
      const cw = widths[i];
      ctx.save();
      ctx.translate(x + cw / 2 + (rnd() - 0.5) * size * 0.07,
                    y + (rnd() - 0.5) * size * 0.13);
      ctx.rotate((rnd() - 0.5) * 0.16);
      ctx.strokeText(chars[i], -cw / 2, 0);
      ctx.fillText(chars[i], -cw / 2, 0);
      ctx.restore();
      x += cw;
    }
  });
  ctx.restore();
}

/* ---------------- tier rendering ---------------- */

// Rough.js costs ~0.3ms per shape and a tier is ~25 shapes, so tiers are drawn
// into an offscreen canvas and only rebuilt when their size changes or the boil
// ticks. Per frame we then just blit three bitmaps.
function buildTier(layer, w, h, hole, seed) {
  // Two independent randomness streams, and the split matters:
  //   rnd — LAYOUT (icing wavelengths, sprinkle placement). Seeded per tier
  //         only, so the cake keeps its shape across boils.
  //   sd  — Rough.js STROKE jitter. Seeded off `seed`, which carries the boil
  //         epoch, so the pen is re-drawn each tick.
  // Sharing one stream would re-roll the icing outline 7 times a second, which
  // reads as the cake writhing rather than as a hand-drawn wobble.
  const rnd = mulberry32((layer.key.charCodeAt(0) * 2654435761) >>> 0);
  const sd = (i) => seed + i * 7919;

  const capH = w * 0.2;
  const waveAmp = w * 0.115;
  const pearlR = w * 0.045;
  const stroke = Math.max(1.6, w * 0.017) * config.strokeWidth;

  // The mask tier starts above its pin so there's cake over the forehead;
  // everything else starts at the pin, so rise is 0 and the layout is unchanged.
  const rise = layer.mask && hole > 0 ? hole * layer.riseMul : 0;
  const capTop = -rise;
  // Body colour runs all the way up behind the cap. The icing wave's crests
  // rise well above the cap's midline, and if the body starts below them the
  // background peeks through in the arcs under each crest. Starting just a
  // hair below capTop (not exactly at it) keeps the body's rough top edge from
  // wobbling out above the cap's own edge.
  const bodyTop = capTop + capH * 0.15;

  const holeRx = hole * HOLE_RX;
  const holeRy = hole * HOLE_RY;
  const holeCy = hole * HOLE_CY;

  const candleH = layer.candles ? w * 0.44 : 0;
  const flameH = layer.candles ? w * 0.17 : 0;

  // Pads scale with roughness for the same reason the bug sprites do: a rough
  // pen strays well outside the nominal path, and a tight bitmap shears the
  // outline off at the edges.
  const slop = w * 0.03 * Math.max(1, config.roughness);
  const padX = w * 0.14 + slop;
  const padT = rise + (layer.candles ? candleH + flameH + w * 0.14 : w * 0.06) + slop;
  const padB = w * 0.16 + slop;

  const cv = layer._cv || (layer._cv = document.createElement("canvas"));
  cv.width = Math.ceil(w + padX * 2);
  cv.height = Math.ceil(padT + h + padB);
  layer._ox = padX + w / 2; // where the hinge pin sits inside the bitmap
  layer._oy = padT;

  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.translate(layer._ox, layer._oy); // origin = hinge pin, +Y down the cake

  const rc = rough.canvas(cv);
  const base = {
    roughness: config.roughness,
    bowing: config.bowing,
    stroke: OUTLINE,
    strokeWidth: stroke,
    fillStyle: "solid",
  };

  // cake board, behind everything
  if (layer.board) {
    rc.ellipse(0, h + pearlR * 0.3, w * 1.14, w * 0.13, {
      ...base, fill: "#E7D3B7", seed: sd(1),
    });
  }

  // ===== body: solid base, sketch fill over it, then the outline =====
  // Three passes rather than one. The sketch fill leaves gaps, and the cake is
  // composited over live video, so on its own the webcam would show through
  // between every stroke. The solid pass underneath makes the tier opaque.
  const bodyPath = roundRect(-w / 2, bodyTop, w, h - bodyTop, w * 0.06);

  rc.path(bodyPath, {
    roughness: config.roughness, bowing: config.bowing,
    stroke: "none", fill: layer.body, fillStyle: "solid", seed: sd(2),
  });
  // Clipped: Rough.js roughens fill strokes past the path boundary, so an
  // unclipped hachure sprouts spikes out of the cake's sides.
  ctx.save();
  ctx.clip(new Path2D(bodyPath));
  rc.path(bodyPath, {
    roughness: config.roughness, bowing: config.bowing,
    stroke: "none",
    fill: layer.pipe,
    fillStyle: config.fillStyle,
    hachureAngle: layer.hachureAngle, // varied per tier so they don't look stamped
    // dots need a tighter grid and lighter weight or the fill reads as sparse
    // polka dots instead of a texture
    hachureGap: config.fillStyle === "dots" ? w * 0.045 : w * 0.07,
    fillWeight: config.fillStyle === "dots" ? stroke * 0.7 : stroke * 0.9,
    seed: sd(4),
  });
  ctx.restore();

  rc.path(bodyPath, { ...base, fill: undefined, seed: sd(2) });

  // frosting cap + drips
  const cx0 = -w / 2 - w * 0.035;
  const cx1 = w / 2 + w * 0.035;
  rc.path(
    capPath(cx0, cx1, capTop, capTop + capH, capH * 0.42,
            icingWave(cx1, cx0, capTop + capH, waveAmp, rnd)),
    { ...base, fill: CREAM, seed: sd(3) }
  );

  // sprinkles on the cap
  for (let i = 0; i < 5; i++) {
    const sx = -w / 2 + w * (0.1 + 0.19 * i) + w * 0.04 * (rnd() - 0.5);
    const sy = capTop + capH * (0.25 + rnd() * 0.4);
    const ang = (rnd() - 0.5) * 2.2;
    const len = w * 0.05;
    rc.line(
      sx - Math.cos(ang) * len, sy - Math.sin(ang) * len,
      sx + Math.cos(ang) * len, sy + Math.sin(ang) * len,
      {
        roughness: config.roughness,
        stroke: SPRINKLES[i % SPRINKLES.length],
        strokeWidth: stroke * 1.3,
        seed: sd(30 + i),
      }
    );
  }

  // Piped pearl border. Sits a full diameter up from the tier's bottom edge:
  // that edge lands on the next tier's hinge pin, and the next tier's cap is
  // drawn in front from that pin downwards, so pearls any lower get swallowed.
  const pn = Math.max(4, Math.round(w / (pearlR * 2.1)));
  for (let i = 0; i < pn; i++) {
    const px = -w / 2 + pearlR + ((w - pearlR * 2) * i) / (pn - 1);
    rc.circle(px, h - pearlR * 1.9, pearlR * 2, {
      ...base, fill: CREAM, strokeWidth: stroke * 0.8, seed: sd(50 + i),
    });
  }

  // candles, above the pin
  if (layer.candles) {
    const cols = ["#FF8FA3", "#8FD9FF", "#B9F0C9"];
    const cw = w * 0.075;
    for (let i = 0; i < layer.candles; i++) {
      const cx = (i - (layer.candles - 1) / 2) * w * 0.21;
      const tall = i === 1 ? w * 0.1 : 0;
      const bot = capTop + capH * 0.5;
      const top = bot - candleH - tall;
      rc.path(roundRect(cx - cw / 2, top, cw, bot - top, cw * 0.3), {
        ...base, fill: cols[i % cols.length], strokeWidth: stroke * 0.9, seed: sd(70 + i),
      });
      rc.line(cx, top, cx, top - w * 0.035, {
        roughness: config.roughness, stroke: OUTLINE,
        strokeWidth: stroke * 0.8, seed: sd(80 + i),
      });
      rc.path(flamePath(cx, top - w * 0.03, flameH), {
        ...base, fill: "#FFC93C", strokeWidth: stroke * 0.8, seed: sd(90 + i),
      });
    }
  }

  // Message goes on before the hole and the bites, so worms chew through the
  // lettering along with the cake.
  if (layer.text) {
    drawIcingText(ctx, layer.text, w, capTop + capH * 1.15, h - pearlR * 2.4, stroke, rnd, layer.textFont);
  }

  // ===== the face hole =====
  // Punched last, so it cuts through the body, piping and pearls in one go —
  // masking each shape as it was drawn would be far more code and would still
  // leave the pearls poking into the opening.
  if (layer.mask && hole > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(0, holeCy, holeRx, holeRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Just a sketchy line around the cut so it reads as drawn, not punched —
    // no cream collar; the cake's own colour runs right up to the opening.
    rc.ellipse(0, holeCy, holeRx * 2, holeRy * 2, {
      roughness: config.roughness,
      bowing: config.bowing,
      stroke: OUTLINE,
      strokeWidth: stroke,
      seed: sd(121),
    });
  }

  // ===== worm bites =====
  // Punched after everything else so a bite cuts through cap, body and pearls
  // alike. Three stacked circles per bite give the classic scalloped cartoon
  // nibble instead of a clean round hole.
  if (layer.bites?.length) {
    const firstOutlined = Math.max(0, layer.bites.length - OUTLINED_BITES);
    for (let bi = 0; bi < layer.bites.length; bi++) {
      const b = layer.bites[bi];
      const bx = b.nx * w;
      const by = b.ny * h;
      const br = b.r * w;

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (const [k, kr] of [[-0.8, 0.6], [0, 1], [0.8, 0.6]]) {
        ctx.beginPath();
        ctx.arc(bx, by + k * br, br * kr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Sketchy nibble edge, drawn source-atop so the stroke only lands on
      // surviving cake pixels — an unclipped circle floats as a full ring
      // over the empty space where the bite used to be.
      if (bi >= firstOutlined) {
        ctx.save();
        ctx.globalCompositeOperation = "source-atop";
        rc.circle(bx, by, br * 2, {
          roughness: config.roughness * 1.2,
          bowing: config.bowing,
          stroke: OUTLINE,
          strokeWidth: stroke * 0.8,
          seed: sd(140 + bi),
        });
        ctx.restore();
      }
    }
  }

  ctx.restore();
  return cv;
}

/* ---------------- loading ---------------- */

// Nothing to fetch any more (the cake is drawn, not loaded) — kept async so
// callers don't have to change.
export async function loadLayers() {
  for (const layer of LAYERS) {
    layer.state = null;
    layer._key = null;
    layer.bites = [];
    layer._biteRev = 0;
  }
  return LAYERS;
}

/**
 * Register a worm bite. Coordinates are FRACTIONS of the tier's current size
 * (nx of width, from the centre; ny of height, from the pin; r of width) so
 * bites stay glued to the cake and scale with it as the player moves — a bite
 * stored in pixels would drift off the tier the moment they stepped back.
 */
export function addBite(layer, nx, ny, r) {
  const bites = (layer.bites ??= []);
  const rr = r * (0.8 + Math.random() * 0.5);

  // A bite that lands entirely inside an already-eaten patch changes no
  // pixels — don't store it. With no cap on total damage, an endless worm
  // parade would otherwise grow this list (and the tier rebuild cost) forever.
  const s = layer.state;
  const hr = s ? s.height / s.width : 1;
  for (const b of bites) {
    if (Math.hypot(nx - b.nx, (ny - b.ny) * hr) + rr * 0.55 < b.r) return false;
  }

  bites.push({ nx, ny, r: rr });
  layer._biteRev = (layer._biteRev ?? 0) + 1;
  return true;
}

// Only the newest bites get the sketchy edge treatment: older bites' rims have
// mostly been chewed away by later overlapping punches anyway, and the rough
// circles are the expensive part of a bite (the punches are nearly free).
const OUTLINED_BITES = 24;

// Face-hole geometry, relative to ear-to-ear width. A near-circle (not a tall
// oval) reads like a porthole cut in the cake; kept snug so it frames the face
// rather than swallowing the head plus a margin of background. Shared between
// buildTier (which punches it) and hasCakeAt (which treats it as eaten).
const HOLE_RX = 0.56;
const HOLE_RY = 0.58;
const HOLE_CY = 0.12; // ears sit at eye level; the face centres lower

/**
 * How far above its pin a tier's cake starts, and how far below it ends, as
 * fractions of the tier's height — i.e. the ny range that actually has cake.
 * The mask tier rises well ABOVE its pin (cake over the forehead, then the
 * candles), so its range starts negative; every other tier starts at 0.
 */
export function tierNyRange(layer) {
  const s = layer.state;
  if (!s) return [0, 1];
  const rise = layer.mask && s.hole > 0 ? s.hole * layer.riseMul : 0;
  return [-rise / s.height, 1];
}

/**
 * Is there still cake at (nx, ny) on this tier? Checks the recorded bites
 * and, on the mask tier, the face hole. Same fractional coordinates as bites.
 *
 * The bite test mirrors the THREE overlapping circles buildTier actually
 * punches (a scalloped nibble, ~1.4r tall against r wide). Testing a single
 * r-radius circle under-reports the eaten area at the top and bottom of every
 * bite, which is how bugs ended up chewing on holes that were already there.
 */
export function hasCakeAt(layer, nx, ny) {
  const s = layer.state;
  if (!s) return false;
  const hr = s.height / s.width; // ny is a height fraction; convert to width units

  for (const b of layer.bites ?? []) {
    const dx = nx - b.nx;
    const dy = (ny - b.ny) * hr;
    const r = b.r * 0.95; // slight inset so bugs aim at solid cake, not the rim
    if (Math.hypot(dx, dy) < r) return false;
    if (Math.hypot(dx, dy + b.r * 0.8) < r * 0.6) return false;
    if (Math.hypot(dx, dy - b.r * 0.8) < r * 0.6) return false;
  }

  if (layer.mask && s.hole > 0) {
    const px = nx * s.width;
    const py = ny * s.height;
    const dx = px / (s.hole * HOLE_RX);
    const dy = (py - s.hole * HOLE_CY) / (s.hole * HOLE_RY);
    if (dx * dx + dy * dy < 1.1) return false;
  }
  return true;
}

/**
 * Scan inward from `fromNx` toward the far edge and return the first depth
 * where cake still exists at height `ny`, or null if that whole channel is
 * gone. This is how worms find something real to chew instead of gumming air
 * inside a tunnel some earlier worm already ate.
 */
export function findCakeDepth(layer, side, ny, step = 0.05, fromNx = side * 0.5) {
  for (let nx = fromNx; nx * side >= -0.5; nx -= side * step) {
    if (hasCakeAt(layer, nx, ny)) return nx;
  }
  return null;
}

/* ---------------- layout ---------------- */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function midpoint(pts, [i, j]) {
  const a = pts[i];
  const b = pts[j];
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: ((a.v ?? 1) + (b.v ?? 1)) / 2 };
}

/**
 * Overall cake size reference. Deliberately NOT each tier's own landmark
 * distance — shoulders read wider than knees on screen, so that would give
 * you an upside-down cake. Falls back to hip width / torso length when the
 * player turns sideways and the shoulders collapse together.
 */
export function computeBase(pts) {
  const sh = pts[11] && pts[12] ? dist(pts[11], pts[12]) : 0;
  const hip = pts[23] && pts[24] ? dist(pts[23], pts[24]) : 0;
  const torso = pts[11] && pts[23] ? dist(pts[11], pts[23]) : 0;
  return Math.max(sh, hip * 1.15, torso * 0.62, 60);
}

// Blend two angles the short way round, not through 359°.
export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function visible(pts, pair, minVisibility) {
  if (!pair || !pts[pair[0]] || !pts[pair[1]]) return false;
  return ((pts[pair[0]].v ?? 1) + (pts[pair[1]].v ?? 1)) / 2 >= minVisibility;
}

// Eye-line to mouth-line, expressed as an equivalent head width. Roughly
// 145mm bitragion / 65mm eye-to-mouth on an adult.
const EYE_MOUTH_TO_WIDTH = 2.2;

/**
 * How big the player's face is on screen, in head-width units.
 *
 * Ear-to-ear alone is not enough: it is a purely horizontal measure, so it
 * collapses as the head turns (90px frontal -> 27px at ~70° yaw) even though
 * the face is still nearly the same size on screen. That would shrink the hole
 * to nothing and bury the face in cake mid-turn.
 *
 * The eye-to-mouth distance is a vertical measure, so yaw leaves it alone.
 * Taking the max means whichever measure is currently un-foreshortened wins,
 * and the two agree when facing the camera so there's no jump between them.
 */
function faceSpan(pts, minVisibility, base) {
  let width = 0;
  if (visible(pts, [7, 8], minVisibility)) width = dist(pts[7], pts[8]);

  if (visible(pts, [2, 5], minVisibility) && visible(pts, [9, 10], minVisibility)) {
    const eyes = midpoint(pts, [2, 5]);
    const mouth = midpoint(pts, [9, 10]);
    width = Math.max(width, dist(eyes, mouth) * EYE_MOUTH_TO_WIDTH);
  }

  // Nothing measurable — fall back to a typical head:shoulder ratio rather
  // than 0, which would punch no hole at all and seal the face in cake.
  return width > 0 ? width : base * 0.5;
}

/**
 * Where one tier wants to be this frame, or null if its landmarks are gone.
 *   x,y     the tier's hinge pin — its own landmark midpoint, always exact
 *   height  the span down to the next pin, which kills the gap between tiers
 *   angle   pair rotation blended toward the pin-to-pin direction
 */
export function solveLayer(layer, pts, base, opts = {}) {
  const { minVisibility = 0.5, hinge = config.hinge } = opts;

  const [ia, ib] = layer.pair;
  const a = pts[ia];
  const b = pts[ib];
  if (!a || !b) return null;
  if (((a.v ?? 1) + (b.v ?? 1)) / 2 < minVisibility) return null;

  // Order the pair left-to-right on screen so the cake never flips over.
  const [l, r] = a.x <= b.x ? [a, b] : [b, a];
  const mid = { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };

  // s.angle rotates the tier's local +X (its width axis), so the tier hangs
  // along local +Y — i.e. 90° clockwise of s.angle. To aim the tier down a
  // direction, subtract that quarter turn.
  const pairAngle = Math.atan2(r.y - l.y, r.x - l.x);
  let angle = pairAngle;

  const nxt = midpoint(pts, layer.next);
  const nextVisible = nxt && visible(pts, layer.next, minVisibility);
  const span = nextVisible ? dist(mid, nxt) : base * layer.fallbackSpanMul;

  if (nextVisible) {
    const aim = Math.atan2(nxt.y - mid.y, nxt.x - mid.x) - Math.PI / 2;
    angle = lerpAngle(pairAngle, aim, hinge);
  } else if (visible(pts, layer.prev, minVisibility)) {
    // No next pin (ankles are out of frame constantly). Carry on in the
    // direction the chain was already heading, so the tier doesn't snap back
    // to its pair angle and visibly unhinge itself.
    const prv = midpoint(pts, layer.prev);
    const aim = Math.atan2(mid.y - prv.y, mid.x - prv.x) - Math.PI / 2;
    angle = lerpAngle(pairAngle, aim, hinge);
  }

  // The mask tier is sized off the measured face; every other tier off the
  // shoulder-derived `base`. That way the mask and its hole shrink together
  // when the face gets smaller, instead of a fixed-size cake gaining a tiny
  // hole in the middle.
  let hole = 0;
  let width = base * layer.widthMul;
  if (layer.mask) {
    hole = faceSpan(pts, minVisibility, base);
    width = Math.min(hole * layer.faceWidthMul, base * layer.maxWidthMul);
  }

  return {
    x: mid.x,
    y: mid.y,
    angle,
    width,
    // never let a tier collapse to nothing when someone folds in half
    height: Math.max(span, base * 0.35) * SPAN_OVERLAP,
    hole,
  };
}

/* ---------------- drawing ---------------- */

/**
 * Overshooting ease-out — the tier drops past its resting spot and settles
 * back, which reads as a landing plop rather than a lift arriving at a floor.
 */
export function easeOutBack(p, overshoot = 1.5) {
  const c = overshoot;
  const q = p - 1;
  return 1 + (c + 1) * q * q * q + c * q * q;
}

function epochNow() {
  return config.boil > 0 ? Math.floor((performance.now() / 1000) * config.boil) : 0;
}

export function drawLayer(ctx, layer, s, epoch = epochNow()) {
  if (!s || (s.alpha ?? 1) <= 0.01 || s.hidden) return;

  const w = s.width;
  const h = s.height;
  if (!(w > 4) || !(h > 4)) return;

  // Rebuild only on a real size change or a boil tick — quantising means small
  // wobbles reuse the cached bitmap.
  const hole = s.hole ?? 0;
  // Style knobs are part of the key so changing them invalidates the cached
  // bitmap immediately, instead of waiting for a resize or boil tick.
  const key =
    `${Math.round(w / 3)}|${Math.round(h / 3)}|${Math.round(hole / 3)}|${epoch}` +
    `|${config.fillStyle}|${config.roughness}|${config.bowing}|${config.strokeWidth}` +
    `|${layer._biteRev ?? 0}|${fontsReady}`;
  if (layer._key !== key) {
    layer._key = key;
    buildTier(layer, w, h, hole, (layer.key.charCodeAt(0) * 31 + epoch * 101) >>> 0);
  }

  ctx.save();
  ctx.globalAlpha = s.alpha ?? 1;
  // dropY lets the intro drop each tier in from off-screen without disturbing
  // the pose-driven layout underneath — it's purely a draw-time offset.
  ctx.translate(s.x, s.y + (s.dropY ?? 0));
  ctx.rotate(s.angle);
  ctx.drawImage(layer._cv, -layer._ox, -layer._oy);
  ctx.restore();
}

/**
 * Draw the whole cake, lowest tier LAST so it lands in FRONT of the one above
 * it. Each tier's frosting cap then covers the overrun where the tier above
 * ends, which hides the seam when the two are rotated to different angles.
 * Reads like the upper tier is nestled into the frosting below it.
 */
export function drawCake(ctx, stateOf = (layer) => layer.state) {
  const epoch = epochNow();
  for (let i = LAYERS.length - 1; i >= 0; i--) {
    drawLayer(ctx, LAYERS[i], stateOf(LAYERS[i]), epoch);
  }
}
