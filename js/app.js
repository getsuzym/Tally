const { createApp, ref, computed } = Vue;

createApp({
    setup() {
        const people = ref(['Alex', 'Sam']);
        const newPerson = ref('');
        const splitMethod = ref('even');
        
        // Dishes split
        const taxPercent = ref(10);
        const tipPercent = ref(18);
        const dishes = ref([
            { name: 'Pizza', price: 20, sharedBy: ['Alex', 'Sam'] },
            { name: 'Soda', price: 3, sharedBy: ['Alex'] }
        ]);

        // Even split
        const totalBill = ref(0);
        const evenTaxPercent = ref(10);
        const evenTipPercent = ref(18);

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

        const calculatedTotals = computed(() => {
            const totals = {};
            people.value.forEach(p => totals[p] = 0);

            if (splitMethod.value === 'even') {
                // Even split calculation
                if (totalBill.value > 0 && people.value.length > 0) {
                    const multiplier = 1 + (evenTaxPercent.value / 100) + (evenTipPercent.value / 100);
                    const totalWithCharges = totalBill.value * multiplier;
                    const perPerson = totalWithCharges / people.value.length;
                    people.value.forEach(p => {
                        totals[p] = perPerson;
                    });
                }
            } else {
                // Dishes split calculation
                const multiplier = 1 + (taxPercent.value / 100) + (tipPercent.value / 100);

                dishes.value.forEach(dish => {
                    if (dish.sharedBy.length > 0) {
                        const portion = (dish.price / dish.sharedBy.length) * multiplier;
                        dish.sharedBy.forEach(person => {
                            totals[person] += portion;
                        });
                    }
                });
            }
            return totals;
        });

        return { 
            people, 
            newPerson, 
            dishes, 
            splitMethod,
            totalBill,
            evenTaxPercent,
            evenTipPercent,
            taxPercent, 
            tipPercent,
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
            calculatedTotals 
        };
    }
}).mount('#app');
