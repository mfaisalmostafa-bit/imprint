"""Photo Search rerank — drop-in for the CC finder.

Production retrieval (embed / CLIP) returns near-ties around 53–67% for
anything in the same aisle. That is why a cream tumbler on a wooden table
lands TM176 + a digital flask + a vacuum bottle, and a white power bank
lands a wireless pad.

This module does not replace retrieval. It reranks the shortlist.

Rules
-----
1. Isolate the object. Whole-frame histograms match the table, not the SKU.
2. Classify by category + name + material. Never by SKU.
3. Shape (aspect + silhouette) and body colour beat the embed score.
4. Superfamily mismatch (power bank vs charger, tumbler vs flask-with-screen)
   is dropped, not shown at 63%.
5. Black vs white (ΔL ≥ 45) cannot lock. Cap at 0.50 and label colour-mismatch.
6. "It fits" is only a winner (≥ 0.82, family agree, colour agree).
   56% is not a match.

Numbers (hold on a phone snap and on a packed catalogue thumb)
--------------------------------------------------------------
WIN 0.82   WEAK 0.62   CLUSTER 0.06
COLOR_DL 45   colour cap 0.50
FAMILY_DROP 0.42  (superfamily miss)
weights: shape 0.36  colour 0.32  silhouette 0.18  family 0.14

Wire-up
-------
    from photo_search import describe, family_of, rerank, interpret, is_lock
    q = describe(w, h, rgb)
    catalog = [{**row, "feat": describe(tw, th, trgb),
                "family": family_of(row)} for row in rows]
    hits = rerank(q, catalog, embed_hits)   # embed_hits optional
    answer = interpret(hits)
    if is_lock(answer):
        # enable It fits
"""

from __future__ import annotations

import math
import re
from typing import Any, Mapping, Sequence

WIN = 0.82
WEAK = 0.62
CLUSTER = 0.06
COLOR_DL = 45.0
COLOR_CAP = 0.50
FAMILY_DROP = 0.42
SIL_BINS = 12

SUPERFAMILY: dict[str, str] = {
    "tumbler": "drinkware",
    "mug": "drinkware",
    "cup": "drinkware",
    "flask": "drinkware",
    "bottle": "drinkware",
    "powerbank": "tech",
    "charger": "tech",
    "usb": "tech",
    "cable": "tech",
    "notebook": "stationery",
    "pen": "writing",
    "apparel": "apparel",
    "bag": "bag",
    "award": "award",
    "display": "display",
    "tech": "tech",
    "default": "default",
}


def family_of(product: Mapping[str, Any] | None) -> str:
    """Category + name + material + decoration family. Never SKU."""
    p = product or {}
    blob = " ".join(
        str(p.get(k) or "")
        for k in ("category", "name", "material", "family", "decoration")
    ).lower()
    if re.search(r"wireless|\bqi\b|charg(er|ing)|charging pad", blob):
        return "charger"
    if re.search(r"power\s*bank|powerbank", blob):
        return "powerbank"
    if re.search(r"\busb\b|flash drive", blob):
        return "usb"
    if re.search(r"cable|hub", blob) and "drink" not in blob:
        return "cable"
    if re.search(r"tumbler|\bbrew\b", blob):
        return "tumbler"
    if re.search(r"\bmug\b", blob):
        return "mug"
    if re.search(r"flask|thermos", blob):
        return "flask"
    if re.search(r"vacuum|\bbottle\b", blob):
        return "bottle"
    if re.search(r"\bcup\b", blob):
        return "cup"
    if re.search(r"notebook|journal|diary", blob):
        return "notebook"
    if re.search(r"\bpen\b|pencil", blob):
        return "pen"
    if re.search(r"polo|hoodie|tee|t-?shirt|cap|apparel", blob):
        return "apparel"
    if re.search(r"tote|backpack|\bbag\b", blob):
        return "bag"
    if re.search(r"award|crystal|plaque", blob):
        return "award"
    if re.search(r"totem|billboard|display", blob):
        return "display"
    cat = str(p.get("category") or "").lower()
    if "drink" in cat:
        return "bottle"
    if "tech" in cat:
        return "tech"
    if "station" in cat:
        return "notebook"
    if "apparel" in cat:
        return "apparel"
    if "award" in cat:
        return "award"
    if "packag" in cat:
        return "bag"
    return "default"


def _lum(r: float, g: float, b: float) -> float:
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _px(rgb: Sequence[float], w: int, x: int, y: int) -> tuple[float, float, float]:
    i = (y * w + x) * 3
    return float(rgb[i]), float(rgb[i + 1]), float(rgb[i + 2])


def _corners(w: int, h: int, rgb: Sequence[float]) -> tuple[float, float, float]:
    m = max(3, round(min(w, h) * 0.08))
    boxes = [(0, 0), (w - m, 0), (0, h - m), (w - m, h - m)]
    rs = gs = bs = n = 0.0
    for sx, sy in boxes:
        for y in range(sy, sy + m):
            for x in range(sx, sx + m):
                r, g, b = _px(rgb, w, x, y)
                rs += r
                gs += g
                bs += b
                n += 1
    return (rs / n, gs / n, bs / n) if n else (0.0, 0.0, 0.0)


def _blob(mask: Sequence[int], w: int, h: int) -> dict[str, int] | None:
    seen = [0] * (w * h)
    best: dict[str, int] | None = None
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
            if best is None or n > best["n"]:
                best = {"n": n, "minX": min_x, "maxX": max_x, "minY": min_y, "maxY": max_y}
    return best


def _sil(mask: Sequence[int], w: int, box: Mapping[str, int]) -> list[float]:
    cx = (box["minX"] + box["maxX"]) / 2
    cy = (box["minY"] + box["maxY"]) / 2
    acc = [0.0] * SIL_BINS
    cnt = [0] * SIL_BINS
    max_r = max(1.0, math.hypot(box["maxX"] - box["minX"], box["maxY"] - box["minY"]) / 2)
    for y in range(box["minY"], box["maxY"] + 1):
        for x in range(box["minX"], box["maxX"] + 1):
            if not mask[y * w + x]:
                continue
            ang = (math.atan2(y - cy, x - cx) + math.pi) / (2 * math.pi)
            b = min(SIL_BINS - 1, int(ang * SIL_BINS))
            acc[b] += math.hypot(x - cx, y - cy) / max_r
            cnt[b] += 1
    return [acc[i] / cnt[i] if cnt[i] else 0.0 for i in range(SIL_BINS)]


def _cosine(a: Sequence[float], b: Sequence[float]) -> float:
    d = na = nb = 0.0
    for i in range(min(len(a), len(b))):
        d += a[i] * b[i]
        na += a[i] * a[i]
        nb += b[i] * b[i]
    den = math.sqrt(na) * math.sqrt(nb)
    return d / den if den else 0.0


def _screen_hint(w: int, h: int, rgb: Sequence[float], box: Mapping[str, int]) -> float:
    """Bright compact patch in the top 22% — digital flask lid, not a tumbler."""
    y1 = box["minY"] + max(2, int((box["maxY"] - box["minY"]) * 0.22))
    n = bright = 0
    for y in range(box["minY"], min(box["maxY"], y1) + 1):
        for x in range(box["minX"], box["maxX"] + 1):
            r, g, b = _px(rgb, w, x, y)
            n += 1
            if _lum(r, g, b) > 160 and max(r, g, b) - min(r, g, b) > 25:
                bright += 1
    return bright / n if n else 0.0


def describe(w: int, h: int, rgb: Sequence[float]) -> dict[str, Any]:
    """Body-relative features. Catalogue thumb and phone snap both work."""
    bg = _corners(w, h, rgb)
    bg_l = _lum(*bg)
    # Corner variance — dark studio thumbs have almost none, so a low floor.
    var_acc = n_c = 0.0
    m = max(3, round(min(w, h) * 0.08))
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
                if math.hypot(r - bg[0], g - bg[1], b - bg[2]) >= th or abs(_lum(r, g, b) - bg_l) >= th:
                    out[y * w + x] = 1
        return out

    mask = build(thresh)
    blob = _blob(mask, w, h)
    if not blob or blob["n"] < w * h * 0.04:
        mask = build(max(6.0, thresh * 0.5))
        blob = _blob(mask, w, h)
    isolated = bool(blob and blob["n"] >= w * h * 0.03)
    if isolated and blob:
        box = blob
    else:
        box = {
            "n": int(w * h * 0.25),
            "minX": int(w * 0.25),
            "maxX": int(w * 0.75) - 1,
            "minY": int(h * 0.25),
            "maxY": int(h * 0.75) - 1,
        }
        isolated = False
    bw = max(1, box["maxX"] - box["minX"] + 1)
    bh = max(1, box["maxY"] - box["minY"] + 1)
    rs = gs = bs = n = 0.0
    for y in range(box["minY"], box["maxY"] + 1):
        for x in range(box["minX"], box["maxX"] + 1):
            if isolated and not mask[y * w + x]:
                continue
            r, g, b = _px(rgb, w, x, y)
            rs += r
            gs += g
            bs += b
            n += 1
    mean = (rs / n, gs / n, bs / n) if n else (0.0, 0.0, 0.0)
    L = _lum(*mean)
    return {
        "isolated": isolated,
        "aspect": bw / bh,
        "L": L,
        "mean": mean,
        "sil": _sil(mask if isolated else [1] * (w * h), w, box),
        "screen": _screen_hint(w, h, rgb, box),
        "coverage": box["n"] / (w * h),
        "box": box,
    }


def infer_family(feat: Mapping[str, Any]) -> str:
    """Shape-only guess. Returns default when the body was not isolated."""
    if not feat.get("isolated"):
        return "default"
    aspect = float(feat.get("aspect") or 1)
    screen = float(feat.get("screen") or 0)
    if aspect < 0.28:
        return "flask" if screen > 0.08 else "bottle"
    if aspect < 0.55:
        return "flask" if screen > 0.08 else "tumbler"
    if 0.85 <= aspect <= 1.25 and float(feat.get("coverage") or 0) > 0.12:
        return "charger"
    if 0.45 <= aspect <= 0.85:
        return "powerbank"
    return "default"


def score_pair(
    query: Mapping[str, Any],
    catalog: Mapping[str, Any],
    *,
    cat_family: str | None = None,
    embed: float | None = None,
) -> dict[str, Any]:
    qa = max(1e-6, float(query.get("aspect") or 1))
    ca = max(1e-6, float(catalog.get("aspect") or 1))
    shape = 1.0 - min(1.0, abs(math.log(qa / ca)) / math.log(2.4))
    dL = abs(float(query.get("L") or 0) - float(catalog.get("L") or 0))
    colour = 1.0 - min(1.0, dL / 80.0)
    sil = _cosine(query.get("sil") or [], catalog.get("sil") or [])
    q_fam = str(query.get("family") or infer_family(query))
    c_fam = cat_family or str(catalog.get("family") or infer_family(catalog))
    unknown = q_fam == "default" or c_fam == "default"
    same = q_fam == c_fam or unknown
    super_ok = SUPERFAMILY.get(q_fam, q_fam) == SUPERFAMILY.get(c_fam, c_fam) or unknown
    drinkware = SUPERFAMILY.get(q_fam) == "drinkware" and SUPERFAMILY.get(c_fam) == "drinkware"
    fam = 1.0 if (q_fam == c_fam or unknown) else (0.45 if drinkware else 0.0)
    screen_pen = 0.0
    if abs(float(query.get("screen") or 0) - float(catalog.get("screen") or 0)) > 0.12:
        screen_pen = 0.12
    score = 0.36 * shape + 0.32 * colour + 0.18 * sil + 0.14 * fam - screen_pen
    if embed is not None:
        score = 0.55 * score + 0.45 * float(embed)
    reasons: list[str] = []
    color_cap = dL >= COLOR_DL
    # Keep drinkware cousins on the sheet. Drop charger vs power bank, mug vs pen, etc.
    family_drop = (not unknown) and (q_fam != c_fam) and (not drinkware)
    if family_drop:
        score *= FAMILY_DROP
        reasons.append(f"family {q_fam}≠{c_fam}")
    if color_cap:
        score = min(score, COLOR_CAP)
        reasons.append(f"colour ΔL {dL:.0f}")
    score = max(0.0, min(1.0, score))
    return {
        "score": score,
        "shape": shape,
        "colour": colour,
        "sil": sil,
        "family": c_fam,
        "queryFamily": q_fam,
        "familyAgree": same,
        "superAgree": super_ok,
        "colorCap": color_cap,
        "familyDrop": family_drop,
        "dL": dL,
        "reasons": reasons,
    }


def rerank(
    query: Mapping[str, Any],
    catalog: Sequence[Mapping[str, Any]],
    embed_hits: Sequence[Mapping[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Rerank a retrieval shortlist, or the whole catalogue if none given."""
    embed_map = {str(h.get("sku")): float(h.get("score") or 0) for h in (embed_hits or [])}
    pool = catalog
    if embed_hits:
        wanted = {str(h.get("sku")) for h in embed_hits}
        tagged = [c for c in catalog if str(c.get("sku")) in wanted]
        if tagged:
            pool = tagged
    out: list[dict[str, Any]] = []
    q = dict(query)
    if "family" not in q:
        q["family"] = infer_family(q)
    for row in pool:
        feat = row.get("feat") or row
        fam = str(row.get("family") or family_of(row))
        scored = score_pair(q, feat, cat_family=fam, embed=embed_map.get(str(row.get("sku"))))
        if scored["familyDrop"]:
            continue
        out.append(
            {
                "sku": row.get("sku"),
                "name": row.get("name"),
                "src": row.get("src"),
                "family": fam,
                **scored,
            }
        )
    out.sort(key=lambda h: -h["score"])
    return out


def interpret(hits: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    live = [h for h in hits if float(h.get("score") or 0) >= WEAK and not h.get("colorCap")]
    capped = [h for h in hits if h.get("colorCap") and h.get("superAgree") is not False]
    if not live:
        if capped:
            return {
                "judged": True,
                "kind": "colour-mismatch",
                "hits": capped[:4],
                "note": "Same shape family, different colour. Confirm by eye — not a lock.",
            }
        top = hits[0] if hits else None
        pct = round(float(top["score"]) * 100) if top else 0
        return {
            "judged": False,
            "code": "far",
            "why": f"Nothing in the catalogue is close (top {pct}%). This is not a match.",
        }
    top = live[0]
    second = live[1] if len(live) > 1 else None
    if second and float(top["score"]) - float(second["score"]) < CLUSTER and float(second["score"]) >= WEAK:
        return {
            "judged": True,
            "kind": "cluster",
            "hits": live[:4],
            "note": (
                f"Leaders are too close to separate "
                f"({round(float(top['score'])*100)}% vs {round(float(second['score'])*100)}%). "
                f"Pick by eye — do not treat this as a lock."
            ),
        }
    if float(top["score"]) < WIN or top.get("colorCap"):
        return {
            "judged": True,
            "kind": "weak",
            "hits": live[:4],
            "note": f"Best guess {top.get('sku')} at {round(float(top['score'])*100)}%. That is not a confident lock.",
        }
    if not top.get("familyAgree") and not top.get("superAgree"):
        return {
            "judged": True,
            "kind": "weak",
            "hits": live[:4],
            "note": f"Best guess {top.get('sku')} at {round(float(top['score'])*100)}%. That is not a confident lock.",
        }
    return {
        "judged": True,
        "kind": "winner",
        "hits": live[:4],
        "note": f"{top.get('sku')} at {round(float(top['score'])*100)}%.",
    }


def is_lock(answer: Mapping[str, Any]) -> bool:
    return bool(answer.get("judged") is True and answer.get("kind") == "winner")
