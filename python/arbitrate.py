"""Prior ⇄ detector arbitration, and a prior that learns from picks.

Port these functions. Do not drop this file onto imprint_engine.py —
that engine has the detector; this module does not.

Floors taken from the corpus brief, not fitted here
---------------------------------------------------
N_MIN = 5         "n < 5 is reported but never proposed as a prior"
BODY_MIN = 0.45   pages below 0.45 were dropped as unreadable
DETECTOR_MID = 50 midpoint of the published 0–100 quality scale

A row median is not evidence when n_eff is 3.3. Proposable uses n_eff,
not n. Award n=38 with inverse-Simpson 3.3 is not a prior.

The point seam
--------------
API in/out is {x, y} dicts. Internals are [x, y]. Crossing it implicitly
once left a veto dead inside a broad except. Convert at the boundary.

Unsure — measure on the 249 decks, do not treat as fitted
---------------------------------------------------------
- drawn:chosen weight 1.0:0.5. Thirty menu picks should not equal thirty
  drawn boxes; I do not know if 0.5 is the right ratio.
- a chosen box in the valley does not spawn a mode (it is the least-wrong
  of a bad menu). A drawn box can. Spawn stays invisible until n >= 5.
- valley + seen plate: I keep the plate when body_confidence >= 0.45.
  Measure notebook valley-detector precision before locking that.
- grouping for n_eff is account-manager id, then deck id if AM is missing.
  Deck-only grouping would count one AM on forty decks as forty opinions.

Five methods, one spelling: UV printing, UV DTF, laser engraving,
sublimation, embroidery. This file does not name a method.
"""

from __future__ import annotations

import math
from typing import Any, Mapping, Sequence

N_MIN = 5
BODY_MIN = 0.45
DETECTOR_MID = 50.0

# Routes that mean "the engine saw a face on this photo", not a guess.
SEEN_ROUTES = frozenset({"panel", "plate", "hub", "demo", "specular"})
# Placeholder / class / zone are fallbacks, not faces.

W_DRAWN = 1.0
W_CHOSEN = 0.5
W_REJECT = 0.5


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


# ---------------------------------------------------------------------------
# Product-relative geometry (framing-invariant, always X for width)
# ---------------------------------------------------------------------------

def relative_of(quad: Sequence[Any], body: Sequence[Any]) -> dict[str, float]:
    """Centre as a fraction of the product box. Width over product width — the X axis.

    Never swap to height/product_height because the mark is rotated. That units
    error invented a 3× pen defect. `ext` is separate, along the mark's baseline.
    """
    q = box_of(quad)
    b = box_of(body)
    bw = max(b["w"], 1e-9)
    bh = max(b["h"], 1e-9)
    cx = (q["x"] + q["w"] / 2 - b["x"]) / bw
    cy = (q["y"] + q["h"] / 2 - b["y"]) / bh
    rot = _long_axis_deg(quad_xy(quad))
    # ext: mark extent along its own baseline over the product on that axis.
    if rot >= 45:
        ext = q["h"] / bh
    else:
        ext = q["w"] / bw
    return {"cx": cx, "cy": cy, "w": q["w"] / bw, "h": q["h"] / bh, "ext": ext, "rot": rot}


def _long_axis_deg(pts: Sequence[Sequence[float]]) -> float:
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


def quad_from_relative(rel: Mapping[str, float], body: Sequence[Any]) -> list[dict[str, float]]:
    b = box_of(body)
    w = float(rel.get("w") or 0.24) * b["w"]
    h = float(rel.get("h") or rel.get("w") or 0.24) * b["h"]
    cx = b["x"] + float(rel["cx"]) * b["w"]
    cy = b["y"] + float(rel["cy"]) * b["h"]
    return quad_of_box({"x": cx - w / 2, "y": cy - h / 2, "w": w, "h": h})


# ---------------------------------------------------------------------------
# Effective n
# ---------------------------------------------------------------------------

def effective_n(weights: Mapping[Any, float]) -> float:
    """Inverse-Simpson. 40 jobs from one AM → 1. 40 AMs → 40."""
    total = float(sum(weights.values()))
    if total <= 0:
        return 0.0
    return 1.0 / sum((w / total) ** 2 for w in weights.values() if w > 0)


def proposable(prior: Mapping[str, Any] | None) -> bool:
    if not prior:
        return False
    n = float(prior.get("n") or 0)
    n_eff = float(prior.get("n_eff") if prior.get("n_eff") is not None else n)
    return n >= N_MIN and n_eff >= N_MIN


def iqr_span(spec: Mapping[str, Any] | None) -> tuple[float, float, float]:
    """Return (lo, hi, median). IQR may be a (lo,hi) pair or a width."""
    if not spec:
        return (0.0, 1.0, 0.5)
    med = float(spec.get("median") if spec.get("median") is not None else spec.get("cy", spec.get("cx", 0.5)))
    iqr = spec.get("iqr")
    if isinstance(iqr, (list, tuple)) and len(iqr) == 2:
        return float(iqr[0]), float(iqr[1]), med
    if iqr is not None:
        half = float(iqr) / 2
        return med - half, med + half, med
    return med - 0.05, med + 0.05, med


def in_iqr(value: float, spec: Mapping[str, Any] | None) -> bool:
    lo, hi, _ = iqr_span(spec)
    return lo <= value <= hi


def _modes_of(prior: Mapping[str, Any]) -> list[dict[str, Any]]:
    modes = list(prior.get("modes") or [])
    if modes:
        return [dict(m) for m in modes]
    cy = prior.get("cy") or {}
    cx = prior.get("cx") or {}
    w = prior.get("w") or {}
    _, _, cy_m = iqr_span(cy) if isinstance(cy, Mapping) else (0, 1, float(cy or 0.5))
    _, _, cx_m = iqr_span(cx) if isinstance(cx, Mapping) else (0, 1, float(cx or 0.5))
    _, _, w_m = iqr_span(w) if isinstance(w, Mapping) else (0, 1, float(w or 0.24))
    lo, hi, _ = iqr_span(cy) if isinstance(cy, Mapping) else (cy_m - 0.05, cy_m + 0.05, cy_m)
    return [{"cx": cx_m, "cy": cy_m, "w": w_m, "h": w_m, "n": float(prior.get("n") or 0), "iqr": (lo, hi)}]


def visible_modes(prior: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Modes with enough mass to propose. Never the average of two."""
    out = []
    for m in _modes_of(prior):
        n = float(m.get("n") or 0)
        if n >= N_MIN:
            out.append(m)
    return out or []


def _heavier(modes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    return max(modes, key=lambda m: float(m.get("n") or 0))


def _near_mode(rel: Mapping[str, float], mode: Mapping[str, Any]) -> bool:
    lo, hi, med = iqr_span({"median": mode.get("cy"), "iqr": mode.get("iqr")})
    # A value inside the mode IQR, or within 0.08 of its centre (named, not fitted:
    # notebook modes sit 0.40 apart, so 0.08 cannot merge them).
    return lo <= rel["cy"] <= hi or abs(rel["cy"] - med) <= 0.08


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
    mass = n_eff / (n_eff + N_MIN)  # N_MIN is their floor, used as prior strength
    cy = prior.get("cy") if isinstance(prior.get("cy"), Mapping) else {}
    lo, hi, _ = iqr_span(cy)
    # IQR of 0.5 of the product is "no zone". Tight IQR raises trust.
    tightness = 1.0 - min(1.0, max(0.0, (hi - lo) / 0.5))
    return mass * (0.4 + 0.6 * tightness)


def _seen_face(route: str, score: float, body_confidence: float) -> bool:
    return route in SEEN_ROUTES and score >= DETECTOR_MID and body_confidence >= BODY_MIN


def arbitrate(
    detector: Mapping[str, Any] | None,
    prior: Mapping[str, Any] | None,
    body: Sequence[Any],
    body_confidence: float,
) -> dict[str, Any]:
    """Choose a quad and say why.

    detector: {quad, score, route}  score 0–100, route is a face name
    prior:    {n, n_eff, cx, cy, w, ext, modes?}
    body:     product quad, {x,y} dicts
    """
    body_q = quad_dict(quad_xy(body))
    det_quad = (detector or {}).get("quad")
    det_score = float((detector or {}).get("score") or 0)
    route = str((detector or {}).get("route") or "")
    det_rel = relative_of(det_quad, body_q) if det_quad else None
    d_conf = _detector_conf(det_score, body_confidence, route) if det_quad else 0.0
    p_ok = proposable(prior)
    modes = visible_modes(prior) if prior else []
    p_conf = _prior_conf(prior) if p_ok else 0.0

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

    # --- A. Prior not proposable ------------------------------------------
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

    # --- B. No detector ---------------------------------------------------
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
        pick = modes[0] if modes else {"cx": 0.5, "cy": 0.5, "w": 0.24, "h": 0.24}
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "no detector; class prior",
            p_conf,
            priorProposable=True,
        )

    assert det_rel is not None

    # Does the detector sit in a mode IQR?
    agreeing = [m for m in (modes or _modes_of(prior or {})) if _near_mode(det_rel, m)]
    in_valley = len(modes) >= 2 and not agreeing

    # --- C. Agreement: raise confidence, keep the face on this photo ------
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

    # --- D/E. Bimodal valley ----------------------------------------------
    if in_valley:
        if _seen_face(route, det_score, body_confidence):
            return pack(
                det_quad,
                "detector",
                "bimodal prior, detector in the valley, but a seen face on a readable body — keeping the plate",
                d_conf,
                priorProposable=True,
                valley=True,
            )
        nearest = min(modes, key=lambda m: abs(float(m["cy"]) - det_rel["cy"]))
        return pack(
            quad_from_relative(nearest, body_q),
            "prior-bimodal",
            "bimodal prior, detector in the empty valley without a seen face — nearest mode, not the mean",
            p_conf,
            priorProposable=True,
            valley=True,
        )

    # --- H. Bad photo: body unreadable, prior is the archive --------------
    if body_confidence < BODY_MIN:
        pick = _heavier(modes) if modes else _modes_of(prior)[0]
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "body confidence below 0.45; photo is not evidence, class prior stands",
            p_conf,
            priorProposable=True,
        )

    # --- G. Seen face on a readable body: do not override a plate ---------
    if _seen_face(route, det_score, body_confidence):
        return pack(
            det_quad,
            "detector",
            "seen face on a readable body — tight prior does not override a plate",
            d_conf,
            priorProposable=True,
        )

    # --- F. Weak detector vs proposable prior -----------------------------
    if det_score < DETECTOR_MID:
        pick = _heavier(modes) if modes else _modes_of(prior)[0]
        return pack(
            quad_from_relative(pick, body_q),
            "prior",
            "detector below the midpoint of the 0–100 scale; proposable prior wins",
            p_conf,
            priorProposable=True,
        )

    # Conflict, both middling: keep the detector (it is this photo) but do
    # not raise confidence, and surface the prior as an alternate.
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
    for m in modes:
        stored.append(
            {
                "cx": float(m["cx"]),
                "cy": float(m["cy"]),
                "cx_corpus": float(m["cx"]),
                "cy_corpus": float(m["cy"]),
                "w": float(m.get("w") or 0.24),
                "h": float(m.get("h") or m.get("w") or 0.24),
                "n_corpus": float(m.get("n") or 0),
                "iqr": m.get("iqr") or (float(m["cy"]) - 0.05, float(m["cy"]) + 0.05),
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
        "modes": stored,
        "events": [],
    }


def _group_of(event: Mapping[str, Any]) -> str:
    am = event.get("am_id")
    if am:
        return f"am:{am}"
    deck = event.get("deck_id")
    if deck:
        return f"deck:{deck}"
    return f"row:{id(event)}"


def _group_mass(records: Sequence[Mapping[str, Any]]) -> float:
    """One account manager is one opinion. Drawn (1.0) outranks chosen (0.5).

    40 jobs from one AM → mass 1. 40 AMs drawn → mass 40. 40 AMs chosen → mass 20.
    Unsure: a second AM with one job beside 39 from another is mass 2 here;
    inverse-Simpson of that split is ~1.05. I am counting the second AM. Measure it.
    """
    weights: dict[str, float] = {}
    for r in records:
        g = str(r.get("group") or "row")
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
                "cx_corpus": cx_c,
                "cy_corpus": cy_c,
                "w": ww,
                "w_corpus": w_c,
                "h": float(m.get("h") or ww),
                "n": n_c + n_picks_net,
                "n_corpus": n_c,
                "n_picks": n_picks_net,
                "iqr": m.get("iqr"),
                "picks": picks,
                "rejects": rejects,
            }
        )
    vis = [m for m in modes_out if float(m["n"]) >= N_MIN]
    n_eff = sum(float(m["n"]) for m in vis) if vis else 0.0
    out = dict(prior)
    out["modes"] = modes_out
    out["n_eff_live"] = n_eff
    return out


def update_prior(prior: Mapping[str, Any], event: Mapping[str, Any], body: Sequence[Any]) -> dict[str, Any]:
    """Shrinkage update. Corpus mass never decreases.

    event.kind: "drawn" | "chosen" | "reject"
    event.quad: the drawn/chosen box (required for drawn/chosen)
    event.shortlist: offered boxes (required for reject; optional otherwise)
    event.am_id / event.deck_id: concentration keys
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
            target = min(nearby, key=lambda m: abs(float(m["cy"]) - rel["cy"]))
            target[kind_key].append(rec)
            return
        # Valley / new place.
        if kind == "drawn":
            modes.append(
                {
                    "cx": rel["cx"],
                    "cy": rel["cy"],
                    "w": rel["w"],
                    "h": rel.get("h", rel["w"]),
                    "n_corpus": 0.0,
                    "iqr": (rel["cy"] - 0.05, rel["cy"] + 0.05),
                    "picks": [rec] if kind_key == "picks" else [],
                    "rejects": [rec] if kind_key == "rejects" else [],
                }
            )
        # chosen in the valley is not a new mode. reject in the valley still
        # lands on the nearest mode if any, else is stored on nothing (the
        # valley has no mass to take away, which is the point).

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
