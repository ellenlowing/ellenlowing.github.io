import {
  FilesetResolver,
  PoseLandmarker,
  HandLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

import {
  LAYERS, loadLayers, computeBase, solveLayer, drawCake, lerpAngle, easeOutBack,
} from "./cake.js";
import { updateWorms, drawWorms, resetWorms, wormConfig, wormStats } from "./worms.js";
import {
  updateConfetti, drawConfetti, resetConfetti, confettiConfig,
} from "./confetti.js";
import { sfx, initAudio, resumeAudio, thud, setVolume } from "./sfx.js";

const SMOOTH = 0.35;        // 0 = frozen, 1 = no smoothing (jittery)
const MIN_VISIBILITY = 0.5; // below this we coast on the last good pose

const video  = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");
const failEl   = document.getElementById("fail");
const retryBtn = document.getElementById("retryBtn");
const errEl    = document.getElementById("err");
const fpsEl    = document.getElementById("fps");
const statusEl = document.getElementById("status");
const wormsEl  = document.getElementById("worms");
const promptEl = document.getElementById("prompt");
const promptCount = document.getElementById("promptCount");

let landmarker = null;
let handLandmarker = null;
let camStream = null;
let thumbCount = 0;
let running = false;
let lastVideoTime = -1;
let pts = null;
let lastBase = 200;

// wrist velocities, for swatting worms
let hands = [];
const prevHand = {};
let lastPoseT = performance.now();
let lastVidT = performance.now();
let poseDt = 0;

const show = { skeleton: false, video: true, cake: true };

/* ---------------- intro ---------------- *
 * Plain camera feed until the player gives a thumbs-up with BOTH hands, then
 * the tiers drop in bottom-first. Press R to reset for the next person.
 *
 * The gesture uses a second model (HandLandmarker), run ONLY while waiting.
 * Pose's own hand points are too coarse to tell a thumbs-up from a fist.
 * SPACE forces the drop, so a flaky gesture can never block the party.
 */
const intro = { phase: "waiting", hold: 0, t: 0 };
const DROP_HOLD = 0.4;     // seconds both thumbs must be up before it fires
const DROP_STAGGER = 0.38; // gap between one tier landing and the next falling
const DROP_DUR = 0.7;      // fall time per tier

/**
 * Thumbs-up, from HandLandmarker's 21 points.
 *
 * Pose's own hand points (17-22) are far too coarse for this — in the lite
 * model the thumb, index and pinky collapse toward each other, so "thumb above
 * the fingers" never clears a usable margin and the gesture simply never fires.
 * The hand model gives real joints, so the test can be the textbook one:
 * thumb extended upward, all four fingers curled.
 *
 *   4/3/2 thumb tip / IP / MCP      8,6 index tip / PIP
 *   12,10 middle                    16,14 ring        20,18 pinky
 */
function isThumbsUp(h) {
  const y = (i) => h[i].y; // normalised; smaller = higher on screen
  const thumbUp = y(4) < y(3) && y(3) < y(2);
  if (!thumbUp) return false;

  let curled = 0;
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
    if (y(tip) > y(pip)) curled++;
  }
  if (curled < 3) return false; // allow one finger to be misread

  // thumb tip has to be clearly the highest point of the hand
  const span = Math.abs(y(0) - y(9)) || 1e-6; // wrist -> middle-finger MCP
  return y(8) - y(4) > span * 0.25;
}

/** How many thumbs-up are on screen right now (0-2). */
function countThumbsUp(res) {
  let n = 0;
  for (const h of res?.landmarks ?? []) if (h?.length === 21 && isThumbsUp(h)) n++;
  return n;
}

// How far down each tier still is, mid-drop. Returns null once it has landed.
function dropOffset(i, elapsed, fallDist) {
  const local = elapsed - i * DROP_STAGGER;
  if (local <= 0) return { hidden: true };
  if (local >= DROP_DUR) return null;
  const eased = easeOutBack(local / DROP_DUR);
  return { dropY: -(1 - eased) * fallDist };
}

/* ---------------- setup ---------------- */

async function initPose() {
  statusEl.textContent = "loading model…";
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  handLandmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });
}

async function initCamera() {
  // Camera only. The mic used to be requested here so the recorder could mix it
  // in; with recording gone there's nothing to do with it, so the player gets a
  // camera-only permission prompt.
  camStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });

  initAudio();
  video.srcObject = camStream;
  await video.play();
  if (!video.videoWidth) await new Promise((r) => (video.onloadedmetadata = r));
}

/* ---------------- geometry ---------------- */

// How the video is cropped onto the canvas (object-fit: cover) plus the
// mirroring, so landmarks and pixels agree.
function videoFit() {
  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  return { cw, ch, dw, dh, dx: (cw - dw) / 2, dy: (ch - dh) / 2 };
}

const lerp = (a, b, t) => a + (b - a) * t;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
}

/* ---------------- drawing ---------------- */

function drawVideo(fit) {
  ctx.save();
  ctx.translate(fit.cw, 0);
  ctx.scale(-1, 1); // selfie mirror
  ctx.drawImage(video, fit.dx, fit.dy, fit.dw, fit.dh);
  ctx.restore();
}

function drawSkeleton(p) {
  ctx.save();
  ctx.strokeStyle = "rgba(0,255,190,0.85)";
  ctx.lineWidth = 3;
  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    if (!p[start] || !p[end]) continue;
    ctx.beginPath();
    ctx.moveTo(p[start].x, p[start].y);
    ctx.lineTo(p[end].x, p[end].y);
    ctx.stroke();
  }
  ctx.fillStyle = "#ff2e88";
  for (const q of p) {
    ctx.beginPath();
    ctx.arc(q.x, q.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ---------------- per-frame update ---------------- */

function updateLayers(p) {
  const base = computeBase(p);
  lastBase = base;

  for (const layer of LAYERS) {
    const target = solveLayer(layer, p, base, { minVisibility: MIN_VISIBILITY });

    if (!target) {
      // coast on the last good pose, fading out
      if (layer.state) layer.state.alpha = lerp(layer.state.alpha, 0, 0.12);
      continue;
    }

    if (!layer.state) layer.state = { ...target, alpha: 0 };
    const s = layer.state;
    s.x = lerp(s.x, target.x, SMOOTH);
    s.y = lerp(s.y, target.y, SMOOTH);
    s.angle = lerpAngle(s.angle, target.angle, SMOOTH);
    s.width = lerp(s.width, target.width, SMOOTH * 0.6);
    s.height = lerp(s.height, target.height, SMOOTH * 0.6);
    s.hole = lerp(s.hole ?? target.hole, target.hole, SMOOTH * 0.6);
    s.alpha = lerp(s.alpha, 1, 0.18);
  }
}

function fadeOut() {
  for (const layer of LAYERS) {
    if (layer.state) layer.state.alpha = lerp(layer.state.alpha, 0, 0.12);
  }
}

/* ---------------- main loop ---------------- */

let fpsAccum = 0;
let fpsFrames = 0;
let fpsLast = performance.now();

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);

  const now = performance.now();
  const fit = videoFit();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (show.video) drawVideo(fit);

  if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
    const vidDt = Math.max((now - lastVidT) / 1000, 1e-3);
    lastVidT = now;
    lastVideoTime = video.currentTime;

    // Gesture check runs on every video frame, independent of whether a full
    // body pose was found — someone can be holding both thumbs up before the
    // pose model has locked on to them. The hand model only runs during the
    // intro; there's no reason to pay for it once the cake is up.
    if (intro.phase === "waiting" && handLandmarker) {
      thumbCount = countThumbsUp(handLandmarker.detectForVideo(video, now));
      intro.hold = thumbCount >= 2 ? intro.hold + vidDt : 0;
      if (intro.hold >= DROP_HOLD) startDrop();
      promptCount.textContent = thumbCount >= 2 ? "👍 👍" : thumbCount === 1 ? "👍 ·" : "· ·";
    }

    const result = landmarker.detectForVideo(video, now);
    const raw = result.landmarks?.[0];

    if (raw) {
      const world = result.worldLandmarks?.[0];
      pts = raw.map((lm, i) => ({
        x: fit.dx + (1 - lm.x) * fit.dw, // mirrored
        y: fit.dy + lm.y * fit.dh,
        v: Math.max(lm.visibility ?? 0, world?.[i]?.visibility ?? 0),
      }));
      // Some builds report visibility as all-zero. If nothing has a score,
      // don't let the visibility gate hide the whole cake.
      if (!pts.some((q) => q.v > 0)) for (const q of pts) q.v = 1;

      updateLayers(pts);

      // Wrist velocities for swatting. Measured between pose samples (video
      // frames), not render frames — pose only updates when the camera does,
      // and dividing by the render dt would spike the speed on every sample.
      const hdt = Math.max((now - lastPoseT) / 1000, 1e-3);
      poseDt = hdt;
      lastPoseT = now;
      hands = [];
      for (const idx of [15, 16]) {
        const q = pts[idx];
        if (q && q.v >= 0.5) {
          const prev = prevHand[idx];
          hands.push({
            id: idx, // stable key: confetti keeps a per-hand emitter across frames
            x: q.x, y: q.y,
            vx: prev ? (q.x - prev.x) / hdt : 0,
            vy: prev ? (q.y - prev.y) / hdt : 0,
          });
          prevHand[idx] = { x: q.x, y: q.y };
        } else {
          prevHand[idx] = null;
        }
      }

      statusEl.textContent =
        intro.phase === "waiting"
          ? `👍 ${thumbCount}/2 thumbs up`
          : "tracking ✓";
    } else {
      pts = null;
      hands = [];
      fadeOut();
      statusEl.textContent = "step into frame";
    }
  }

  const dt = (now - fpsLast) / 1000;

  if (show.skeleton && pts) drawSkeleton(pts);

  // ---- intro: nothing but camera until both thumbs go up ----
  if (intro.phase === "dropping") {
    intro.t += Math.min(dt, 0.06);
    const fallDist = canvas.height * 1.15;
    let landed = 0;
    LAYERS.forEach((layer, i) => {
      if (!layer.state) return;
      const d = dropOffset(i, intro.t, fallDist);
      const wasFalling = !layer.state.hidden && (layer.state.dropY ?? 0) !== 0;
      layer.state.hidden = !!d?.hidden;
      layer.state.dropY = d?.dropY ?? 0;
      if (d === null) {
        if (wasFalling) thud(i); // one thump as each tier settles
        landed++;
      }
    });
    if (landed === LAYERS.length) intro.phase = "playing";
  }

  if (show.cake && intro.phase !== "waiting") drawCake(ctx);

  // Bugs only show up once the cake is built.
  if (intro.phase === "playing") {
    updateWorms(dt, {
      w: canvas.width,
      h: canvas.height,
      base: lastBase,
      hands,
    });
    drawWorms(ctx);
  }

  // Confetti flies from the moment the cake starts stacking — in front of
  // everything, cake and bugs included, since it's foreground sparkle.
  if (intro.phase !== "waiting") {
    updateConfetti(dt, {
      w: canvas.width,
      h: canvas.height,
      base: lastBase,
      hands,
    });
    drawConfetti(ctx);
  }

  fpsFrames++;
  fpsAccum += now - fpsLast;
  fpsLast = now;
  if (fpsAccum >= 500) {
    fpsEl.textContent = `${Math.round((fpsFrames * 1000) / fpsAccum)} fps`;
    wormsEl.textContent = wormConfig.enabled
      ? `🐛 ${wormStats.active} · bites ${wormStats.bites} · swatted ${wormStats.swatted}`
      : "🐛 off";
    fpsAccum = 0;
    fpsFrames = 0;
  }
}

/** Kick off the stacking animation. */
function startDrop() {
  if (intro.phase !== "waiting") return;
  intro.phase = "dropping";
  intro.t = 0;
  promptEl.classList.add("gone");
}

/** Back to a plain camera feed, cake cleared, ready for the next person. */
function resetIntro() {
  intro.phase = "waiting";
  intro.hold = 0;
  intro.t = 0;
  promptEl.classList.remove("gone");
  promptCount.textContent = "· ·";
  thumbCount = 0;
  for (const layer of LAYERS) {
    layer.bites = [];
    layer._biteRev = 0;
    if (layer.state) { layer.state.hidden = true; layer.state.dropY = 0; }
  }
  resetWorms();
  resetConfetti();
  wormStats.bites = 0;
  wormStats.swatted = 0;
}

/* ---------------- boot ---------------- */

// AudioContexts start suspended until a genuine user gesture — a thumbs-up
// doesn't count, so hook the first real click or keypress.
for (const ev of ["pointerdown", "keydown"]) {
  window.addEventListener(ev, resumeAudio, { once: false });
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "d") show.skeleton = !show.skeleton;
  if (k === "v") show.video = !show.video;
  if (k === "c") show.cake = !show.cake;
  if (k === "w") wormConfig.enabled = !wormConfig.enabled;
  if (k === "f") confettiConfig.enabled = !confettiConfig.enabled;
  if (k === "r") resetIntro();
  if (k === "m") { sfx.enabled = !sfx.enabled; setVolume(sfx.enabled ? 0.55 : 0); }
  // manual fallback, so a flaky gesture can never block the party
  if (k === " " || k === "enter") { e.preventDefault(); startDrop(); }
});

/**
 * No start screen — the camera comes up as soon as the page loads. Browsers
 * allow getUserMedia without a click (the permission prompt is the gesture),
 * and the <video> is muted+playsinline so autoplay policy lets it run.
 * The failure card only appears if that doesn't work out.
 */
async function boot() {
  failEl.hidden = true;
  retryBtn.disabled = true;
  errEl.textContent = "";
  try {
    resize();
    await loadLayers();
    await initCamera();
    await initPose();
    resetIntro();
    statusEl.textContent = "ready";
    if (!running) {
      running = true;
      fpsLast = performance.now(); // don't hand the loop a giant first dt
      loop();
    }
  } catch (e) {
    console.error(e);
    errEl.textContent =
      e.name === "NotAllowedError"
        ? "Camera permission was blocked. Allow it in the address bar, then try again."
        : e.message || String(e);
    failEl.hidden = false;
  } finally {
    retryBtn.disabled = false;
  }
}

retryBtn.addEventListener("click", boot);

resize();
statusEl.textContent = "starting camera…";
boot();
