/** Print-decoration matrix. A method is a quoting fact, not a Photoshop blend. */

export type MethodId =
  | "laser_engrave"
  | "sublimation"
  | "uv_dtf"
  | "pad_print"
  | "embroidery"
  | "screen_print"
  | "deboss"
  | "foil";

export type MethodFamily = "etch" | "ink" | "fiber" | "press";

export type MethodDef = {
  id: MethodId;
  label: string;
  short: string;
  family: MethodFamily;
  quoteLine: string;
  ink: boolean;
};

export const METHODS: Record<MethodId, MethodDef> = {
  laser_engrave: {
    id: "laser_engrave",
    label: "Laser engrave",
    short: "Laser",
    family: "etch",
    quoteLine: "Laser removes coating / frosts substrate. Proof must read as engraved metal, not ink.",
    ink: false,
  },
  sublimation: {
    id: "sublimation",
    label: "Sublimation",
    short: "Subli",
    family: "ink",
    quoteLine: "Dye soaks into polymer/coating. Full colour, no raised edge.",
    ink: true,
  },
  uv_dtf: {
    id: "uv_dtf",
    label: "UV DTF",
    short: "UV DTF",
    family: "ink",
    quoteLine: "UV transfer film sits on the surface with a slight raise.",
    ink: true,
  },
  pad_print: {
    id: "pad_print",
    label: "Pad print",
    short: "Pad",
    family: "ink",
    quoteLine: "1–2 spot colours, slightly inset into the part.",
    ink: true,
  },
  embroidery: {
    id: "embroidery",
    label: "Embroidery",
    short: "Emb",
    family: "fiber",
    quoteLine: "Thread on textile. Satin direction, not a flat sticker.",
    ink: false,
  },
  screen_print: {
    id: "screen_print",
    label: "Screen print",
    short: "Screen",
    family: "ink",
    quoteLine: "Spot-colour ink on fabric. Opaque, flat.",
    ink: true,
  },
  deboss: {
    id: "deboss",
    label: "Deboss",
    short: "Deboss",
    family: "press",
    quoteLine: "Blind stamp into cover stock. Recess only — no foil unless specified.",
    ink: false,
  },
  foil: {
    id: "foil",
    label: "Foil stamp",
    short: "Foil",
    family: "press",
    quoteLine: "Metallic foil laid into a stamp. Gold or silver, not CMYK.",
    ink: false,
  },
};

export const METHOD_ORDER: MethodId[] = [
  "laser_engrave",
  "sublimation",
  "uv_dtf",
  "pad_print",
  "embroidery",
  "screen_print",
  "deboss",
  "foil",
];
