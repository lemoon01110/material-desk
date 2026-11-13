#!/usr/bin/env python3
"""Make the built-in wallpaper (extension/wallpapers/dusk.svg). Only Dusk is kept (owner 2026-11-12: "Only Dusk");
Dune, Tide, Fern, Aurora and Bloom are in the git history if they are ever wanted back.

    python3 -I tools/wallpapers.py

Procedural art drawn from code, so there is no image license to track: layered ridges, waves and soft light made
of plain paths and gradients (no SVG filters, so a new tab paints them fast). Deterministic: the same seed draws the
same picture. Each file is 1600x900 and scaled to cover the page.
"""
import math
import os
import random

W, H = 1600, 900
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "extension", "wallpapers")


def ridge(rnd, base, amp, waves=4, step=20, top=None):
    """A smooth ridge line across the width (a sum of sines), closed down to the bottom edge."""
    parts = [(rnd.uniform(0.6, 2.4) * (k + 1), rnd.uniform(0, math.tau), amp / (k + 1.2)) for k in range(waves)]
    pts = []
    for x in range(-step, W + 2 * step, step):
        y = base + sum(a * math.sin(f * x / W * math.tau + p) for f, p, a in parts)
        pts.append((x, y))
    d = f"M{pts[0][0]} {pts[0][1]:.1f}"
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d += f" Q{x0} {y0:.1f} {(x0 + x1) / 2:.1f} {(y0 + y1) / 2:.1f}"
    end = H + 10 if top is None else top
    return d + f" L{W + 2 * step} {end} L{-step} {end} Z"


def svg(defs, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f"<defs>{defs}</defs>{body}</svg>\n")


def lin(gid, stops, x2=0, y2=1):
    s = "".join(f'<stop offset="{o}" stop-color="{c}"{f" stop-opacity=\"{a}\"" if a is not None else ""}/>'
                for o, c, a in [(t + (None,))[:3] for t in stops])
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad(gid, stops, cx=0.5, cy=0.5, r=0.5):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{gid}" cx="{cx}" cy="{cy}" r="{r}">{s}</radialGradient>'


def layered(name, seed, sky, glow, layers, sun=None):
    """Sky gradient, an optional low sun or moon with a halo, then ridges from far (light) to near (dark)."""
    rnd = random.Random(seed)
    cx, cy, r = glow[0]
    if sun:   # the halo is centered on the sun itself (owner 2026-11-12: "the light gradient centered with the sun")
        cx, cy = round(sun[0] / W, 4), round(sun[1] / H, 4)
    defs = lin("sky", sky) + rad("glow", glow[1], cx, cy, r)
    body = f'<rect width="{W}" height="{H}" fill="url(#sky)"/><rect width="{W}" height="{H}" fill="url(#glow)"/>'
    if sun:
        x, y, r, c = sun
        body += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
    for i, (base, amp, color) in enumerate(layers):
        defs += lin(f"l{i}", [(0, color[0]), (1, color[1])])
        body += f'<path d="{ridge(rnd, base, amp)}" fill="url(#l{i})"/>'
    return svg(defs, body)


WALLPAPERS = {
    # Violet dusk over blue mountains (the first-run default).
    "dusk": lambda: layered("dusk", 3,
        [(0, "#140f2e"), (0.55, "#3a2a66"), (0.8, "#7a4f8f"), (1, "#c98a8a")],
        ((0.68, 0.62, 0.55), [(0, "#ffc7a1", 0.55), (0.45, "#b46aa0", 0.18), (1, "#3a2a66", 0)]),
        [(560, 70, ("#5b4a8c", "#3d3170")), (630, 60, ("#3f3474", "#2a2257")),
         (710, 55, ("#2a2257", "#1b1640")), (800, 45, ("#17122f", "#0d0a1d"))],
        sun=(1090, 520, 46, "#ffd9bd")),
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, make in WALLPAPERS.items():
        data = make()
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(data)
        print(f"{name}.svg  {len(data)} bytes")
