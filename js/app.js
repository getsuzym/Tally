const { createApp, ref, computed, watch, onMounted } = Vue;

createApp({
    setup() {
        const people = ref(['Person 1', 'Person 2']);
        const newPerson = ref('');
        const splitMethod = ref('dishes');
        const tipCalculationMethod = ref('after-tax'); // 'before-tax' or 'after-tax'
        
        // Collapsed sections state - Progressive disclosure: start collapsed
        const collapsedSections = ref({
            participants: false,  // Start open - first step
            billAmount: true,     // Collapsed until participants added
            dishes: true,         // Collapsed until participants added
            additionalCharges: true  // Collapsed until dishes/bill entered
        });
        
        // Track which sections have been opened/reviewed by user
        const reviewedSections = ref({
            participants: false,
            billAmount: false,
            dishes: false,
            additionalCharges: false
        });
        
        // Dishes split
        const taxPercent = ref(5);
        const tipPercent = ref(15);
        const tipMode = ref('percent'); // 'percent' or 'amount'
        const tipAmount = ref(0);
        const dishes = ref([
            { name: 'Pizza', price: 0, sharedBy: ['Person 1', 'Person 2'], isEdited: false }
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
        const showExtractedText = ref(false);
        const visionApiKey = ref(''); // Google Cloud Vision API key, kept only in localStorage
        const scanError = ref('');
        const parsedItems = ref([]); // { name, price, selected } awaiting user review
        const parsedCharges = ref({ subtotal: null, tax: null, tip: null, total: null });
        const resultsSection = ref(null);
        const showStickyDetails = ref(false);
        const showStickySummary = ref(false);
        const showAdvancedFeatures = ref(false);

        const addPerson = () => {
            let nameToAdd = newPerson.value.trim();
            
            // If empty, auto-generate name
            if (!nameToAdd) {
                // Find the highest Person # number
                let maxNum = 0;
                people.value.forEach(person => {
                    const match = person.match(/^Person (\d+)$/);
                    if (match) {
                        maxNum = Math.max(maxNum, parseInt(match[1]));
                    }
                });
                nameToAdd = `Person ${maxNum + 1}`;
            }
            
            // Add if not duplicate
            if (!people.value.includes(nameToAdd)) {
                people.value.push(nameToAdd);
                newPerson.value = '';
            }
        };

        const removePerson = (person) => {
            people.value = people.value.filter(p => p !== person);
            dishes.value.forEach(dish => {
                dish.sharedBy = dish.sharedBy.filter(p => p !== person);
            });
        };

        const addDish = () => {
            dishes.value.push({ name: '', price: 0, sharedBy: [], isEdited: true });
        };

        const handleDishNameFocus = (index, event) => {
            const dish = dishes.value[index];
            // If dish hasn't been manually edited yet, clear the default name
            if (!dish.isEdited) {
                dish.name = '';
                dish.isEdited = true;
            } else {
                // Otherwise, select all text for easy editing
                event.target.select();
            }
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

        const resetParsedReceipt = () => {
            parsedItems.value = [];
            parsedCharges.value = { subtotal: null, tax: null, tip: null, total: null };
        };

        const VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

        const handleReceiptUpload = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const apiKey = visionApiKey.value.trim();
            if (!apiKey) {
                scanError.value = 'Add a Google Cloud Vision API key above first.';
                event.target.value = '';
                return;
            }

            ocrProcessing.value = true;
            extractedText.value = '';
            showExtractedText.value = false;
            scanError.value = '';
            resetParsedReceipt();

            try {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = () => reject(new Error('Could not read the selected file.'));
                    reader.readAsDataURL(file);
                });
                const base64Image = dataUrl.split(',')[1];

                const response = await fetch(`${VISION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [{
                            image: { content: base64Image },
                            // DOCUMENT_TEXT_DETECTION is tuned for dense text (receipts,
                            // documents) and auto-detects language, including mixed
                            // English/Chinese on the same receipt.
                            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
                        }]
                    })
                });

                const result = await response.json();
                // Errors can come back two ways: a top-level `error` (bad key, API not
                // enabled, quota) or a per-image `responses[0].error` (bad image data).
                const perImageError = result.responses && result.responses[0] && result.responses[0].error;
                const apiError = (result.error && result.error.message) || (perImageError && perImageError.message);
                if (!response.ok || perImageError) {
                    throw new Error(apiError || `Vision API request failed (${response.status}).`);
                }

                const annotation = result.responses[0].fullTextAnnotation;
                const text = annotation ? annotation.text : '';
                extractedText.value = text;

                if (!text) {
                    scanError.value = "Vision didn't find any text in that photo.";
                } else {
                    const { items, charges } = ReceiptParser.parseReceipt(text);
                    parsedItems.value = items;
                    parsedCharges.value = charges;
                }
            } catch (err) {
                console.error('Receipt scan error:', err);
                scanError.value = err.message || 'Could not process this image.';
            } finally {
                ocrProcessing.value = false;
                event.target.value = ''; // let the same file be re-selected
            }
        };

        const selectedParsedItems = computed(() =>
            parsedItems.value.filter(i => i.selected && String(i.name).trim())
        );

        const parsedItemsSubtotal = computed(() =>
            selectedParsedItems.value.reduce((sum, i) => sum + (Number(i.price) || 0), 0)
        );

        // Cross-check parsed items against the receipt's own subtotal/total.
        const parsedReceiptCheck = computed(() => {
            const c = parsedCharges.value;
            let target = c.subtotal;
            if (target == null && c.total != null) {
                target = c.total - (c.tax || 0) - (c.tip || 0);
            }
            if (target == null || target <= 0) return null;
            const diff = parsedItemsSubtotal.value - target;
            return { target, diff, ok: Math.abs(diff) / target <= 0.02 };
        });

        const removeParsedItem = (index) => {
            parsedItems.value.splice(index, 1);
        };

        const applyParsedReceipt = () => {
            const chosen = selectedParsedItems.value;
            if (chosen.length === 0) return;

            chosen.forEach(i => {
                dishes.value.push({
                    name: String(i.name).trim(),
                    price: Number(i.price) || 0,
                    sharedBy: [],
                    isEdited: true
                });
            });

            const fallbackBase = chosen.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
            const percents = ReceiptParser.derivePercents(
                parsedCharges.value,
                fallbackBase,
                tipCalculationMethod.value === 'after-tax'
            );
            if (percents.taxPercent != null) taxPercent.value = percents.taxPercent;
            if (percents.tipPercent != null) {
                tipMode.value = 'percent';
                tipPercent.value = percents.tipPercent;
            }

            discardParsedReceipt();
        };

        const discardParsedReceipt = () => {
            resetParsedReceipt();
            extractedText.value = '';
            showExtractedText.value = false;
            scanError.value = '';
        };

        const splitDishEvenly = (dishIndex) => {
            dishes.value[dishIndex].sharedBy = [...people.value];
        };

        const toggleSection = (section) => {
            const wasCollapsed = collapsedSections.value[section];
            collapsedSections.value[section] = !collapsedSections.value[section];
            // Mark as reviewed when user opens or closes the section
            if (wasCollapsed) {
                // Opening the section
                reviewedSections.value[section] = true;
            } else {
                // Closing the section - also mark as reviewed
                reviewedSections.value[section] = true;
            }
        };

        const setQuickTip = (percent, mode = 'even') => {
            if (mode === 'even') {
                evenTipPercent.value = percent;
                evenTipMode.value = 'percent';
            } else {
                tipPercent.value = percent;
                tipMode.value = 'percent';
            }
        };

        const shareResults = async () => {
            if (typeof html2canvas === 'undefined') {
                alert('Screenshot tool not available.');
                return;
            }
            if (!resultsSection.value) {
                alert('Nothing to capture yet.');
                return;
            }
            
            // Hide sticky summary before screenshot
            const wasSummaryVisible = showStickySummary.value;
            showStickySummary.value = false;
            
            // Wait a moment for UI to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            try {
                const canvas = await html2canvas(resultsSection.value, {
                    backgroundColor: '#ffffff',
                    useCORS: true,
                    scale: window.devicePixelRatio || 2
                });

                const blob = await new Promise((resolve, reject) => {
                    canvas.toBlob((blobResult) => {
                        if (blobResult) resolve(blobResult);
                        else reject(new Error('Unable to capture screenshot.'));
                    }, 'image/png');
                });

                const fileName = `tally-results-${Date.now()}.png`;
                const file = new File([blob], fileName, { type: 'image/png' });

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    // Use Web Share API with files - user can choose to save to photos
                    await navigator.share({
                        files: [file],
                        title: 'Tally Bill Split',
                        text: 'Bill breakdown from Tally'
                    });
                } else {
                    // Fallback: Open image in new window where user can long-press to save
                    const imageUrl = canvas.toDataURL('image/png');
                    const newWindow = window.open();
                    if (newWindow) {
                        newWindow.document.write(`
                            <html>
                            <head><title>Tally Results</title>
                            <style>
                                body { margin: 0; padding: 20px; background: #f0f0f0; display: flex; flex-direction: column; align-items: center; }
                                img { max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                                p { font-family: sans-serif; color: #666; margin-top: 20px; text-align: center; }
                            </style>
                            </head>
                            <body>
                            <img src="${imageUrl}" alt="Tally Results">
                            <p>Long-press or right-click the image to save to your photos</p>
                            </body>
                            </html>
                        `);
                    } else {
                        alert('Please enable popups to save the screenshot');
                    }
                }
            } catch (err) {
                console.error('Screenshot error:', err);
                alert('Unable to capture screenshot. Please try again.');
            } finally {
                // Restore sticky summary visibility
                showStickySummary.value = wasSummaryVisible;
            }
        };

        // Load settings from localStorage
        onMounted(() => {
            const saved = localStorage.getItem('tallySettings');
            if (saved) {
                try {
                    const settings = JSON.parse(saved);
                    if (settings.taxPercent) taxPercent.value = settings.taxPercent;
                    if (settings.evenTaxPercent) evenTaxPercent.value = settings.evenTaxPercent;
                    if (settings.tipPercent) tipPercent.value = settings.tipPercent;
                    if (settings.evenTipPercent) evenTipPercent.value = settings.evenTipPercent;
                    if (settings.tipCalculationMethod) tipCalculationMethod.value = settings.tipCalculationMethod;
                    if (settings.visionApiKey) visionApiKey.value = settings.visionApiKey;
                } catch (e) {
                    console.error('Error loading settings:', e);
                }
            }
        });

        // Save settings to localStorage
        watch([taxPercent, evenTaxPercent, tipPercent, evenTipPercent, tipCalculationMethod, visionApiKey], () => {
            const settings = {
                taxPercent: taxPercent.value,
                evenTaxPercent: evenTaxPercent.value,
                tipPercent: tipPercent.value,
                evenTipPercent: evenTipPercent.value,
                tipCalculationMethod: tipCalculationMethod.value,
                visionApiKey: visionApiKey.value
            };
            localStorage.setItem('tallySettings', JSON.stringify(settings));
        });

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

        const numberOfPeople = computed(() => people.value.length);

        const firstPersonTotal = computed(() => {
            const totals = Object.values(calculatedTotals.value);
            return totals.length > 0 ? totals[0] : 0;
        });

        const peopleTotalsList = computed(() => Object.entries(calculatedTotals.value));
        const extraPeopleCount = computed(() => Math.max(0, peopleTotalsList.value.length - 3));
        const visibleStickyPeople = computed(() => {
            const list = peopleTotalsList.value;
            if (showStickyDetails.value || list.length <= 3) return list;
            return list.slice(0, 3);
        });

        watch(peopleTotalsList, (list) => {
            if (list.length <= 3) {
                showStickyDetails.value = false;
            }
        });

        const isSectionComplete = computed(() => {
            return {
                participants: people.value.length > 0,
                billAmount: splitMethod.value === 'even' ? totalBill.value > 0 : true,
                dishes: splitMethod.value === 'dishes' ? dishes.value.length > 0 : true,
                additionalCharges: true // Optional, so always "complete"
            };
        });

        // Progressive disclosure: Auto-expand next section when current is complete
        watch(() => isSectionComplete.value.participants, (isComplete) => {
            if (isComplete && people.value.length > 0) {
                // Auto-collapse participants after adding people
                setTimeout(() => {
                    collapsedSections.value.participants = true;
                    // Mark as reviewed since user just interacted with it
                    reviewedSections.value.participants = true;
                    // Open dishes section
                    collapsedSections.value.dishes = false;
                }, 500);
            }
        });

        watch(() => isSectionComplete.value.dishes, (isComplete) => {
            if (isComplete && splitMethod.value === 'dishes' && dishes.value.length > 0) {
                // Auto-collapse dishes section
                setTimeout(() => {
                    collapsedSections.value.dishes = true;
                    // Open additional charges section
                    collapsedSections.value.additionalCharges = false;
                }, 500);
            }
        });

        watch(() => isSectionComplete.value.billAmount, (isComplete) => {
            if (isComplete && splitMethod.value === 'even' && totalBill.value > 0) {
                // Auto-collapse bill amount
                setTimeout(() => {
                    collapsedSections.value.billAmount = true;
                }, 500);
            }
        });
        
        // Track when sections are opened (not auto-opened)
        watch(() => collapsedSections.value.dishes, (isCollapsed) => {
            if (!isCollapsed) {
                reviewedSections.value.dishes = true;
            }
        });
        
        watch(() => collapsedSections.value.additionalCharges, (isCollapsed) => {
            if (!isCollapsed) {
                reviewedSections.value.additionalCharges = true;
            }
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
            showExtractedText,
            visionApiKey,
            scanError,
            parsedItems,
            parsedCharges,
            selectedParsedItems,
            parsedItemsSubtotal,
            parsedReceiptCheck,
            resultsSection,
            showStickyDetails,
            showStickySummary,
            showAdvancedFeatures,
            collapsedSections,
            numberOfPeople,
            isSectionComplete,
            reviewedSections,
            firstPersonTotal,
            peopleTotalsList,
            visibleStickyPeople,
            extraPeopleCount,
            addPerson, 
            removePerson, 
            addDish, 
            removeDish,
            handleDishNameFocus,
            togglePerson,
            handleReceiptUpload,
            removeParsedItem,
            applyParsedReceipt,
            discardParsedReceipt,
            splitDishEvenly,
            toggleSection,
            setQuickTip,
            shareResults,
            calculatedTotals,
            grandTotal,
            billBreakdown,
            clearTipPercents,
            clearTaxPercents
        };
    }
}).mount('#app');
