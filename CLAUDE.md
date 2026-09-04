# IMPRINT 2 — port notes for live CC

Repo: `github.com/mfaisalmostafa-bit/imprint` branch **`class-scale`**.

This playground is the mockup generator. Live Command Center is still
`tepee-dev-workspace` / `cc.tepee-x.com`. Port the algorithms, do not
rewrite the vanilla SPA.

## What v2 added

A picker tap that does not write the render quad is a lying control.
That was MG-4018 on the phone: orange **A** on the mid-body, then the
PNG stamped a stale neck override.

Priority (do not invert):

1. **drawn** — hand-drawn box on this photo
2. **pick** — "Where does the logo go?" confirm this session
3. **engine** — `pick_zone` winner (demo > panel > class)
4. **saved** — stored override, only if `print_face_ok`
5. **class** — category recipe, never a lock

A saved override on the neck / a skewed shoulder diamond is not an
override. Drop it. Classify by class, never SKU. MG-4018 is the
control test in `resolve_placement.py`, not a branch.

## Files to port

| File | Kind | Live landing |
|---|---|---|
| `python/resolve_placement.py` | **new module** | next to the mockup compositor, not inside imprint_engine.py |
| `python/crop.py` | new (already on class-scale) | after `canvas_hygiene` block, before the mark |
| `python/imprint_engine.py` | drop-in | `tpx_wix/mockup/imprint_engine.py` |
| `src/lib/resolve-placement.ts` | TS mirror | playground only |
| `src/components/studio/pick-sheet.tsx` | UI | live already has the sheet — **wire the confirm to the render quad** |

Proof:

```
python3 python/test_resolve_placement.py
python3 python/test_crop.py
python3 python/test_imprint_engine.py
```

TS: `node --test scripts/resolve-placement.test.mjs`

## Live call site (the actual bug)

Grep `Where does the logo go?` and the function that composites the
logo onto the product photo. The sheet's chosen candidate MUST write
the session quad **before** the render. Next uses that quad, not the
saved override, not `zone_for_class` as a lock.

`print_face_ok` on the saved row: if it returns neck/skewed/too-wide,
forget the row and fall through.

Bottle face: zone width ≤ 0.55 of body, class band 0.34 × 0.36 of body,
mid-body not neck.

## Do not

SKU literals. New constants. Invert drawn > pick > engine > saved > class.
Rewrite the SPA. Port the React crop overlay — live cropper is `crop.py`.
