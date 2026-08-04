# 🎂 You Are The Cake

Your body is a 3-layer birthday cake. MediaPipe Pose tracks you, each cake layer
rides a pair of landmarks.

| tier   | rides            | reaches down to  |
|--------|------------------|------------------|
| top    | ears `7,8`       | shoulders `11,12`|
| middle | shoulders `11,12`| hips `23,24`     |
| bottom | hips `23,24`     | knees `25,26`    |

The top tier is worn as a **mask**: a face-shaped hole is punched clean through
it so your real face shows through from the video underneath.

The cake is drawn with [Rough.js](https://roughjs.com) for a hand-drawn look —
there are no art files, `cake.js` sketches every tier procedurally.

Each tier's top edge sits on its own landmark midpoint and reaches down to the
next pair — so the tiers always meet and there's never dead space between them.
Crouch and you're a squat cake; stand up and you're a very tall unfortunate cake.

## Hinges

Those landmark midpoints are also hinge pins: shoulders join top-to-middle, hips
join middle-to-bottom, and consecutive tiers pivot about the shared pin instead
of floating independently.

The pins are always exact, so the only thing left to decide is each tier's
**angle** — and the two things we want from it fight each other:

| `config.hinge` | angle comes from | result |
|---|---|---|
| `0` | the tier's own landmark pair | tiers roll with your shoulders/hips/knees, but neither end aims at the next pin, so a twist makes them slide past each other |
| `1` | the pin-to-pin direction | a true articulated chain — but the pair rotation stops mattering, so leaning your shoulders no longer tips the top tier |

The default `0.7` blends them: the chain visibly holds together while each tier
still tips with its own pair. Measured on a twisted pose, the gap from a tier's
bottom edge to the next pin runs ~37–62px at `0`, ~12–20px at `0.7`, and ~7px at
`1` (that residual is just `SPAN_OVERLAP` overshooting on purpose).

Drag the slider in `preview.html` to feel it; the cyan rings are the pins.

When the *next* pair is out of frame — knees, if the player stands close — the
tier aims along the direction the chain was already heading (`LAYERS[].prev`)
rather than snapping back to its pair angle and visibly unhinging itself.

## The face mask

The top tier rides the **ears** (`7,8`), which give both head width and head
tilt, so the mask rolls when you tip your head independently of your shoulders.

Three things make it a mask rather than a slab across the eyes:

- `riseMul` lifts the tier above its pin, so there's cake over the forehead and
  the candles sit above your head rather than on your nose.
- The whole tier is sized off the **measured face**, not the shoulder-derived
  `base`, so mask and hole shrink *together* as the face shrinks. Sizing only
  the hole off the face gives you a fixed-size cake with a shrinking hole in it.
  `maxWidthMul` caps it against `base` so a proportionally large head (kids)
  can't make the mask wider than the tier below and invert the taper — it must
  stay below the middle tier's `widthMul`, or the taper flattens at the clamp.
- `faceSpan()` measures the face from **two** directions and takes the max.

### Why two measurements

Ear-to-ear is purely horizontal, so it collapses as the head turns — measured
at ~70px facing the camera, it falls to ~11px in near-profile, even though the
face is still the same size on screen. Sizing the hole off that alone shrinks it
to nothing mid-turn and seals the face in cake.

Eye-line to mouth-line is a *vertical* measure, so yaw leaves it alone. Taking
`max(earWidth, eyeToMouth × 2.2)` means whichever measure is currently
un-foreshortened wins, and the two agree head-on so there's no jump between
them. (2.2 ≈ 145mm bitragion / 65mm eye-to-mouth on an adult.)

Measured across a head turn, `faceSpan` holds at 70 while ear distance falls
70 → 49 → 28 → 11. Across a person walking away, face 90 → 25 shrinks the hole
119 → 33 and the mask 198 → 55, holding hole/mask constant at 0.60.

If the face can't be measured at all, `faceSpan` falls back to `base × 0.5`
rather than 0 — a zero would punch no hole and seal the face in cake.

The hole is punched **last**, with `destination-out` over the finished tier —
masking each shape as it was drawn would be far more code and would still leave
pearls poking into the opening. A rough cream ellipse is then drawn back over
the cut edge so it reads as piped frosting rather than a hole knocked in a
bitmap.

## Run

```bash
cd ~/birthday-cake-game && python3 tools/serve.py
```

Open <http://localhost:8777>. The camera starts on page load — there's no
start screen. A failure card with a retry button appears only if that doesn't
work (permission blocked, no camera, insecure origin). Camera needs `localhost`
or https — `file://` won't work.

Use `tools/serve.py` rather than plain `python3 -m http.server`: it sends
no-cache headers. Browsers cache ES module imports (`cake.js`, `worms.js`)
aggressively and by their own URLs, so cache-busting the HTML with `?v=2`
does **not** refresh them — you get stale code with a fresh page and no error
to tell you. If you ever suspect it, check a known value in the console:
`(await import('./cake.js')).config.roughness`.

**Keys:** `SPACE` stack · `M` mute · `R` restart · `W` worms · `F` confetti · `D` skeleton overlay · `V` toggle webcam feed · `C` toggle cake

## The intro

You start on a plain camera feed. Give a **thumbs up with both hands**, hold it
for `DROP_HOLD` (0.4s), and the tiers drop in from above — bottom first, then
middle, then top, each landing with an overshoot-and-settle. The whole sequence
runs 1.46s. Bugs don't appear until the cake is built. `R` clears everything
back to a plain feed for the next person.

**Gesture detection** uses a second model, `HandLandmarker`, and it has to.
Pose reports thumb/index/pinky points per hand, but in the `lite` model those
collapse toward each other — "thumb above the fingers" never clears a usable
margin, so a pose-only thumbs-up simply never fires. (That was the first
attempt, and it didn't work.) The hand model gives real joints, so the test is
the textbook one: thumb extended upward (tip above IP above MCP) with at least
three fingers curled (tip below PIP), and the thumb tip clearly the highest
point of the hand.

The hand model runs **only while waiting** — there's no reason to pay for a
second inference once the cake is up. The check also runs on every video frame
independent of the pose model, since someone can be holding both thumbs up
before pose has locked onto them.

The prompt shows live progress (`· ·` → `👍 ·` → `👍 👍`) so a player can tell
whether they're being seen, and **SPACE forces the drop** — a gesture that
misreads should never block a party.

**The drop** is a pure draw-time offset (`state.dropY`), so it never disturbs
the pose-driven layout underneath — a tier that's still falling is already
tracking your body, just drawn higher up. `preview.html` has a **replay drop**
button to check the timing without a camera.

## Sound

`sfx.js`. Samples live in `assets/sounds/<bank>/`; each bank holds
interchangeable takes.

| bank | files | when |
|---|---|---|
| `munch` | 3 | a bite lands |
| `boing` | 4 | swatted — the impact |
| `dizzy` | 1 | under the spinning stars, 0.1s after the boing |
| *(synth)* | — | `thud`, each tier landing in the intro |

`M` mutes.

**Variety comes from pitch.** Playing a bank picks a random take *and* a random
`playbackRate`, which shifts pitch and duration together — so three munch files
never sound like three munch files. Ranges are per bank (`pitch: [0.82, 1.28]`
for munch); `dizzy` has only one take, so it leans hardest on pitch. Measured
over 14 plays: 3 distinct source files, 14 distinct pitches, range 0.87–1.28.

Filenames are listed explicitly in `BANKS` because a browser can't read a
directory — **drop a new take in the folder and add its name there.**

Three things that would otherwise bite:

- **An AudioContext starts suspended until a real user gesture**, and a
  thumbs-up is not one — it's just pixels. `resumeAudio` is hooked to the first
  genuine click or keypress, or the whole game runs silently.
- **Machine-gunning.** Each bank has a `limit` (minimum seconds between plays).
  `dizzy` is ~1.8s long and plays under the stars, so overlapping copies muddle
  badly — it's spaced much further apart than the short sounds.
- **Voice ceiling.** `MAX_VOICES` caps concurrent sources; a full swarm can
  otherwise fire a lot at once.

Verified by measuring peak amplitude at the output: chomp 0.45,
swat 0.44, thud 0.25, against a 0.0 silence floor.

## Confetti

`confetti.js`. Both hands throw Rough.js confetti while they move, and **how
much is mapped to how fast** — a lazy wave is a trickle, a real swing is a
burst. It draws in front of everything (cake and bugs included) and `F` toggles
it.

Speed is measured in **base-widths per second**, not pixels, so the same
physical gesture throws the same confetti whether you're close to the camera or
across the room — the same trick the swat threshold uses.

| hand speed (base-widths/s) | pieces/sec, per hand |
|---|---|
| ≤ 0.7 | 0 |
| 1.0 | 1 |
| 1.5 | 6 |
| 2.0 | 13 |
| 3.0 | 32 |
| ≥ 4.0 | 52 (capped) |

The curve is `rate ∝ t^1.5`, not linear: the payoff is concentrated in real
swings, which is what makes flinging your arms about feel like it's doing
something. Squaring it went too far — a brisk wave managed 8 pieces/sec, which
reads as broken. The dead zone below `minSpeed` matters as much: pose puts a
little jitter on a still wrist (~0.3 base-widths/s), and without it a player
standing perfectly still would dribble confetti.

Both hands at full tilt settle at **~130 live pieces** and drain to zero 1.5s
after you stop; `maxPieces` (320) is a safety net, not the limiter. Cost at
that population is **0.5 ms/frame** for update + draw, so it's ~3% of a frame.

Details worth knowing:

- **Bursts are smeared along the swing arc.** Each piece spawns at a random
  point between where the hand was last frame and where it is now, so a fast
  swing leaves a streak instead of a clump at its end point. If pose loses the
  player and finds them again, the emitter's last position is dropped rather
  than smeared — otherwise a returning hand paints a stripe across the screen.
- **Fractional pieces carry over** (`emitter.acc`), which is what makes the rate
  frame-rate independent instead of quantising to one per frame. Emitters are
  keyed by landmark index, since `hands` is rebuilt from scratch every frame.
- **Pieces inherit ~28% of the hand's velocity** plus an outward pop and an
  upward bias, so confetti flies the way the arm swung — thrown, not dropped.
- **The flip is fake 3D.** Scaling horizontally on a cosine reads as a flat
  scrap turning edge-on and back, which is the shimmer real confetti has. That
  plus the sideways flutter is most of what stops falling paper looking like
  gravel.
- **The sketches don't rebuild on the boil**, unlike the cake and the bugs. A
  piece lives about a second while tumbling, so a 7fps redraw would be invisible
  churn across hundreds of sprites — three seeded variants per (shape, size,
  colour) supply the variety instead.
- **Fill and outline are sketched from different seeds**, so the outline doesn't
  sit exactly on the edge of its own fill. That mismatch is the whole
  hand-coloured look; one clean pass reads as vector art no matter how rough the
  pen is.
- The pen runs at `config.roughness × 0.8`, well below the cake's — a 12px
  square at 3.2 dissolves into a scribble. Same lesson as the bugs' per-species
  pens.

Four shapes (strip, dot, triangle, streamer) in the cake's own sprinkle palette.
Tuning lives in `confettiConfig`. In the harness, the **confetti** button turns
it on and the **mouse is the throwing hand** — move it fast across the canvas.

## How tiers are drawn

Rough.js sketches each tier at whatever size it needs, so **nothing is ever
stretched** and there's no smearing to design around. The cap, drips, pearls and
candles are all sized off the tier's *width*, so they keep their proportions
while only the body's length changes with your pose.

(Earlier versions sliced a pre-rendered SVG into three horizontal bands and
stretched the middle one, which meant that band could hold no horizontal detail.
Drawing procedurally deleted that whole constraint.)

### Piped lettering

`LAYERS[].text` puts a message on a tier — middle reads HAPPY / BIRTHDAY /
ROXPIKMIN, bottom reads FROM WINGPIKMIN <3. Change the strings there; the top
tier has none because it's the mask.

It's drawn **into the tier bitmap**, before the face hole and the bites. That's
what makes it behave like icing rather than an overlay: it rotates and scales
with the tier, and the worms chew clean through the lettering.

The face is **Flavors**, bundled in `assets/fonts/`. It's registered from
`cake.js` rather than a stylesheet, because `preview.html` has its own inline
CSS and would otherwise silently fall back. Canvas doesn't wait on webfonts
either — text drawn before the face loads quietly uses the fallback — so
`fontsReady` is part of the tier cache key and every tier rebuilds once it
arrives.

Canvas has no hand-drawn text and Rough.js can't stroke a font, so the wobble is
faked the way real piping looks — each character gets its own small offset and
rotation, a thin dark outline under a cream fill. Placement uses the *layout*
rng (stable across boils); letters that re-jittered every tick would be
unreadable, unlike the outlines where the wobble is the point.

Type size comes off the tier's **width**, so the message holds still while the
player's torso stretches and squashes, then shrinks to fit if a line is too wide
(both currently land at 80% of tier width) and skips entirely if the body gets
too short to hold it.

### Fills and the icing edge

The coloured part of each tier is drawn in **three passes**: a solid base, a
sketch fill (`config.fillStyle`, default `zigzag`) over it, then the outline.
The solid pass is not redundant — sketch fills leave gaps and the cake sits over
live video, so without it the webcam shows through between every stroke. The
sketch pass is also **clipped** to the tier, because Rough.js roughens fill
strokes past the path boundary and an unclipped hachure sprouts spikes out of
the cake's sides. `hachureAngle` is set per tier so they don't look stamped.

The icing's lower edge is one continuous wave, each half-period given its own
wavelength and amplitude so it reads as an irregular sine rather than a
repeating scallop. Each segment is a single cubic with both control handles at
4/3 of the target amplitude — a cubic with handles at height `k` peaks at
`0.75k`, so 4/3 lands the crest exactly where asked. Segment endpoints all sit
on the centreline, which keeps the joins tangent-continuous so no corner shows
where two half-periods meet.

### Two randomness streams

`buildTier` keeps layout randomness and stroke randomness apart:

- **layout** (icing wavelengths, sprinkle placement) is seeded per tier only, so
  the cake keeps its shape across boils
- **stroke jitter** is seeded off the boil epoch, so the pen redraws each tick

Sharing one stream re-rolls the icing outline 7 times a second, which reads as
the cake writhing rather than as a hand-drawn wobble. Measured across boils, the
icing edge now moves ~5px (jitter) instead of jumping to a new shape.

### Caching, and why it's necessary

Rough.js costs roughly **0.3ms per shape** and a full cake is ~75 shapes. Naively
re-sketching every frame is ~10ms, which at 60fps is 61% of a core — it would
wreck the frame rate next to MediaPipe.

So each tier is sketched into an offscreen canvas and only rebuilt when its size
changes meaningfully or the boil ticks. Per frame we just blit three bitmaps:

| | cost |
|---|---|
| full rebuild of all 3 tiers | 4.5 ms |
| cached frame (3 blits) | 0.005 ms |
| at `config.boil = 7` | ~3% of one core |

`config.boil` is how many times a second the sketch is redrawn with fresh
randomness — that's the hand-animated wobble. It's also the main cost knob;
`0` holds the lines perfectly still.

`config.roughness` / `config.bowing` control how loose the pen is.

The lower tier draws in *front* of the upper one, so a tier's drip cap hides the
seam where the tier above it ends — otherwise twisting opens a wedge of
background between two differently-rotated tiers. `SPAN_OVERLAP` adds a small
extra overrun on top of that. Keep it small, and note each tier's pearl border
is deliberately placed a full diameter up from its bottom edge so the cap below
doesn't swallow it.

## Tuning

- `LAYERS[].widthMul` (`cake.js`) — tier width as a multiple of **shoulder
  width**, not its own landmark distance. Using its own distance inverts the
  cake, since shoulders read wider than knees on screen.
- `LAYERS[].fallbackSpanMul` — height to use when the *next* pair is out of
  frame, which happens constantly with ankles.
- `config.hinge` — how hard tiers swing to meet at the pins. See **Hinges**.
- `config.boil` — sketch wobble, in redraws per second. `0` = perfectly still.
- `config.fillStyle` — `zigzag` (default), `hachure`, `cross-hatch`, `dots`.
  Dots automatically get a tighter grid + lighter weight so they read as
  texture, not sparse polka dots.
- `config.roughness` / `config.bowing` — how shaky the pen is / how much
  straight lines bow.
- `config.strokeWidth` — multiplier on every outline and pen width.
- `LAYERS[].hachureAngle` — sketch-fill direction, per tier.

All of these are live sliders in `preview.html`. The tier cache keys on the
style values, so changing them rebuilds instantly rather than waiting for a
boil tick.
- `SMOOTH` (`main.js`) — pose smoothing; 0 = frozen, 1 = raw and jittery.

`preview.html` renders the cake against a fake draggable pose, with buttons for
stand / crouch / tilt / feet-out-of-frame, so you can tune all of this without
standing in front of a camera. It imports the same `cake.js` as the live app.

## Changing how the cake looks

Colours are per-tier in `LAYERS` (`body`, `pipe`, plus `board` / `candles`
flags). The shapes themselves are in `buildTier()` in `cake.js` — cap height,
drip depth, pearl size, piping count and candles are all expressed as fractions
of the tier width, so they scale together.

## Unused

Nothing imports these any more — they're leftovers from earlier versions:

- `assets/` — the hand-authored SVG tiers, replaced by Rough.js
- `assets/photo/` + `tools/build_photo_cake.py` — a photographic skin (CC0
  Unsplash cake sliced into tiers) that we tried and dropped

```bash
rm -rf ~/birthday-cake-game/assets ~/birthday-cake-game/tools
```

## Bugs

`worms.js` (named for the founding species). Four kinds, all sharing one
lifecycle (approach → eat → leave, or flung when swatted) and the same
cake-targeting; they differ in sprite, size, speed, appetite and whether they
fly:

| species | size | min px | speed | bites | pen & fill | animation |
|---|---|---|---|---|---|---|
| worm | large | 92 | slow | 6 big | loose doubled strokes, dotted body | inchworm scrunch |
| ladybug | medium | 76 | medium | 4 | heavy scrawl, grid-shaded dome | scuttling legs, waggling antennae, hover-bob |
| dragonfly | long | 98 | brisk | 2 quick | light swooping single line, hachure-veined wings | two-frame wing flap |
| ant | small | 70 | fast | 3 small | neat ballpoint, cross-hatched shell | marching legs, waggling antennae |

**Size floors.** Species sizes are fractions of the player's shoulder width, so
someone standing well back shrinks every bug toward invisibility. Each species
has a `minPx` floor (absolute device pixels) with `wormConfig.minSizePx` as the
fallback, which keeps them readable — and swattable — at any camera distance.
It also guards the pen: small sprites turn to mush at high roughness.

("Grid" is cross-hatch at `hachureAngle: 0` — horizontal + vertical passes.)

Articulation lives **inside the sprites** and steps at the boil rate (7fps),
so the bugs animate in the same stop-motion cadence as the cake's wobble. On
top of that, at full frame rate, crawlers do little walk-hops and everyone
rocks slightly along their body axis while travelling (`wm.bobOff`/`wm.rock`).

Textured fills (worm's dots, ant's cross-hatch, ladybug's grid) are a darker
tone of the skin drawn over a solid base — solid underneath so video can't show
through the gaps, clipped so the fill can't sprout spikes past the outline.

### Photo heads

Every bug wears the birthday girl's face, Pikmin-style. `tools/build_heads.py`
turns the photos in `assets/ROXPIKMIN/` into circular cutouts
(`head1.png` … `head5.png`); each bug picks one at random when it spawns.

That's a build step rather than browser work for two reasons: three of the five
originals are **HEIC**, which Chrome can't decode, and the originals run up to
1851×2233 for a head a few dozen pixels wide. The script holds a per-photo face
centre and zoom (`FRAMING`) — a blind centre-crop lops off chins, since the
faces aren't consistently placed. To re-run after adding photos:

```bash
pip install pillow-heif        # only needed for the .HEIC originals
python3 tools/build_heads.py
```

Heads load fire-and-forget: bugs draw their hand-sketched heads until the
photos arrive, and `headsReady` is in the sprite cache key so every cached
sprite rebuilds the moment they do. Heads are drawn deliberately oversized so
the face still reads when a bug is only a few dozen pixels on screen.

Each species' `pen` (in the `SPECIES` table) sets roughness/bowing multipliers,
stroke weight, and single- vs doubled-stroke. The pen is characterization —
and a constraint: small sprites turn to mush at high roughness, so the tinier
the bug, the cleaner its pen has to be. The global roughness/stroke sliders
still multiply over all of them.

They come in from the screen edges, chew scalloped bites out of a tier, and
leave when full. Swat them with a fast-moving hand
(wrists `15,16`) — slow touches don't count, only swings. `W` toggles them in
the live app; the harness has a worms button where the **mouse acts as the
swatting hand** (move it fast across a worm).

Design notes:

- Everything scales off `base` (shoulder width) — worm size, crawl speed, swat
  threshold — so behaviour is the same at any camera distance or resolution.
- Bites are stored per tier as **fractions of tier size** and punched during
  `buildTier` like the face hole. Stored in pixels they'd drift off the cake
  the moment the player stepped back. The nibble edge is drawn `source-atop`
  so it only lands on surviving cake pixels.
- **There is no damage cap** — worms burrow inward one bite-radius per chomp,
  so given time they tunnel clean through and erase the cake entirely (the
  icing shelves and pearls survive, which looks fantastic). Two things keep
  that affordable: `addBite` refuses bites that land entirely inside an
  already-eaten patch, and only the newest `OUTLINED_BITES` get the expensive
  sketchy rim.
- **Bugs chew across the tier's whole height.** `tierNyRange` reports where a
  tier's cake actually starts and ends. The mask tier rises above its pin, so
  its cake lives at *negative* ny — a fixed 0.2–0.8 sampling window left the
  cake over the player's head unreachable and spared a band at the top and
  bottom of every tier, which is exactly where tiers meet.
- **`hasCakeAt` models the real bite shape.** A bite punches three overlapping
  circles (a scalloped nibble ~1.4r tall against r wide); testing a single
  r-radius circle under-reported the eaten area top and bottom, so bugs chewed
  holes that were already there. Bites are also recorded exactly where the
  check was made — jittering them made the record drift off the line the bug
  keeps testing.
- **Worms only chew where cake still exists.** `hasCakeAt` / `findCakeDepth`
  (in `cake.js`, since they share the bites' fractional coordinates — the face
  hole counts as eaten) drive three decisions: spawn targeting samples random
  channels until it finds one with cake left, a worm re-checks on arrival in
  case someone ate its spot while it crawled over, and each chomp skips
  straight through hollow stretches to the next real mouthful. Measured on a
  stress run: 97% of bites now land on cake, versus 42% with blind chewing.
  When the search finds nothing anywhere, spawning stops — no worms loitering
  around an empty plate.
- A chewing worm recomputes its attach point from the tier's transform every
  frame, so it rides along as you move — the worms chase the cake.
- Worms share one Rough.js sprite per (size, colour, boil epoch): they wiggle
  at the boil rate for free, and a handful of sprite rebuilds per tick is far
  cheaper than sketching every worm every frame.
- Hand velocity is measured between pose samples, not render frames — pose
  only updates when the camera does, and dividing by the render dt would spike
  the speed on every sample.

### Reactions

Two bits of feedback, both drawn as cached Rough.js sprites so they wobble on
the boil like everything else. They're **stroke only** — a yellow star outline
and a pink heart outline, no fill.

- **Swatted → dizzy stars.** Three stars orbit above the bug for `DIZZY_SEC`
  (1.8s). They're drawn in *screen* space, deliberately outside the bug's
  transform — inheriting the tumble would whirl them around with it instead of
  reading as "seeing stars". The orbit is squashed vertically (x0.34) and each
  star scales with its position in the ring, so it reads as a circle seen
  edge-on.
- **Ate cake → hearts.** One heart per mouthful, floating up from the bug's
  head, drifting sideways on a sine and fading over ~1.15s.

Their wobble is baked into the geometry rather than left to Rough.js, because
Rough.js measures its jitter (`maxRandomnessOffset`) in **absolute pixels** —
one setting that suits a big heart mangles a small star. So `starPath` and
`heartPath` offset their own vertices by a fraction of the shape's radius
(`FX_WOBBLE`), which looks identical at every size, and `maxRandomnessOffset`
is tied to the radius too. The wobble is per-shape: a heart is one chunky
outline that takes a lot of mangling (0.3), while a star's points smear into an
unreadable tangle at the same value (0.18, with a fattened inner radius).
Stroke width scales with the radius so the outline reads at bug scale.

Global tuning lives in `wormConfig` (spawn rate, plus `speedMul`/`biteRate`
multipliers over every species, swat threshold); per-species stats live in the
`SPECIES` table.

Defaults are a full-on infestation: `spawnEverySec: 0.9`, `maxWorms: 12`. That
reaches a steady ~12 bugs about 15s in and chews ~115 bites in 30s, so an
unattended cake is stripped in roughly a minute — swatting is mandatory, not
optional. Raise `spawnEverySec` for a calmer game. In the harness, `window.__spawn("dragonfly")` etc. spawns a
chosen species.

One testing gotcha: the harness game loop runs on `requestAnimationFrame`,
which browsers pause while the page is hidden — a background tab freezes the
bugs mid-air. For headless testing, step the simulation synchronously:
`for (let i = 0; i < 360; i++) updateWorms(1/60, env)`.

## Not built yet

Win/lose: nothing happens yet when the cake is fully eaten, and there's no
way to restore it. Candles don't blow out.
