import { create } from "zustand";
import {
  cloneQuad,
  defaultCenterQuad,
  type Quad,
} from "./geometry";
import {
  cloneEdit,
  DEFAULT_EDIT,
  type EditDraft,
} from "./edit";
import {
  MOCKUPS,
  SAMPLE_LOGOS,
  type BlendMode,
  type Mockup,
  type WrapMode,
} from "./mockups";
import type { ScanResult } from "./scan";
import type { DetectResult } from "./detect";

export type LogoAsset = {
  id: string;
  name: string;
  src: string | null;
  kind: "image" | "wordmark";
};

export type StudioMode = "studio" | "edit";
export type EditTool = "crop" | "rotate" | "adjust" | "filter";
export type EditTarget = "logo" | "product";

type Snapshot = {
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
  generating: boolean;
  scanError: string | null;
  brainNote: string | null;
  confidence: number | null;
  surfaceLabel: string;
  material: string;
  dragging: boolean;
  mode: StudioMode;
  editTool: EditTool;
  editTarget: EditTarget;
  draft: EditDraft;
  imaginePrompt: string;
  history: Snapshot[];
  historyIndex: number;

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
  applyScan: (result: ScanResult | DetectResult) => void;
  setScanning: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setScanError: (e: string | null) => void;
  setMode: (m: StudioMode) => void;
  setEditTool: (t: EditTool) => void;
  setEditTarget: (t: EditTarget) => void;
  setDraft: (d: EditDraft | ((prev: EditDraft) => EditDraft)) => void;
  resetDraft: () => void;
  setImaginePrompt: (s: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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

function takeSnapshot(s: StudioState): Snapshot {
  return {
    logo: { ...s.logo },
    wordmark: s.wordmark,
    mockupId: s.mockupId,
    customSrc: s.customSrc,
    customName: s.customName,
    customQuad: cloneQuad(s.customQuad),
    quad: cloneQuad(s.quad),
    scale: s.scale,
    offsetX: s.offsetX,
    offsetY: s.offsetY,
    opacity: s.opacity,
    blend: s.blend,
    wrap: s.wrap,
    cylinderArc: s.cylinderArc,
    lighting: s.lighting,
    invert: s.invert,
  };
}

function apparelOffset(id: string): number {
  const m = MOCKUPS.find((x) => x.id === id);
  if (!m) return 0;
  if (m.category === "Apparel") return -0.08;
  if (m.category === "Drinkware") return -0.02;
  return 0;
}

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
  offsetY: apparelOffset(first.id),
  opacity: 0.92,
  blend: first.blend,
  wrap: first.wrap,
  cylinderArc: first.cylinderArc,
  lighting: 0.55,
  invert: first.invert,
  showGuides: true,
  scanning: false,
  generating: false,
  scanError: null,
  brainNote: null,
  confidence: 1,
  surfaceLabel: first.surface,
  material: first.material,
  dragging: false,
  mode: "studio",
  editTool: "crop",
  editTarget: "logo",
  draft: cloneEdit(DEFAULT_EDIT),
  imaginePrompt: "",
  history: [],
  historyIndex: -1,

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
      brainNote: "Catalog plane — corners and the mark are live.",
      scanError: null,
      offsetX: 0,
      offsetY: apparelOffset(m.id),
      scale: m.scale,
      mode: "studio",
    });
  },
  selectCustom: () => {
    const s = get();
    if (!s.customSrc) return;
    set({
      mockupId: "custom",
      quad: cloneQuad(s.customQuad),
      wrap: s.wrap,
      surfaceLabel: s.surfaceLabel,
      confidence: s.confidence,
      brainNote: s.brainNote ?? "Custom photograph.",
      mode: "studio",
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
      brainNote: "Scan the surface — local brain runs first, then Grok if you ask.",
      scanError: null,
      scale: 0.7,
      offsetX: 0,
      offsetY: 0,
      mode: "studio",
    }),
  setLogo: (logo) => set({ logo }),
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
      offsetY: apparelOffset(m.id),
    });
  },
  applyScan: (result) =>
    set((s) => ({
      quad: result.quad,
      customQuad: s.mockupId === "custom" ? result.quad : s.customQuad,
      wrap: result.wrap,
      cylinderArc: "cylinderArc" in result && result.cylinderArc ? result.cylinderArc : s.cylinderArc,
      blend: result.suggestedBlend,
      invert: result.surfaceTone === "dark" || ("invert" in result && result.invert),
      lighting: result.surfaceTone === "dark" ? 0.32 : 0.55,
      surfaceLabel: "surface" in result ? result.surface : s.surfaceLabel,
      material: "material" in result ? result.material : s.material,
      confidence: result.confidence,
      brainNote: result.notes,
      scanning: false,
      scanError: null,
    })),
  setScanning: (v) => set({ scanning: v, scanError: v ? null : get().scanError }),
  setGenerating: (v) => set({ generating: v }),
  setScanError: (e) => set({ scanError: e, scanning: false, generating: false }),
  setMode: (m) =>
    set({
      mode: m,
      draft: m === "edit" ? cloneEdit(DEFAULT_EDIT) : get().draft,
    }),
  setEditTool: (t) => {
    const s = get();
    const target =
      s.logo.kind === "wordmark" && s.editTarget === "logo" ? "product" : s.editTarget;
    set({
      editTool: t,
      mode: "edit",
      editTarget: target,
      draft: cloneEdit(DEFAULT_EDIT),
    });
  },
  setEditTarget: (t) => set({ editTarget: t, draft: cloneEdit(DEFAULT_EDIT) }),
  setDraft: (d) =>
    set({
      draft: typeof d === "function" ? d(get().draft) : d,
    }),
  resetDraft: () => set({ draft: cloneEdit(DEFAULT_EDIT) }),
  setImaginePrompt: (s) => set({ imaginePrompt: s }),
  pushHistory: () => {
    const s = get();
    const snap = takeSnapshot(s);
    const next = s.history.slice(0, s.historyIndex + 1);
    next.push(snap);
    if (next.length > 16) next.shift();
    set({ history: next, historyIndex: next.length - 1 });
  },
  undo: () => {
    const s = get();
    if (s.historyIndex < 0) return;
    const snap = s.history[s.historyIndex];
    if (!snap) return;
    set({
      ...snap,
      historyIndex: s.historyIndex - 1,
      mode: "studio",
    });
  },
  redo: () => {
    const s = get();
    const next = s.historyIndex + 1;
    const snap = s.history[next];
    if (!snap) return;
    set({ ...snap, historyIndex: next, mode: "studio" });
  },
  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex + 1 < get().history.length,
}));
