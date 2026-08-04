/* ------------------------------------------------------------------ *
 *  Sound effects.
 *
 *  Samples live in assets/sounds/<bank>/. Each bank holds interchangeable
 *  takes; playing one picks at random AND varies playbackRate, which on an
 *  AudioBufferSourceNode shifts pitch and speed together — so the same
 *  handful of files never sound like a loop.
 *
 *  Everything runs through one `master` gain into the speakers, which is
 *  what `M` turns down.
 * ------------------------------------------------------------------ */

export const sfx = { enabled: true, volume: 0.75 };

/**
 * Sample banks. Filenames are listed explicitly because a browser can't read a
 * directory — drop a new take in the folder and add its name here.
 *
 *   gain   per-bank level, since the sources are mastered differently
 *   pitch  playbackRate range; 1 = as recorded
 *   limit  minimum seconds between plays, to stop a swarm machine-gunning
 */
const BANKS = {
  munch: {
    dir: "assets/sounds/munch",
    files: [
      "zapsplat_cartoon_eat_crunch_bite_sinlge_low_pitched_69529.mp3",
      "zapsplat_cartoon_eat_crunch_bite_sinlge_mid_pitched_69411.mp3",
      "zapsplat_food_ice_pop_crunch_bite_munch_84408.mp3",
    ],
    // Turned down: a bite fires on every chomp from up to 12 bugs at once, so
    // it's the most-heard sound in the game and was dominating the mix.
    gain: 0.55,
    pitch: [0.82, 1.28],
    limit: 0.08,
  },
  boing: {
    dir: "assets/sounds/boing",
    files: [
      "zapsplat_cartoon_boing_jump_bounce_013_107873.mp3",
      "zapsplat_cartoon_boing_jump_bounce_017_107877.mp3",
      "zapsplat_cartoon_boing_jump_bounce_018_107878.mp3",
      "zapsplat_multimedia_game_sound_8_bit_blip_spring_boing_high_pitched_112046.mp3",
    ],
    gain: 0.85,
    pitch: [0.88, 1.2],
    limit: 0.06,
  },
  dizzy: {
    dir: "assets/sounds/dizzy",
    files: ["dizzy.mp3"],
    gain: 0.5,
    // Only one take, so it leans harder on pitch for variety.
    pitch: [0.9, 1.15],
    // Long (~1.8s) and it plays under the spinning stars, so overlapping
    // copies muddle badly — spaced further apart than the short sounds.
    limit: 0.7,
  },
};

const MAX_VOICES = 14; // hard ceiling; a full swarm can fire a lot at once

let ctx = null;
let master = null;      // -> speakers
let noiseBuf = null;
let voices = 0;

/** Create the graph. Safe to call before any user gesture; it starts suspended. */
export function initAudio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = sfx.volume;
  master.connect(ctx.destination);

  // short noise buffer, used by the one remaining synthesised sound
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  loadBanks();
  return ctx;
}

/** Fetch + decode every bank. Sounds simply don't fire until their bank lands. */
async function loadBanks() {
  await Promise.all(
    Object.entries(BANKS).map(async ([name, bank]) => {
      bank.buffers = [];
      bank.last = 0;
      await Promise.all(
        bank.files.map(async (f) => {
          try {
            const res = await fetch(`${bank.dir}/${encodeURIComponent(f)}`);
            if (!res.ok) throw new Error(`${res.status}`);
            bank.buffers.push(await ctx.decodeAudioData(await res.arrayBuffer()));
          } catch (e) {
            console.warn(`sfx: could not load ${name}/${f}`, e);
          }
        })
      );
    })
  );
}

/**
 * Browsers start an AudioContext suspended until a real user gesture. A
 * thumbs-up is not one — it's just pixels — so this has to be called from a
 * genuine click or keypress or the game would run silently.
 */
export function resumeAudio() {
  if (ctx && ctx.state === "suspended") ctx.resume();
}

const ready = () => sfx.enabled && ctx && ctx.state === "running";

/**
 * Play a random take from a bank at a random pitch.
 * `rate` shifts pitch and duration together — the cheap, characterful kind of
 * variation, and the reason three munch files don't sound like three munch
 * files.
 */
function play(name, { gain = 1, delay = 0 } = {}) {
  if (!ready()) return;
  const bank = BANKS[name];
  if (!bank?.buffers?.length) return;

  const now = ctx.currentTime;
  if (now - bank.last < bank.limit) return;
  if (voices >= MAX_VOICES) return;
  bank.last = now;

  const src = ctx.createBufferSource();
  src.buffer = bank.buffers[(Math.random() * bank.buffers.length) | 0];
  const [lo, hi] = bank.pitch;
  src.playbackRate.value = lo + Math.random() * (hi - lo);

  const g = ctx.createGain();
  g.gain.value = bank.gain * gain;

  src.connect(g);
  g.connect(master);

  voices++;
  src.onended = () => { voices--; };
  src.start(now + delay);
}

/* ---------------- the sounds ---------------- */

/** A bite landed. */
export function chomp() {
  play("munch");
}

/** Swatted: the impact, then the woozy spin underneath the stars. */
export function swat() {
  play("boing");
  play("dizzy", { delay: 0.1 });
}

/** Each tier landing during the intro — still synthesised; no sample for it. */
export function thud(index = 0) {
  if (!ready()) return;
  const p = 1 - index * 0.12;
  const t0 = ctx.currentTime;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.setValueAtTime(500 * p, t0);
  filt.frequency.exponentialRampToValueAtTime(120 * p, t0 + 0.13);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.4, t0);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13);
  src.connect(filt).connect(ng);
  ng.connect(master);
  src.start(t0);
  src.stop(t0 + 0.16);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150 * p, t0);
  osc.frequency.exponentialRampToValueAtTime(55 * p, t0 + 0.22);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.32, t0 + 0.012);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  osc.connect(og);
  og.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.24);
}

export function setVolume(v) {
  sfx.volume = v;
  if (master) master.gain.value = v;
}

/** Testing handle: which banks decoded, and how many takes each. */
export function bankStatus() {
  return Object.fromEntries(
    Object.entries(BANKS).map(([k, b]) => [k, `${b.buffers?.length ?? 0}/${b.files.length}`])
  );
}
