# TePee-X IMPRINT 2

Smart mockup generator. Drop a mark, scan the product plane, pick where
the logo goes — the pick **writes the render quad**. Stale neck overrides
are dropped. The Command Center stays at `/cc`.

## What it does

1. **Studio** — logo on the product. Scan locks the print face. The
   "Where does the logo go?" sheet confirms a box and that box is what
   prints. Draw-your-own still wins.
2. **Design Jobs / Place** — phone-first corner-drag. Save writes a
   per-SKU override only if it is still a print-face.
3. **Optics** — findings against the renderer on catalogue photos.
4. **Search** — Photo Search with a winner-only **It fits**. A 40% hit
   is not a lock. A lock opens Studio on that SKU.

## Placement stack

drawn → pick → engine (demo > panel > class) → saved (print-face only) → class recipe.

Bottle marks sit on the mid-body, not the neck. Classify by category,
never SKU.

## Rails

- No supplier names on a client screen.
- Five methods only. UV Printing ≠ UV DTF.
- Price 0 is B2B config, never an error.
- Brand: navy `#04263F`, orange `#D1812E`, Montserrat.
- No live write without the confirm phrase `SAVE PLACEMENT OVERRIDE`.

## Run

```bash
npm install
npm run dev
npm test
python3 python/test_resolve_placement.py
python3 python/test_crop.py
```

Port notes for live CC: [CLAUDE.md](CLAUDE.md)

## License

MIT
