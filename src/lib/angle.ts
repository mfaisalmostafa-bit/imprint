/** Recommended camera for a TePee-X catalog mockup. The SKU photo is the angle. */

import { mag, poseFromQuad, sub, type Pose, type Quad } from "./geometry";

export type AngleBand = "ok" | "soft" | "off";

export type AngleGuide = {
  id: string;
  label: string;
  prompt: string;
};

export type AngleJudgement = {
  band: AngleBand;
  ok: boolean;
  dist: number;
  dYaw: number;
  dRoll: number;
  note: string;
};

const CHEST: AngleGuide = {
  id: "chest",
  label: "Chest front · print face to camera",
  prompt:
    "Dead-front or slight 3/4, chest/print panel to camera, garment filling the frame. No back, no side, no hanger-only crop.",
};

const CROWN: AngleGuide = {
  id: "crown",
  label: "3/4 crown · front panel to camera",
  prompt: "Three-quarter front of the cap, front panel and brim readable. Not top-down, not the back strap.",
};

const MUG: AngleGuide = {
  id: "wall",
  label: "3/4 wall · handle off the print face",
  prompt:
    "Catalog 3/4 of the mug or flask, cylindrical print wall toward camera, handle at 3 or 9 o'clock. Not top-down into the cup, not the handle as hero.",
};

const BARREL: AngleGuide = {
  id: "barrel",
  label: "Barrel 3/4 · clip readable",
  prompt: "Pen or barrel almost horizontal, slight 3/4 so the clip reads, engrave zone facing camera. Not nib-on.",
};

const TECH: AngleGuide = {
  id: "tech",
  label: "3/4 · top and front readable",
  prompt: "Three-quarter of the device, top print face and front both visible. Not a flat top-down slab.",
};

const COVER: AngleGuide = {
  id: "cover",
  label: "3/4 cover · spine left",
  prompt: "Notebook or book 3/4, cover to camera, spine to the left. Not open pages, not the back.",
};

const PACK: AngleGuide = {
  id: "pack",
  label: "3/4 pack · front panel to camera",
  prompt: "Bag or box 3/4, front panel toward camera. Not the gusset, not the bottom.",
};

const FRONT: AngleGuide = {
  id: "front",
  label: "Front elevation · face to camera",
  prompt: "Award or plaque nearly square-on, engraved face to camera, slight 3/4 allowed. Not the edge, not the back.",
};

const FACE: AngleGuide = {
  id: "face",
  label: "Square-on face · copy to camera",
  prompt: "Billboard or totem square-on, print face filling the frame. Not a street-side vanishing point.",
};

const HERO: AngleGuide = {
  id: "hero",
  label: "Catalog hero · print face to camera",
  prompt:
    "B2B catalog hero: print-brandable face toward camera, 3/4 or square-on as the product requires. Never top-down, never from behind, never the handle/lid/sole as the hero.",
};

export function angleGuideFor(input: { id?: string; category?: string }): AngleGuide {
  const id = input.id ?? "";
  const cat = input.category ?? "";
  if (id === "pen") return BARREL;
  if (id === "th164" || id === "flask") return MUG;
  if (id === "bp70" || id === "bag" || id === "tote") return PACK;
  if (id === "nb146" || id === "notebook") return COVER;
  if (id === "p202" || id === "usb" || id === "powerbank" || id === "lr-cbl01") return TECH;
  if (id === "cap") return CROWN;
  if (id === "billboard" || id === "totem") return FACE;
  if (id === "mug" || id === "cup" || id === "flask") return MUG;
  if (cat === "Apparel") return CHEST;
  if (cat === "Drinkware") return MUG;
  if (cat === "Packaging") return PACK;
  if (cat === "Stationery") return COVER;
  if (cat === "Awards") return FRONT;
  if (cat === "Tech") return TECH;
  if (cat === "Writing") return BARREL;
  if (cat === "Display") return FACE;
  return HERO;
}

export function meanCornerDist(a: Quad, b: Quad) {
  let s = 0;
  for (let i = 0; i < 4; i++) s += mag(sub(a[i]!, b[i]!));
  return s / 4;
}

export function judgeCatalogAngle(current: Quad, catalog: Quad): AngleJudgement {
  const dist = meanCornerDist(current, catalog);
  const now = poseFromQuad(current);
  const rec = poseFromQuad(catalog);
  const dYaw = Math.abs(now.yawDeg - rec.yawDeg);
  const dRoll = Math.abs(now.rollDeg - rec.rollDeg);
  if (dist > 0.22 || dRoll > 14 || dYaw > 32) {
    return {
      band: "off",
      ok: false,
      dist,
      dYaw,
      dRoll,
      note: "Off the catalog angle. Far edge will foreshorten — use the SKU photo.",
    };
  }
  if (dist > 0.12 || dRoll > 8 || dYaw > 18) {
    return {
      band: "soft",
      ok: true,
      dist,
      dYaw,
      dRoll,
      note: "Soft on the catalog angle. Prefer the SKU photo for the quote pack.",
    };
  }
  return {
    band: "ok",
    ok: true,
    dist,
    dYaw,
    dRoll,
    note: "On the catalog angle.",
  };
}

export function judgePoseRoll(pose: Pose): AngleJudgement | null {
  const roll = Math.abs(pose.rollDeg);
  if (roll <= 12) return null;
  if (roll > 18) {
    return {
      band: "off",
      ok: false,
      dist: 0,
      dYaw: 0,
      dRoll: roll,
      note: "Shot is crooked. Level the product so the print face sits catalog-straight.",
    };
  }
  return {
    band: "soft",
    ok: true,
    dist: 0,
    dYaw: 0,
    dRoll: roll,
    note: "Slight roll. Level the product for the quote pack.",
  };
}

export const ANGLE_PROMPT =
  "Catalog hero angle, print-brandable face toward camera, 3/4 or square-on. Never top-down, never from behind, never the handle, lid, sole, or back as the hero.";
