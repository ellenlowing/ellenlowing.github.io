#!/usr/bin/env python3
"""
Turn the photos in assets/ROXPIKMIN into circular head cutouts the bugs wear.

Two reasons this is a build step rather than something done in the browser:
HEIC (three of the five) is not decodable in Chrome, and the originals are up
to 1851x2233 — far more pixels than a bug head a few dozen pixels wide needs.

Each photo gets a square crop around the face, a soft-edged circular alpha
mask, and a downscale to HEAD_PX. FRAMING holds a per-photo face centre
(fractions of width/height) and zoom, because the faces are not consistently
placed and a blind centre-crop lops off chins and foreheads.

Usage:  python3 tools/build_heads.py
Writes: assets/ROXPIKMIN/head1.png … headN.png  (RGBA, circular)
"""
import os
import numpy as np
from PIL import Image

# three of the five originals are HEIC, which Pillow can't open unaided
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    print("note: pip install pillow-heif to read the .HEIC originals")

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "assets", "ROXPIKMIN")
HEAD_PX = 256

# name -> (face centre x, face centre y, crop size as a fraction of the short side)
FRAMING = {
    "IMG_1061": (0.47, 0.52, 0.85),
    "IMG_2120": (0.50, 0.58, 0.92),
    "IMG_2730": (0.55, 0.62, 0.91),
    "IMG_3124": (0.52, 0.55, 0.94),
    "IMG_5490": (0.57, 0.52, 0.86),
}


def load(path):
    im = Image.open(path)
    # phone photos carry EXIF rotation; without this some faces come out sideways
    try:
        from PIL import ImageOps
        im = ImageOps.exif_transpose(im)
    except Exception:
        pass
    return im.convert("RGB")


def circular_head(im, cx, cy, zoom):
    w, h = im.size
    side = int(min(w, h) * zoom)
    x = int(w * cx - side / 2)
    y = int(h * cy - side / 2)
    # keep the crop inside the frame rather than letting Pillow pad it black
    x = max(0, min(x, w - side))
    y = max(0, min(y, h - side))
    face = im.crop((x, y, x + side, y + side)).resize((HEAD_PX, HEAD_PX), Image.LANCZOS)

    # soft-edged circular mask: a hard edge shimmers badly once the head is
    # scaled down to bug size and redrawn every boil tick
    yy, xx = np.mgrid[0:HEAD_PX, 0:HEAD_PX]
    r = np.hypot(xx - HEAD_PX / 2, yy - HEAD_PX / 2) / (HEAD_PX / 2)
    alpha = np.clip((0.99 - r) / 0.04, 0, 1)

    out = np.dstack([np.asarray(face).astype(float), alpha * 255])
    return Image.fromarray(np.clip(out, 0, 255).astype("uint8"), "RGBA")


def main():
    src_dir = os.path.normpath(SRC)
    originals = sorted(
        f for f in os.listdir(src_dir)
        if f.upper().endswith((".HEIC", ".JPG", ".JPEG", ".PNG"))
        and not f.startswith("head")
    )
    n = 0
    for f in originals:
        stem = os.path.splitext(f)[0]
        if stem not in FRAMING:
            print(f"skip {f} (no framing entry)")
            continue
        try:
            im = load(os.path.join(src_dir, f))
        except Exception as e:
            print(f"skip {f}: {e}")
            continue
        n += 1
        head = circular_head(im, *FRAMING[stem])
        out = os.path.join(src_dir, f"head{n}.png")
        head.save(out)
        print(f"{f} -> head{n}.png  {head.size}")
    print(f"\n{n} heads written")


if __name__ == "__main__":
    main()
