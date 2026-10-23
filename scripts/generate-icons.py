#!/usr/bin/env python3
"""Generate the Keep Notes icon set (no external dependencies required)."""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
SCALE = 8
SIZES = (16, 32, 48, 128)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_icon(size):
    canvas = size * SCALE
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Vertical gradient background clipped to a rounded square.
    bg = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    top = (99, 102, 241)
    bottom = (124, 58, 237)
    for y in range(canvas):
        bg_draw.line([(0, y), (canvas, y)], fill=(*lerp(top, bottom, y / canvas), 255))
    mask = Image.new("L", (canvas, canvas), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, canvas - 1, canvas - 1), radius=int(canvas * 0.24), fill=255
    )
    img.paste(bg, (0, 0), mask)
    draw = ImageDraw.Draw(img)

    # Note sheet.
    pad = canvas * 0.22
    note = (pad, pad * 0.9, canvas - pad, canvas - pad * 0.9)
    rounded(draw, note, canvas * 0.075, (255, 255, 255, 255))

    # Rule lines.
    left = note[0] + canvas * 0.09
    right = note[2] - canvas * 0.09
    line_h = max(1, int(canvas * 0.035))
    for i, frac in enumerate((0.32, 0.5, 0.68)):
        y = note[1] + (note[3] - note[1]) * frac
        width = right - left if i < 2 else (right - left) * 0.62
        rounded(
            draw,
            (left, y, left + width, y + line_h),
            line_h / 2,
            (99, 102, 241, 235),
        )

    # Small accent tab for a sticky-note feel.
    tab_w = (right - left) * 0.3
    tab_h = canvas * 0.055
    rounded(
        draw,
        (left, note[3] - canvas * 0.13, left + tab_w, note[3] - canvas * 0.13 + tab_h),
        tab_h / 2,
        (245, 158, 11, 255),
    )

    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        make_icon(size).save(OUT / f"icon{size}.png")
    print(f"Wrote icons for {', '.join(f'{s}px' for s in SIZES)} to {OUT}")


if __name__ == "__main__":
    main()
