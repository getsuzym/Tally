const { parseReceipt, derivePercents } = require('./receipt-parser');

describe('parseReceipt', () => {
    test('pulls name + price from simple line items', () => {
        const { items } = parseReceipt('Cheeseburger 12.99\nFries 4.50\nIced Tea 3.00');
        expect(items).toEqual([
            { name: 'Cheeseburger', price: 12.99, selected: true },
            { name: 'Fries', price: 4.5, selected: true },
            { name: 'Iced Tea', price: 3.0, selected: true }
        ]);
    });

    test('handles $ signs, comma decimals and dotted leaders', () => {
        const { items } = parseReceipt('Pad Thai .......... $13,95\nSpring Roll   $6.00');
        expect(items).toEqual([
            { name: 'Pad Thai', price: 13.95, selected: true },
            { name: 'Spring Roll', price: 6.0, selected: true }
        ]);
    });

    test('strips leading quantity and stray column prices', () => {
        const { items } = parseReceipt('2 Tacos 5.00 10.00\n3x Latte 4.25 12.75');
        expect(items).toEqual([
            { name: 'Tacos', price: 10.0, selected: true },
            { name: 'Latte', price: 12.75, selected: true }
        ]);
    });

    test('routes subtotal / tax / tip / total into charges, not items', () => {
        const { items, charges } = parseReceipt(
            'Burger 10.00\nSalad 8.00\nSubtotal 18.00\nSales Tax 1.44\nTip 3.60\nTOTAL 23.04'
        );
        expect(items.map(i => i.name)).toEqual(['Burger', 'Salad']);
        expect(charges).toEqual({ subtotal: 18.0, tax: 1.44, tip: 3.6, total: 23.04 });
    });

    test('does not let a "TOTAL SAVINGS" line overwrite the real total', () => {
        const { charges } = parseReceipt('Total Savings 2.00\nTotal 41.10');
        expect(charges.total).toBe(41.1);
    });

    test('ignores lines without a trailing price and junk short labels', () => {
        const { items } = parseReceipt('THANK YOU!\n******************\nA 1.00\nGARLIC BREAD 5.50');
        expect(items).toEqual([{ name: 'GARLIC BREAD', price: 5.5, selected: true }]);
    });

    test('tolerates empty / missing input', () => {
        expect(parseReceipt('')).toEqual({ items: [], charges: { subtotal: null, tax: null, tip: null, total: null } });
        expect(parseReceipt(null).items).toEqual([]);
    });
});

describe('derivePercents', () => {
    test('computes tax % from subtotal and tip % on subtotal + tax (after-tax)', () => {
        const out = derivePercents({ subtotal: 100, tax: 8, tip: 21.6 }, 0, true);
        expect(out.taxPercent).toBe(8);
        expect(out.tipPercent).toBe(20); // 21.6 / (100 + 8)
    });

    test('computes tip % on subtotal only when tip is figured before tax', () => {
        const out = derivePercents({ subtotal: 100, tax: 8, tip: 18 }, 0, false);
        expect(out.tipPercent).toBe(18);
    });

    test('falls back to the passed-in base when the receipt had no subtotal', () => {
        const out = derivePercents({ subtotal: null, tax: 5 }, 50, true);
        expect(out.taxPercent).toBe(10);
    });

    test('omits a percentage when its charge is absent', () => {
        expect(derivePercents({ subtotal: 100, tax: 7 }, 0, true)).toEqual({ taxPercent: 7 });
    });
});
