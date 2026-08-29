"""Prior ⇄ detector arbitration, and a prior that learns from picks.

Port these functions. Do not drop this file onto imprint_engine.py —
that engine has the detector; this module does not.

Floors taken from the corpus brief, not fitted here
---------------------------------------------------
N_MIN = 5         "n < 5 is reported but never proposed as a prior"
BODY_MIN = 0.45   pages below 0.45 were dropped as unreadable
DETECTOR_MID = 50 midpoint of the 0–100 scale. Measured inert on 303
                  photos (min score 50, 58% at 100). Kept as a floor,
                  not adopted as a cut. SEEN_ROUTES is the live control.

A row median is not evidence when n_eff is 3.3. Proposable uses n_eff,
not n, with a float tolerance so five equal decks are not 4.999…

Vocabulary — silent mismatch is the expensive class
---------------------------------------------------
Engine routes (the assigner): insert, panel, placeholder, specular, hub,
recipe, category. SEEN vs NOT_SEEN is declared. An unknown route raises.
plate and demo are not in the engine; naming them is a defect.

Prior keys: cx_rel, cy_rel, w_of_product_w, mark_extent_along_baseline.
Short aliases (cx, cy, w, ext) still read. A block with neither raises —
it is not a prior at (0.5, 0.5) with IQR (0, 1).

Pick grouping: `by` (person) and `job` (deck). No id() fallback. An
event with neither raises; it is not its own independent opinion.

Relative form carries `rot` (signed top-edge degrees). Reconstructing a
quad without it flattens a fitted mark to 0°.

Five methods, one spelling: UV printing, UV DTF, laser engraving,
sublimation, embroidery. This file does not name a method.

Unsure / unmeasurable until a second voter exists
-------------------------------------------------
drawn:chosen 1.0:0.5 — whole pick history is one person, mass caps at 1
either way. 39+1 AM split counted as 2 here.
"""

from __future__ import annotations

import math
from typing import Any, Mapping, Sequence

N_MIN = 5
N_MIN_EPS = 1e-9
BODY_MIN = 0.45
DETECTOR_MID = 50.0

# Vocabulary the engine actually assigns. verify_route_vocabulary.py
# reads these two sets. Unknown names must not be swallowed.
ENGINE_ROUTES = frozenset(
    {"insert", "panel", "placeholder", "specular", "hub", "recipe", "category"}
)
SEEN_ROUTES = frozenset({"insert", "panel", "placeholder", "specular", "hub"})
NOT_SEEN = frozenset({"recipe", "category"})
if SEEN_ROUTES | NOT_SEEN != ENGINE_ROUTES or SEEN_ROUTES & NOT_SEEN:
    raise RuntimeError("SEEN_ROUTES / NOT_SEEN do not partition ENGINE_ROUTES")

W_DRAWN = 1.0
W_CHOSEN = 0.5
W_REJECT = 0.5

# Location keys: ours first, theirs second. Missing both is an error.
_CX = ("cx", "cx_rel")
_CY = ("cy", "cy_rel")
_W = ("w", "w_of_product_w")
_EXT = ("ext", "mark_extent_along_baseline")
_ROT = ("rot", "angle", "rotation")
_H = ("h", "h_of_product_h")


# ---------------------------------------------------------------------------
# Point seam
# ---------------------------------------------------------------------------

def as_xy(pt: Any) -> list[float]:
    if isinstance(pt, Mapping):
        return [float(pt["x"]), float(pt["y"])]
    return [float(pt[0]), float(pt[1])]


def as_dict(pt: Sequence[float]) -> dict[str, float]:
    return {"x": float(pt[0]), "y": float(pt[1])}


def quad_xy(quad: Sequence[Any]) -> list[list[float]]:
    return [as_xy(p) for p in quad]


def quad_dict(quad: Sequence[Sequence[float]]) -> list[dict[str, float]]:
    return [as_dict(p) for p in quad]


def box_of(quad: Sequence[Any]) -> dict[str, float]:
    pts = quad_xy(quad)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return {
        "x": min(xs),
        "y": min(ys),
        "w": max(xs) - min(xs),
        "h": max(ys) - min(ys),
    }


def quad_of_box(b: Mapping[str, float]) -> list[dict[str, float]]:
    x, y, w, h = float(b["x"]), float(b["y"]), float(b["w"]), float(b["h"])
    return [
        {"x": x, "y": y},
        {"x": x + w, "y": y},
        {"x": x + w, "y": y + h},
        {"x": x, "y": y + h},
    ]


def _pick(block: Mapping[str, Any], names: Sequence[str], *, required: bool = True) -> Any:
    for n in names:
        if n in block and block[n] is not None:
            return block[n]
    if required:
        raise KeyError(
            f"missing {names[0]} (also tried {list(names[1:])}); "
            "will not invent a default"
        )
    return None


def _num(value: Any, names: Sequence[str] = ("value",)) -> float:
    if isinstance(value, Mapping):
        if "median" in value:
            return float(value["median"])
        return float(_pick(value, names))
    return float(value)


# ---------------------------------------------------------------------------
# Product-relative geometry (framing-invariant, always X for width)
# ---------------------------------------------------------------------------

def top_edge_deg(quad: Sequence[Any]) -> float:
    """Signed degrees of TL→TR. The renderer maps the mark's top edge onto that."""
    pts = quad_xy(quad)
    return math.degrees(math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]))


def relative_of(quad: Sequence[Any], body: Sequence[Any]) -> dict[str, float]:
    """Centre as a fraction of the product box. Width over product width — the X axis.

    Never swap to height/product_height because the mark is rotated. That units
    error invented a 3× pen defect. `ext` is separate, along the mark's baseline.
    `rot` is signed top-edge degrees so a reconstructed quad is not flattened.
    """
    q = box_of(quad)
    b = box_of(body)
    bw = max(b["w"], 1e-9)
    bh = max(b["h"], 1e-9)
    cx = (q["x"] + q["w"] / 2 - b["x"]) / bw
    cy = (q["y"] + q["h"] / 2 - b["y"]) / bh
    rot = top_edge_deg(quad)
    abs_long = _long_axis_abs_deg(quad_xy(quad))
    if abs_long >= 45:
        ext = q["h"] / bh
    else:
        ext = q["w"] / bw
    w = q["w"] / bw
    h = q["h"] / bh
    return {
        "cx": cx,
        "cy": cy,
        "w": w,
        "h": h,
        "ext": ext,
        "rot": rot,
        "cx_rel": cx,
        "cy_rel": cy,
        "w_of_product_w": w,
        "mark_extent_along_baseline": ext,
    }


def _long_axis_abs_deg(pts: Sequence[Sequence[float]]) -> float:
    if len(pts) < 2:
        return 0.0
    d01 = math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    d12 = math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]) if len(pts) > 2 else 0.0
    if d01 >= d12:
        ang = math.degrees(math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]))
    else:
        ang = math.degrees(math.atan2(pts[2][1] - pts[1][1], pts[2][0] - pts[1][0]))
    ang = abs(ang) % 180
    return 180 - ang if ang > 90 else ang


def quad_from_relative(rel: Mapping[str, Any], body: Sequence[Any]) -> list[dict[str, float]]:
    """Rebuild a quad, carrying rotation. Axis-aligned only when rot is 0."""
    b = box_of(body)
    cx_r = _num(_pick(rel, _CX))
    cy_r = _num(_pick(rel, _CY))
    w_r = _num(_pick(rel, _W))
    h_val = _pick(rel, _H, required=False)
    h_r = _num(h_val) if h_val is not None else w_r
    rot_val = _pick(rel, _ROT, required=False)
    rot = float(rot_val) if rot_val is not None else 0.0
    w = w_r * b["w"]
    h = h_r * b["h"]
    cx = b["x"] + cx_r * b["w"]
    cy = b["y"] + cy_r * b["h"]
    hw, hh = w / 2, h / 2
    rad = math.radians(rot)
    co, si = math.cos(rad), math.sin(rad)
    pts = []
    for x, y in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)):
        pts.append({"x": cx + x * co - y * si, "y": cy + x * si + y * co})
    return pts


# ---------------------------------------------------------------------------
# Effective n
# ---------------------------------------------------------------------------

def effective_n(weights: Mapping[Any, float]) -> float:
    """Inverse-Simpson. 40 jobs from one AM → 1. 40 AMs → 40."""
    total = float(sum(weights.values()))
    if total <= 0:
        return 0.0
    return 1.0 / sum((w / total) ** 2 for w in weights.values() if w > 0)


def _meets_n(n: float, floor: float = N_MIN) -> bool:
    return float(n) + N_MIN_EPS >= floor


def proposable(prior: Mapping[str, Any] | None) -> bool:
    if not prior:
        return False
    n = float(prior.get("n") or 0)
    n_eff = float(prior["n_eff"]) if prior.get("n_eff") is not None else n
    return _meets_n(n) and _meets_n(n_eff)


def iqr_span(spec: Mapping[str, Any] | None) -> tuple[float, float, float]:
    """Return (lo, hi, median). Refuses to invent a whole-product IQR."""
    if not spec or not isinstance(spec, Mapping):
        raise KeyError("iqr_span needs a {median, iqr} block; will not default to (0, 1)")
    if "median" in spec:
        med = float(spec["median"])
    else:
        raise KeyError("iqr_span missing median; will not default to 0.5")
    iqr = spec.get("iqr")
    if isinstance(iqr, (list, tuple)) and len(iqr) == 2:
        return float(iqr[0]), float(iqr[1]), med
    if iqr is not None:
        half = float(iqr) / 2
        return med - half, med + half, med
    raise KeyError("iqr missing; will not span the whole product")


def in_iqr(value: float, spec: Mapping[str, Any] | None) -> bool:
    lo, hi, _ = iqr_span(spec)
    return lo <= value <= hi


def _as_mode(m: Mapping[str, Any]) -> dict[str, Any]:
    cx = _num(_pick(m, _CX))
    cy = _num(_pick(m, _CY))
    w = _num(_pick(m, _W))
    h_val = _pick(m, _H, required=False)
    rot_val = _pick(m, _ROT, required=False)
    iqr = m.get("iqr")
    if iqr is None:
        iqr = (cy - 0.05, cy + 0.05)
    return {
        "cx": cx,
        "cy": cy,
        "w": w,
        "h": _num(h_val) if h_val is not None else w,
        "rot": float(rot_val) if rot_val is not None else 0.0,
        "n": float(m.get("n") or m.get("n_corpus") or 0),
        "iqr": iqr,
        "cx_rel": cx,
        "cy_rel": cy,
        "w_of_product_w": w,
    }


def _modes_of(prior: Mapping[str, Any]) -> list[dict[str, Any]]:
    modes = list(prior.get("modes") or [])
    if modes:
        return [_as_mode(m) for m in modes]
    cx_b = _pick(prior, _CX)
    cy_b = _pick(prior, _CY)
    w_b = _pick(prior, _W)
    if isinstance(cy_b, Mapping):
        lo, hi, cy_m = iqr_span(cy_b)
    else:
        cy_m = float(cy_b)
        lo, hi = cy_m - 0.05, cy_m + 0.05
    cx_m = _num(cx_b)
    w_m = _num(w_b)
    return [{"cx": cx_m, "cy": cy_m, "w": w_m, "h": w_m, "rot": 0.0, "n": float(prior.get("n") or 0), "iqr": (lo, hi)}]


def visible_modes(prior: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Modes with enough mass to propose. Never the average of two."""
    out = []
    for m in _modes_of(prior):
        if _meets_n(float(m.get("n") or 0)):
            out.append(m)
    return out


def _heavier(modes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    return max(modes, key=lambda m: float(m.get("n") or 0))


def _near_mode(rel: Mapping[str, float], mode: Mapping[str, Any]) -> bool:
    m = _as_mode(mode)
    lo, hi, med = iqr_span({"median": float(m["cy"]), "iqr": m.get("iqr")})
    cy_ok = lo <= float(rel["cy"]) <= hi or abs(float(rel["cy"]) - med) <= 0.08
    cx_ok = abs(float(rel["cx"]) - float(m["cx"])) <= 0.08
    return bool(cx_ok and cy_ok)


def check_route(route: str) -> str:
    if not route:
        raise KeyError("detector route is empty; will not guess")
    if route not in ENGINE_ROUTES:
        raise ValueError(
            f"unknown route {route!r}; engine emits {sorted(ENGINE_ROUTES)}; "
            f"SEEN={sorted(SEEN_ROUTES)} NOT_SEEN={sorted(NOT_SEEN)}"
        )
    return route


# ---------------------------------------------------------------------------
# Arbitration
# ---------------------------------------------------------------------------

def _detector_conf(score: float, body_confidence: float, route: str) -> float:
    s = max(0.0, min(1.0, float(score) / 100.0))
    b = max(0.0, min(1.0, float(body_confidence)))
    seen = 1.0 if route in SEEN_ROUTES else 0.55
    return s * b * seen


def _prior_conf(prior: Mapping[str, Any]) -> float:
    n_eff = float(prior.get("n_eff") if prior.get("n_eff") is not None else prior.get("n") or 0)
    mass = n_eff / (n_eff + N_MIN)
    cy_b = _pick(prior, _CY, required=False)
    if isinstance(cy_b, Mapping) and "iqr" in cy_b and "median" in cy_b:
        lo, hi, _ = iqr_span(cy_b)
    elif prior.get("modes"):
        m0 = _as_mode(prior["modes"][0])
        lo, hi, _ = iqr_span({"median": m0["cy"], "iqr": m0.get("iqr")})
    else:
        raise KeyError("prior has no cy_rel/cy IQR; will not assume a tight zone")
    tightness = 1.0 - min(1.0, max(0.0, (hi - lo) / 0.5))
    return mass * (0.4 + 0.6 * tightness)


def _seen_face(route: str, score: float, body_confidence: float) -> bool:
    check_route(route)
    return route in SEEN_ROUTES and score >= DETECTOR_MID and body_confidence >= BODY_MIN


def arbitrate(
    detector: Mapping[str, Any] | None,
    prior: Mapping[str, Any] | None,
    body: Sequence[Any],
    body_confidence: float,
) -> dict[str, Any]:
    """Choose a quad and say why.

    detector: {quad, score, route}  score 0–100, route is an engine face name
    prior:    n, n_eff, cx_rel/cy_rel/w_of_product_w (or cx/cy/w), modes?
    body:     product quad, {x,y} dicts
    """
    body_q = quad_dict(quad_xy(body))
    det_quad = (detector or {}).get("quad")
    det_score = float((detector or {}).get("score") or 0)
    route_raw = (detector or {}).get("route")
    route = str(route_raw) if route_raw else ""
    if det_quad and route:
        check_route(route)
    det_rel = relative_of(det_quad, body_q) if det_quad else None
    d_conf = _detector_conf(det_score, body_confidence, route) if det_quad and route else 0.0
    p_ok = proposable(prior)
    modes = visible_modes(prior) if prior else []
    p_conf = _prior_conf(prior) if p_ok and prior else 0.0

    def pack(quad, source: str, reason: str, confidence: float, **extra: Any) -> dict[str, Any]:
        q = quad_dict(quad_xy(quad)) if quad is not None else None
        return {
            "quad": q,
            "source": source,
            "reason": reason,
            "confidence": max(0.0, min(1.0, confidence)),
            "modes": [
                {**m, "quad": quad_from_relative(m, body_q)}
                for m in modes
            ],
            **extra,
        }

    if not p_ok:
        if det_quad:
            return pack(
                det_quad,
                "detector",
                "prior not proposable (n or n_eff < 5); detector is the only opinion",
                d_conf,
                priorProposable=False,
            )
        return pack(None, "none", "no proposable prior and no detector", 0.0, priorProposable=False)

    if not det_quad:
        if len(modes) >= 2:
            pick = _heavier(modes)
            return pack(
                quad_from_relative(pick, body_q),
                "prior-bimodal",
                "no detector; two modes — not averaging, heavier mode offered, both kept",
                p_conf,
                priorProposable=True,
            )
        if not modes:
            raise KeyError("proposable prior has no readable mode (cx_rel/cy_rel)")
        pick = modes[0]
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "no detector; class prior",
            p_conf,
            priorProposable=True,
        )

    assert det_rel is not None

    agreeing = [m for m in (modes or _modes_of(prior or {})) if _near_mode(det_rel, m)]
    in_valley = len(modes) >= 2 and not agreeing

    if agreeing:
        raised = 1.0 - (1.0 - d_conf) * (1.0 - p_conf)
        return pack(
            det_quad,
            "agree",
            "detector lands in a prior mode IQR — same opinion, confidence raised",
            raised,
            priorProposable=True,
            agreedMode=agreeing[0],
        )

    if in_valley:
        if route and _seen_face(route, det_score, body_confidence):
            return pack(
                det_quad,
                "detector",
                "bimodal prior, detector in the valley, but a seen face on a readable body — keeping the plate",
                d_conf,
                priorProposable=True,
                valley=True,
            )
        nearest = min(
            modes,
            key=lambda m: math.hypot(float(m["cx"]) - det_rel["cx"], float(m["cy"]) - det_rel["cy"]),
        )
        return pack(
            quad_from_relative(nearest, body_q),
            "prior-bimodal",
            "bimodal prior, detector in the empty valley without a seen face — nearest mode, not the mean",
            p_conf,
            priorProposable=True,
            valley=True,
        )

    if body_confidence < BODY_MIN:
        pick = _heavier(modes) if modes else _modes_of(prior)[0]
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "body confidence below 0.45; photo is not evidence, class prior stands",
            p_conf,
            priorProposable=True,
        )

    if route and _seen_face(route, det_score, body_confidence):
        return pack(
            det_quad,
            "detector",
            "seen face on a readable body — tight prior does not override a plate",
            d_conf,
            priorProposable=True,
        )

    if det_score < DETECTOR_MID:
        pick = _heavier(modes) if modes else _modes_of(prior)[0]
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "detector below the midpoint of the 0–100 scale; proposable prior wins",
            p_conf,
            priorProposable=True,
        )

    return pack(
        det_quad,
        "detector",
        "prior and detector disagree; no seen-face lock and detector is not weak — offering the face, prior kept as alt",
        d_conf,
        priorProposable=True,
        conflict=True,
    )


# ---------------------------------------------------------------------------
# Priors that learn
# ---------------------------------------------------------------------------

def empty_prior(class_id: str, modes: Sequence[Mapping[str, Any]], n: float, n_eff: float) -> dict[str, Any]:
    """Corpus snapshot. Pick-layer starts empty so three picks cannot rewrite it."""
    stored = []
    for raw in modes:
        m = _as_mode(raw)
        stored.append(
            {
                "cx": m["cx"],
                "cy": m["cy"],
                "cx_rel": m["cx"],
                "cy_rel": m["cy"],
                "cx_corpus": m["cx"],
                "cy_corpus": m["cy"],
                "w": m["w"],
                "w_of_product_w": m["w"],
                "h": m["h"],
                "rot": m["rot"],
                "n_corpus": float(raw.get("n") or 0),
                "iqr": m["iqr"],
                "picks": [],
                "rejects": [],
            }
        )
    cy_vals = [float(m["cy"]) for m in stored] or [0.5]
    cx_vals = [float(m["cx"]) for m in stored] or [0.5]
    return {
        "class": class_id,
        "n": float(n),
        "n_eff": float(n_eff),
        "cx": {"median": sum(cx_vals) / len(cx_vals), "iqr": (min(cx_vals), max(cx_vals))},
        "cy": {"median": sum(cy_vals) / len(cy_vals), "iqr": (min(cy_vals), max(cy_vals))},
        "cx_rel": {"median": sum(cx_vals) / len(cx_vals), "iqr": (min(cx_vals), max(cx_vals))},
        "cy_rel": {"median": sum(cy_vals) / len(cy_vals), "iqr": (min(cy_vals), max(cy_vals))},
        "modes": stored,
        "events": [],
    }


def _group_of(event: Mapping[str, Any]) -> str:
    """Person (`by`) then deck (`job`). Never a memory address."""
    by = event.get("by") if event.get("by") not in (None, "") else event.get("am_id")
    if by:
        return f"by:{by}"
    job = event.get("job") if event.get("job") not in (None, "") else event.get("deck_id")
    if job:
        return f"job:{job}"
    raise ValueError("event has no by/job; unattributable picks cannot update a prior")


def _group_mass(records: Sequence[Mapping[str, Any]]) -> float:
    """One person is one opinion. Drawn (1.0) outranks chosen (0.5)."""
    weights: dict[str, float] = {}
    for r in records:
        g = str(r.get("group") or "")
        if not g:
            raise ValueError("pick record missing group; refusing id() fallback")
        weights[g] = weights.get(g, 0.0) + float(r.get("weight") or 0)
    return sum(min(w, 1.0) for w in weights.values())


def _weighted_mean(records: Sequence[Mapping[str, Any]], key: str) -> float | None:
    s = w = 0.0
    for r in records:
        ww = float(r.get("weight") or 0)
        s += ww * float(r[key])
        w += ww
    return s / w if w else None


def summarise(prior: Mapping[str, Any]) -> dict[str, Any]:
    """Recompute visible modes from corpus + pick layer. Never average two modes."""
    modes_out = []
    for m in prior.get("modes") or []:
        picks = list(m.get("picks") or [])
        rejects = list(m.get("rejects") or [])
        n_c = float(m.get("n_corpus") or 0)
        cy_c = float(m.get("cy_corpus") if m.get("cy_corpus") is not None else m["cy"])
        cx_c = float(m.get("cx_corpus") if m.get("cx_corpus") is not None else m["cx"])
        w_c = float(m.get("w_corpus") if m.get("w_corpus") is not None else m["w"])
        n_p = _group_mass(picks)
        n_r = _group_mass(rejects)
        n_picks_net = max(0.0, n_p - n_r)
        cy_p = _weighted_mean(picks, "cy")
        cx_p = _weighted_mean(picks, "cx")
        w_p = _weighted_mean(picks, "w")
        denom = n_c + n_picks_net
        cy = (n_c * cy_c + n_picks_net * cy_p) / denom if (cy_p is not None and denom) else cy_c
        cx = (n_c * cx_c + n_picks_net * cx_p) / denom if (cx_p is not None and denom) else cx_c
        ww = (n_c * w_c + n_picks_net * w_p) / denom if (w_p is not None and denom) else w_c
        modes_out.append(
            {
                "cx": cx,
                "cy": cy,
                "cx_rel": cx,
                "cy_rel": cy,
                "cx_corpus": cx_c,
                "cy_corpus": cy_c,
                "w": ww,
                "w_of_product_w": ww,
                "w_corpus": w_c,
                "h": float(m.get("h") or ww),
                "rot": float(m.get("rot") or 0),
                "n": n_c + n_picks_net,
                "n_corpus": n_c,
                "n_picks": n_picks_net,
                "iqr": m.get("iqr"),
                "picks": picks,
                "rejects": rejects,
            }
        )
    vis = [m for m in modes_out if _meets_n(float(m["n"]))]
    n_eff = sum(float(m["n"]) for m in vis) if vis else 0.0
    out = dict(prior)
    out["modes"] = modes_out
    out["n_eff_live"] = n_eff
    return out


def update_prior(prior: Mapping[str, Any], event: Mapping[str, Any], body: Sequence[Any]) -> dict[str, Any]:
    """Shrinkage update. Corpus mass never decreases.

    event.kind: "drawn" | "chosen" | "reject"
    event.quad: the drawn/chosen box (required for drawn/chosen)
    event.shortlist: offered boxes (required for reject)
    event.by / event.job: concentration keys (am_id / deck_id accepted as aliases)
    """
    out = {
        **prior,
        "modes": [dict(m, picks=list(m.get("picks") or []), rejects=list(m.get("rejects") or [])) for m in prior.get("modes") or []],
        "events": list(prior.get("events") or []) + [dict(event, kind=event.get("kind"))],
    }
    kind = str(event.get("kind") or "")
    group = _group_of(event)
    modes = out["modes"]

    def rel_of(q: Any) -> dict[str, float]:
        return relative_of(q, body)

    def attach(kind_key: str, rel: Mapping[str, float], weight: float) -> None:
        rec = {"cy": rel["cy"], "cx": rel["cx"], "w": rel["w"], "weight": weight, "group": group, "kind": kind}
        nearby = [m for m in modes if _near_mode(rel, m)]
        if nearby:
            target = min(nearby, key=lambda m: math.hypot(float(m["cx"]) - rel["cx"], float(m["cy"]) - rel["cy"]))
            target[kind_key].append(rec)
            return
        if kind == "drawn":
            modes.append(
                {
                    "cx": rel["cx"],
                    "cy": rel["cy"],
                    "cx_rel": rel["cx"],
                    "cy_rel": rel["cy"],
                    "cx_corpus": rel["cx"],
                    "cy_corpus": rel["cy"],
                    "w": rel["w"],
                    "h": rel.get("h", rel["w"]),
                    "rot": rel.get("rot", 0.0),
                    "n_corpus": 0.0,
                    "iqr": (rel["cy"] - 0.05, rel["cy"] + 0.05),
                    "picks": [rec] if kind_key == "picks" else [],
                    "rejects": [rec] if kind_key == "rejects" else [],
                }
            )

    if kind == "reject":
        shortlist = list(event.get("shortlist") or [])
        if event.get("quad"):
            shortlist = shortlist + [event["quad"]]
        for q in shortlist:
            attach("rejects", rel_of(q), W_REJECT)
        return summarise(out)

    if kind in ("drawn", "chosen") and event.get("quad"):
        w = W_DRAWN if kind == "drawn" else W_CHOSEN
        attach("picks", rel_of(event["quad"]), w)
        return summarise(out)

    return summarise(out)
