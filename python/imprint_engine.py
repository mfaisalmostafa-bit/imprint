"""Class-scale imprint engine.

Drop-in for tpx_wix/mockup/imprint_engine.py

Classify by category / decoration.resolve family. Never by SKU.
A SKU branch that names five complaint products does not cover 1,486 SKUs.

Thresholds are body-relative so they hold on:
  - a packed catalogue photo (product may be ~0.12 of the frame, or fill it)
  - the 1400×1400 canvas rebuild (product occupies canvasFill of the frame)

Numbers
-------
Class          markOfBody  min  max  bodyLow  bodyHigh  zone         canvasFill
pen            0.78        0.55 0.96 0.03     0.99      barrel       0.70
bottle         0.42        0.28 0.72 0.05     0.92      mid-body     0.68
bag            0.30        0.22 0.48 0.22     0.995     front panel  0.70
cable          0.55        0.55 0.92 0.08     0.95      disc         0.64
notebook       0.36        0.32 0.70 0.18     0.96      cover band   0.62
apparel        0.22        0.45 0.92 0.20     0.96      chest        0.72
tech           0.42        0.32 0.86 0.10     0.95      face         0.68
award          0.28        0.30 0.78 0.12     0.92      face         0.70
display        0.70        0.50 0.92 0.20     0.98      print face   0.78
default        0.38        0.22 0.72 0.08     0.95      print face   0.70

Why these numbers (dual framing)
--------------------------------
bodyLow 0.05 on drinkware: a slim bottle in a packed catalogue shot reads ~0.12
of frame. The old 0.18 floor marked it untrusted and fell back to a 0.55-of-body
lock that sat on the neck.

bodyHigh 0.995 on bags: a backpack catalogue photo fills the frame (~0.88–0.95).
The old 0.72 ceiling marked it untrusted and inflated the mark past the panel.

canvasFill 0.62 on notebooks: 0.72-of-frame rebuild clipped the cover to the
clasp / rib. Crop must keep ≥0.85 of the cover bbox.

Disc radius is min(body.w, body.h)*0.46 — never a pixel hub radius, which
changes between the catalogue photo and the 1400 canvas.

Placeholder size is a fraction of the *body mask*, not the frame. Brightness
uses body percentiles, not an absolute grey floor — texture and exposure
shift between the two framings.

Wire-up
-------
    family = decoration.resolve(product)   # already covers ~1330 / 1486
    cls = classify({**product, "family": family})
    spec = class_scale(cls)
    zone = pick_zone(cls, body_quad, w=w, h=h, lum=lum, mask=mask)["winner"]["quad"]
    fit  = fit_mark_scale(body_w, zone_w, spec["maxScale"], preferred, cls)
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

MarkClass = str

CLASS_SCALE: dict[str, dict[str, Any]] = {
    "pen": {
        "id": "pen",
        "markOfBody": 0.78,
        "minScale": 0.55,
        "maxScale": 0.96,
        "bodyLow": 0.03,
        "bodyHigh": 0.99,
        "zone": "barrel",
        "badge": "PEN · barrel",
        "canvasFill": 0.70,
        "canvasPad": 0.08,
    },
    "bottle": {
        "id": "bottle",
        "markOfBody": 0.42,
        "minScale": 0.28,
        "maxScale": 0.72,
        "bodyLow": 0.05,
        "bodyHigh": 0.92,
        "zone": "mid-body",
        "badge": "BOTTLE · mid-body",
        "canvasFill": 0.68,
        "canvasPad": 0.10,
    },
    "bag": {
        "id": "bag",
        "markOfBody": 0.30,
        "minScale": 0.22,
        "maxScale": 0.48,
        "bodyLow": 0.22,
        "bodyHigh": 0.995,
        "zone": "front panel",
        "badge": "BAG · front panel",
        "canvasFill": 0.70,
        "canvasPad": 0.06,
    },
    "cable": {
        "id": "cable",
        "markOfBody": 0.55,
        "minScale": 0.55,
        "maxScale": 0.92,
        "bodyLow": 0.08,
        "bodyHigh": 0.95,
        "zone": "disc",
        "badge": "CABLE · disc",
        "canvasFill": 0.64,
        "canvasPad": 0.10,
    },
    "notebook": {
        "id": "notebook",
        "markOfBody": 0.36,
        "minScale": 0.32,
        "maxScale": 0.70,
        "bodyLow": 0.18,
        "bodyHigh": 0.96,
        "zone": "cover band",
        "badge": "NOTEBOOK · band",
        "canvasFill": 0.62,
        "canvasPad": 0.12,
    },
    "apparel": {
        "id": "apparel",
        "markOfBody": 0.22,
        "minScale": 0.45,
        "maxScale": 0.92,
        "bodyLow": 0.20,
        "bodyHigh": 0.96,
        "zone": "chest",
        "badge": "APPAREL · chest",
        "canvasFill": 0.72,
        "canvasPad": 0.06,
    },
    "tech": {
        "id": "tech",
        "markOfBody": 0.42,
        "minScale": 0.32,
        "maxScale": 0.86,
        "bodyLow": 0.10,
        "bodyHigh": 0.95,
        "zone": "face",
        "badge": "TECH · face",
        "canvasFill": 0.68,
        "canvasPad": 0.08,
    },
    "award": {
        "id": "award",
        "markOfBody": 0.28,
        "minScale": 0.30,
        "maxScale": 0.78,
        "bodyLow": 0.12,
        "bodyHigh": 0.92,
        "zone": "face",
        "badge": "AWARD · face",
        "canvasFill": 0.70,
        "canvasPad": 0.08,
    },
    "display": {
        "id": "display",
        "markOfBody": 0.70,
        "minScale": 0.50,
        "maxScale": 0.92,
        "bodyLow": 0.20,
        "bodyHigh": 0.98,
        "zone": "print face",
        "badge": "DISPLAY · face",
        "canvasFill": 0.78,
        "canvasPad": 0.04,
    },
    "default": {
        "id": "default",
        "markOfBody": 0.38,
        "minScale": 0.22,
        "maxScale": 0.72,
        "bodyLow": 0.08,
        "bodyHigh": 0.95,
        "zone": "print face",
        "badge": "ENGINE · print face",
        "canvasFill": 0.70,
        "canvasPad": 0.08,
    },
}

FAMILY_CLASS = {
    "pen": "pen",
    "pens": "pen",
    "writing": "pen",
    "pencil": "pen",
    "bottle": "bottle",
    "bottles": "bottle",
    "drinkware": "bottle",
    "tumbler": "bottle",
    "flask": "bottle",
    "mug": "bottle",
    "cup": "bottle",
    "thermos": "bottle",
    "bag": "bag",
    "bags": "bag",
    "tote": "bag",
    "backpack": "bag",
    "rucksack": "bag",
    "packaging": "bag",
    "notebook": "notebook",
    "notebooks": "notebook",
    "stationery": "notebook",
    "journal": "notebook",
    "cable": "cable",
    "cables": "cable",
    "hub": "cable",
    "tech": "tech",
    "electronics": "tech",
    "usb": "tech",
    "powerbank": "tech",
    "apparel": "apparel",
    "textile": "apparel",
    "clothing": "apparel",
    "award": "award",
    "awards": "award",
    "display": "display",
    "signage": "display",
}

CATEGORY_CLASS = {
    "writing": "pen",
    "drinkware": "bottle",
    "stationery": "notebook",
    "apparel": "apparel",
    "awards": "award",
    "display": "display",
    "packaging": "bag",
    "tech": "tech",
}

_CABLE_NAME = re.compile(r"\b(cable|cables|hub|charging disc)\b", re.I)
_PEN_NAME = re.compile(r"\b(pen|pens|pencil|ballpoint)\b", re.I)
_BOTTLE_NAME = re.compile(r"\b(bottle|flask|tumbler|mug|cup|thermos|drinkware)\b", re.I)
_BAG_NAME = re.compile(r"\b(backpack|rucksack|tote|bag|bags)\b", re.I)
_NOTE_NAME = re.compile(r"\b(notebook|journal|diary|stationery)\b", re.I)
_APPAREL_NAME = re.compile(r"\b(polo|t-?shirt|hoodie|cap|apparel|textile)\b", re.I)
_AWARD_NAME = re.compile(r"\b(award|trophy|plaque)\b", re.I)
_DISPLAY_NAME = re.compile(r"\b(billboard|totem|signage|display)\b", re.I)
_TECH_NAME = re.compile(r"\b(power ?bank|usb|electronics)\b", re.I)


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def class_scale(cls: str | None = None) -> dict[str, Any]:
    return CLASS_SCALE.get(cls or "default", CLASS_SCALE["default"])


def _family_tokens(product: Mapping[str, Any]) -> list[str]:
    raw = product.get("family")
    if raw is None:
        raw = product.get("decoration")
    if isinstance(raw, Mapping):
        raw = raw.get("family") or raw.get("kind") or raw.get("class") or ""
    if not raw:
        raw = _try_decoration_resolve(product) or ""
    return [t for t in re.split(r"[^a-z0-9]+", str(raw).lower()) if t]


def _try_decoration_resolve(product: Mapping[str, Any]) -> str | None:
    """Use the existing catalogue classifier when it is on the path."""
    try:
        from decoration import resolve  # type: ignore
    except Exception:
        return None
    try:
        out = resolve(product)
    except Exception:
        return None
    if isinstance(out, str):
        return out
    if isinstance(out, Mapping):
        return out.get("family") or out.get("kind") or out.get("class")
    return None


def classify(product: Mapping[str, Any] | None = None, **kwargs: Any) -> str:
    """Map a catalogue product to a mark class. Never reads SKU."""
    product = {**(product or {}), **kwargs}
    cat = str(product.get("category") or "").strip().lower()
    blob = f"{product.get('name') or ''} {product.get('material') or ''}".lower()

    for tok in _family_tokens(product):
        mapped = FAMILY_CLASS.get(tok)
        if mapped:
            if mapped == "tech" and _CABLE_NAME.search(blob):
                return "cable"
            return mapped

    from_cat = CATEGORY_CLASS.get(cat)
    if from_cat:
        if from_cat == "tech" and _CABLE_NAME.search(blob):
            return "cable"
        return from_cat

    if _CABLE_NAME.search(blob):
        return "cable"
    if _PEN_NAME.search(blob):
        return "pen"
    if _NOTE_NAME.search(blob):
        return "notebook"
    if _BAG_NAME.search(blob):
        return "bag"
    if _BOTTLE_NAME.search(blob):
        return "bottle"
    if _APPAREL_NAME.search(blob):
        return "apparel"
    if _AWARD_NAME.search(blob):
        return "award"
    if _DISPLAY_NAME.search(blob):
        return "display"
    if _TECH_NAME.search(blob):
        return "tech"
    return "default"


def body_trusted(body_width: float, cls: str | None = None) -> bool:
    spec = class_scale(cls)
    return spec["bodyLow"] <= body_width < spec["bodyHigh"]


def fit_mark_scale(
    body_width: float,
    zone_width: float,
    max_scale: float,
    preferred: float,
    cls: str | None = None,
) -> dict[str, Any]:
    spec = class_scale(cls)
    max_scale = max(spec["minScale"], min(max_scale, spec["maxScale"]))
    zone_w = max(0.04, zone_width)
    trusted = body_trusted(body_width, cls)
    if not trusted:
        cap = max_scale
        lo = min(spec["minScale"], cap)
        scale = _clamp(preferred, lo, cap)
        return {
            "scale": scale,
            "trusted": False,
            "cap": cap,
            "note": "Body filled the frame — sized from the print zone, not the photo.",
        }
    from_body = (spec["markOfBody"] * body_width) / zone_w
    cap = min(max_scale, from_body)
    lo = min(spec["minScale"], cap)
    preferred = _clamp(preferred, lo, max_scale)
    return {
        "scale": _clamp(min(preferred, cap), lo, cap),
        "trusted": True,
        "cap": cap,
        "note": f"{spec['badge']} — mark capped to the product body.",
    }


def mark_body_ratio(scale: float, zone_width: float, body_width: float) -> float:
    return (scale * max(0.04, zone_width)) / max(1e-6, body_width)


Point = dict[str, float]
Quad = Sequence[Point]
Box = dict[str, float]


def box_of(q: Quad) -> Box:
    xs = [p["x"] for p in q]
    ys = [p["y"] for p in q]
    x = min(xs)
    y = min(ys)
    return {"x": x, "y": y, "w": max(xs) - x, "h": max(ys) - y}


def _rect_quad(cx: float, cy: float, w: float, h: float) -> list[Point]:
    hw, hh = w / 2, h / 2
    return [
        {"x": _clamp(cx - hw, 0.02, 0.98), "y": _clamp(cy - hh, 0.02, 0.98)},
        {"x": _clamp(cx + hw, 0.02, 0.98), "y": _clamp(cy - hh, 0.02, 0.98)},
        {"x": _clamp(cx + hw, 0.02, 0.98), "y": _clamp(cy + hh, 0.02, 0.98)},
        {"x": _clamp(cx - hw, 0.02, 0.98), "y": _clamp(cy + hh, 0.02, 0.98)},
    ]


def zone_for_class(body: Quad, cls: str) -> list[Point]:
    b = box_of(body)
    cx = b["x"] + b["w"] / 2
    cy = b["y"] + b["h"] / 2
    if cls == "pen":
        if b["w"] > b["h"] * 1.25:
            return _rect_quad(cx, cy, b["w"] * 0.58, b["h"] * 0.62)
        return _rect_quad(cx, cy - b["h"] * 0.06, b["w"] * 0.62, b["h"] * 0.32)
    if cls == "bottle":
        if b["w"] > b["h"] * 1.15:
            return _rect_quad(cx, cy, b["w"] * 0.32, b["h"] * 0.42)
        return _rect_quad(cx, b["y"] + b["h"] * 0.48, b["w"] * 0.34, b["h"] * 0.36)
    if cls == "bag":
        return _rect_quad(cx, b["y"] + b["h"] * 0.44, b["w"] * 0.4, b["h"] * 0.28)
    if cls == "cable":
        s = min(b["w"], b["h"]) * 0.48
        return _rect_quad(cx, cy, s, s)
    if cls == "notebook":
        return _rect_quad(b["x"] + b["w"] * 0.4, b["y"] + b["h"] * 0.36, b["w"] * 0.5, b["h"] * 0.16)
    if cls == "apparel":
        return _rect_quad(b["x"] + b["w"] * 0.38, b["y"] + b["h"] * 0.34, b["w"] * 0.22, b["h"] * 0.16)
    if cls == "tech":
        return _rect_quad(cx, cy, b["w"] * 0.56, b["h"] * 0.36)
    return _rect_quad(cx, cy, b["w"] * 0.5, b["h"] * 0.4)


def disc_quad(body: Quad) -> list[Point]:
    b = box_of(body)
    s = min(b["w"], b["h"]) * 0.46
    return _rect_quad(b["x"] + b["w"] / 2, b["y"] + b["h"] / 2, s, s)


def _clamp_crop(c: Box) -> Box:
    x, y, w, h = c["x"], c["y"], c["w"], c["h"]
    if x < 0:
        w += x
        x = 0.0
    if y < 0:
        h += y
        y = 0.0
    if x + w > 1:
        w = 1 - x
    if y + h > 1:
        h = 1 - y
    if w < 0.2:
        w = min(1.0, 0.2)
    if h < 0.2:
        h = min(1.0, 0.2)
    return {
        "x": _clamp(x, 0, 1),
        "y": _clamp(y, 0, 1),
        "w": _clamp(w, 0.08, 1),
        "h": _clamp(h, 0.08, 1),
    }


def smart_canvas_crop(body: Mapping[str, float], cls: str) -> Box:
    spec = class_scale(cls)
    pad = spec["canvasPad"]
    fill = spec["canvasFill"]
    w = max(body["w"] * (1 + 2 * pad), min(1.0, body["w"] / fill))
    h = max(body["h"] * (1 + 2 * pad), min(1.0, body["h"] / fill))
    if cls == "notebook":
        w = max(w, body["w"] * 0.9)
        h = max(h, body["h"] * 0.9)
    crop = {
        "x": body["x"] + body["w"] / 2 - w / 2,
        "y": body["y"] + body["h"] / 2 - h / 2,
        "w": w,
        "h": h,
    }
    return _clamp_crop(crop)


def notebook_crop_sane(crop: Mapping[str, float], body: Mapping[str, float]) -> bool:
    cover = (
        min(crop["x"] + crop["w"], body["x"] + body["w"]) - max(crop["x"], body["x"])
    ) * (
        min(crop["y"] + crop["h"], body["y"] + body["h"]) - max(crop["y"], body["y"])
    )
    return cover / max(1e-6, body["w"] * body["h"]) >= 0.85


def body_on_canvas(body: Mapping[str, float], crop: Mapping[str, float]) -> Box:
    return {
        "x": (body["x"] - crop["x"]) / max(1e-6, crop["w"]),
        "y": (body["y"] - crop["y"]) / max(1e-6, crop["h"]),
        "w": body["w"] / max(1e-6, crop["w"]),
        "h": body["h"] / max(1e-6, crop["h"]),
    }


def placeholder_rect(
    w: int,
    h: int,
    lum: Sequence[float],
    mask: Sequence[int],
) -> Box | None:
    """Bright panel on the product face. Size vs body, contrast vs percentiles."""
    body_vals: list[float] = []
    bmin_x, bmin_y, bmax_x, bmax_y = w, h, 0, 0
    for y in range(h):
        row = y * w
        for x in range(w):
            i = row + x
            if not mask[i]:
                continue
            body_vals.append(lum[i])
            if x < bmin_x:
                bmin_x = x
            if x > bmax_x:
                bmax_x = x
            if y < bmin_y:
                bmin_y = y
            if y > bmax_y:
                bmax_y = y
    if len(body_vals) < 40:
        return None
    ordered = sorted(body_vals)
    n = len(ordered)
    lo = ordered[int(n * 0.18)]
    med = ordered[int(n * 0.50)]
    hi = ordered[int(n * 0.82)]
    span = hi - lo
    if span < 8:
        return None
    if hi - med < span * 0.18:
        return None
    thresh = med + (hi - med) * 0.45
    min_x, min_y, max_x, max_y, hits = w, h, 0, 0, 0
    for y in range(h):
        row = y * w
        for x in range(w):
            i = row + x
            if mask[i] and lum[i] >= thresh:
                hits += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
    if hits < 12:
        return None
    body_w = max(1, bmax_x - bmin_x + 1)
    body_h = max(1, bmax_y - bmin_y + 1)
    pw = (max_x - min_x + 1) / body_w
    ph = (max_y - min_y + 1) / body_h
    if pw < 0.15 or ph < 0.08 or pw > 0.85 or ph > 0.70:
        return None
    aspect = pw / max(0.001, ph)
    if aspect < 0.7 or aspect > 4.5:
        return None
    return {
        "x": min_x / w,
        "y": min_y / h,
        "w": (max_x - min_x + 1) / w,
        "h": (max_y - min_y + 1) / h,
    }


def crop_to_quad(c: Mapping[str, float]) -> list[Point]:
    return [
        {"x": c["x"], "y": c["y"]},
        {"x": c["x"] + c["w"], "y": c["y"]},
        {"x": c["x"] + c["w"], "y": c["y"] + c["h"]},
        {"x": c["x"], "y": c["y"] + c["h"]},
    ]


def _overlap(a: Mapping[str, float], b: Mapping[str, float]) -> float:
    x = max(0.0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    y = max(0.0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    return (x * y) / max(1e-6, a["w"] * a["h"])


def _body_bbox(w: int, h: int, mask: Sequence[int]) -> Box | None:
    x0, y0, x1, y1, n = w, h, 0, 0, 0
    for y in range(h):
        row = y * w
        for x in range(w):
            if not mask[row + x]:
                continue
            n += 1
            if x < x0:
                x0 = x
            if x > x1:
                x1 = x
            if y < y0:
                y0 = y
            if y > y1:
                y1 = y
    if n < 20:
        return None
    return {"x": x0 / w, "y": y0 / h, "w": (x1 - x0 + 1) / w, "h": (y1 - y0 + 1) / h}


def _connected_boxes(on: list[int], gw: int, gh: int, ox: float, oy: float, cw: float, ch: float) -> list[Box]:
    seen = [0] * len(on)
    out: list[Box] = []
    for i in range(len(on)):
        if not on[i] or seen[i]:
            continue
        stack = [i]
        seen[i] = 1
        min_x, min_y, max_x, max_y, n = gw, gh, 0, 0, 0
        while stack:
            p = stack.pop()
            x, y = p % gw, p // gw
            n += 1
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)
            for q, ok in ((p - 1, x > 0), (p + 1, x + 1 < gw), (p - gw, y > 0), (p + gw, y + 1 < gh)):
                if ok and on[q] and not seen[q]:
                    seen[q] = 1
                    stack.append(q)
        if n < 2:
            continue
        out.append(
            {
                "x": ox + (min_x / gw) * cw,
                "y": oy + (min_y / gh) * ch,
                "w": ((max_x - min_x + 1) / gw) * cw,
                "h": ((max_y - min_y + 1) / gh) * ch,
            }
        )
    out.sort(key=lambda c: c["w"] * c["h"], reverse=True)
    return out


def read_surface(w: int, h: int, lum: Sequence[float], mask: Sequence[int], body: Box | None = None) -> dict[str, Any]:
    empty: dict[str, Any] = {"strap": None, "clasp": None, "ribs": None, "specular": [], "demo": None, "panel": None}
    body = body or _body_bbox(w, h, mask)
    if not body:
        return empty
    GW = GH = 24
    mean = [0.0] * (GW * GH)
    vari = [0.0] * (GW * GH)
    gx = [0.0] * (GW * GH)
    hit = [0] * (GW * GH)
    x0, y0, cw, ch = body["x"] * w, body["y"] * h, body["w"] * w, body["h"] * h
    cell_w, cell_h = cw / GW, ch / GH
    vals: list[float] = []
    for gy in range(GH):
        for gx_ in range(GW):
            i = gy * GW + gx_
            sx, sy = x0 + gx_ * cell_w, y0 + gy * cell_h
            s = s2 = n = 0.0
            xA, xB = max(0, int(sx)), min(w, int(sx + cell_w) + 1)
            yA, yB = max(0, int(sy)), min(h, int(sy + cell_h) + 1)
            for y in range(yA, yB):
                row = y * w
                for x in range(xA, xB):
                    if not mask[row + x]:
                        continue
                    v = lum[row + x]
                    s += v
                    s2 += v * v
                    n += 1
            if n < 2:
                continue
            hit[i] = 1
            m = s / n
            mean[i] = m
            vari[i] = max(0.0, s2 / n - m * m)
            vals.append(m)
    for gy in range(GH):
        for gx_ in range(GW - 1):
            i = gy * GW + gx_
            if hit[i] and hit[i + 1]:
                gx[i] = abs(mean[i] - mean[i + 1])
    if len(vals) < 8:
        return empty
    ordered = sorted(vals)
    med = ordered[int(len(ordered) * 0.5)]
    p92 = ordered[int(len(ordered) * 0.92)]
    span = max(8.0, p92 - ordered[int(len(ordered) * 0.1)])

    row_mean = [med] * GH
    row_n = [0] * GH
    for gy in range(GH):
        s = n = 0.0
        for gx_ in range(GW):
            i = gy * GW + gx_
            if not hit[i]:
                continue
            s += mean[i]
            n += 1
        row_n[gy] = n
        row_mean[gy] = s / n if n else med
    strap = None
    best_strap = 0.0
    for a in range(GH):
        for b in range(a, min(GH, a + 4)):
            s = n = 0.0
            for y in range(a, b + 1):
                if row_n[y] < GW * 0.35:
                    continue
                s += abs(row_mean[y] - med)
                n += 1
            score = s / n if n else 0.0
            thick = (b - a + 1) / GH
            if score > best_strap and score > span * 0.22 and 0.04 <= thick <= 0.16:
                best_strap = score
                strap = {"x": body["x"], "y": body["y"] + (a / GH) * body["h"], "w": body["w"], "h": thick * body["h"]}

    clasp = None
    best_clasp = 0.0
    for gy in range(int(GH * 0.28), int(GH * 0.78)):
        for gx_ in range(int(GW * 0.55), GW - 1):
            for hh in range(2, 7):
                for ww in range(2, 7):
                    if gy + hh > GH or gx_ + ww > GW:
                        continue
                    s = v = n = 0.0
                    for y in range(gy, gy + hh):
                        for x in range(gx_, gx_ + ww):
                            i = y * GW + x
                            if not hit[i]:
                                continue
                            s += mean[i]
                            v += vari[i]
                            n += 1
                    if n < 3:
                        continue
                    aspect = ww / hh
                    if aspect < 0.35 or aspect > 2.8:
                        continue
                    score = v / n + abs(s / n - med)
                    area = (ww / GW) * (hh / GH)
                    if score > best_clasp and score > span * 0.18 and 0.01 <= area <= 0.12:
                        best_clasp = score
                        clasp = {
                            "x": body["x"] + (gx_ / GW) * body["w"],
                            "y": body["y"] + (gy / GH) * body["h"],
                            "w": (ww / GW) * body["w"],
                            "h": (hh / GH) * body["h"],
                        }

    spec_on = [1 if hit[i] and mean[i] >= p92 and mean[i] >= med + span * 0.35 else 0 for i in range(GW * GH)]
    specular = [
        c
        for c in _connected_boxes(spec_on, GW, GH, body["x"], body["y"], body["w"], body["h"])
        if min(c["w"], c["h"]) / max(c["w"], c["h"]) < 0.32
        or (c["w"] * c["h"] < body["w"] * body["h"] * 0.12 and max(c["w"], c["h"]) < max(body["w"], body["h"]) * 0.35)
    ]

    col_gx = [0.0] * GW
    for gx_ in range(GW):
        s = n = 0.0
        for gy in range(GH):
            i = gy * GW + gx_
            if not hit[i]:
                continue
            s += gx[i]
            n += 1
        col_gx[gx_] = s / n if n else 0.0
    gx_med = sorted(col_gx)[GW // 2] or 1.0
    rib_cols = [i for i, v in enumerate(col_gx) if v > gx_med * 1.7]
    ribs = None
    if len(rib_cols) >= GW * 0.28:
        ribs = {
            "x": body["x"] + (min(rib_cols) / GW) * body["w"],
            "y": body["y"],
            "w": ((max(rib_cols) - min(rib_cols) + 1) / GW) * body["w"],
            "h": body["h"],
        }

    flat_on = [0] * (GW * GH)
    for gy in range(GH):
        for gx_ in range(GW):
            i = gy * GW + gx_
            if not hit[i]:
                continue
            cell = {
                "x": body["x"] + (gx_ / GW) * body["w"],
                "y": body["y"] + (gy / GH) * body["h"],
                "w": body["w"] / GW,
                "h": body["h"] / GH,
            }
            hard = (strap and _overlap(cell, strap) > 0.35) or (clasp and _overlap(cell, clasp) > 0.35) or any(
                _overlap(cell, s) > 0.4 for s in specular
            )
            ribbed = ribs and _overlap(cell, ribs) > 0.5 and gx[i] > gx_med * 1.4
            if not hard and not ribbed and vari[i] < span * span * 0.08:
                flat_on[i] = 1
    flats = _connected_boxes(flat_on, GW, GH, body["x"], body["y"], body["w"], body["h"])
    panel = next((c for c in flats if (c["w"] * c["h"]) / (body["w"] * body["h"]) >= 0.05), None)

    demo = None
    best_demo = 0.0
    for gy in range(2, GH - 2):
        for gx_ in range(2, GW - 2):
            for hh in range(2, 8):
                for ww in range(3, 11):
                    if gy + hh >= GH or gx_ + ww >= GW:
                        continue
                    s = v = n = 0.0
                    for y in range(gy, gy + hh):
                        for x in range(gx_, gx_ + ww):
                            i = y * GW + x
                            if not hit[i]:
                                continue
                            s += mean[i]
                            v += vari[i]
                            n += 1
                    if n < 6:
                        continue
                    box = {
                        "x": body["x"] + (gx_ / GW) * body["w"],
                        "y": body["y"] + (gy / GH) * body["h"],
                        "w": (ww / GW) * body["w"],
                        "h": (hh / GH) * body["h"],
                    }
                    area = (box["w"] * box["h"]) / (body["w"] * body["h"])
                    if area < 0.03 or area > 0.18:
                        continue
                    aspect = box["w"] / max(1e-6, box["h"])
                    if aspect < 0.8 or aspect > 4:
                        continue
                    if strap and _overlap(box, strap) > 0.25:
                        continue
                    if clasp and _overlap(box, clasp) > 0.25:
                        continue
                    if any(_overlap(box, s) > 0.3 for s in specular):
                        continue
                    struct = v / n
                    if struct < span * 0.4 or struct > span * span * 0.5:
                        continue
                    if struct > best_demo:
                        best_demo = struct
                        demo = box
    return {"strap": strap, "clasp": clasp, "ribs": ribs, "specular": specular, "demo": demo, "panel": panel}


def _fit_in_panel(panel: Box, cls: str, body: Box) -> Box:
    prior = box_of(zone_for_class(crop_to_quad(body), cls))
    tw = min(panel["w"] * 0.9, prior["w"])
    th = min(panel["h"] * 0.9, prior["h"])
    return {
        "x": _clamp(panel["x"] + panel["w"] / 2 - tw / 2, panel["x"], panel["x"] + panel["w"] - tw),
        "y": _clamp(panel["y"] + panel["h"] / 2 - th / 2, panel["y"], panel["y"] + panel["h"] - th),
        "w": tw,
        "h": th,
    }


def _veto(box: Box, maps: Mapping[str, Any], cls: str) -> str | None:
    if maps.get("strap") and _overlap(box, maps["strap"]) > 0.22:
        return "hardware"
    if maps.get("clasp") and _overlap(box, maps["clasp"]) > 0.22:
        return "hardware"
    if any(_overlap(box, s) > 0.28 for s in maps.get("specular") or []):
        return "specular"
    if cls == "notebook" and maps.get("ribs") and _overlap(box, maps["ribs"]) > 0.45:
        return "ribs"
    return None


def _nudge(box: Box, maps: Mapping[str, Any], body: Box, cls: str) -> Box:
    obs = [o for o in (maps.get("strap"), maps.get("clasp"), maps.get("ribs")) if o] + list(maps.get("specular") or [])
    if not obs:
        return box
    tries = [box]
    strap = maps.get("strap")
    clasp = maps.get("clasp")
    if strap:
        tries.append({"x": box["x"], "y": strap["y"] - box["h"] - 0.02, "w": box["w"], "h": box["h"]})
        tries.append({"x": box["x"], "y": strap["y"] + strap["h"] + 0.02, "w": box["w"], "h": box["h"]})
    if clasp:
        tries.append({"x": clasp["x"] - box["w"] - 0.02, "y": box["y"], "w": box["w"], "h": box["h"]})
    if cls == "bottle":
        tries.append({"x": body["x"] + body["w"] * 0.33, "y": body["y"] + body["h"] * 0.38, "w": body["w"] * 0.34, "h": body["h"] * 0.36})
    best, best_pen = box, 99.0
    for t in tries:
        if t["w"] < 0.04 or t["h"] < 0.04:
            continue
        clamped = {
            "x": _clamp(t["x"], body["x"], body["x"] + body["w"] - t["w"]),
            "y": _clamp(t["y"], body["y"], body["y"] + body["h"] - t["h"]),
            "w": t["w"],
            "h": t["h"],
        }
        pen = sum(_overlap(clamped, o) for o in obs)
        if pen < best_pen:
            best, best_pen = clamped, pen
    return best


def pick_zone(
    cls: str,
    body: Quad,
    w: int | None = None,
    h: int | None = None,
    lum: Sequence[float] | None = None,
    mask: Sequence[int] | None = None,
) -> dict[str, Any]:
    body_box = box_of(body)
    class_box = box_of(zone_for_class(body, cls))
    maps: dict[str, Any] = {"strap": None, "clasp": None, "ribs": None, "specular": [], "demo": None, "panel": None}
    if w and h and lum is not None and mask is not None:
        maps = read_surface(w, h, lum, mask, body_box)
        ph = placeholder_rect(w, h, lum, mask) if cls in ("tech", "default") else None
        if ph and not maps["panel"]:
            maps["panel"] = ph
        elif ph and maps["panel"] and not any(_overlap(ph, s) > 0.4 for s in maps["specular"]):
            maps["demo"] = maps["demo"] or ph
        if maps["panel"]:
            maps["panel"] = _fit_in_panel(maps["panel"], cls, body_box)
    class_box = _nudge(class_box, maps, body_box, cls)
    candidates: list[dict[str, Any]] = []

    def push(kind: str, label: str, box: Box | None, score: float) -> None:
        if not box:
            return
        candidates.append({"id": kind, "label": label, "quad": crop_to_quad(box), "score": score, "veto": _veto(box, maps, cls)})

    push("demo", "where the demo print already is", maps.get("demo"), 100)
    push("panel", "the flat panel", maps.get("panel"), 70)
    push("class", "the usual place for this category", class_box, 40)
    live = [c for c in candidates if not c["veto"]]
    live.sort(key=lambda c: -c["score"])
    winner = live[0] if live else next((c for c in candidates if c["id"] == "class"), None)
    if winner is None:
        winner = {"id": "class", "label": "the usual place for this category", "quad": zone_for_class(body, cls), "score": 40, "veto": None}
    return {"winner": winner, "candidates": candidates, "maps": maps}


def recommend_placement(cls: str, body: Quad, **kwargs: Any) -> dict[str, Any]:
    picked = pick_zone(cls, body, **kwargs)
    by_id = {c["id"]: c for c in picked["candidates"]}
    pick = next((k for k in ("demo", "panel", "class") if k in by_id and not by_id[k]["veto"]), "class")
    return {"pick": pick, "choices": picked["candidates"], "winner": picked["winner"], "maps": picked["maps"]}


def canvas_hygiene(w: int, h: int, lum: Sequence[float], mask: Sequence[int]) -> dict[str, Any]:
    findings: list[dict[str, str]] = []
    pad = max(2, round(min(w, h) * 0.08))

    def corner(x0: int, y0: int) -> float:
        s = n = 0.0
        for y in range(y0, y0 + pad):
            for x in range(x0, x0 + pad):
                s += lum[y * w + x]
                n += 1
        return s / n

    corners = [corner(0, 0), corner(w - pad, 0), corner(0, h - pad), corner(w - pad, h - pad)]
    if max(corners) - min(corners) > 48:
        findings.append({"code": "lifestyle", "text": "Canvas is a lifestyle shot, not a studio plate. Isolate the product before sending."})
    body = _body_bbox(w, h, mask)
    top_h = max(3, round(h * 0.12))
    top_edges = top_n = 0
    for y in range(1, top_h):
        row = y * w
        for x in range(1, w - 1, 2):
            top_n += 1
            if abs(lum[row + x] - lum[row + x - 1]) > 28:
                top_edges += 1
    top_in_body = 0.0
    if body:
        top_in_body = max(0.0, min(body["y"] + body["h"], top_h / h) - body["y"]) / max(1e-6, top_h / h)
    if top_n and top_edges / top_n > 0.22 and top_in_body < 0.45:
        findings.append({"code": "chrome", "text": "Catalog chrome sits on the canvas (title, spec). Crop it off before the mark."})
    if body:
        bx0, by0 = round(body["x"] * w), round(body["y"] * h)
        bx1, by1 = round((body["x"] + body["w"]) * w), round((body["y"] + body["h"]) * h)

        def edge_blob(x0: int, y0: int, x1: int, y1: int) -> bool:
            n = on = 0
            for y in range(max(0, y0), min(h, y1)):
                row = y * w
                for x in range(max(0, x0), min(w, x1)):
                    n += 1
                    if mask[row + x]:
                        continue
                    v = lum[row + x]
                    if v < 40 or v > 220:
                        on += 1
            return bool(n and on / n > 0.12 and on > 8)

        strip = edge_blob(0, max(0, by1), w, h) or edge_blob(0, 0, w, max(1, by0))
        if body["x"] > 0.06:
            strip = strip or edge_blob(0, 0, bx0, h)
        if body["x"] + body["w"] < 0.94:
            strip = strip or edge_blob(bx1, 0, w, h)
        if strip:
            findings.append({"code": "spec-strip", "text": "Spec strip on the canvas. Do not send until it is gone."})
    block = any(f["code"] in ("spec-strip", "chrome") for f in findings)
    return {"ok": not findings, "block": block, "findings": findings}


def assert_zone(cls: str, body: Quad) -> bool:
    z = zone_for_class(body, cls)
    b = box_of(body)
    zb = box_of(z)
    cy = zb["y"] + zb["h"] / 2
    if cls == "pen":
        return zb["w"] >= b["w"] * 0.4 and zb["h"] <= b["h"] * 0.8
    if cls == "bottle":
        return b["y"] + b["h"] * 0.22 < cy < b["y"] + b["h"] * 0.78 and zb["w"] <= b["w"] * 0.55 and zb["h"] <= b["h"] * 0.5
    if cls == "bag":
        return zb["w"] / max(1e-6, b["w"]) < 0.55 and cy < b["y"] + b["h"] * 0.7
    if cls == "cable":
        return abs(zb["w"] - zb["h"]) < 0.04 and zb["w"] <= min(b["w"], b["h"]) * 0.6
    if cls == "notebook":
        return zb["h"] <= b["h"] * 0.28 and zb["w"] <= b["w"] * 0.75 and zb["w"] >= b["w"] * 0.2
    cx = zb["x"] + zb["w"] / 2
    return zb["w"] > 0.02 and zb["h"] > 0.02 and b["x"] < cx < b["x"] + b["w"]
