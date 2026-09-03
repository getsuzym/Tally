/**
 * Receipt parser — turns raw OCR text into structured line items + charges.
 *
 * Pure functions, no DOM. Exposed as `window.ReceiptParser` in the browser and
 * as CommonJS exports for Jest (js/receipt-parser.test.js).
 */
(function (root) {
    'use strict';

    // CJK Unified Ideographs + Extension A (covers common zh-Hans / zh-Hant text).
    var CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf';

    // A price at the end of a line: optional currency mark ($ ¥ ￥), 1-4 digits,
    // "." or "," then cents, optional trailing unit (元 / RMB). Group 2 is the number.
    var TRAILING_PRICE = /([¥￥$]\s?)?(-?\$?\s?\d{1,4}[.,]\d{2})\s*(元|RMB)?\s*$/i;

    // Order matters: "subtotal" must be tested before "total".
    var CHARGE_MATCHERS = [
        ['subtotal', /\bsub[\s-]?total\b|小\s?計|小\s?计/i],
        ['tax', /\b(tax|gst|hst|pst|vat)\b|消費稅|消费税|增值税|營業稅|营业税|稅金|税金|稅|税/i],
        ['tip', /\b(tip|gratuity|service\s*charge)\b|服務費|服务费|服務charge|小費|小费/i],
        ['total', /\b(grand\s*total|total|balance\s*due|amount\s*due)\b|總\s?計|总\s?计|合\s?計|合\s?计|總\s?額|总\s?额|應付|应付|實付|实付|應收|应收/i]
    ];

    function parseMoney(s) {
        // The captured token carries a single separator; treat a comma as the decimal point.
        var n = parseFloat(String(s).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    var JOIN_SPACED_CJK = new RegExp('([' + CJK + '])\\s+(?=[' + CJK + '])', 'g');
    var EDGE_PUNCT = new RegExp('^[^A-Za-z0-9' + CJK + ']+|[^A-Za-z0-9)' + CJK + ']+$', 'g');
    var HAS_LETTER = new RegExp('[A-Za-z0-9' + CJK + ']');

    function cleanLabel(raw) {
        return raw
            .replace(/[.\-:_\s]+$/, '')              // trailing dot leaders / separators
            .replace(/[¥￥$]?\d{1,4}[.,]\d{2}/g, ' ') // stray unit-price / qty columns
            .replace(/^\d{1,2}\s*[x@*]?\s+/i, '')    // leading quantity ("2 ", "3x ")
            .replace(JOIN_SPACED_CJK, '$1')          // "牛 肉 麵" -> "牛肉麵"
            .replace(/\s{2,}/g, ' ')
            .replace(EDGE_PUNCT, '')                 // edge punctuation (keeps CJK)
            .trim();
    }

    /**
     * @param {string} rawText  OCR output
     * @returns {{items: {name:string, price:number, selected:boolean}[],
     *            charges: {subtotal:?number, tax:?number, tip:?number, total:?number}}}
     */
    function parseReceipt(rawText) {
        var lines = String(rawText || '')
            .split('\n')
            .map(function (l) { return l.trim(); })
            .filter(Boolean);

        var items = [];
        var charges = { subtotal: null, tax: null, tip: null, total: null };

        lines.forEach(function (line) {
            var m = line.match(TRAILING_PRICE);
            if (!m) return;

            var price = parseMoney(m[2]);
            if (price === null) return;

            var charge = CHARGE_MATCHERS.find(function (entry) { return entry[1].test(line); });
            if (charge) {
                var key = charge[0];
                if (key === 'total') {
                    // Guard against "TOTAL SAVINGS" style lines stomping the real total.
                    charges.total = Math.max(charges.total == null ? 0 : charges.total, price);
                } else {
                    charges[key] = price;
                }
                return;
            }

            var label = cleanLabel(line.slice(0, m.index));
            if (price <= 0 || !HAS_LETTER.test(label)) return;
            // Latin labels need >= 2 chars to skip stray "A 1.00" rows; a lone
            // CJK character (e.g. "鱼") is a legitimate item name.
            var compact = label.replace(/\s/g, '');
            if (compact.length < 2 && !new RegExp('[' + CJK + ']').test(compact)) return;

            items.push({ name: label, price: price, selected: true });
        });

        return { items: items, charges: charges };
    }

    /**
     * Derive tax / tip percentages from detected charge amounts.
     * @param {object} charges       output of parseReceipt().charges
     * @param {number} fallbackBase  subtotal to use when the receipt had none
     * @param {boolean} tipAfterTax  whether tip is figured on (subtotal + tax)
     * @returns {{taxPercent?: number, tipPercent?: number}}
     */
    function derivePercents(charges, fallbackBase, tipAfterTax) {
        var c = charges || {};
        var base = c.subtotal != null && c.subtotal > 0 ? c.subtotal : fallbackBase;
        var out = {};

        if (base > 0 && c.tax != null) {
            out.taxPercent = Math.round((c.tax / base) * 1000) / 10;
        }
        if (base > 0 && c.tip != null) {
            var tipBase = tipAfterTax ? base + (c.tax || 0) : base;
            if (tipBase > 0) out.tipPercent = Math.round((c.tip / tipBase) * 1000) / 10;
        }
        return out;
    }

    var api = { parseReceipt: parseReceipt, derivePercents: derivePercents };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        root.ReceiptParser = api;
    }
})(typeof window !== 'undefined' ? window : this);
