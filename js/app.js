const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        const people = ref(['Person 1', 'Person 2']);
        const newPerson = ref('');
        const splitMethod = ref('dishes');
        const tipCalculationMethod = ref('after-tax'); // 'before-tax' or 'after-tax'
        
        // Dishes split
        const taxPercent = ref(5);
        const tipPercent = ref(15);
        const tipMode = ref('percent'); // 'percent' or 'amount'
        const tipAmount = ref(0);
        const dishes = ref([
            { name: 'Pizza', price: 20, sharedBy: ['Person 1', 'Person 2'] },
            { name: 'Soda', price: 3, sharedBy: ['Person 1'] }
        ]);

        // Even split
        const totalBill = ref(0);
        const evenTaxPercent = ref(5);
        const evenTipPercent = ref(15);
        const evenTipMode = ref('percent');
        const evenTipAmount = ref(0);

        // Receipt OCR
        const receiptInput = ref(null);
        const ocrProcessing = ref(false);
        const extractedText = ref('');
        const suggestedDishes = ref([]);

        const addPerson = () => {
            if (newPerson.value.trim()) {
                if (!people.value.includes(newPerson.value.trim())) {
                    people.value.push(newPerson.value.trim());
                    newPerson.value = '';
                }
            }
        };

        const removePerson = (person) => {
            people.value = people.value.filter(p => p !== person);
            dishes.value.forEach(dish => {
                dish.sharedBy = dish.sharedBy.filter(p => p !== person);
            });
        };

        const addDish = () => {
            dishes.value.push({ name: '', price: 0, sharedBy: [] });
        };

        const removeDish = (index) => {
            dishes.value.splice(index, 1);
        };

        const togglePerson = (dishIndex, person) => {
            const sharedList = dishes.value[dishIndex].sharedBy;
            const index = sharedList.indexOf(person);
            if (index > -1) sharedList.splice(index, 1);
            else sharedList.push(person);
        };

        const handleReceiptUpload = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            ocrProcessing.value = true;
            extractedText.value = '';
            suggestedDishes.value = [];

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const { data: { text } } = await Tesseract.recognize(e.target.result, 'eng');
                        extractedText.value = text;
                        
                        // Extract potential dish names (capitalized words and common patterns)
                        const lines = text.split('\n');
                        const potential = new Set();
                        
                        lines.forEach(line => {
                            const cleaned = line.trim();
                            if (cleaned.length > 2 && cleaned.length < 50) {
                                // Remove common words and numbers
                                const words = cleaned.split(/\s+/);
                                const filtered = words.filter(w => 
                                    w.length > 2 && 
                                    !/^\d+(\.\d{2})?$/.test(w) && 
                                    !/^[\$€£¥]/.test(w) &&
                                    !['the', 'and', 'with', 'sauce', 'total', 'subtotal', 'tax', 'tip', 'amount', 'price', 'cost'].includes(w.toLowerCase())
                                ).join(' ');
                                
                                if (filtered && filtered.length > 2) {
                                    potential.add(filtered);
                                }
                            }
                        });

                        // Convert to array and limit suggestions
                        suggestedDishes.value = Array.from(potential).slice(0, 15);
                    } catch (err) {
                        console.error('OCR Error:', err);
                        extractedText.value = 'Error processing image. Please try again.';
                    }
                    ocrProcessing.value = false;
                };
                reader.readAsDataURL(file);
            } catch (err) {
                console.error('Error:', err);
                ocrProcessing.value = false;
            }
        };

        const addSuggestedDish = (dishName) => {
            dishes.value.push({ name: dishName, price: 0, sharedBy: [] });
            suggestedDishes.value = suggestedDishes.value.filter(d => d !== dishName);
        };

        const clearTipPercents = () => {
            tipPercent.value = 0;
            tipAmount.value = 0;
            evenTipPercent.value = 0;
            evenTipAmount.value = 0;
        };

        const clearTaxPercents = () => {
            taxPercent.value = 0;
            evenTaxPercent.value = 0;
        };

        const calculatedTotals = computed(() => {
            const totals = {};
            people.value.forEach(p => totals[p] = 0);

            // Calculate multiplier based on tip calculation method
            const getMultiplier = (taxPct, tipPct) => {
                if (tipCalculationMethod.value === 'after-tax') {
                    // Tip calculated after tax: total = base * (1 + tax%) * (1 + tip%)
                    return (1 + taxPct / 100) * (1 + tipPct / 100);
                } else {
                    // Tip calculated before tax (on base): total = base * (1 + tax% + tip%)
                    return 1 + (taxPct / 100) + (tipPct / 100);
                }
            };

            if (splitMethod.value === 'even') {
                // Even split calculation
                if (totalBill.value > 0 && people.value.length > 0) {
                    let totalWithCharges = 0;
                    if (evenTipMode.value === 'percent') {
                        const multiplier = getMultiplier(evenTaxPercent.value, evenTipPercent.value);
                        totalWithCharges = totalBill.value * multiplier;
                    } else {
                        const totalWithTax = totalBill.value * (1 + evenTaxPercent.value / 100);
                        totalWithCharges = totalWithTax + evenTipAmount.value;
                    }
                    const perPerson = totalWithCharges / people.value.length;
                    people.value.forEach(p => {
                        totals[p] = perPerson;
                    });
                }
            } else {
                // Dishes split calculation
                const subtotalAll = dishes.value.reduce((s, d) => s + d.price, 0);

                dishes.value.forEach(dish => {
                    if (dish.sharedBy.length > 0) {
                        let totalForDish = 0;
                        const taxForDish = dish.price * (taxPercent.value / 100);

                        if (tipMode.value === 'percent') {
                            const multiplier = getMultiplier(taxPercent.value, tipPercent.value);
                            totalForDish = dish.price * multiplier;
                        } else {
                            // tip is a fixed amount distributed proportionally by dish price
                            const tipShare = subtotalAll > 0 ? (dish.price / subtotalAll) * tipAmount.value : 0;
                            totalForDish = dish.price + taxForDish + tipShare;
                        }

                        const portion = totalForDish / dish.sharedBy.length;
                        dish.sharedBy.forEach(person => {
                            totals[person] += portion;
                        });
                    }
                });
            }
            return totals;
        });

        const grandTotal = computed(() => {
            return Object.values(calculatedTotals.value).reduce((sum, total) => sum + total, 0);
        });

        const billBreakdown = computed(() => {
            let subtotal = 0;
            
            if (splitMethod.value === 'dishes') {
                // Sum all dish prices
                subtotal = dishes.value.reduce((sum, dish) => sum + dish.price, 0);
            } else {
                // Even split uses totalBill as subtotal
                subtotal = totalBill.value;
            }

            const taxAmount = splitMethod.value === 'dishes' 
                ? subtotal * (taxPercent.value / 100)
                : subtotal * (evenTaxPercent.value / 100);

            let tipAmt = 0;
            if (splitMethod.value === 'dishes') {
                tipAmt = tipMode.value === 'percent' ? computedDishTipAmount.value : tipAmount.value;
            } else {
                tipAmt = evenTipMode.value === 'percent' ? computedEvenTipAmount.value : evenTipAmount.value;
            }

            const total = subtotal + taxAmount + tipAmt;

            return {
                subtotal: subtotal,
                taxAmount: taxAmount,
                tipAmount: tipAmt,
                total: total
            };
        });

        // Computed helpers for displaying tip equivalents
        const computedDishTipAmount = computed(() => {
            const subtotal = dishes.value.reduce((s, d) => s + d.price, 0);
            const taxAmt = subtotal * (taxPercent.value / 100);
            if (tipMode.value === 'percent') {
                if (tipCalculationMethod.value === 'after-tax') return (subtotal + taxAmt) * (tipPercent.value / 100);
                return subtotal * (tipPercent.value / 100);
            }
            return tipAmount.value;
        });

        const computedDishTaxAmount = computed(() => {
            const subtotal = dishes.value.reduce((s, d) => s + d.price, 0);
            return subtotal * (taxPercent.value / 100);
        });

        const computedDishTipPercent = computed(() => {
            const subtotal = dishes.value.reduce((s, d) => s + d.price, 0);
            const taxAmt = subtotal * (taxPercent.value / 100);
            const base = tipCalculationMethod.value === 'after-tax' ? (subtotal + taxAmt) : subtotal;
            if (base <= 0) return 0;
            if (tipMode.value === 'amount') return (tipAmount.value / base) * 100;
            return tipPercent.value;
        });

        const computedEvenTipAmount = computed(() => {
            const subtotal = totalBill.value;
            const taxAmt = subtotal * (evenTaxPercent.value / 100);
            if (evenTipMode.value === 'percent') {
                if (tipCalculationMethod.value === 'after-tax') return (subtotal + taxAmt) * (evenTipPercent.value / 100);
                return subtotal * (evenTipPercent.value / 100);
            }
            return evenTipAmount.value;
        });

        const computedEvenTipPercent = computed(() => {
            const subtotal = totalBill.value;
            const taxAmt = subtotal * (evenTaxPercent.value / 100);
            const base = tipCalculationMethod.value === 'after-tax' ? (subtotal + taxAmt) : subtotal;
            if (base <= 0) return 0;
            if (evenTipMode.value === 'amount') return (evenTipAmount.value / base) * 100;
            return evenTipPercent.value;
        });

        return { 
            people, 
            newPerson, 
            dishes, 
            splitMethod,
            tipCalculationMethod,
            totalBill,
            evenTaxPercent,
            evenTipPercent,
            taxPercent, 
            tipPercent,
            tipMode,
            tipAmount,
            evenTipMode,
            evenTipAmount,
            computedDishTipAmount,
            computedDishTaxAmount,
            computedDishTipPercent,
            computedEvenTipAmount,
            computedEvenTipPercent,
            receiptInput,
            ocrProcessing,
            extractedText,
            suggestedDishes,
            addPerson, 
            removePerson, 
            addDish, 
            removeDish, 
            togglePerson,
            handleReceiptUpload,
            addSuggestedDish,
            calculatedTotals,
            grandTotal,
            billBreakdown,
            clearTipPercents,
            clearTaxPercents
        };
    }
}).mount('#app');
