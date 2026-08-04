#!/usr/bin/env python3
"""Generate simple PNG icons (skip-forward glyph on a blue rounded square).

No third-party deps — encodes PNG via zlib + struct. Run: python3 make_icons.py
"""
import os
import struct
import zlib

BG = (91, 140, 255, 255)      # blue
FG = (255, 255, 255, 255)     # white glyph
TRANSPARENT = (0, 0, 0, 0)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")


def rounded(x, y, n, r):
    """True if pixel (x,y) is inside an n×n rounded square with corner radius r."""
    # Clamp the pixel to the inner rectangle whose corners sit at radius r; the
    # distance from there is only nonzero inside a corner region, so one check
    # against the nearest corner arc handles all four corners correctly.
    cx = min(max(x, r), n - 1 - r)
    cy = min(max(y, r), n - 1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def in_glyph(x, y, n):
    """Skip-forward symbol: two right-pointing triangles + a vertical bar."""
    fx, fy = x / n, y / n
    if not (0.28 <= fy <= 0.72):
        return False
    # two triangles, each spanning a horizontal band
    for x0, x1 in ((0.22, 0.46), (0.46, 0.70)):
        if x0 <= fx <= x1:
            t = (fx - x0) / (x1 - x0)              # 0..1 across the triangle
            half = 0.22 * (1 - t)                  # tapers to a point on the right
            if abs(fy - 0.5) <= half:
                return True
    # trailing vertical bar
    if 0.72 <= fx <= 0.80:
        return True
    return False


def build(n):
    raw = bytearray()
    for y in range(n):
        raw.append(0)  # PNG filter type 0 per scanline
        for x in range(n):
            if not rounded(x, y, n, max(2, n // 6)):
                px = TRANSPARENT
            elif in_glyph(x, y, n):
                px = FG
            else:
                px = BG
            raw.extend(px)
    return bytes(raw)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data +
            struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def write_png(path, n):
    ihdr = struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", ihdr) +
           chunk(b"IDAT", zlib.compress(build(n), 9)) +
           chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for n in (16, 48, 128):
        write_png(os.path.join(OUT_DIR, f"icon{n}.png"), n)


if __name__ == "__main__":
    main()
