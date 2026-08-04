#!/usr/bin/env python3
"""
Build the photographic cake tiers from CC0 source photos.

Source (both CC0, both from the same Unsplash shoot, so the lighting matches):
  colorful.jpg  "Colorful Cake"          -> the cut-face cross-section
  third.jpg     "3rd birthday cake"      -> the lit candle

Why we cut strips instead of using one contiguous crop: the app stretches each
tier to span the gap between two body landmarks, and only the middle band may
stretch. The fixed top+bottom bands set the tier's MINIMUM height, so a tall
contiguous crop (5 sponge layers) would never fit between shoulders and hips.
Stacking a short cap + one uniform sponge layer + a short base keeps the fixed
height low and puts a genuinely uniform layer in the stretch band.

The middle band is TILED by the app, not stretched -- stretching would smear
the crumb into vertical streaks, since the band covers up to 400px on screen.

The tile is one natural cake unit: a sponge layer plus the cream filling line
below it. That matters. A bare crumb strip tiles as an obvious repeating noise
pattern, but sponge+cream repeats read as a many-layered torte, because that
IS what a stack of sponge-and-filling looks like. The wrap (cream -> sponge) is
a real cake boundary, so it needs no seam-hiding trickery at all.

Consequently CAP must end exactly at the frosting/sponge boundary, so whatever
sponge colour a tier uses starts directly under the frosting, and BASE must
start at a sponge (the band already ends on cream).

Usage:  python3 tools/build_photo_cake.py <dir-with-source-jpgs>
Writes: assets/photo/cake-{top,middle,bottom}.png  and prints the geom block
        to paste into cake.js.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "photo")
os.makedirs(OUT, exist_ok=True)

# --- geometry measured off colorful.jpg (see the row-mean colour profile) ---
OX, OY = 1795, 1454          # origin of the analysis crop within colorful.jpg
X0, X1 = OX + 70, OX + 730   # horizontal extent of the clean cross-section face

# Start the cap below y=205: above that sits out-of-focus clutter from the
# cake's top surface (a fondant star, the uncut half) that reads as noise.
# End it at 310, the frosting/sponge boundary, so the tile band's sponge
# starts directly under the frosting whatever colour that tier uses.
CAP  = (205, 310)            # clean white frosting band
BASE = (985, 1095)           # bottom sponge + bottom edge (band ends on cream)
BODIES = {                   # one repeating unit each: sponge + its cream line
    "yellow": (510, 700),
    "orange": (790, 985),
    "pink":   (330, 505),
}
# BASE is the bottom pink layer, so don't put pink directly above it or the
# tier turns into one muddy pink block with no filling line to read against.
TIERS = [                    # which sponge each tier gets, top -> bottom
    ("top",    "yellow"),
    ("middle", "pink"),
    ("bottom", "orange"),
]

# candle, in third.jpg coordinates; excludes the frosting blob bottom-left and
# the fondant star bottom-right, which the connected-component pass also drops
CANDLE_BOX = (1145, 495, 1555, 1500)
CANDLE_FADE = 0.16           # fade the bottom of the candle out so it sinks
                             # into the frosting instead of ending on a hard
                             # crop edge (which shows as a pale rectangle)

CORNER = 26                  # bottom corner rounding, source px
EDGE_SHADE = 0.30            # how strongly to darken left/right edges (cylinder hint)


def strip(im, y0, y1):
    return im.crop((X0, OY + y0, X1, OY + y1))


def round_bottom_and_shade(tile, corner, cap_h, body_h):
    """Alpha: square top (it butts against the tier above), rounded bottom.
    Also darkens the left/right edges so a flat crop reads as a cylinder."""
    w, h = tile.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, -corner, w - 1, h - 1], radius=corner, fill=255)
    tile.putalpha(mask)

    # cylindrical shading: darken toward both vertical edges
    x = np.linspace(-1.0, 1.0, w)
    shade = 1.0 - EDGE_SHADE * (np.abs(x) ** 2.6)
    arr = np.asarray(tile).astype(float)
    arr[..., :3] *= shade[None, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA")


def build_tier(xsec, body_key):
    cap  = strip(xsec, *CAP)
    base = strip(xsec, *BASE)
    # No seam treatment: the band is sponge->cream, so the wrap back to sponge
    # is exactly what the next filling line looks like in a real cake.
    body = strip(xsec, *BODIES[body_key])

    w = cap.width
    h = cap.height + body.height + base.height
    tile = Image.new("RGB", (w, h))
    tile.paste(cap, (0, 0))
    tile.paste(body, (0, cap.height))
    tile.paste(base, (0, cap.height + body.height))

    tile = round_bottom_and_shade(tile.convert("RGBA"), CORNER, cap.height, body.height)
    return tile, cap.height, body.height, base.height


def _keep_major_components(mask, min_frac=0.05):
    """Keep every 4-connected blob at least `min_frac` of the biggest one.

    NOT just the biggest: the flame is a separate blob from the candle body
    (the wick between them is dark), so a largest-only rule silently discards
    the flame. Blob sizes here are ~12400 body / ~1800 flame / 1 for JPEG
    speckle, so the fraction cleanly keeps both and drops the noise."""
    small = np.asarray(
        Image.fromarray((mask * 255).astype("uint8")).resize(
            (mask.shape[1] // 4, mask.shape[0] // 4), Image.NEAREST
        )
    ) > 127
    h, w = small.shape
    seen = np.zeros_like(small, bool)
    comps = []
    for sy in range(h):
        for sx in range(w):
            if not small[sy, sx] or seen[sy, sx]:
                continue
            stack, cells = [(sy, sx)], []
            seen[sy, sx] = True
            while stack:
                y, x = stack.pop()
                cells.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and small[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            comps.append(cells)

    biggest = max(len(c) for c in comps)
    keep = np.zeros_like(small, bool)
    for cells in comps:
        if len(cells) >= biggest * min_frac:
            for y, x in cells:
                keep[y, x] = True
    up = Image.fromarray((keep * 255).astype("uint8")).resize(
        (mask.shape[1], mask.shape[0]), Image.BILINEAR
    )
    return np.asarray(up.filter(ImageFilter.MaxFilter(9))).astype(float) / 255.0


def cut_candle(third):
    """Key the candle off its near-black background.

    Background luminance sits at ~36 and the candle at >=180, so the split is
    clean. The extra connected-component pass drops the frosting blob and the
    fondant star that share the bottom of the crop -- a pure threshold keeps
    them and you get debris floating beside the candle."""
    c = third.crop(CANDLE_BOX).convert("RGB")
    a = np.asarray(c).astype(float)
    lum = a.max(axis=2)

    keep = _keep_major_components(lum > 90)
    alpha = np.clip((lum - 70.0) / 60.0, 0, 1) * keep

    # ramp the bottom rows out so the base dissolves into the frosting
    h = alpha.shape[0]
    n = max(1, int(h * CANDLE_FADE))
    ramp = np.ones(h)
    ramp[h - n:] = np.linspace(1.0, 0.0, n) ** 1.6
    alpha *= ramp[:, None]

    out = np.dstack([a, alpha * 255])
    img = Image.fromarray(np.clip(out, 0, 255).astype("uint8"), "RGBA")
    return img.crop(img.getbbox())


def main():
    xsec  = Image.open(os.path.join(SRC, "colorful.jpg")).convert("RGB")
    third = Image.open(os.path.join(SRC, "third.jpg")).convert("RGB")

    candle = cut_candle(third)
    geom = {}

    for name, body_key in TIERS:
        tile, cap_h, body_h, base_h = build_tier(xsec, body_key)
        top0 = 0

        if name == "top":
            # candle rides above the frosting; it must NOT scale with the
            # stretch band, so it lives above top0 in the fixed cap region.
            target_w = int(tile.width * 0.34)
            c = candle.resize(
                (target_w, int(candle.height * target_w / candle.width)),
                Image.LANCZOS,
            )
            overlap = int(cap_h * 0.42)          # sink the base into the frosting
            pad = c.height - overlap
            canvas = Image.new("RGBA", (tile.width, tile.height + pad), (0, 0, 0, 0))
            canvas.paste(tile, (0, pad), tile)
            canvas.alpha_composite(c, ((tile.width - c.width) // 2, 0))
            tile = canvas
            top0 = pad

        path = os.path.join(OUT, f"cake-{name}.png")
        tile.save(path)
        geom[name] = dict(
            vb=[tile.width, tile.height],
            top0=top0,
            capEnd=top0 + cap_h,
            bodyEnd=top0 + cap_h + body_h,
            bot0=tile.height,
            tileBand=body_h,               # the seamless tile height
        )
        print(f"wrote {path}  {tile.size}")

    print("\n--- paste into cake.js SKINS.photo ---")
    for name, g in geom.items():
        print(
            f'  {name}: vb: [{g["vb"][0]}, {g["vb"][1]}], '
            f'geom: {{ top0: {g["top0"]}, capEnd: {g["capEnd"]}, '
            f'bodyEnd: {g["bodyEnd"]}, bot0: {g["bot0"]} }},  // tile={g["tileBand"]}'
        )


if __name__ == "__main__":
    main()
