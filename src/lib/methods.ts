/** Locked TePee-X decoration matrix. A method is a quoting fact. */

export type MethodId =
  | "laser_engrave"
  | "uv_print"
  | "uv_dtf"
  | "sublimation"
  | "embroidery";

export type MethodFamily = "etch" | "ink" | "fiber";

export type MethodDef = {
  id: MethodId;
  label: string;
  short: string;
  family: MethodFamily;
  quoteLine: string;
  ink: boolean;
};

/** Never appear in copy, proofs, or the method picker. */
export const BLACKLISTED_TERMS = [
  "pad print",
  "pad_print",
  "screen print",
  "screen_print",
  "emboss",
  "deboss",
  "foil",
] as const;

export const METHODS: Record<MethodId, MethodDef> = {
  laser_engrave: {
    id: "laser_engrave",
    label: "Laser Engraving",
    short: "Laser",
    family: "etch",
    quoteLine: "Laser removes coating / frosts substrate. Proof must read as engraved metal, not ink.",
    ink: false,
  },
  uv_print: {
    id: "uv_print",
    label: "UV Printing",
    short: "UV",
    family: "ink",
    quoteLine: "House default. UV ink on the surface — bags, totes, plastic, notebooks, power banks.",
    ink: true,
  },
  uv_dtf: {
    id: "uv_dtf",
    label: "UV DTF",
    short: "UV DTF",
    family: "ink",
    quoteLine: "Transfer film on textiles and apparel. Never quote UV DTF as UV Printing.",
    ink: true,
  },
  sublimation: {
    id: "sublimation",
    label: "Sublimation",
    short: "Subli",
    family: "ink",
    quoteLine: "Dye soaks into polymer/ceramic coat. Full colour, no raised edge.",
    ink: true,
  },
  embroidery: {
    id: "embroidery",
    label: "Embroidery",
    short: "Emb",
    family: "fiber",
    quoteLine: "Thread on apparel. Satin direction, not a flat sticker.",
    ink: false,
  },
};

export const METHOD_ORDER: MethodId[] = [
  "laser_engrave",
  "uv_print",
  "uv_dtf",
  "sublimation",
  "embroidery",
];
