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
    zone = zone_for_class(body_quad, cls)
    fit  = fit_mark_scale(body_w, zone_w, spec.max_scale, preferred, cls)
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
        return _rect_quad(cx, b["y"] + b["h"] * 0.5, b["w"] * 0.7, b["h"] * 0.32)
    if cls == "bag":
        return _rect_quad(cx, b["y"] + b["h"] * 0.44, b["w"] * 0.4, b["h"] * 0.28)
    if cls == "cable":
        s = min(b["w"], b["h"]) * 0.48
        return _rect_quad(cx, cy, s, s)
    if cls == "notebook":
        return _rect_quad(cx, b["y"] + b["h"] * 0.62, b["w"] * 0.56, b["h"] * 0.18)
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


def assert_zone(cls: str, body: Quad) -> bool:
    z = zone_for_class(body, cls)
    b = box_of(body)
    zb = box_of(z)
    cy = zb["y"] + zb["h"] / 2
    if cls == "pen":
        return zb["w"] >= b["w"] * 0.4 and zb["h"] <= b["h"] * 0.8
    if cls == "bottle":
        return b["y"] + b["h"] * 0.28 < cy < b["y"] + b["h"] * 0.72 and zb["h"] <= b["h"] * 0.45
    if cls == "bag":
        return zb["w"] / max(1e-6, b["w"]) < 0.55 and cy < b["y"] + b["h"] * 0.7
    if cls == "cable":
        return abs(zb["w"] - zb["h"]) < 0.04 and zb["w"] <= min(b["w"], b["h"]) * 0.6
    if cls == "notebook":
        return zb["y"] > b["y"] + b["h"] * 0.4 and zb["h"] <= b["h"] * 0.28
    cx = zb["x"] + zb["w"] / 2
    return zb["w"] > 0.02 and zb["h"] > 0.02 and b["x"] < cx < b["x"] + b["w"]
