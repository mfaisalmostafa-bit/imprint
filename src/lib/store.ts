import { create } from "zustand";
import {
  cloneQuad,
  defaultCenterQuad,
  type Quad,
} from "./geometry";
import {
  MOCKUPS,
  SAMPLE_LOGOS,
  type BlendMode,
  type Mockup,
  type WrapMode,
} from "./mockups";
import type { ScanResult } from "./scan";

export type LogoAsset = {
  id: string;
  name: string;
  src: string | null;
  kind: "image" | "wordmark";
};

type StudioState = {
  logo: LogoAsset;
  wordmark: string;
  mockupId: string;
  customSrc: string | null;
  customName: string;
  customQuad: Quad;
  quad: Quad;
  scale: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
  blend: BlendMode;
  wrap: WrapMode;
  cylinderArc: number;
  lighting: number;
  invert: boolean;
  showGuides: boolean;
  scanning: boolean;
  scanError: string | null;
  brainNote: string | null;
  confidence: number | null;
  surfaceLabel: string;
  material: string;
  dragging: boolean;

  mockup: () => Mockup | CustomView;
  productSrc: () => string;
  selectMockup: (id: string) => void;
  selectCustom: () => void;
  setCustomProduct: (src: string, name: string) => void;
  setLogo: (logo: LogoAsset) => void;
  setWordmark: (text: string) => void;
  setQuad: (quad: Quad) => void;
  setScale: (n: number) => void;
  setOffset: (x: number, y: number) => void;
  setOpacity: (n: number) => void;
  setBlend: (b: BlendMode) => void;
  setWrap: (w: WrapMode) => void;
  setCylinderArc: (n: number) => void;
  setLighting: (n: number) => void;
  setInvert: (v: boolean) => void;
  setShowGuides: (v: boolean) => void;
  setDragging: (v: boolean) => void;
  resetPlacement: () => void;
  applyScan: (result: ScanResult) => void;
  setScanning: (v: boolean) => void;
  setScanError: (e: string | null) => void;
};

export type CustomView = {
  id: "custom";
  name: string;
  category: "Custom";
  src: string;
  wrap: WrapMode;
  cylinderArc: number;
  quad: Quad;
  blend: BlendMode;
  invert: boolean;
  tone: "light" | "mid" | "dark";
  surface: string;
  material: string;
  scale: number;
};

const first = MOCKUPS[0]!;

export const useStudio = create<StudioState>((set, get) => ({
  logo: {
    id: SAMPLE_LOGOS[0].id,
    name: SAMPLE_LOGOS[0].name,
    src: SAMPLE_LOGOS[0].src,
    kind: "image",
  },
  wordmark: "",
  mockupId: first.id,
  customSrc: null,
  customName: "Your product",
  customQuad: defaultCenterQuad(),
  quad: cloneQuad(first.quad),
  scale: first.scale,
  offsetX: 0,
  offsetY: 0,
  opacity: 0.92,
  blend: first.blend,
  wrap: first.wrap,
  cylinderArc: first.cylinderArc,
  lighting: 0.55,
  invert: first.invert,
  showGuides: true,
  scanning: false,
  scanError: null,
  brainNote: null,
  confidence: 1,
  surfaceLabel: first.surface,
  material: first.material,
  dragging: false,

  mockup: () => {
    const s = get();
    if (s.mockupId === "custom" && s.customSrc) {
      return {
        id: "custom",
        name: s.customName,
        category: "Custom",
        src: s.customSrc,
        wrap: s.wrap,
        cylinderArc: s.cylinderArc,
        quad: s.quad,
        blend: s.blend,
        invert: s.invert,
        tone: "mid",
        surface: s.surfaceLabel,
        material: s.material,
        scale: s.scale,
      };
    }
    return MOCKUPS.find((m) => m.id === s.mockupId) ?? first;
  },
  productSrc: () => {
    const s = get();
    if (s.mockupId === "custom" && s.customSrc) return s.customSrc;
    return (MOCKUPS.find((m) => m.id === s.mockupId) ?? first).src;
  },
  selectMockup: (id) => {
    const m = MOCKUPS.find((x) => x.id === id);
    if (!m) return;
    const prev = get();
    set({
      mockupId: m.id,
      customQuad: prev.mockupId === "custom" ? cloneQuad(prev.quad) : prev.customQuad,
      quad: cloneQuad(m.quad),
      blend: m.blend,
      wrap: m.wrap,
      cylinderArc: m.cylinderArc,
      lighting: m.invert ? 0.32 : 0.52,
      invert: m.invert,
      surfaceLabel: m.surface,
      material: m.material,
      confidence: 1,
      brainNote: "Catalog plane — corners are live if you want to nudge them.",
      scanError: null,
      offsetX: 0,
      offsetY: 0,
      scale: m.scale,
    });
  },
  selectCustom: () => {
    const s = get();
    if (!s.customSrc) return;
    set({
      mockupId: "custom",
      quad: cloneQuad(s.customQuad),
      wrap: s.wrap,
      surfaceLabel: s.surfaceLabel === "Unscanned plane" ? s.surfaceLabel : s.surfaceLabel,
      confidence: s.confidence,
      brainNote: s.brainNote ?? "Custom photograph.",
    });
  },
  setCustomProduct: (src, name) =>
    set({
      mockupId: "custom",
      customSrc: src,
      customName: name,
      customQuad: defaultCenterQuad(),
      quad: defaultCenterQuad(),
      wrap: "plane",
      cylinderArc: 1.2,
      blend: "multiply",
      invert: false,
      surfaceLabel: "Unscanned plane",
      material: "unknown",
      confidence: null,
      brainNote: "Scan the surface to lock a printable plane from the photo.",
      scanError: null,
      scale: 0.7,
      offsetX: 0,
      offsetY: 0,
    }),
  setLogo: (logo) => set({ logo, wordmark: logo.kind === "wordmark" ? get().wordmark : get().wordmark }),
  setWordmark: (text) =>
    set({
      wordmark: text,
      logo: { id: "wordmark", name: text || "Wordmark", src: null, kind: "wordmark" },
    }),
  setQuad: (quad) => set({ quad }),
  setScale: (n) => set({ scale: n }),
  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),
  setOpacity: (n) => set({ opacity: n }),
  setBlend: (b) => set({ blend: b }),
  setWrap: (w) => set({ wrap: w }),
  setCylinderArc: (n) => set({ cylinderArc: n }),
  setLighting: (n) => set({ lighting: n }),
  setInvert: (v) => set({ invert: v }),
  setShowGuides: (v) => set({ showGuides: v }),
  setDragging: (v) => set({ dragging: v }),
  resetPlacement: () => {
    const s = get();
    if (s.mockupId === "custom") {
      set({
        quad: defaultCenterQuad(),
        scale: 0.7,
        offsetX: 0,
        offsetY: 0,
      });
      return;
    }
    const m = MOCKUPS.find((x) => x.id === s.mockupId) ?? first;
    set({
      quad: cloneQuad(m.quad),
      blend: m.blend,
      wrap: m.wrap,
      cylinderArc: m.cylinderArc,
      invert: m.invert,
      scale: m.scale,
      offsetX: 0,
      offsetY: 0,
    });
  },
  applyScan: (result) =>
    set((s) => ({
      quad: result.quad,
      customQuad: s.mockupId === "custom" ? result.quad : s.customQuad,
      wrap: result.wrap,
      blend: result.suggestedBlend,
      invert: result.surfaceTone === "dark",
      surfaceLabel: result.surface,
      material: result.material,
      confidence: result.confidence,
      brainNote: result.notes,
      scanning: false,
      scanError: null,
    })),
  setScanning: (v) => set({ scanning: v, scanError: v ? null : get().scanError }),
  setScanError: (e) => set({ scanError: e, scanning: false }),
}));
