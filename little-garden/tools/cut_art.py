# Cuts the picture sheets in art-src/ into single webp sprites in art/, plus art/sizes.json.
# Plants and animals come from garden.json, so a new word needs no change here.
# Run:  python3 tools/cut_art.py
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "art-src"), os.path.join(ROOT, "art")
os.makedirs(OUT, exist_ok=True)

def split(occ, n):
    """Split a 1-D occupancy mask into n spans at the n-1 widest interior gaps.
    Widest gaps, not every gap: leaves and vines often leave hairline gaps inside one picture."""
    idx = np.nonzero(occ)[0]
    lo, hi = int(idx.min()), int(idx.max())
    gaps, x = [], lo
    while x <= hi:
        if occ[x]:
            x += 1
            continue
        g0 = x
        while x <= hi and not occ[x]:
            x += 1
        gaps.append((x - g0, g0, x))
    if len(gaps) < n - 1:
        return None
    cuts = sorted(sorted(gaps, reverse=True)[: n - 1], key=lambda g: g[1])
    edges = [lo] + [e for g in cuts for e in (g[1], g[2])] + [hi + 1]
    return [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]

def pieces(path, rows):
    """rows = pictures per row, top to bottom. Returns boxes in reading order."""
    a = np.array(Image.open(path).convert("RGBA"))[:, :, 3] > 24
    bands = split(a.sum(axis=1) > 2, len(rows))
    if bands is None:
        sys.exit(f"FAIL {os.path.basename(path)}: cannot find {len(rows)} rows. Leave clear space between rows.")
    boxes = []
    for (y0, y1), n in zip(bands, rows):
        cols = split(a[y0:y1].sum(axis=0) > 2, n)
        if cols is None:
            boxes += by_shape(a, y0, y1, n, path)
            continue
        for x0, x1 in cols:
            ys = np.nonzero(a[y0:y1, x0:x1].any(axis=1))[0]
            boxes.append(((x0, y0 + int(ys.min()), x1, y0 + int(ys.max()) + 1), None))
    return boxes

def by_shape(a, y0, y1, n, path):
    """Fallback when pictures overlap in columns (tree canopies): cut the n largest separate shapes,
    each with its own mask so no sliver of a neighbour comes along."""
    from scipy import ndimage
    band = np.zeros_like(a)
    band[y0:y1] = a[y0:y1]
    lab, _ = ndimage.label(ndimage.binary_opening(band, iterations=2))
    areas = ndimage.sum(np.ones_like(lab), lab, index=range(1, lab.max() + 1))
    keep = sorted(np.argsort(areas)[::-1][:n] + 1, key=lambda i: np.nonzero(lab == i)[1].min())
    if len(keep) < n or areas[keep[-1] - 1] < 0.1 * areas.max():
        sys.exit(f"FAIL {os.path.basename(path)}: expected {n} pictures in a row but some touch. "
                 "Leave clear space between pictures, or cut this sheet by hand.")
    out = []
    for i in keep:
        m = ndimage.binary_dilation(lab == i, iterations=3) & band
        ys, xs = np.nonzero(m)
        box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        out.append((box, m[box[1]:box[3], box[0]:box[2]]))
    return out

sizes = {}
def save(sheet, piece, name, scale):
    box, mask = piece
    im = Image.open(os.path.join(SRC, sheet)).convert("RGBA").crop(box)
    if mask is not None:
        px = np.array(im)
        px[:, :, 3] = px[:, :, 3] * mask
        im = Image.fromarray(px)
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, name + ".webp"), "WEBP", quality=84, method=6)
    sizes[name] = [w, h]

data = json.load(open(os.path.join(ROOT, "garden.json")))

# Plant sheets hold the five growth steps in one row; one scale for all keeps their sizes relative.
for p in data["plants"]:
    for i, box in enumerate(pieces(os.path.join(SRC, p["sheet"]), [5]), 1):
        save(p["sheet"], box, f"{p['id']}_{i}", 0.5)

for a in data["animals"]:
    boxes = pieces(os.path.join(SRC, a["sheet"]), [a.get("of", 1)])
    save(a["sheet"], boxes[a.get("piece", 1) - 1], a["id"], 0.5)

SCENE = {
    "beds.png":   ([4], ["bed_dry", "bed_wet", None, "seed_mound"], {"bed_dry": 1.0, "bed_wet": 1.0}),
    "farmer.png": ([4], ["farmer", None, None, None], {}),
    "trees.png":  ([5], ["tree_orange", "tree_red", "tree_yellow", "pine", "pine_small"], {}),
    "nature.png": ([5, 4], ["bush_green", "bush_orange", "bush_berry", "flowers_white", "flowers_purple",
                            "rock_big", "rock", "rocks_small", "stump"], {}),
}
for sheet, (rows, names, scales) in SCENE.items():
    for box, name in zip(pieces(os.path.join(SRC, sheet), rows), names):
        if name:
            save(sheet, box, name, scales.get(name, 0.5))

json.dump(sizes, open(os.path.join(OUT, "sizes.json"), "w"), indent=0, sort_keys=True)
print(f"cut {len(sizes)} pictures into art/")
