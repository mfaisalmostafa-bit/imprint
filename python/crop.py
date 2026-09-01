"""Product-frame cropper. Isolate the object, strip chrome, keep the body.

Port these functions. Do not drop this file onto imprint_engine.py.

canvas_hygiene already names the defects (lifestyle / chrome / spec-strip)
and then says "crop it off" / "isolate before send". This is that crop.

Rules
-----
1. Isolate the object. Border-median colour is the backdrop (not the
   four-corner mean — a spec strip occupying two corners would mix the
   plate into the product). The largest connected blob that is not the
   table and not an edge band is the product.

2. Two product-sized blobs is a cluster — refuse. Do not pick the bag when
   they photographed the tumbler. Clutter below the isolated-body floor is
   ignored, not clustered.
3. Studio plate (even corners, no chrome, no real spec band, body already
   fills canvasFill on both axes) is identity. A bag that fills the frame
   is not cropped in.
4. Packed catalogue (body ~0.12 of the frame) crops tight to the body
   through smart_canvas_crop. Dual framing: 80px snap and 140px thumb
   share the numbers.
5. Chrome and a real spec band never ship as identity. Crop to body+pad
   so the band falls outside the frame. A white studio sweep that matches
   the corners is not a spec band — that is the plate.
6. Notebooks keep ≥0.85 of the cover bbox. Never a clasp-only clip.
7. Classify by class, never SKU. Unknown class raises.

Numbers — reused, not fitted
----------------------------
canvasFill / canvasPad   CLASS_SCALE (imprint_engine)
COVER_KEEP 0.85          notebook_crop_sane
CORNER_DELTA 48          canvas_hygiene lifestyle
CHROME_EDGE 0.22         canvas_hygiene chrome
STRIP_ON 0.12            canvas_hygiene spec-strip
BODY_MIN 0.03 of frame   photo_search isolated floor
CLUSTER area floor       same BODY_MIN — a second blob that would isolate
                         is a second product, not clutter.

Kinds: studio | isolated | stripped | packed | refuse

Wire-up
-------
    from crop import crop_frame, is_ready
    result = crop_frame(w, h, rgb, cls=classify(product))
    if not is_ready(result):
        # do not send — same as hygiene block
    else:
        # crop the photo to result["crop"] before the mark
"""

from __future__ import annotations

import math
from typing import Any, Mapping, Sequence

import imprint_engine as eng

# Reused. Not fitted. photo_search isolated floor.
BODY_MIN = 0.03

# A spec/chrome band is flush to an edge and thinner than the leftover
# around a product that already fills the plate (1 - default canvasFill).
BAND_THICK = 1.0 - float(eng.CLASS_SCALE["default"]["canvasFill"])
# Hygiene chrome band is the top 12% of the frame.
CHROME_BAND = 0.12

# Closed vocabulary. A miss raises — class_scale itself is silent.

CLASSES = frozenset(eng.CLASS_SCALE)

KINDS = frozenset({"studio", "isolated", "stripped", "packed", "refuse"})


class CropError(ValueError):
    pass


def _class(cls: str | None) -> str:
    name = cls or "default"
    if name not in CLASSES:
        raise CropError(f"unmapped class: {name!r}")
    return name


def _lum(r: float, g: float, b: float) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _px(rgb: Sequence[float], w: int, x: int, y: int) -> tuple[float, float, float]:
    i = (y * w + x) * 3
    return float(rgb[i]), float(rgb[i + 1]), float(rgb[i + 2])


def _border_bg(w: int, h: int, rgb: Sequence[float]) -> tuple[float, float, float]:
    """Median colour of the 1-px border.

    Four-corner mean fails when a spec strip occupies the bottom two
    corners — the backdrop becomes a mix and the whole frame is one blob.
    The border median stays the plate (top + sides outnumber the strip).
    """
    rs: list[float] = []
    gs: list[float] = []
    bs: list[float] = []
    for x in range(w):
        for y in (0, h - 1):
            r, g, b = _px(rgb, w, x, y)
            rs.append(r)
            gs.append(g)
            bs.append(b)
    for y in range(1, h - 1):
        for x in (0, w - 1):
            r, g, b = _px(rgb, w, x, y)
            rs.append(r)
            gs.append(g)
            bs.append(b)
    rs.sort()
    gs.sort()
    bs.sort()
    mid = len(rs) // 2
    return rs[mid], gs[mid], bs[mid]


def _is_edge_band(blob: Mapping[str, int], w: int, h: int) -> bool:
    """Full-edge chrome / spec strip, not a product.

    Flush to an edge, covering that edge, thinner than BAND_THICK.
    A bag that fills the plate covers both axes — not a band.
    """
    bw = blob["maxX"] - blob["minX"] + 1
    bh = blob["maxY"] - blob["minY"] + 1
    flush = (
        blob["minY"] == 0
        or blob["maxY"] == h - 1
        or blob["minX"] == 0
        or blob["maxX"] == w - 1
    )
    if not flush:
        return False
    covers_w = bw / w >= float(eng.CLASS_SCALE["default"]["canvasFill"])
    covers_h = bh / h >= float(eng.CLASS_SCALE["default"]["canvasFill"])

    if covers_w and covers_h:
        return False
    if covers_w and bh / h <= BAND_THICK:
        return True
    if covers_h and bw / w <= BAND_THICK:
        return True
    return False


def _components(mask: Sequence[int], w: int, h: int) -> list[dict[str, int]]:
    seen = [0] * (w * h)
    out: list[dict[str, int]] = []
    for y0 in range(h):
        for x0 in range(w):
            s = y0 * w + x0
            if not mask[s] or seen[s]:
                continue
            stack = [(x0, y0)]
            seen[s] = 1
            n = 0
            min_x = max_x = x0
            min_y = max_y = y0
            while stack:
                x, y = stack.pop()
                n += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    k = ny * w + nx
                    if not mask[k] or seen[k]:
                        continue
                    seen[k] = 1
                    stack.append((nx, ny))
            if n >= 4:
                out.append(
                    {"n": n, "minX": min_x, "maxX": max_x, "minY": min_y, "maxY": max_y}
                )
    out.sort(key=lambda b: b["n"], reverse=True)
    return out


def _box_of(blob: Mapping[str, int], w: int, h: int) -> dict[str, float]:
    return {
        "x": blob["minX"] / w,
        "y": blob["minY"] / h,
        "w": (blob["maxX"] - blob["minX"] + 1) / w,
        "h": (blob["maxY"] - blob["minY"] + 1) / h,
    }


def _to_lum(w: int, h: int, rgb: Sequence[float]) -> list[float]:
    return [_lum(*_px(rgb, w, x, y)) for y in range(h) for x in range(w)]


def _corner_l(lum: Sequence[float], w: int, h: int) -> tuple[float, float]:
    """Mean and range of the four corner patches. Range > 48 is lifestyle."""
    pad = max(2, round(min(w, h) * 0.08))

    def corner(x0: int, y0: int) -> float:
        s = n = 0.0
        for y in range(y0, y0 + pad):
            for x in range(x0, x0 + pad):
                s += lum[y * w + x]
                n += 1
        return s / n

    vals = [corner(0, 0), corner(w - pad, 0), corner(0, h - pad), corner(w - pad, h - pad)]
    return sum(vals) / 4.0, max(vals) - min(vals)


def _region_strip(
    lum: Sequence[float],
    w: int,
    h: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    corner_l: float,
) -> bool:
    """Hygiene spec-strip test, plus 'not the studio sweep'.

    A white pad around a dark bag matches the corners — that is the plate,
    not a spec band. A black bar on a grey plate does not match the corners.
    STRIP_ON 0.12 and the 40/220 floors are canvas_hygiene's.
    CORNER_DELTA 48 is canvas_hygiene's lifestyle floor, reused.
    """
    n = on = 0
    s = 0.0
    for y in range(max(0, y0), min(h, y1)):
        row = y * w
        for x in range(max(0, x0), min(w, x1)):
            n += 1
            v = lum[row + x]
            s += v
            if v < 40 or v > 220:
                on += 1
    if not (n and on / n > 0.12 and on > 8):
        return False
    return abs(s / n - corner_l) > 48.0


def _dirty(
    w: int,
    h: int,
    lum: Sequence[float],
    mask: Sequence[int],
    body: Mapping[str, float],
) -> tuple[list[dict[str, str]], bool, bool]:
    """Return (findings, has_chrome, has_real_strip)."""
    hyg = eng.canvas_hygiene(w, h, lum, mask)
    findings = list(hyg["findings"])
    has_chrome = any(f["code"] == "chrome" for f in findings)
    corner_l, _spread = _corner_l(lum, w, h)
    bx0, by0 = round(body["x"] * w), round(body["y"] * h)
    bx1, by1 = round((body["x"] + body["w"]) * w), round((body["y"] + body["h"]) * h)
    real = (
        _region_strip(lum, w, h, 0, max(0, by1), w, h, corner_l)
        or _region_strip(lum, w, h, 0, 0, w, max(1, by0), corner_l)
        or (body["x"] > 0.06 and _region_strip(lum, w, h, 0, 0, bx0, h, corner_l))
        or (
            body["x"] + body["w"] < 0.94
            and _region_strip(lum, w, h, bx1, 0, w, h, corner_l)
        )
    )
    return findings, has_chrome, real


def _tight_crop(body: Mapping[str, float], cls: str) -> dict[str, float]:
    """Body + canvasPad. Used when a band has to fall outside the frame.

    smart_canvas_crop may expand to canvasFill and swallow a spec strip.
    Pad-only expansion keeps the band out. COVER_KEEP still applies after.
    """
    pad = float(eng.class_scale(cls)["canvasPad"])
    bw = min(1.0, body["w"] * (1 + 2 * pad))
    bh = min(1.0, body["h"] * (1 + 2 * pad))
    x = body["x"] + body["w"] / 2 - bw / 2
    y = body["y"] + body["h"] / 2 - bh / 2
    if x < 0:
        bw += x
        x = 0.0
    if y < 0:
        bh += y
        y = 0.0
    if x + bw > 1:
        bw = 1 - x
    if y + bh > 1:
        bh = 1 - y
    return {"x": max(0.0, x), "y": max(0.0, y), "w": max(0.08, bw), "h": max(0.08, bh)}


def isolate(w: int, h: int, rgb: Sequence[float]) -> dict[str, Any]:
    """Backdrop-distance mask + connected blobs. No centre box invented."""
    if w < 8 or h < 8:
        raise CropError(f"frame too small: {w}x{h}")
    if len(rgb) < w * h * 3:
        raise CropError("rgb is shorter than 3*w*h")
    bg = _border_bg(w, h, rgb)
    bg_l = _lum(*bg)
    var_acc = n_c = 0.0
    m = max(3, round(min(w, h) * 0.08))
    # Variance still from the four corners — that is hygiene's lifestyle test.
    for sx, sy in ((0, 0), (w - m, 0), (0, h - m), (w - m, h - m)):
        for y in range(sy, sy + m):
            for x in range(sx, sx + m):
                var_acc += (_lum(*_px(rgb, w, x, y)) - bg_l) ** 2
                n_c += 1
    std = math.sqrt(var_acc / n_c) if n_c else 0.0
    thresh = max(10.0, 1.6 * std + 8.0)

    def build(th: float) -> list[int]:
        out = [0] * (w * h)
        for y in range(h):
            for x in range(w):
                r, g, b = _px(rgb, w, x, y)
                if math.hypot(r - bg[0], g - bg[1], b - bg[2]) >= th or abs(
                    _lum(r, g, b) - bg_l
                ) >= th:
                    out[y * w + x] = 1
        return out

    mask = build(thresh)
    blobs = _components(mask, w, h)
    floor = w * h * BODY_MIN
    if not blobs or blobs[0]["n"] < floor:
        mask = build(max(6.0, thresh * 0.5))
        blobs = _components(mask, w, h)
    products = [b for b in blobs if b["n"] >= floor and not _is_edge_band(b, w, h)]
    isolated = bool(products)
    winner = products[0] if products else None
    body = _box_of(winner, w, h) if winner else None
    body_mask = [0] * (w * h)
    if winner:
        for y in range(winner["minY"], winner["maxY"] + 1):
            for x in range(winner["minX"], winner["maxX"] + 1):
                i = y * w + x
                if mask[i]:
                    body_mask[i] = 1
    return {
        "isolated": isolated,
        "body": body,
        "blobs": products,
        "mask": body_mask,
        "lum": _to_lum(w, h, rgb),
        "coverage": (winner["n"] / (w * h)) if winner else 0.0,
    }


def is_ready(result: Mapping[str, Any]) -> bool:
    kind = result.get("kind")
    if kind not in KINDS:
        raise CropError(f"unmapped kind: {kind!r}")
    return kind != "refuse"


def pixel_box(crop: Mapping[str, float], w: int, h: int) -> dict[str, int]:
    """Inclusive pixel rectangle for the 0–1 crop. Raises on a box outside the frame."""
    x0 = int(round(crop["x"] * w))
    y0 = int(round(crop["y"] * h))
    x1 = int(round((crop["x"] + crop["w"]) * w))
    y1 = int(round((crop["y"] + crop["h"]) * h))
    if x0 < 0 or y0 < 0 or x1 > w or y1 > h or x1 <= x0 or y1 <= y0:
        raise CropError(f"crop outside frame: {(x0, y0, x1, y1)} vs {w}x{h}")
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def _expand_to_cover(crop: dict[str, float], body: Mapping[str, float]) -> dict[str, float]:
    """Grow a crop until it keeps COVER_KEEP of the body. Does not invent a new centre."""
    out = dict(crop)
    for _ in range(8):
        if eng.notebook_crop_sane(out, body):
            return out
        out["x"] = max(0.0, min(body["x"], out["x"]))
        out["y"] = max(0.0, min(body["y"], out["y"]))
        out["w"] = min(1.0 - out["x"], max(out["w"], body["x"] + body["w"] - out["x"]))
        out["h"] = min(1.0 - out["y"], max(out["h"], body["y"] + body["h"] - out["y"]))
    return out


def crop_frame(
    w: int,
    h: int,
    rgb: Sequence[float],
    *,
    cls: str | None = "default",
) -> dict[str, Any]:
    """Return a 0–1 crop that isolates the product.

    rgb is RGB triplets, length 3*w*h. cls is a CLASS_SCALE key.
    """
    name = _class(cls)
    spec = eng.class_scale(name)
    found = isolate(w, h, rgb)
    findings: list[dict[str, str]] = []
    reason = "no isolated body"
    kind = "refuse"
    crop = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
    body = found["body"]

    if found["isolated"] and body is not None:
        if len(found["blobs"]) >= 2:
            kind = "refuse"
            reason = "cluster: two product-sized blobs"
        else:
            findings, has_chrome, has_strip = _dirty(
                w, h, found["lum"], found["mask"], body
            )
            fill = float(spec["canvasFill"])
            fills = body["w"] >= fill and body["h"] >= fill
            even = not any(f["code"] == "lifestyle" for f in findings)
            dirty = has_chrome or has_strip
            if even and not dirty and fills:
                kind = "studio"
                reason = "studio plate, identity"
                crop = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
            else:
                crop = (
                    _tight_crop(body, name)
                    if dirty
                    else eng.smart_canvas_crop(body, name)
                )
                if name == "notebook" and not eng.notebook_crop_sane(crop, body):
                    crop = _expand_to_cover(crop, body)
                if has_chrome:
                    # Hygiene chrome band is the top 12% of the frame.
                    if crop["y"] < CHROME_BAND and body["y"] >= CHROME_BAND:
                        crop["h"] = max(0.08, crop["h"] - (CHROME_BAND - crop["y"]))
                        crop["y"] = CHROME_BAND

                if dirty:
                    kind = "stripped"
                    reason = "chrome or spec-strip cropped off"
                elif body["w"] < fill or body["h"] < fill:
                    kind = "packed"
                    reason = "packed frame, crop to body"
                else:
                    kind = "isolated"
                    reason = "lifestyle, crop to body"

    if kind not in KINDS:
        raise CropError(f"unmapped kind: {kind!r}")
    return {
        "kind": kind,
        "crop": crop,
        "body": body,
        "findings": findings,
        "reason": reason,
        "cls": name,
        "coverage": found["coverage"],
    }
