# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tally is a single-page, client-only bill splitter. No backend, no bundler, no framework CLI. `index.html` loads every dependency from a CDN and boots one Vue 3 app defined in `js/app.js`. Live at https://getsuzym.github.io/Tally/.

## Commands

```bash
npm test               # Jest, runs js/**/*.test.js
npm run test:watch
npm run test:coverage
npx jest -t "should apply tip percentage correctly"   # single test by name

# No dev server / build. To preview locally:
python3 -m http.server   # then open http://localhost:8000
```

## Deploy

Push to `main` → `.github/workflows/deploy-pages.yml` publishes the repo root to the `gh-pages` branch. There is no build step; whatever is committed is what ships.

**When editing `js/app.js`, bump the cache-busting query in `index.html`** (`<script src="js/app.js?v=1.2">`), or returning visitors keep the stale file.

## Architecture

- **`index.html`** (~550 lines) — all markup and styling. Tailwind utility classes inline (via `cdn.tailwindcss.com`), Font Awesome icons, plus a small `css/styles.css` for the handful of things Tailwind can't express (animations, `.dish-item`, etc.). Vue template syntax lives directly in the HTML under `#app`.
- **`js/app.js`** — the entire application: one `createApp({ setup() {...} })` using the Composition API with `ref`/`computed`/`watch`. No components, no router, no store. Everything returned from `setup()` is bound in `index.html`.
- **CDN globals** (not npm deps — `package.json` only carries Jest): `Vue`, `Tesseract` (OCR), `html2canvas` (currently unused by the active UI; `shareResults` still references it).

### Core domain model

- `splitMethod` is `'dishes'` or `'even'` — two parallel sets of state and two branches in `calculatedTotals`.
  - **dishes**: `dishes[]` of `{ name, price, sharedBy[], isEdited }`; each dish's cost + its share of tax/tip is divided among `sharedBy`.
  - **even**: `totalBill` split equally across `people`.
- **Tax/tip** each mode has its own `taxPercent`/`tipPercent` (+ `evenTaxPercent`/`evenTipPercent`), a `percent` vs `amount` toggle, and a global `tipCalculationMethod` (`'before-tax'` vs `'after-tax'`). The `getMultiplier(tax, tip)` helper inside `calculatedTotals` is the single source of truth for how those combine — mirror it in `billBreakdown` and the `computed*TipAmount` helpers if you change it.
- `calculatedTotals` (per-person map) → `grandTotal`, `peopleTotalsList`, sticky-summary derivations.
- `billBreakdown` recomputes subtotal/tax/tip/total independently for display; keep it consistent with `calculatedTotals`.
- **Persistence**: only tax/tip preferences are saved, to `localStorage` under `tallySettings` (see `onMounted` + the `watch`). People, dishes, and bill amounts are intentionally not persisted.
- **Progressive disclosure**: `collapsedSections` / `reviewedSections` plus several `watch`ers auto-collapse a section and open the next one ~500ms after it's "complete" (`isSectionComplete`). UI-only, but it means section state changes on its own — don't fight it with more watchers.

### Receipt scanning

- **`js/receipt-parser.js`** — pure, DOM-free, and the only unit-tested-for-real module (`js/receipt-parser.test.js` actually `require`s it). Loaded via its own `<script>` before `app.js`; exposes `window.ReceiptParser` in the browser, `module.exports` under Jest.
  - `parseReceipt(text)` → `{ items: [{name, price, selected}], charges: {subtotal, tax, tip, total} }`. Matches a trailing `$?\d{1,4}[.,]\d{2}` per line, routes subtotal/tax/tip/total keyword lines into `charges` (order matters — "subtotal" tested before "total"), strips leading qty and stray column prices from names.
  - `derivePercents(charges, fallbackBase, tipAfterTax)` → `{taxPercent?, tipPercent?}`, honoring the before/after-tax tip convention.
- **`handleReceiptUpload`** in `app.js` runs Tesseract OCR, stores raw text in `extractedText` (behind a "Raw scanned text" toggle), then fills `parsedItems` / `parsedCharges`. The user reviews an editable list; `applyParsedReceipt` pushes selected rows into `dishes[]` and sets `taxPercent`/`tipPercent` from `derivePercents`. `parsedReceiptCheck` compares the selected-items sum to the receipt's own subtotal and warns on a >2% gap.
- If you change the parser, add cases to `js/receipt-parser.test.js` (real assertions there) and keep the regex/keyword lists in sync with `derivePercents`.

### Tests

`js/app.test.js` **does not import `js/app.js`.** Each test re-implements the calculation inline and asserts on that. So the suite documents expected behavior but will not catch a regression in the real functions — when you change calculation logic in `app.js`, update the mirrored logic in the test file by hand, and treat green tests as "the formula is still what we agreed", not "the app works".

`js/receipt-parser.test.js` is the exception — it `require`s the real module, because `receipt-parser.js` was written DOM-free specifically to be testable. New extractable logic should follow that pattern rather than the mirror-in-the-test one.
