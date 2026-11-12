#!/usr/bin/env python3
"""Make the built-in wallpapers (extension/wallpapers/*.svg).

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
    defs = lin("sky", sky) + rad("glow", glow[1], *glow[0])
    body = f'<rect width="{W}" height="{H}" fill="url(#sky)"/><rect width="{W}" height="{H}" fill="url(#glow)"/>'
    if sun:
        x, y, r, c = sun
        body += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
    for i, (base, amp, color) in enumerate(layers):
        defs += lin(f"l{i}", [(0, color[0]), (1, color[1])])
        body += f'<path d="{ridge(rnd, base, amp)}" fill="url(#l{i})"/>'
    return svg(defs, body)


def aurora():
    rnd = random.Random(7)
    defs = lin("sky", [(0, "#0b0614"), (0.55, "#1a0b24"), (1, "#2a0f2c")])
    body = f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
    for i in range(140):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H * 0.62), rnd.choice([0.8, 1, 1.2, 1.6])
        body += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#fbe6f2" opacity="{rnd.uniform(0.25, 0.8):.2f}"/>'
    ribbons = [("#ff7ab6", 250, 90), ("#c86bff", 330, 70), ("#ff9f8a", 410, 55)]
    for i, (c, base, amp) in enumerate(ribbons):
        defs += lin(f"r{i}", [(0, c, 0), (0.35, c, 0.55), (1, c, 0)])
        top = ridge(rnd, base, amp, waves=3)
        # A curtain: the ridge line, then straight down 260px, so the light hangs like an aurora.
        d = top.rsplit(" L", 2)[0]
        body += f'<path d="{d} L{W + 40} {base + 260} L-40 {base + 260} Z" fill="url(#r{i})" opacity="0.8"/>'
    defs += lin("hill", [(0, "#3a1636"), (1, "#12060f")])
    body += f'<path d="{ridge(rnd, 760, 40)}" fill="url(#hill)"/>'
    return svg(defs, body)


def bloom():
    """Soft overlapping Material-like rounded shapes in coral and wine, lit from the top left."""
    rnd = random.Random(11)
    defs = lin("bg", [(0, "#2b0d14"), (1, "#14060a")], x2=1, y2=1)
    body = f'<rect width="{W}" height="{H}" fill="url(#bg)"/>'
    blobs = [(330, 260, 330, "#ff6f61", 0.55), (1180, 230, 260, "#ff9a7b", 0.4), (900, 720, 420, "#c2185b", 0.45),
             (180, 820, 260, "#ff8a65", 0.35), (1500, 760, 300, "#ad1457", 0.4), (760, 380, 200, "#ffb199", 0.3)]
    for i, (cx, cy, r, c, a) in enumerate(blobs):
        defs += rad(f"b{i}", [(0, c, a), (0.7, c, a * 0.35), (1, c, 0)])
        lobes, rot = rnd.choice([6, 7, 8, 9]), rnd.uniform(0, math.tau)
        pts = []
        for k in range(73):
            t = k / 72 * math.tau
            rr = r * (1 + 0.08 * math.cos(lobes * t + rot))
            pts.append(f"{cx + rr * math.cos(t):.1f} {cy + rr * math.sin(t):.1f}")
        body += f'<path d="M{" L".join(pts)} Z" fill="url(#b{i})"/>'
    return svg(defs, body)


WALLPAPERS = {
    # Violet dusk over blue mountains (the first-run default).
    "dusk": lambda: layered("dusk", 3,
        [(0, "#140f2e"), (0.55, "#3a2a66"), (0.8, "#7a4f8f"), (1, "#c98a8a")],
        ((0.68, 0.62, 0.55), [(0, "#ffc7a1", 0.55), (0.45, "#b46aa0", 0.18), (1, "#3a2a66", 0)]),
        [(560, 70, ("#5b4a8c", "#3d3170")), (630, 60, ("#3f3474", "#2a2257")),
         (710, 55, ("#2a2257", "#1b1640")), (800, 45, ("#17122f", "#0d0a1d"))],
        sun=(1090, 520, 46, "#ffd9bd")),
    # Warm desert dunes under an amber evening.
    "dune": lambda: layered("dune", 5,
        [(0, "#1f0f08"), (0.5, "#5a2a12"), (1, "#c2672b")],
        ((0.3, 0.55, 0.6), [(0, "#ffb26b", 0.5), (1, "#5a2a12", 0)]),
        [(560, 35, ("#b8612a", "#7a3816")), (640, 45, ("#93461c", "#5c2a10")),
         (730, 40, ("#6e3213", "#401c0a")), (820, 30, ("#3a1a09", "#1f0d05"))]),
    # Deep sea and rolling teal waves.
    "tide": lambda: layered("tide", 9,
        [(0, "#03161c"), (0.6, "#0b3a44"), (1, "#14606a")],
        ((0.5, 0.25, 0.7), [(0, "#7fe3d6", 0.35), (1, "#0b3a44", 0)]),
        [(470, 25, ("#1d7a80", "#125259")), (560, 30, ("#14606a", "#0c434b")),
         (660, 35, ("#0d4851", "#08313a")), (770, 30, ("#072a31", "#03161c"))]),
    # Misty green hills.
    "fern": lambda: layered("fern", 13,
        [(0, "#0d1a10"), (0.5, "#24402a"), (1, "#5f8a5a")],
        ((0.75, 0.3, 0.6), [(0, "#e3f2b4", 0.35), (1, "#24402a", 0)]),
        [(520, 60, ("#4f7a4c", "#365c37")), (610, 55, ("#3a6139", "#264427")),
         (700, 50, ("#27452a", "#18301b")), (800, 40, ("#132816", "#0a150c"))]),
    # Rose and violet light over a dark ridge, with stars.
    "aurora": aurora,
    # Soft coral shapes on wine.
    "bloom": bloom,
}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, make in WALLPAPERS.items():
        data = make()
        with open(os.path.join(OUT, name + ".svg"), "w") as f:
            f.write(data)
        print(f"{name}.svg  {len(data)} bytes")
