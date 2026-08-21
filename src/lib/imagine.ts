import { createServerFn } from "@tanstack/react-start";
import { ANGLE_PROMPT } from "./angle";

const PREFIX =
  "Photorealistic commercial B2B catalog product photograph, empty branding, no logos, no typography, no watermarks. Catalog lighting, sharp focus. ";

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch generated image");
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function pickImage(body: {
  data?: { url?: string; b64_json?: string }[];
}): string | null {
  const item = body.data?.[0];
  if (!item) return null;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item.url) return item.url;
  return null;
}

export const generateProduct = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; angle?: string }) => {
    const prompt = (input?.prompt ?? "").trim();
    if (prompt.length < 4) throw new Error("Describe the product to generate");
    if (prompt.length > 400) throw new Error("Keep the prompt under 400 characters");
    const angle = (input?.angle ?? "").trim().slice(0, 280);
    return { prompt, angle };
  })
  .handler(async ({ data }): Promise<{ ok: true; src: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Imagine is unavailable in this environment." };

    const camera = data.angle || ANGLE_PROMPT;
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: PREFIX + camera + " Subject: " + data.prompt,
        n: 1,
        resolution: "1k",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `Generate failed (${res.status}). Try a shorter prompt.` };
    }
    const body = (await res.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const picked = pickImage(body);
    if (!picked) return { ok: false, error: "No image returned. Try again." };
    try {
      const src = picked.startsWith("data:") ? picked : await urlToDataUrl(picked);
      return { ok: true, src };
    } catch {
      return { ok: false, error: "Could not read the generated frame." };
    }
  });

export const imagineEdit = createServerFn({ method: "POST" })
  .validator((input: { prompt: string; imageDataUrl: string }) => {
    const prompt = (input?.prompt ?? "").trim();
    if (prompt.length < 3) throw new Error("Describe the edit");
    if (prompt.length > 400) throw new Error("Keep the prompt under 400 characters");
    if (!input?.imageDataUrl || typeof input.imageDataUrl !== "string") {
      throw new Error("Missing image");
    }
    if (input.imageDataUrl.length > 2_400_000) throw new Error("Image too large to edit");
    return { prompt, imageDataUrl: input.imageDataUrl };
  })
  .handler(async ({ data }): Promise<{ ok: true; src: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Imagine is unavailable in this environment." };

    const res = await fetch("https://api.x.ai/v1/images/edits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: data.prompt,
        image: data.imageDataUrl,
        n: 1,
        resolution: "1k",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `Edit failed (${res.status}). Try again.` };
    }
    const body = (await res.json()) as {
      data?: { url?: string; b64_json?: string }[];
    };
    const picked = pickImage(body);
    if (!picked) return { ok: false, error: "No image returned. Try again." };
    try {
      const src = picked.startsWith("data:") ? picked : await urlToDataUrl(picked);
      return { ok: true, src };
    } catch {
      return { ok: false, error: "Could not read the edited frame." };
    }
  });
