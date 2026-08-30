"""A class zone that can hold two modes, and the rule that picks one.

Port these functions. Do not drop this file onto imprint_engine.py.

Why this exists
---------------
A zone with one `rotation` number cannot describe bottles (17 along the
wall / 9 upright) or flags (18 at 90° / 30 upright). Shipping 0 everywhere
is honest; shipping the mean is not. Notebooks have the same problem on
position (mid-cover vs bottom). Same representation covers both splits.

Angle convention — long axis, not the presented top edge
--------------------------------------------------------
Reference edge: the longer of TL→TR and TR→BR.
Sign: atan2(dy, dx) degrees, CCW from +X, folded onto (-90, 90].
0° and 180° are the same baseline. Orthogonal poses are 90° apart.

A 75° sliver measures ~18° on its top edge. We use 75°. The renderer maps
the logo's top onto TL→TR; that is a different quantity, named
`top_edge_deg` in arbitrate.py. Passing it as `rotation` is a vocabulary
error — set `rotation_ref="top_edge"` and we raise, we do not convert
silently.

Size — two numbers, never a swapped axis
----------------------------------------
The engine clamp is `bbox_width / body_width`, always X. An earlier audit
swapped to height/product_height for rotated classes and manufactured a
3× pen defect. We will not.

  w_of_product_w                 overflow on X. The clamp. Never rotates.
  mark_extent_along_baseline     the mark's long axis over the product on
                                 that same axis. This is the 0.17 barrel
                                 number, and it is not the clamp.

A caller expresses a cap with those keys. A single `max_scale` raises.

Vocabulary — raise on an unmapped value
---------------------------------------
Engine routes: insert, panel, placeholder, specular, hub, recipe, category.
SEEN vs NOT_SEEN declared. Unknown route raises.
Zone keys: cx_rel, cy_rel, w_of_product_w, mark_extent_along_baseline,
rotation. Short aliases accepted. Missing both of a required pair raises.
At most two modes. A third raises. An old single-value zone is one mode.

Unsure — measure on the 567 mockups, do not treat as fitted
-----------------------------------------------------------
- ROTATED = 45° is your published definition of a rotated mark, reused
  as "these two modes disagree on rotation". Not a new cut.
- "Between" the two angles is unique-nearer, no dead zone. A 37° band on
  a 0/90 class is nearer 0; we still do not snap a seen face to 0.
- Forced pick of the heavier mode when the call site cannot offer: off
  by default. Turning it on is how the notebook valley comes back.

Five methods, one spelling: UV printing, UV DTF, laser engraving,
sublimation, embroidery. This file does not name a method.
"""

from __future__ import annotations

import math
from typing import Any, Mapping, Sequence

import arbitrate as arb

N_MIN = arb.N_MIN
N_MIN_EPS = arb.N_MIN_EPS
BODY_MIN = arb.BODY_MIN

ENGINE_ROUTES = arb.ENGINE_ROUTES
SEEN_ROUTES = arb.SEEN_ROUTES
NOT_SEEN = arb.NOT_SEEN

# Your published definition of a rotated mark. Reused, not refitted.
ROTATED_DEG = 45.0

_CX = arb._CX
_CY = arb._CY
_W = arb._W
_EXT = arb._EXT
_H = arb._H
_ROT = ("rotation", "rot", "angle")
_REF = ("rotation_ref", "angle_ref")

# Allowed rotation_ref values. Anything else, including top_edge, raises.
ROTATION_REFS = frozenset({"long_axis"})


def _fold(deg: float) -> float:
    """Fold onto (-90, 90]. 180° ≡ 0° (same baseline)."""
    x = (float(deg) + 180.0) % 180.0
    return x - 180.0 if x > 90.0 else x


def ang_dist(a: float, b: float) -> float:
    """Distance between two line orientations, in [0, 90]."""
    d = abs(_fold(a) - _fold(b))
    return 180.0 - d if d > 90.0 else d


def long_axis_deg(quad: Sequence[Any]) -> float:
    """Signed long-axis degrees of a quad. See module docstring."""
    pts = arb.quad_xy(quad)
    if len(pts) < 3:
        raise KeyError("quad needs TL, TR, BR to name a long axis")
    e01 = (pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
    e12 = (pts[2][0] - pts[1][0], pts[2][1] - pts[1][1])
    if math.hypot(*e01) >= math.hypot(*e12):
        deg = math.degrees(math.atan2(e01[1], e01[0]))
    else:
        deg = math.degrees(math.atan2(e12[1], e12[0]))
    return _fold(deg)


def _pick(block: Mapping[str, Any], names: Sequence[str], *, required: bool = True) -> Any:
    return arb._pick(block, names, required=required)


def _num(value: Any) -> float:
    return arb._num(value)


def _n_of(block: Mapping[str, Any]) -> float:
    n_eff = block.get("n_eff")
    if n_eff is not None:
        return float(n_eff)
    return float(block.get("n") or 0)


def _trusted(block: Mapping[str, Any]) -> bool:
    n = float(block.get("n") or 0)
    n_eff = float(block["n_eff"]) if block.get("n_eff") is not None else n
    return arb._meets_n(n) and arb._meets_n(n_eff)


def _iqr_of(block: Mapping[str, Any], names: Sequence[str]) -> tuple[float, float, float] | None:
    raw = _pick(block, names, required=False)
    if isinstance(raw, Mapping) and "median" in raw and "iqr" in raw:
        return arb.iqr_span(raw)
    iqr = block.get("iqr") if names[0] in ("cy", "cy_rel") else block.get("iqr_cx")
    if iqr is not None and raw is not None and not isinstance(raw, Mapping):
        med = float(raw)
        if isinstance(iqr, (list, tuple)) and len(iqr) == 2:
            return float(iqr[0]), float(iqr[1]), med
    return None


def as_mode(block: Mapping[str, Any]) -> dict[str, Any]:
    ref = _pick(block, _REF, required=False)
    if ref is not None and ref not in ROTATION_REFS:
        raise ValueError(
            f"rotation_ref={ref!r} is not {sorted(ROTATION_REFS)}; "
            "will not silently treat a top edge as a long axis"
        )
    rot_raw = _pick(block, _ROT, required=False)
    rot = _fold(_num(rot_raw)) if rot_raw is not None else 0.0
    cx = _num(_pick(block, _CX))
    cy = _num(_pick(block, _CY))
    w = _num(_pick(block, _W))
    ext_raw = _pick(block, _EXT, required=False)
    h_raw = _pick(block, _H, required=False)
    return {
        "cx": cx,
        "cy": cy,
        "cx_rel": cx,
        "cy_rel": cy,
        "w": w,
        "w_of_product_w": w,
        "h": _num(h_raw) if h_raw is not None else w,
        "ext": _num(ext_raw) if ext_raw is not None else None,
        "mark_extent_along_baseline": _num(ext_raw) if ext_raw is not None else None,
        "rotation": rot,
        "n": float(block.get("n") or 0),
        "n_eff": float(block["n_eff"]) if block.get("n_eff") is not None else float(block.get("n") or 0),
        "iqr": block.get("iqr"),
        "iqr_cx": block.get("iqr_cx"),
    }


def as_modes(zone: Mapping[str, Any] | None) -> list[dict[str, Any]]:
    """Normalise an old single-value zone or a modes list. At most two."""
    if not zone:
        raise KeyError("zone is missing")
    extra = zone.get("modes")
    if extra is None:
        return [as_mode(zone)]
    if not isinstance(extra, (list, tuple)):
        raise KeyError("zone.modes must be a list")
    if len(extra) > 2:
        raise ValueError("a zone holds at most two modes; a third is a new class of error")
    if len(extra) == 0:
        raise KeyError("zone.modes is empty")
    return [as_mode(m) for m in extra]


def split_of(a: Mapping[str, Any], b: Mapping[str, Any]) -> str:
    """Which channel the two modes disagree on: rotation | position | both | same."""
    rot_apart = ang_dist(float(a["rotation"]), float(b["rotation"]))
    rot_split = rot_apart >= ROTATED_DEG
    dpos = math.hypot(float(a["cx"]) - float(b["cx"]), float(a["cy"]) - float(b["cy"]))
    iqr_a = _iqr_of(a, _CY)
    iqr_b = _iqr_of(b, _CY)
    if iqr_a and iqr_b:
        pos_split = not (iqr_a[0] <= float(b["cy"]) <= iqr_a[1] or iqr_b[0] <= float(a["cy"]) <= iqr_b[1])
    else:
        # No IQR: two listed centres are a split iff they are not the same point.
        # Named: we refuse to invent a valley width. Measure whether 0.02
        # should count as "same" on your pages.
        pos_split = dpos > 0.0
    if rot_split and pos_split:
        return "both"
    if rot_split:
        return "rotation"
    if pos_split:
        return "position"
    return "same"


def _nearer_rotation(rel_rot: float, a: Mapping[str, Any], b: Mapping[str, Any]) -> tuple[dict[str, Any] | None, bool]:
    da, db = ang_dist(rel_rot, float(a["rotation"])), ang_dist(rel_rot, float(b["rotation"]))
    if math.isclose(da, db, abs_tol=1e-9):
        return None, True
    return (a if da < db else b), False


def _nearer_position(rel: Mapping[str, float], a: Mapping[str, Any], b: Mapping[str, Any]) -> tuple[dict[str, Any] | None, bool]:
    def d(m: Mapping[str, Any]) -> float:
        return math.hypot(rel["cx"] - float(m["cx"]), rel["cy"] - float(m["cy"]))

    boxes = {id(m): _iqr_of(m, _CY) for m in (a, b)}
    if any(boxes.values()):
        hits = []
        for m in (a, b):
            box = boxes[id(m)]
            if box and box[0] <= rel["cy"] <= box[1]:
                cxb = _iqr_of(m, _CX)
                if cxb and not (cxb[0] <= rel["cx"] <= cxb[1]):
                    continue
                hits.append(m)
        if len(hits) == 0:
            return None, True  # in the valley, not in either IQR
        if len(hits) == 1:
            return hits[0], False
    da, db = d(a), d(b)
    if math.isclose(da, db, abs_tol=1e-9):
        return None, True
    return (a if da < db else b), False


def quad_from_mode(mode: Mapping[str, Any], body: Sequence[Any]) -> list[dict[str, float]]:
    """Rebuild a quad whose *long axis* equals mode.rotation.

    arb.quad_from_relative orients the top edge. When the box is taller than
    it is wide, the long axis is the side (top + 90°), so we pass rotation-90
    as the top-edge angle. Named, not silent.
    """
    m = as_mode(mode)
    w_frac = float(m["w"])
    h_frac = float(m.get("h") or w_frac)
    top = float(m["rotation"])
    if h_frac > w_frac:
        top = float(m["rotation"]) - 90.0
    return arb.quad_from_relative(
        {"cx": float(m["cx"]), "cy": float(m["cy"]), "w": w_frac, "h": h_frac, "rot": top},
        body,
    )


def read_size(quad: Sequence[Any], body: Sequence[Any]) -> dict[str, Any]:
    """Two numbers. X-clamp and along-baseline extent are not interchangeable."""
    q = arb.box_of(quad)
    b = arb.box_of(body)
    bw = max(b["w"], 1e-9)
    bh = max(b["h"], 1e-9)
    axis = long_axis_deg(quad)
    w_frac = q["w"] / bw
    if abs(axis) >= ROTATED_DEG:
        ext = q["h"] / bh
        size_axis = "y"
    else:
        ext = q["w"] / bw
        size_axis = "x"
    return {
        "w_of_product_w": w_frac,
        "mark_extent_along_baseline": ext,
        "long_axis_deg": axis,
        "size_axis": size_axis,
    }


def within_cap(size: Mapping[str, Any], cap: Mapping[str, Any]) -> bool:
    if not cap:
        raise KeyError("cap is missing")
    unknown = set(cap) - {
        "max_w_of_product_w",
        "max_mark_extent_along_baseline",
        "min_w_of_product_w",
        "min_mark_extent_along_baseline",
    }
    if "max_scale" in cap or "maxScale" in cap:
        raise KeyError("max_scale is ambiguous for a rotated mark; use max_w_of_product_w and/or max_mark_extent_along_baseline")
    if unknown:
        raise KeyError(f"unmapped cap keys {sorted(unknown)}")
    w = float(size["w_of_product_w"])
    ext = float(size["mark_extent_along_baseline"])
    if "max_w_of_product_w" in cap and w > float(cap["max_w_of_product_w"]):
        return False
    if "min_w_of_product_w" in cap and w < float(cap["min_w_of_product_w"]):
        return False
    if "max_mark_extent_along_baseline" in cap and ext > float(cap["max_mark_extent_along_baseline"]):
        return False
    if "min_mark_extent_along_baseline" in cap and ext < float(cap["min_mark_extent_along_baseline"]):
        return False
    return True


def _seen(detector: Mapping[str, Any] | None, body_confidence: float) -> bool:
    if not detector or not detector.get("quad"):
        return False
    route = str(detector.get("route") or "")
    arb.check_route(route)
    score = float(detector.get("score") or 0)
    return route in SEEN_ROUTES and body_confidence >= BODY_MIN and score >= 0.0


def select_mode(
    detector: Mapping[str, Any] | None,
    zone: Mapping[str, Any],
    body: Sequence[Any],
    body_confidence: float,
    *,
    must_choose: bool = False,
) -> dict[str, Any]:
    """Pick which class mode applies on this photo.

    Returns quad, mode, offers, snapped, reason.
    snapped is always False for a seen face — we do not rotate a plate
    onto a class angle.
    """
    modes = as_modes(zone)
    trusted = [m for m in modes if _trusted(m)]
    det_quad = (detector or {}).get("quad")
    if det_quad and detector and detector.get("route"):
        arb.check_route(str(detector["route"]))
    seen = _seen(detector, body_confidence)
    det_rot = long_axis_deg(det_quad) if det_quad else None
    det_rel = arb.relative_of(det_quad, body) if det_quad else None

    def pack(mode, quad, reason: str, *, offers=None, snapped: bool = False, between: bool = False) -> dict[str, Any]:
        return {
            "mode": mode,
            "quad": arb.quad_dict(arb.quad_xy(quad)) if quad is not None else None,
            "offers": [
                {**m, "quad": quad_from_mode(m, body)}
                for m in (offers if offers is not None else modes)
            ],
            "snapped": snapped,
            "reason": reason,
            "between": between,
            "split": split_of(modes[0], modes[1]) if len(modes) == 2 else "unimodal",
        }

    # Unimodal (old zone included).
    if len(modes) == 1:
        m = modes[0]
        if seen and det_quad:
            return pack(m, det_quad, "unimodal class, seen face kept (angle not snapped)")
        if not _trusted(m):
            if must_choose:
                return pack(m, quad_from_mode(m, body), "unimodal but n_eff < 5; must_choose used it anyway")
            return pack(None, None, "unimodal zone is not trusted (n_eff < 5)", offers=modes)
        return pack(m, quad_from_mode(m, body), "unimodal class zone")

    a, b = modes[0], modes[1]
    kind = split_of(a, b)

    def offer(reason: str, between: bool = False) -> dict[str, Any]:
        if must_choose:
            pick = max(trusted or modes, key=lambda m: float(m.get("n_eff") or m.get("n") or 0))
            return pack(
                pick,
                quad_from_mode(pick, body),
                reason + " — must_choose took the heavier mode",
                offers=modes,
                snapped=False,
                between=between,
            )
        return pack(None, None, reason, offers=modes, between=between)

    if len(trusted) == 0:
        if seen and det_quad:
            return pack(None, det_quad, "no trusted class mode; seen face stands", offers=modes)
        return offer("neither mode has n_eff >= 5")

    if len(trusted) == 1:
        m = trusted[0]
        if seen and det_quad:
            return pack(m, det_quad, "only one mode is trusted; seen face kept, class identity from that mode")
        return pack(m, quad_from_mode(m, body), "only one mode has enough evidence")

    # Two trusted modes.
    if not det_quad or not seen:
        return offer("class is bimodal and the detector is weak — offering both, not the mean")

    assert det_rel is not None and det_rot is not None

    if kind == "rotation":
        pick, between = _nearer_rotation(det_rot, a, b)
        if between or pick is None:
            return pack(
                None,
                det_quad,
                "seen face sits between the two rotation modes — keeping its angle, not the mean",
                offers=modes,
                between=True,
            )
        return pack(
            pick,
            det_quad,
            "rotation split: nearest mode for class identity, seen face angle not snapped",
        )

    if kind == "position":
        pick, between = _nearer_position(det_rel, a, b)
        if between or pick is None:
            return pack(
                None,
                det_quad,
                "seen face sits between the two position modes — keeping the plate, not the valley mean",
                offers=modes,
                between=True,
            )
        return pack(
            pick,
            det_quad,
            "position split: nearest mode for class identity, seen face not snapped",
        )

    # both / same
    pick_r, between_r = _nearer_rotation(det_rot, a, b)
    pick_p, between_p = _nearer_position(det_rel, a, b)
    if pick_r is pick_p and pick_r is not None:
        return pack(pick_r, det_quad, "both channels point at the same mode; seen face kept")
    return pack(
        None,
        det_quad,
        "modes disagree on rotation and position and the face does not uniquely match one — keeping the plate",
        offers=modes,
        between=between_r or between_p,
    )
