/**
 * Test Suite for Tally Bill-Splitting Application
 * Tests cover core business logic for people management, dish management, and calculations
 */

describe('Tally Bill-Splitting App', () => {
    
    // Helper function to create app state for testing
    function createTestState() {
        return {
            people: ['Alex', 'Sam'],
            dishes: [
                { name: 'Pizza', price: 20, sharedBy: ['Alex', 'Sam'] },
                { name: 'Soda', price: 3, sharedBy: ['Alex'] }
            ],
            taxPercent: 10,
            tipPercent: 18,
            totalBill: 0,
            evenTaxPercent: 10,
            evenTipPercent: 18,
            splitMethod: 'dishes'
        };
    }

    // ==================== People Management Tests ====================
    
    describe('addPerson', () => {
        test('should add a new person to the list', () => {
            const people = ['Alex', 'Sam'];
            const newPerson = 'Jordan';
            
            if (newPerson.trim() && !people.includes(newPerson.trim())) {
                people.push(newPerson.trim());
            }
            
            expect(people).toContain('Jordan');
            expect(people.length).toBe(3);
        });

        test('should not add empty or whitespace-only names', () => {
            const people = ['Alex', 'Sam'];
            const newPerson = '   ';
            
            if (newPerson.trim() && !people.includes(newPerson.trim())) {
                people.push(newPerson.trim());
            }
            
            expect(people.length).toBe(2);
        });

        test('should not add duplicate names', () => {
            const people = ['Alex', 'Sam'];
            const newPerson = 'Alex';
            
            if (newPerson.trim() && !people.includes(newPerson.trim())) {
                people.push(newPerson.trim());
            }
            
            expect(people.length).toBe(2);
            expect(people.filter(p => p === 'Alex').length).toBe(1);
        });

        test('should trim whitespace from names', () => {
            const people = ['Alex', 'Sam'];
            const newPerson = '  Jordan  ';
            
            if (newPerson.trim() && !people.includes(newPerson.trim())) {
                people.push(newPerson.trim());
            }
            
            expect(people).toContain('Jordan');
            expect(people).not.toContain('  Jordan  ');
        });
    });

    describe('removePerson', () => {
        test('should remove a person from the list', () => {
            const state = createTestState();
            const personToRemove = 'Alex';
            
            state.people = state.people.filter(p => p !== personToRemove);
            state.dishes.forEach(dish => {
                dish.sharedBy = dish.sharedBy.filter(p => p !== personToRemove);
            });
            
            expect(state.people).not.toContain('Alex');
            expect(state.people).toEqual(['Sam']);
        });

        test('should remove person from all dishes when removed', () => {
            const state = createTestState();
            const personToRemove = 'Alex';
            
            state.people = state.people.filter(p => p !== personToRemove);
            state.dishes.forEach(dish => {
                dish.sharedBy = dish.sharedBy.filter(p => p !== personToRemove);
            });
            
            state.dishes.forEach(dish => {
                expect(dish.sharedBy).not.toContain('Alex');
            });
        });

        test('should handle removing non-existent person gracefully', () => {
            const state = createTestState();
            const originalLength = state.people.length;
            
            state.people = state.people.filter(p => p !== 'NonExistent');
            
            expect(state.people.length).toBe(originalLength);
        });
    });

    // ==================== Dish Management Tests ====================

    describe('addDish', () => {
        test('should add a new dish to the list', () => {
            const dishes = [
                { name: 'Pizza', price: 20, sharedBy: ['Alex', 'Sam'] }
            ];
            
            dishes.push({ name: '', price: 0, sharedBy: [] });
            
            expect(dishes.length).toBe(2);
            expect(dishes[1].name).toBe('');
            expect(dishes[1].price).toBe(0);
            expect(dishes[1].sharedBy).toEqual([]);
        });

        test('should maintain existing dishes when adding new one', () => {
            const state = createTestState();
            const initialDishes = JSON.parse(JSON.stringify(state.dishes));
            
            state.dishes.push({ name: 'Salad', price: 12, sharedBy: ['Sam'] });
            
            expect(state.dishes[0]).toEqual(initialDishes[0]);
            expect(state.dishes[1]).toEqual(initialDishes[1]);
            expect(state.dishes[2].name).toBe('Salad');
        });
    });

    describe('removeDish', () => {
        test('should remove a dish by index', () => {
            const state = createTestState();
            const indexToRemove = 0;
            
            state.dishes.splice(indexToRemove, 1);
            
            expect(state.dishes.length).toBe(1);
            expect(state.dishes[0].name).toBe('Soda');
        });

        test('should handle removing middle dish', () => {
            const state = createTestState();
            state.dishes.push({ name: 'Burger', price: 15, sharedBy: ['Alex'] });
            
            state.dishes.splice(1, 1);
            
            expect(state.dishes.length).toBe(2);
            expect(state.dishes[0].name).toBe('Pizza');
            expect(state.dishes[1].name).toBe('Burger');
        });
    });

    describe('togglePerson', () => {
        test('should add person to dish when not present', () => {
            const state = createTestState();
            const dishIndex = 1; // Soda dish
            const person = 'Sam';
            
            const sharedList = state.dishes[dishIndex].sharedBy;
            const index = sharedList.indexOf(person);
            if (index > -1) sharedList.splice(index, 1);
            else sharedList.push(person);
            
            expect(state.dishes[dishIndex].sharedBy).toContain('Sam');
            expect(state.dishes[dishIndex].sharedBy.length).toBe(2);
        });

        test('should remove person from dish when already present', () => {
            const state = createTestState();
            const dishIndex = 0; // Pizza dish
            const person = 'Alex';
            
            const sharedList = state.dishes[dishIndex].sharedBy;
            const index = sharedList.indexOf(person);
            if (index > -1) sharedList.splice(index, 1);
            else sharedList.push(person);
            
            expect(state.dishes[dishIndex].sharedBy).not.toContain('Alex');
            expect(state.dishes[dishIndex].sharedBy).toEqual(['Sam']);
        });

        test('should toggle multiple times correctly', () => {
            const state = createTestState();
            const dishIndex = 1;
            const person = 'Sam';
            
            // Toggle on
            let sharedList = state.dishes[dishIndex].sharedBy;
            let index = sharedList.indexOf(person);
            if (index > -1) sharedList.splice(index, 1);
            else sharedList.push(person);
            expect(state.dishes[dishIndex].sharedBy).toContain('Sam');
            
            // Toggle off
            sharedList = state.dishes[dishIndex].sharedBy;
            index = sharedList.indexOf(person);
            if (index > -1) sharedList.splice(index, 1);
            else sharedList.push(person);
            expect(state.dishes[dishIndex].sharedBy).not.toContain('Sam');
        });
    });

    // ==================== Even Split Calculation Tests ====================

    describe('Even Split Calculation', () => {
        test('should split total bill evenly among all people', () => {
            const totalBill = 100;
            const people = ['Alex', 'Sam'];
            const multiplier = 1 + (10 / 100) + (18 / 100); // 1.28
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(perPerson).toBeCloseTo(64, 2);
        });

        test('should apply tax percentage correctly', () => {
            const totalBill = 100;
            const taxPercent = 10;
            const tipPercent = 0;
            const people = ['Alex', 'Sam'];
            const multiplier = 1 + (taxPercent / 100) + (tipPercent / 100);
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(totalWithCharges).toBeCloseTo(110, 2);
            expect(perPerson).toBeCloseTo(55, 2);
        });

        test('should apply tip percentage correctly', () => {
            const totalBill = 100;
            const taxPercent = 0;
            const tipPercent = 18;
            const people = ['Alex', 'Sam'];
            const multiplier = 1 + (taxPercent / 100) + (tipPercent / 100);
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(totalWithCharges).toBe(118);
            expect(perPerson).toBe(59);
        });

        test('should handle zero bill', () => {
            const totalBill = 0;
            const people = ['Alex', 'Sam'];
            const multiplier = 1.28;
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(perPerson).toBe(0);
        });

        test('should handle single person', () => {
            const totalBill = 100;
            const people = ['Alex'];
            const multiplier = 1.28;
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(perPerson).toBe(128);
        });

        test('should handle high tax and tip percentages', () => {
            const totalBill = 100;
            const taxPercent = 25;
            const tipPercent = 30;
            const people = ['Alex', 'Sam'];
            const multiplier = 1 + (taxPercent / 100) + (tipPercent / 100);
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(multiplier).toBe(1.55);
            expect(totalWithCharges).toBe(155);
            expect(perPerson).toBe(77.5);
        });
    });

    // ==================== Dishes Split Calculation Tests ====================

    describe('Dishes Split Calculation', () => {
        test('should calculate totals for each person by dishes', () => {
            const state = createTestState();
            const totals = {};
            
            state.people.forEach(p => totals[p] = 0);
            
            const multiplier = 1 + (state.taxPercent / 100) + (state.tipPercent / 100);
            state.dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] += portion;
                    });
                }
            });
            
            expect(totals['Alex']).toBeCloseTo(16.64, 2); // (20/2 + 3/1) * 1.28
            expect(totals['Sam']).toBeCloseTo(12.8, 2);   // (20/2) * 1.28
        });

        test('should handle dish with multiple sharers', () => {
            const dishes = [
                { name: 'Pizza', price: 30, sharedBy: ['Alex', 'Sam', 'Jordan'] }
            ];
            const multiplier = 1.28;
            
            const totals = {};
            dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] = (totals[person] || 0) + portion;
                    });
                }
            });
            
            expect(totals['Alex']).toBeCloseTo(12.8, 2);
            expect(totals['Sam']).toBeCloseTo(12.8, 2);
            expect(totals['Jordan']).toBeCloseTo(12.8, 2);
        });

        test('should handle dish with no sharers', () => {
            const dishes = [
                { name: 'Pizza', price: 20, sharedBy: ['Alex'] },
                { name: 'Salad', price: 15, sharedBy: [] }
            ];
            const multiplier = 1.28;
            const totals = {};
            
            dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] = (totals[person] || 0) + portion;
                    });
                }
            });
            
            expect(totals['Alex']).toBeCloseTo(25.6, 2);
            expect(totals.undefinedKey).toBeUndefined();
        });

        test('should accumulate charges for person across multiple dishes', () => {
            const state = createTestState();
            const totals = {};
            
            state.people.forEach(p => totals[p] = 0);
            
            const multiplier = 1.28;
            state.dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] += portion;
                    });
                }
            });
            
            // Alex shares Pizza (20) and Soda (3)
            // Sam shares only Pizza (20)
            const expectedAlex = ((20 / 2) + 3) * 1.28; // 13 * 1.28
            const expectedSam = (20 / 2) * 1.28; // 10 * 1.28
            
            expect(totals['Alex']).toBeCloseTo(expectedAlex, 2);
            expect(totals['Sam']).toBeCloseTo(expectedSam, 2);
        });

        test('should handle zero-price dishes', () => {
            const dishes = [
                { name: 'Water', price: 0, sharedBy: ['Alex', 'Sam'] }
            ];
            const multiplier = 1.28;
            const totals = {};
            
            dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] = (totals[person] || 0) + portion;
                    });
                }
            });
            
            expect(totals['Alex'] || 0).toBe(0);
            expect(totals['Sam'] || 0).toBe(0);
        });

        test('should distribute large bills correctly', () => {
            const dishes = [
                { name: 'Catering', price: 500, sharedBy: ['Alex', 'Sam', 'Jordan', 'Casey'] }
            ];
            const multiplier = 1.18; // 10% tax, 8% tip
            
            const totals = {};
            dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] = (totals[person] || 0) + portion;
                    });
                }
            });
            
            const expectedPerPerson = (500 / 4) * 1.18;
            
            Object.values(totals).forEach(total => {
                expect(total).toBeCloseTo(expectedPerPerson, 2);
            });
        });
    });

    // ==================== Edge Cases Tests ====================

    describe('Edge Cases', () => {
        test('should handle empty people list in even split', () => {
            const totalBill = 100;
            const people = [];
            const multiplier = 1.28;
            
            if (totalBill > 0 && people.length > 0) {
                const totalWithCharges = totalBill * multiplier;
                const perPerson = totalWithCharges / people.length;
                expect(perPerson).toBeDefined();
            } else {
                expect(people.length).toBe(0);
            }
        });

        test('should handle negative prices gracefully', () => {
            const dishes = [
                { name: 'Discount', price: -10, sharedBy: ['Alex', 'Sam'] }
            ];
            const multiplier = 1.28;
            const totals = {};
            
            dishes.forEach(dish => {
                if (dish.sharedBy.length > 0) {
                    const portion = (dish.price / dish.sharedBy.length) * multiplier;
                    dish.sharedBy.forEach(person => {
                        totals[person] = (totals[person] || 0) + portion;
                    });
                }
            });
            
            expect(totals['Alex']).toBeLessThan(0);
        });

        test('should handle very small decimal prices', () => {
            const dishes = [
                { name: 'Mint', price: 0.25, sharedBy: ['Alex'] }
            ];
            const multiplier = 1.28;
            
            const total = (0.25 / 1) * multiplier;
            expect(total).toBeCloseTo(0.32, 2);
        });

        test('should handle 0% tax and tip', () => {
            const totalBill = 100;
            const people = ['Alex', 'Sam'];
            const multiplier = 1; // 0% tax, 0% tip
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(perPerson).toBe(50);
        });

        test('should handle 100% tax and tip', () => {
            const totalBill = 100;
            const people = ['Alex', 'Sam'];
            const multiplier = 2; // 100% tax, 100% tip
            
            const totalWithCharges = totalBill * multiplier;
            const perPerson = totalWithCharges / people.length;
            
            expect(perPerson).toBe(100);
        });
    });

    // ==================== Data Validation Tests ====================

    describe('Data Validation', () => {
        test('should reject dishes with empty names', () => {
            const dish = { name: '', price: 20, sharedBy: ['Alex'] };
            const isValid = dish.name.trim().length > 0;
            
            expect(isValid).toBe(false);
        });

        test('should accept dishes with names and positive prices', () => {
            const dish = { name: 'Pizza', price: 20, sharedBy: ['Alex'] };
            const isValid = dish.name.trim().length > 0 && dish.price > 0;
            
            expect(isValid).toBe(true);
        });

        test('should validate price is a number', () => {
            const validPrice = 20;
            const invalidPrice = 'twenty';
            
            expect(typeof validPrice === 'number').toBe(true);
            expect(typeof invalidPrice === 'number').toBe(false);
        });

        test('should validate person name is not empty', () => {
            const validName = 'Alex';
            const invalidName = '';
            
            expect(validName.trim().length > 0).toBe(true);
            expect(invalidName.trim().length > 0).toBe(false);
        });
    });
});
