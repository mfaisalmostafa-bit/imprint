# IMPRINT

Smart logo mockup studio. Drop a mark, pick a product, and the placement brain finds the printable plane — then warps the logo to the real camera angle.

[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)

## Run

```bash
npm install
npm run dev
```

Open the printed local URL. Upload a logo or use a sample mark, pick a surface, hit **Scan surface**, drag corners if you want, then **Export**.

Vision scan uses the xAI API when `XAI_API_KEY` is set. Catalog placement still works without it.

## Source map

| Path | What it is |
| --- | --- |
| `src/lib/geometry.ts` | Homography, convex quads, yaw/pitch/roll from a plane |
| `src/lib/warp.ts` | Perspective mesh warp + cylinder wrap + lighting match |
| `src/lib/scan.ts` | Vision scan: product photo → printable quad |
| `src/lib/mockups.ts` | Catalog of promotional surfaces |
| `src/lib/store.ts` | Studio state |
| `src/components/studio/` | Stage canvas, catalog, brain panel, logo dock |
| `src/components/studio-app.tsx` | App shell |
| `public/mockups/` | Product photographs |
| `public/logos/` | Sample marks |

Stack: React 19, TanStack Start, Tailwind v4, Zustand.

## License

MIT
