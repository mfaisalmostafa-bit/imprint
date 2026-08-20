# IMPRINT

Smart logo mockup studio — crop, tone, Imagine a blank product, lock the printable plane, warp the mark to the real camera angle.

[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

## Run

```bash
npm install
npm run dev
```

Upload a mark or type a wordmark. Crop / rotate / tone it. Pick a catalog surface or Imagine a product from a sentence. **Scan surface** locks the plane (local silhouette brain, then Grok vision). Drag the mark or the corners. Export PNG.

Vision scan and Imagine use the xAI API when `XAI_API_KEY` is set. Catalog placement and the local plane lock still work without it.

## Source map

| Path | What it is |
| --- | --- |
| `src/lib/geometry.ts` | Homography, convex quads, vanishing-point yaw/pitch/roll |
| `src/lib/warp.ts` | Perspective mesh + cylinder wrap + lighting + print finish |
| `src/lib/detect.ts` | Client-side printable-plane lock from silhouette + falloff |
| `src/lib/scan.ts` | Grok vision scan: product photo → printable quad |
| `src/lib/edit.ts` | Crop, rotate, flip, tone, filters |
| `src/lib/imagine.ts` | Product generation + natural-language image edit |
| `src/lib/mockups.ts` | Catalog of promotional surfaces |
| `src/lib/store.ts` | Studio state + undo |
| `src/components/studio/` | Stage, editor, crop overlay, catalog, brain, tools |
| `public/mockups/` | Product photographs |
| `public/logos/` | Sample marks |

Stack: React 19, TanStack Start, Tailwind v4, Zustand.

Keyboard: `C` crop, `R` rotate, `T` tone, `S` scan, `E` export, `Esc` back, `⌘Z` undo.

## License

MIT
