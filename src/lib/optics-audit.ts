/** Optical findings against the Python render path. We do not patch their code. */

export type OpticsFinding = {
  id: string;
  topic: "metal" | "contact" | "crystal" | "curve" | "small";
  sku: string;
  src: string;
  title: string;
  off: string;
  theirs: string;
  verdict: "off" | "keep";
};

export const OPTICS: OpticsFinding[] = [
  {
    id: "aniso",
    topic: "metal",
    sku: "TPX-PEN-01",
    src: "/mockups/pen.jpg",
    title: "Brushed metal is anisotropic",
    off: "A laser on a twist pen catches light along the barrel grain. Their etch is a flat frost — the same silver on every pixel under the mark.",
    theirs:
      "render_engrave samples a median RGB then lerps toward a fixed [190, 189, 182]. No grain direction. Brass, steel and coated aluminium all become the same champagne.",
    verdict: "off",
  },
  {
    id: "brass",
    topic: "metal",
    sku: "TPX-USB-01",
    src: "/mockups/usb.jpg",
    title: "The etch colour belongs to the material",
    off: "A brass plate should reveal brass. Their frost is a photo-brightness switch: dark body → silver, light body → taupe. A dark brass and a dark steel look identical.",
    theirs: "lum < 110 picks silver; else taupe from luminance. substrateFor (material → RGB) is not in their path.",
    verdict: "off",
  },
  {
    id: "bevel",
    topic: "metal",
    sku: "TPX-FLK-01",
    src: "/mockups/flask.jpg",
    title: "Highlight and shadow are two clipped expressions",
    off: "On a horizontal stroke the top edge can drive both terms negative, both clip to zero, and that edge gets no relief. A flask wordmark reads as a sticker, not a groove.",
    theirs:
      "hi and sh are shifted copies of the mask, then clip(hi-marr) and clip(sh-marr) separately. One signed lighting term split into halves keeps opposite edges opposite.",
    verdict: "off",
  },
  {
    id: "contact-print",
    topic: "contact",
    sku: "TPX-NTB-01",
    src: "/mockups/notebook.jpg",
    title: "Print sits proud — they have the shadow",
    off: "UV on a notebook is a film. Their print path casts a contact shadow. Sign is right.",
    theirs: "render_print offsets the alpha and blurs it. Keep that. Do not put it on laser.",
    verdict: "keep",
  },
  {
    id: "contact-laser",
    topic: "contact",
    sku: "TPX-PEN-01",
    src: "/mockups/pen.jpg",
    title: "An engraving cannot cast a contact shadow",
    off: "render_engrave has no contact shadow — correct. Confirm render_on_quad / _etch_mask never gains one.",
    theirs: "_etch_mask blends frost only. Good. Embroidery currently reuses render_print, so it does sit proud — right sign, missing stitch.",
    verdict: "keep",
  },
  {
    id: "crystal",
    topic: "crystal",
    sku: "TPX-AWD-01",
    src: "/mockups/award.jpg",
    title: "Frosted crystal is not frosted steel",
    off: "A laser on crystal refracts; the mark lives inside the volume. Their frost is the steel recipe on a bright body, so the award reads as painted taupe on glass.",
    theirs: "Same _etch_mask for every material. Crystal needs a brighter, slightly displaced highlight, not a taupe recess.",
    verdict: "off",
  },
  {
    id: "taper",
    topic: "curve",
    sku: "TPX-FLK-01",
    src: "/mockups/flask.jpg",
    title: "A tapered flask is not a cylinder",
    off: "Their warp is one arcsin along X. A flask narrows; columns that should squeeze at the neck stay parallel, so the mark flares at the shoulder.",
    theirs: "_cylinder_warp only. No taper / cone / sphere. A paper cup (cone) will stretch at the rim.",
    verdict: "off",
  },
  {
    id: "cup",
    topic: "curve",
    sku: "TPX-CUP-01",
    src: "/mockups/cup.jpg",
    title: "A paper cup is a cone",
    off: "The wall is wider at the lip. Cylinder warp keeps the wordmark's height even in UV, so it looks pasted on a tube.",
    theirs: "surface=cylinder with a weaker curvature. Needs v-dependent arc (cone), not a single half-angle.",
    verdict: "off",
  },
  {
    id: "pen-small",
    topic: "small",
    sku: "TPX-PEN-01",
    src: "/mockups/pen.jpg",
    title: "A pen barrel is a few dozen pixels",
    off: "Bevel shift is max(1, W//600). On a 900 px catalogue shot that is 1 px. Two clipped 1 px terms vanish, so the mark is a flat silver rectangle.",
    theirs: "GaussianBlur(2) and MaxFilter kernels are pixel constants. At another resolution they change meaning. Scale to image size, then to mark size.",
    verdict: "off",
  },
];
