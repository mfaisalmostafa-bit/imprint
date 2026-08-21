# TPX Mockup

TePee-X Command Center proofs. A salesperson picks a client, a SKU, and a logo — the generator locks the print zone and renders the **quoted decoration method**, not a Photoshop blend.

## Rails

- Methods: Laser Engraving, UV Printing, UV DTF, Sublimation, Embroidery. Never pad / screen / emboss / deboss / foil.
- Hard goods, bags, boxes → UV Printing. Textiles / non-embroidery apparel → UV DTF.
- Brand from `brand.ts` only: navy `#04263F`, orange `#D1812E`, Montserrat.
- SKUs are `TPX-XXX-NN`. No supplier names.
- Proofs use catalogue photos only. Imagine is for concepts, never an invoice.

## Catalogue + order

Searchable read-only catalogue (JSON today, live API later). An account manager's order of several SKUs exports as **one branded PDF**: before/after, method from the order line, mark size in millimetres, QC warnings.

Placement corrections persist per SKU.

## Run

```bash
npm install
npm run dev
npm test
```

## License

MIT
