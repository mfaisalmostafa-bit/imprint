"""Placement stack. A pick that does not write the render quad is a lying control.

Port these functions. Do not drop this file onto imprint_engine.py.

Priority, earlier wins
----------------------
1. drawn   hand-drawn box on THIS photo
2. pick    picker confirm on THIS session
3. saved   stored HUMAN override, only if it is still a print-face
4. engine  live pick_zone winner (demo > panel > class)
5. class   category recipe, never a lock

Aug-29 class: a saved human override beats the engine. The engine
must not clobber a staff lock. A saved override on the neck / a
skewed shoulder diamond is not a human lock — drop it, then the
engine may run.

Classify by class, never SKU. MG-4018 is the control test for the
drop rule, not a SKU branch.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

import imprint_engine as eng

SOURCES = frozenset({"drawn", "pick", "engine", "saved", "class"})
CLASSES = frozenset(eng.CLASS_SCALE)

# Control. Not a SKU. print_face_ok must fail this against a mid-body ref.
NECK_OVERRIDE_CONTROL = [
    {"x": 0.457, "y": 0.214},
    {"x": 0.511, "y": 0.294},
    {"x": 0.526, "y": 0.420},
    {"x": 0.379, "y": 0.459},
]


class PlaceError(ValueError):
    pass


def _class(cls: str | None) -> str:
    name = cls or "default"
    if name not in CLASSES:
        raise PlaceError(f"unmapped class: {name!r}")
    return name


def _xy(pt: Any) -> list[float]:
    if isinstance(pt, Mapping):
        return [float(pt["x"]), float(pt["y"])]
    return [float(pt[0]), float(pt[1])]


def _pts(quad: Sequence[Any]) -> list[dict[str, float]]:
    return [{"x": p[0], "y": p[1]} for p in (_xy(q) for q in quad)]


def _box(quad: Sequence[Any]) -> dict[str, float]:
    pts = [_xy(p) for p in quad]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x = min(xs)
    y = min(ys)
    return {"x": x, "y": y, "w": max(xs) - x, "h": max(ys) - y}


def _centre(quad: Sequence[Any]) -> tuple[float, float]:
    pts = [_xy(p) for p in quad]
    return sum(p[0] for p in pts) / 4.0, sum(p[1] for p in pts) / 4.0


def _fold90(deg: float) -> float:
    d = abs(deg) % 180.0
    if d > 90:
        d = 180.0 - d
    return d


def _edge_deg(a: Sequence[float], b: Sequence[float]) -> float:
    import math

    return _fold90(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])))


def _near_axis(deg: float) -> bool:
    return min(deg, 90.0 - deg) <= 22.0


def print_face_ok(
    quad: Sequence[Any],
    cls: str,
    ref: Sequence[Any] | None = None,
) -> dict[str, Any]:
    """A print-face is an upright band on the printable panel."""
    name = _class(cls)
    if not quad or len(quad) < 4:
        return {"ok": False, "reason": "empty"}
    b = _box(quad)
    if b["w"] < 0.02 or b["h"] < 0.02:
        return {"ok": False, "reason": "tiny"}
    cx, cy = _centre(quad)
    pts = [_xy(p) for p in quad]
    top = _edge_deg(pts[0], pts[1])
    side = _edge_deg(pts[1], pts[2])
    if not (_near_axis(top) or _near_axis(side)):
        return {"ok": False, "reason": "skewed"}
    if name == "bottle":
        if ref is not None and len(ref) >= 4:
            body = _box(ref)
            rel_y = (cy - body["y"]) / max(1e-6, body["h"])
            if rel_y < 0.32:
                return {"ok": False, "reason": "neck"}
            if cy < body["y"] + body["h"] * 0.32:
                return {"ok": False, "reason": "neck"}
        elif cy < 0.32 and b["h"] < 0.28:
            return {"ok": False, "reason": "neck"}
        prior = eng.zone_for_class(
            ref
            or [
                {"x": 0.2, "y": 0.15},
                {"x": 0.8, "y": 0.15},
                {"x": 0.8, "y": 0.9},
                {"x": 0.2, "y": 0.9},
            ],
            "bottle",
        )
        pb = _box(prior)
        if b["w"] > pb["w"] * 1.65:
            return {"ok": False, "reason": "too-wide"}
    return {"ok": True, "reason": None}


def resolve_placement(
    cls: str,
    *,
    body: Sequence[Any] | None = None,
    drawn: Sequence[Any] | None = None,
    pick: Sequence[Any] | None = None,
    engine: Sequence[Any] | None = None,
    saved: Sequence[Any] | None = None,
) -> dict[str, Any]:
    name = _class(cls)
    ref = body if body is not None else engine
    dropped = None
    saved_ok = None
    if saved is not None:
        face = print_face_ok(saved, name, ref if ref is not None else saved)
        if face["ok"]:
            saved_ok = saved
        else:
            dropped = face["reason"] or "stale"
    if drawn is not None:
        return {"quad": _pts(drawn), "source": "drawn", "dropped": dropped}
    if pick is not None:
        return {"quad": _pts(pick), "source": "pick", "dropped": dropped}
    if saved_ok is not None:
        return {"quad": _pts(saved_ok), "source": "saved", "dropped": None}
    if engine is not None:
        return {"quad": _pts(engine), "source": "engine", "dropped": dropped}
    fallback = body or [
        {"x": 0.2, "y": 0.15},
        {"x": 0.8, "y": 0.15},
        {"x": 0.8, "y": 0.9},
        {"x": 0.2, "y": 0.9},
    ]
    return {
        "quad": _pts(eng.zone_for_class(fallback, name)),
        "source": "class",
        "dropped": dropped,
    }
