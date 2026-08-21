import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const files = {
  methods: readFileSync("src/lib/methods.ts", "utf8"),
  mockups: readFileSync("src/lib/mockups.ts", "utf8"),
  store: readFileSync("src/lib/store.ts", "utf8"),
  pdf: readFileSync("src/lib/pdf.ts", "utf8"),
  brand: readFileSync("src/lib/brand.ts", "utf8"),
  styles: readFileSync("src/styles.css", "utf8"),
  etch: readFileSync("src/lib/etch.ts", "utf8"),
  treat: readFileSync("src/lib/treat.ts", "utf8"),
};

const BANNED = ["pad_print", "screen_print", "deboss", "emboss", "foil"];

for (const [name, src] of Object.entries(files)) {
  if (name === "methods") continue;
  test(`no blacklisted method tokens in ${name}`, () => {
    for (const term of BANNED) {
      assert.equal(src.includes(term), false, `${name} still contains ${term}`);
    }
  });
}

test("blacklist is declared and methods do not export banned ids", () => {
  assert.match(files.methods, /BLACKLISTED_TERMS/);
  assert.doesNotMatch(files.methods, /id: "pad_print"|id: "screen_print"|id: "deboss"|id: "foil"/);
});

test("UV Printing exists as uv_print", () => {
  assert.match(files.methods, /id: "uv_print"/);
  assert.match(files.methods, /label: "UV Printing"/);
});

test("notebook default is UV Printing, not deboss", () => {
  const block = files.mockups.split('id: "notebook"')[1]?.slice(0, 1200) ?? "";
  assert.match(block, /defaultMethod: "uv_print"/);
  assert.doesNotMatch(block, /deboss/);
});

test("tote, bag, box default to UV Printing not UV DTF", () => {
  for (const id of ["tote", "bag", "box"]) {
    const block = files.mockups.split(`id: "${id}"`)[1]?.slice(0, 1200) ?? "";
    assert.match(block, /defaultMethod: "uv_print"/, `${id} default`);
    assert.doesNotMatch(block, /uv_dtf/, `${id} must not quote UV DTF`);
  }
});

test("apparel offers embroidery and UV DTF", () => {
  for (const id of ["polo", "tshirt", "hoodie", "cap"]) {
    const block = files.mockups.split(`id: "${id}"`)[1]?.slice(0, 1400) ?? "";
    assert.match(block, /embroidery/, `${id} embroidery`);
    assert.match(block, /uv_dtf/, `${id} UV DTF`);
    assert.match(block, /defaultMethod: "embroidery"/, `${id} default embroidery`);
  }
});

test("mug is sublimation only", () => {
  const block = files.mockups.split('id: "mug"')[1]?.slice(0, 1200) ?? "";
  assert.match(block, /defaultMethod: "sublimation"/);
});

test("metal pen / flask / award are laser", () => {
  for (const id of ["pen", "flask", "award"]) {
    const block = files.mockups.split(`id: "${id}"`)[1]?.slice(0, 1200) ?? "";
    assert.match(block, /defaultMethod: "laser_engrave"/, id);
  }
});

test("proof PDF uses house navy / orange and contact", () => {
  assert.match(files.brand, /#04263F/);
  assert.match(files.brand, /#D1812E/);
  assert.match(files.brand, /info@tepee-x.com/);
  assert.match(files.brand, /34 Ibn El Nafis/);
  assert.match(files.pdf, /Montserrat/);
  assert.match(files.pdf, /TPX_CONTACT/);
  assert.doesNotMatch(files.pdf, /#0B1F3A|#E85D04|232, 93, 4/);
  assert.match(files.styles, /#04263f/i);
  assert.match(files.styles, /#d1812e/i);
});

test("treat.ts swatches come from brand.ts, never a second navy", () => {
  const treat = files.treat;
  assert.match(treat, /from "\.\/brand"/);
  assert.match(treat, /TPX_NAVY_RGB/);
  assert.match(treat, /TPX_ORANGE_RGB/);
  assert.doesNotMatch(treat, /\[4, 38, 63\]/);
  assert.doesNotMatch(treat, /\[209, 129, 46\]/);
  assert.doesNotMatch(treat, /\[11,\s*31,\s*58\]/);
  assert.doesNotMatch(treat, /\[232,\s*93,\s*4\]/);
  assert.match(treat, /knockoutDarkNeutral/);
  assert.match(treat, /keySolidBackground/);
  assert.match(treat, /houseTreatPrint/);
  assert.match(treat, /toneOnTone/);
});

test("totem SKU exists and quotes UV Printing", () => {
  const block = files.mockups.split('id: "totem"')[1]?.slice(0, 1400) ?? "";
  assert.match(block, /TPX-TTM-01/);
  assert.match(block, /defaultMethod: "uv_print"/);
});

test("methods are exactly the five TePee-X sells", () => {
  const ids = [...files.methods.matchAll(/id: "([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(ids)],
    ["laser_engrave", "uv_print", "uv_dtf", "sublimation", "embroidery"],
  );
});

test("no supplier names in client-visible copy", () => {
  const src = files.mockups + files.methods + files.brand;
  assert.doesNotMatch(src, /Parker|Pilot|BIC|Midocean|PfConcept|Hartmann/i);
});

test("etch uses one signed lighting term", () => {
  const etch = readFileSync("src/lib/etch.ts", "utf8");
  assert.match(etch, /const signed = /);
  assert.match(etch, /Math\.max\(0, signed\)/);
  assert.match(etch, /Math\.max\(0, -signed\)/);
});

test("catalogue layer is searchable and read-only", () => {
  const cat = readFileSync("src/lib/catalog.ts", "utf8");
  assert.match(cat, /searchCatalog/);
  assert.match(cat, /pickFrontImage/);
  assert.match(cat, /proofEligible/);
  assert.doesNotMatch(cat, /localStorage\.setItem/);
});

test("placement memory persists per SKU", () => {
  const mem = readFileSync("src/lib/placement-memory.ts", "utf8");
  assert.match(mem, /rememberPlacement/);
  assert.match(mem, /recallPlacement/);
});
