#!/usr/bin/env python3
"""Generate the Keep Notes icon set from the source artwork in assets/icon-source.png."""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "icon-source.png"
OUT = ROOT / "public" / "icons"
SIZES = (16, 32, 48, 128)

# Below this size the "Keep Notes" lettering is illegible, so only the sticky note is used.
FULL_ART_MIN_SIZE = 96
# Square crop around the sticky note in source pixels (left, top, side).
NOTE_CROP = (290, 160, 640)
NOTE_RADIUS = 0.22
WHITE_THRESHOLD = 247


def cut_out_background(img):
    """Make the white page around the rounded tile transparent and crop to the tile."""
    r, g, b = img.split()
    darkest = ImageChops.darker(ImageChops.darker(r, g), b)
    regions = darkest.point(lambda v: 255 if v >= WHITE_THRESHOLD else 0)
    # Flood only the outer white so white highlights inside the art stay opaque.
    for corner in ((0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1)):
        if regions.getpixel(corner) == 255:
            ImageDraw.floodfill(regions, corner, 128)
    mask = regions.point(lambda v: 0 if v == 128 else 255)
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1))

    tile = img.convert("RGBA")
    tile.putalpha(mask)
    left, top, right, bottom = mask.getbbox()
    side = max(right - left, bottom - top)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(tile.crop((left, top, right, bottom)), ((side - (right - left)) // 2, (side - (bottom - top)) // 2))
    return square


def note_mark(img):
    """Crop the sticky note onto its own rounded tile for small icon sizes."""
    left, top, side = NOTE_CROP
    mark = img.crop((left, top, left + side, top + side)).convert("RGBA")
    mask = Image.new("L", (side, side), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, side - 1, side - 1), radius=int(side * NOTE_RADIUS), fill=255)
    mark.putalpha(mask)
    return mark


def main():
    source = Image.open(SOURCE).convert("RGB")
    full = cut_out_background(source)
    mark = note_mark(source)
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        art = full if size >= FULL_ART_MIN_SIZE else mark
        art.resize((size, size), Image.LANCZOS).save(OUT / f"icon{size}.png", optimize=True)
    print(f"Wrote icons for {', '.join(f'{s}px' for s in SIZES)} to {OUT}")


if __name__ == "__main__":
    main()
