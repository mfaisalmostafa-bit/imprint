import type { Quad } from "./geometry";

export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "soft-light";
export type WrapMode = "plane" | "cylinder";
export type SurfaceTone = "light" | "mid" | "dark";

export type Mockup = {
  id: string;
  name: string;
  category: "Apparel" | "Drinkware" | "Packaging" | "Outdoor" | "Stationery";
  src: string;
  wrap: WrapMode;
  cylinderArc: number;
  quad: Quad;
  blend: BlendMode;
  invert: boolean;
  tone: SurfaceTone;
  surface: string;
  material: string;
  scale: number;
};

export const MOCKUPS: Mockup[] = [
  {
    id: "tshirt",
    name: "White Tee",
    category: "Apparel",
    src: "/mockups/tshirt.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.34, y: 0.27 },
      { x: 0.62, y: 0.28 },
      { x: 0.63, y: 0.48 },
      { x: 0.33, y: 0.47 },
    ],
    blend: "multiply",
    invert: false,
    tone: "light",
    surface: "Cotton jersey chest",
    material: "cotton",
    scale: 0.68,
  },
  {
    id: "hoodie",
    name: "Hoodie",
    category: "Apparel",
    src: "/mockups/hoodie.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.34, y: 0.32 },
      { x: 0.63, y: 0.33 },
      { x: 0.64, y: 0.51 },
      { x: 0.33, y: 0.50 },
    ],
    blend: "screen",
    invert: true,
    tone: "dark",
    surface: "Fleece chest panel",
    material: "fleece",
    scale: 0.7,
  },
  {
    id: "mug",
    name: "Ceramic Mug",
    category: "Drinkware",
    src: "/mockups/mug.jpg",
    wrap: "cylinder",
    cylinderArc: 1.55,
    quad: [
      { x: 0.18, y: 0.36 },
      { x: 0.40, y: 0.34 },
      { x: 0.42, y: 0.64 },
      { x: 0.17, y: 0.62 },
    ],
    blend: "multiply",
    invert: false,
    tone: "light",
    surface: "Glazed cylinder wall",
    material: "ceramic",
    scale: 0.55,
  },
  {
    id: "tote",
    name: "Canvas Tote",
    category: "Packaging",
    src: "/mockups/tote.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.24, y: 0.36 },
      { x: 0.74, y: 0.37 },
      { x: 0.72, y: 0.84 },
      { x: 0.22, y: 0.86 },
    ],
    blend: "multiply",
    invert: false,
    tone: "light",
    surface: "Tote front panel",
    material: "canvas",
    scale: 0.56,
  },
  {
    id: "billboard",
    name: "Billboard",
    category: "Outdoor",
    src: "/mockups/billboard.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.16, y: 0.13 },
      { x: 0.78, y: 0.22 },
      { x: 0.76, y: 0.55 },
      { x: 0.12, y: 0.60 },
    ],
    blend: "multiply",
    invert: false,
    tone: "light",
    surface: "Outdoor board face",
    material: "vinyl",
    scale: 0.84,
  },
  {
    id: "box",
    name: "Kraft Box",
    category: "Packaging",
    src: "/mockups/box.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.28, y: 0.42 },
      { x: 0.52, y: 0.48 },
      { x: 0.50, y: 0.82 },
      { x: 0.26, y: 0.78 },
    ],
    blend: "multiply",
    invert: false,
    tone: "mid",
    surface: "Carton front face",
    material: "cardboard",
    scale: 0.58,
  },
  {
    id: "cap",
    name: "Canvas Cap",
    category: "Apparel",
    src: "/mockups/cap.jpg",
    wrap: "cylinder",
    cylinderArc: 0.95,
    quad: [
      { x: 0.38, y: 0.26 },
      { x: 0.64, y: 0.30 },
      { x: 0.66, y: 0.50 },
      { x: 0.36, y: 0.52 },
    ],
    blend: "multiply",
    invert: false,
    tone: "mid",
    surface: "Front crown panel",
    material: "canvas",
    scale: 0.7,
  },
  {
    id: "cup",
    name: "Paper Cup",
    category: "Drinkware",
    src: "/mockups/cup.jpg",
    wrap: "cylinder",
    cylinderArc: 1.45,
    quad: [
      { x: 0.30, y: 0.28 },
      { x: 0.68, y: 0.30 },
      { x: 0.70, y: 0.50 },
      { x: 0.28, y: 0.48 },
    ],
    blend: "multiply",
    invert: false,
    tone: "light",
    surface: "Cup wall above sleeve",
    material: "paper",
    scale: 0.58,
  },
  {
    id: "notebook",
    name: "Notebook",
    category: "Stationery",
    src: "/mockups/notebook.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.20, y: 0.16 },
      { x: 0.72, y: 0.20 },
      { x: 0.78, y: 0.86 },
      { x: 0.22, y: 0.90 },
    ],
    blend: "screen",
    invert: true,
    tone: "dark",
    surface: "Cloth hardcover",
    material: "cloth",
    scale: 0.5,
  },
  {
    id: "bag",
    name: "Shopping Bag",
    category: "Packaging",
    src: "/mockups/bag.jpg",
    wrap: "plane",
    cylinderArc: 0,
    quad: [
      { x: 0.24, y: 0.34 },
      { x: 0.72, y: 0.36 },
      { x: 0.70, y: 0.82 },
      { x: 0.22, y: 0.84 },
    ],
    blend: "multiply",
    invert: false,
    tone: "mid",
    surface: "Kraft front panel",
    material: "paper",
    scale: 0.56,
  },
];

export const SAMPLE_LOGOS = [
  { id: "north", name: "North", src: "/logos/north.svg" },
  { id: "orbit", name: "Orbit", src: "/logos/orbit.svg" },
  { id: "plane", name: "Plane", src: "/logos/plane.svg" },
  { id: "bars", name: "Bars", src: "/logos/bars.svg" },
] as const;
