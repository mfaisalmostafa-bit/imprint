import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Quad } from "./geometry";
import { clampQuad, isConvexQuad, quadArea } from "./geometry";

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const ScanJsonSchema = z.object({
  surface: z.string().optional(),
  material: z.string().optional(),
  wrap: z.enum(["plane", "cylinder"]).optional(),
  quad: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]),
  confidence: z.number().optional(),
  surfaceTone: z.enum(["light", "mid", "dark"]).optional(),
  suggestedBlend: z
    .enum(["multiply", "screen", "overlay", "source-over", "soft-light"])
    .optional(),
  notes: z.string().optional(),
});

export type ScanResult = {
  ok: true;
  surface: string;
  material: string;
  wrap: "plane" | "cylinder";
  quad: Quad;
  confidence: number;
  surfaceTone: "light" | "mid" | "dark";
  suggestedBlend: "multiply" | "screen" | "overlay" | "source-over" | "soft-light";
  notes: string;
};

export type ScanFailure = { ok: false; error: string };

const SCAN_PROMPT = `You are a print-placement engineer locking a logo onto a product photograph.

Find the primary printable/brandable surface (shirt chest — not sleeves or collar; mug/cup front wall — not the handle; box facing camera; billboard face; bag panel; cap front crown; notebook cover).

Return ONLY JSON:
{
  "surface": "short name of the plane",
  "material": "cotton|fleece|ceramic|canvas|cardboard|paper|metal|cloth|vinyl|other",
  "wrap": "plane" or "cylinder",
  "quad": [
    {"x":0-1,"y":0-1},
    {"x":0-1,"y":0-1},
    {"x":0-1,"y":0-1},
    {"x":0-1,"y":0-1}
  ],
  "confidence": 0-1,
  "surfaceTone": "light"|"mid"|"dark",
  "suggestedBlend": "multiply"|"screen"|"overlay"|"source-over",
  "notes": "one sentence: camera yaw/pitch and why this plane is print-safe"
}

Rules:
- quad order: top-left, top-right, bottom-right, bottom-left of the PRINTABLE area.
- Coordinates are normalized image fractions, origin top-left.
- Quad must be convex and sit ON the product, never background, skin, hands, or handles.
- Conservative inset (~6–10%) so the mark does not spill off the surface or into seams.
- Shirts: chest panel only, slightly above garment center (print shop placement).
- Cylindrical objects: wrap="cylinder"; quad is the visible front wall between the silhouette edges.
- Respect perspective: if the surface recedes, the quad must recede with it (foreshortened far edge).
- Ignore existing logos if any — lock the plane they sit on.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON in model response");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

export const scanSurface = createServerFn({ method: "POST" })
  .validator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl || typeof input.imageDataUrl !== "string") {
      throw new Error("Missing image");
    }
    if (input.imageDataUrl.length > 1_800_000) {
      throw new Error("Image too large");
    }
    return input;
  })
  .handler(async ({ data }): Promise<ScanResult | ScanFailure> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Surface scan is unavailable in this environment." };
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SCAN_PROMPT },
              {
                type: "image_url",
                image_url: { url: data.imageDataUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `Scan failed (${res.status}). Try again in a moment.` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = ScanJsonSchema.parse(extractJson(text));
      const quad = clampQuad(parsed.quad);
      if (!isConvexQuad(quad) || quadArea(quad) < 0.008) {
        return { ok: false, error: "Could not lock a printable plane. Drag the corners." };
      }
      return {
        ok: true,
        surface: parsed.surface || "Printable plane",
        material: parsed.material || "other",
        wrap: parsed.wrap ?? "plane",
        quad,
        confidence: parsed.confidence ?? 0.7,
        surfaceTone: parsed.surfaceTone ?? "mid",
        suggestedBlend: parsed.suggestedBlend ?? "multiply",
        notes: parsed.notes || "Plane locked from the product photograph.",
      };
    } catch {
      return { ok: false, error: "Could not read the surface. Drag the corners instead." };
    }
  });
