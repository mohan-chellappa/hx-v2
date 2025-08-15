// Application State
const appState = hx.state({
    selectedVulcanizer: null,
    minCyclesRequired: 2,
    lowStockParts: [],
    vulcanizerData: [],
    productionData: {}
});

// Utility Functions
const utils = {
    showMessage(message, duration = 3000) {
        const msgBox = document.getElementById("message-box");
        msgBox.textContent = message;
        msgBox.style.opacity = "1";
        setTimeout(() => {
            msgBox.style.opacity = "0";
        }, duration);
    },

    calculateTotalStock(part) {
        return part.bins.reduce((total, bin) => total + bin.stock, 0);
    },

    checkStockForMinCycles(vulcNo) {
        appState.lowStockParts = [];
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === vulcNo);
        if (!vulc) return;

        vulc.parts.forEach(p => {
            const plannedQtyPerCycle = p.odd + p.even;
            const totalStock = this.calculateTotalStock(p);
            const minRequired = appState.minCyclesRequired > 0 ?
                plannedQtyPerCycle * Math.ceil(appState.minCyclesRequired / 2) : 0;
            if (totalStock < minRequired) {
                appState.lowStockParts.push(p.part_no);
            }
        });
    },

    adjustStockFromProduction(vulcNo, partIndex, quantity) {
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === vulcNo);
        if (!vulc || !vulc.parts[partIndex]) return false;

        const part = vulc.parts[partIndex];
        let remainingToDeduct = quantity;

        for (let i = 0; i < part.bins.length; i++) {
            if (remainingToDeduct <= 0) break;
            if (part.bins[i].stock >= remainingToDeduct) {
                part.bins[i].stock -= remainingToDeduct;
                remainingToDeduct = 0;
            } else {
                remainingToDeduct -= part.bins[i].stock;
                part.bins[i].stock = 0;
            }
        }

        part.bins = part.bins.filter(bin => bin.stock > 0);
        return remainingToDeduct <= 0;
    },

    exportTableToCSV(tableId, filename) {
        const table = document.getElementById(tableId);
        if (!table) {
            this.showMessage(`Table with ID "${tableId}" not found.`);
            return;
        }

        let csv = [];
        const rows = table.querySelectorAll("tr");
        for (let i = 0; i < rows.length; i++) {
            const row = [];
            const cols = rows[i].querySelectorAll("td, th");
            for (let j = 0; j < cols.length; j++) {
                row.push(cols[j].innerText.trim());
            }
            csv.push(row.join(","));
        }

        const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
        const downloadLink = document.createElement("a");
        downloadLink.download = filename;
        downloadLink.href = window.URL.createObjectURL(csvFile);
        downloadLink.style.display = "none";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        this.showMessage(`Exporting ${filename}...`);
    }
};

// Data Management
const dataManager = {
    loadData() {
        appState.minCyclesRequired = parseInt(hx.store.get('minCyclesRequired')) || 2;
        appState.vulcanizerData = hx.store.get('vulcanizerData') || [
            {
                id: 1, vulc_no: "V-1", cycles: 10, parts: [
                    { part_no: "P101", bins: [{ lot_no: "L101", bin_no: "B101", stock: 100 }, { lot_no: "L102", bin_no: "B102", stock: 50 }], odd: 10, even: 12 },
                    { part_no: "P102", bins: [{ lot_no: "L103", bin_no: "B103", stock: 80 }], odd: 8, even: 15 }
                ]
            },
            { id: 2, vulc_no: "V-2", cycles: 8, parts: [{ part_no: "P103", bins: [{ lot_no: "L104", bin_no: "B104", stock: 150 }], odd: 12, even: 10 }] },
            { id: 3, vulc_no: "V-3", cycles: 15, parts: [] }
        ];
        appState.productionData = hx.store.get('productionData') || {};

        if (appState.vulcanizerData.length > 0) {
            appState.selectedVulcanizer = appState.vulcanizerData[0].vulc_no;
        }
    },

    saveVulcanizerData() {
        hx.store.set('vulcanizerData', appState.vulcanizerData);
        hx.store.set('minCyclesRequired', appState.minCyclesRequired);
        utils.showMessage("Vulcanizer plan saved!");
    },

    saveCyclewiseData() {
        hx.store.set('productionData', appState.productionData);
        utils.showMessage(`Cycle-wise data for Vulcanizer ${appState.selectedVulcanizer} saved.`);
    }
};

// Components
hx.component('Header', () => ({
    $header: {
        class: "bg-indigo-600 text-white p-6",
        $h1: {
            class: "text-3xl font-bold",
            text: "Vulcanizer Plan Design"
        }
    }
}));

hx.component('SettingsPanel', () => ({
    $div: {
        class: "bg-gray-50 rounded-lg p-6 mb-8 shadow-md",
        $h2: {
            class: "text-xl font-semibold text-gray-800 mb-4",
            text: "Settings"
        },
        $label: {
            class: "block text-sm font-medium text-gray-700",
            for: "minCyclesInput",
            text: "Min. Cycles Required"
        },
        $input: {
            class: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2",
            id: "minCyclesInput",
            type: "number",
            value: appState.minCyclesRequired,
            oninput: (e) => {
                appState.minCyclesRequired = parseInt(e.target.value) || 0;
                utils.checkStockForMinCycles(appState.selectedVulcanizer);
                renderApp();
            }
        }
    }
}));

hx.component('VulcanizerTable', () => {
    if (appState.vulcanizerData.length === 0) {
        return {
            $p: {
                class: "text-gray-500",
                text: "No vulcanizers found. Add one below."
            }
        };
    }

    return {
        $table: {
            id: "vulcanizerPlanTable",
            class: "min-w-full divide-y divide-gray-200",
            $thead: {
                class: "table-header-bg",
                $tr: {
                    $th: [
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Vulcanizer No." },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "No. of Cycles" }
                    ]
                }
            },
            $tbody: {
                class: "bg-white divide-y divide-gray-200",
                $tr: appState.vulcanizerData.map(vulc => ({
                    class: vulc.vulc_no === appState.selectedVulcanizer ? 'bg-indigo-100' : '',
                    onclick: () => {
                        appState.selectedVulcanizer = vulc.vulc_no;
                        utils.checkStockForMinCycles(appState.selectedVulcanizer);
                        renderApp();
                    },
                    $td: [
                        {
                            class: "px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 editable-cell",
                            contenteditable: "true",
                            text: vulc.vulc_no,
                            oninput: (e) => {
                                vulc.vulc_no = e.target.textContent;
                            }
                        },
                        {
                            class: "px-3 py-2 whitespace-nowrap text-sm text-gray-500 editable-cell",
                            contenteditable: "true",
                            text: vulc.cycles,
                            oninput: (e) => {
                                const value = parseInt(e.target.textContent);
                                if (!isNaN(value)) {
                                    vulc.cycles = value;
                                    utils.checkStockForMinCycles(appState.selectedVulcanizer);
                                    renderApp();
                                }
                            }
                        }
                    ]
                }))
            }
        }
    };
});

hx.component('PartwiseTable', () => {
    const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);

    if (!vulc || vulc.parts.length === 0) {
        return {
            $p: {
                class: "text-gray-500",
                text: `No parts found for ${appState.selectedVulcanizer}. Add a part above.`
            }
        };
    }

    return {
        $table: {
            id: "partwiseTable",
            class: "min-w-full divide-y divide-gray-200",
            $thead: {
                class: "table-header-bg",
                $tr: {
                    $th: [
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Part No." },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider odd-cycle-cell", text: "Odd" },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider even-cycle-cell", text: "Even" }
                    ]
                }
            },
            $tbody: {
                class: "bg-white divide-y divide-gray-200",
                $tr: vulc.parts.map((part, index) => ({
                    $td: [
                        {
                            class: "px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 editable-cell",
                            contenteditable: "true",
                            text: part.part_no,
                            oninput: (e) => {
                                part.part_no = e.target.textContent;
                            }
                        },
                        {
                            class: "px-3 py-2 whitespace-nowrap text-sm text-gray-500 editable-cell odd-cycle-cell",
                            contenteditable: "true",
                            text: part.odd,
                            oninput: (e) => {
                                const value = parseInt(e.target.textContent);
                                if (!isNaN(value)) {
                                    part.odd = value;
                                    utils.checkStockForMinCycles(appState.selectedVulcanizer);
                                    renderApp();
                                }
                            }
                        },
                        {
                            class: "px-3 py-2 whitespace-nowrap text-sm text-gray-500 editable-cell even-cycle-cell",
                            contenteditable: "true",
                            text: part.even,
                            oninput: (e) => {
                                const value = parseInt(e.target.textContent);
                                if (!isNaN(value)) {
                                    part.even = value;
                                    utils.checkStockForMinCycles(appState.selectedVulcanizer);
                                    renderApp();
                                }
                            }
                        }
                    ]
                }))
            }
        }
    };
});

hx.component('CyclewiseTable', () => {
    const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);

    if (!vulc) {
        return {
            $p: {
                class: "text-gray-500",
                text: "Please select a vulcanizer to view the production plan."
            }
        };
    }

    const cycleData = appState.productionData[appState.selectedVulcanizer] || vulc.parts.map(p => ({
        part: p.part_no,
        values: Array(vulc.cycles).fill(0)
    }));

    // Create cycle headers
    const cycleHeaders = [];
    for (let i = 1; i <= vulc.cycles; i++) {
        cycleHeaders.push({
            class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider",
            text: i.toString()
        });
    }

    return {
        $table: {
            id: "cyclewiseTable",
            class: "min-w-full divide-y divide-gray-200",
            $thead: {
                class: "table-header-bg",
                $tr: {
                    $th: [
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Part No." },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Lot No." },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Bin No." },
                        { class: "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider", text: "Stock" },
                        ...cycleHeaders
                    ]
                }
            },
            $tbody: {
                class: "bg-white divide-y divide-gray-200",
                $tr: vulc.parts.map((part, partIndex) => {
                    const rowData = cycleData.find(d => d.part === part.part_no) || {
                        values: Array(vulc.cycles).fill(0)
                    };
                    const isLowStock = appState.lowStockParts.includes(part.part_no);
                    const stockCellClass = isLowStock ? 'blink-red' : '';

                    // Create cycle cells
                    const cycleCells = [];
                    for (let i = 0; i < vulc.cycles; i++) {
                        const cycleTypeClass = (i + 1) % 2 !== 0 ? 'odd-cycle-cell' : 'even-cycle-cell';
                        cycleCells.push({
                            class: `px-3 py-2 whitespace-nowrap text-sm text-gray-500 editable-cell ${cycleTypeClass}`,
                            contenteditable: "true",
                            text: rowData.values[i] || 0,
                            oninput: (e) => {
                                const value = parseInt(e.target.textContent);
                                if (!isNaN(value)) {
                                    updateProductionData(partIndex, i, value);
                                }
                            }
                        });
                    }

                    return {
                        $td: [
                            {
                                class: "px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900",
                                text: part.part_no
                            },
                            {
                                class: "px-3 py-2 whitespace-nowrap text-sm text-gray-500",
                                text: part.bins.map(b => b.lot_no).join(', ')
                            },
                            {
                                class: "px-3 py-2 whitespace-nowrap text-sm text-gray-500",
                                text: part.bins.map(b => b.bin_no).join(', ')
                            },
                            {
                                class: `px-3 py-2 whitespace-nowrap text-sm text-gray-500 ${stockCellClass}`,
                                text: utils.calculateTotalStock(part)
                            },
                            ...cycleCells
                        ]
                    };
                })
            }
        }
    };
});

// Event Handlers
const handlers = {
    addVulcanizer() {
        const newVulcId = appState.vulcanizerData.length > 0 ?
            Math.max(...appState.vulcanizerData.map(v => v.id)) + 1 : 1;
        const newVulcNo = `V-${newVulcId}`;
        appState.vulcanizerData.push({
            id: newVulcId,
            vulc_no: newVulcNo,
            cycles: 0,
            parts: []
        });
        renderApp();
        utils.showMessage(`Added new vulcanizer: ${newVulcNo}`);
    },

    addPart() {
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);
        if (!vulc) {
            utils.showMessage("Please select or add a vulcanizer first.");
            return;
        }
        vulc.parts.push({
            part_no: `New_Part_${vulc.parts.length + 1}`,
            bins: [],
            odd: 0,
            even: 0
        });
        renderApp();
        utils.showMessage(`Added new part to ${appState.selectedVulcanizer}`);
    },

    flipOddEven() {
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);
        if (!vulc) {
            utils.showMessage("Please select a vulcanizer first.");
            return;
        }
        vulc.parts.forEach(part => {
            const temp = part.odd;
            part.odd = part.even;
            part.even = temp;
        });
        renderApp();
        utils.showMessage("Odd and Even values flipped!");
    },

    fillProductionTable() {
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);
        if (!vulc) {
            utils.showMessage("Please select a vulcanizer first.");
            return;
        }

        if (!appState.productionData[appState.selectedVulcanizer]) {
            appState.productionData[appState.selectedVulcanizer] = vulc.parts.map(p => ({
                part: p.part_no,
                values: Array(vulc.cycles).fill(0)
            }));
        }

        const currentProduction = appState.productionData[appState.selectedVulcanizer];
        const parts = vulc.parts;

        parts.forEach((part, partIndex) => {
            const partProduction = currentProduction.find(d => d.part === part.part_no);
            if (!partProduction) return;

            const nextCycleIndex = partProduction.values.findIndex(val => val === 0);

            if (nextCycleIndex !== -1) {
                const plannedQty = (nextCycleIndex + 1) % 2 !== 0 ? part.odd : part.even;
                const totalStock = utils.calculateTotalStock(part);

                if (totalStock > 0) {
                    const qtyToFill = Math.min(plannedQty, totalStock);
                    partProduction.values[nextCycleIndex] = qtyToFill;
                    utils.adjustStockFromProduction(appState.selectedVulcanizer, partIndex, qtyToFill);
                    utils.showMessage(`Filled cycle ${nextCycleIndex + 1} for part ${part.part_no}.`);
                } else {
                    utils.showMessage(`No stock available for part ${part.part_no} to fill cycle ${nextCycleIndex + 1}.`, 5000);
                }
            }
        });

        utils.checkStockForMinCycles(appState.selectedVulcanizer);
        renderApp();
    }
};

function updateProductionData(partIndex, cycleIndex, value) {
    if (!appState.productionData[appState.selectedVulcanizer]) {
        const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);
        if (vulc) {
            appState.productionData[appState.selectedVulcanizer] = vulc.parts.map(p => ({
                part: p.part_no,
                values: Array(vulc.cycles).fill(0)
            }));
        } else {
            return;
        }
    }

    if (appState.productionData[appState.selectedVulcanizer][partIndex]) {
        const prevValue = appState.productionData[appState.selectedVulcanizer][partIndex].values[cycleIndex];
        const change = value - prevValue;

        if (change !== 0) {
            const vulc = appState.vulcanizerData.find(v => v.vulc_no === appState.selectedVulcanizer);
            const part = vulc.parts[partIndex];
            const totalStock = utils.calculateTotalStock(part);

            if (totalStock >= change) {
                if (utils.adjustStockFromProduction(appState.selectedVulcanizer, partIndex, change)) {
                    appState.productionData[appState.selectedVulcanizer][partIndex].values[cycleIndex] = value;
                    utils.showMessage(`Stock for ${part.part_no} updated. New stock: ${utils.calculateTotalStock(part)}`);
                } else {
                    utils.showMessage("Insufficient stock to make this change.", 5000);
                }
            } else {
                utils.showMessage("Insufficient stock to make this change.", 5000);
            }
        }
        utils.checkStockForMinCycles(appState.selectedVulcanizer);
        renderApp();
    }
}

// Main App Component
hx.component('App', () => ({
    $div: {
        class: "w-[100%] mx-auto bg-white shadow-xl rounded-lg overflow-hidden",
        id: "vulc-main-app-container",
        $header: hx._components.Header(),
        $main: {
            class: "p-6",
            $div: {
                class: "flex flex-col md:flex-row gap-8",
                $div: [
                    // Left Panel
                    {
                        class: "w-full md:w-1/4",
                        $div: [
                            // Settings
                            hx._components.SettingsPanel(),
                            // Vulcanizer Plan
                            {
                                class: "bg-gray-50 rounded-lg p-6 mb-8 shadow-md",
                                id: "vulcanizer-plan-container",
                                $h2: {
                                    class: "text-2xl font-semibold text-gray-800 mb-4",
                                    text: "Planning Section"
                                },
                                $div: [
                                    {
                                        class: "overflow-x-auto rounded-lg",
                                        id: "vulcanizerPlanTableDiv",
                                        ...hx._components.VulcanizerTable()
                                    },
                                    {
                                        class: "flex justify-end mt-4 space-x-2",
                                        $button: [
                                            {
                                                class: "bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors",
                                                text: "Add Vulcanizer",
                                                onclick: handlers.addVulcanizer
                                            },
                                            {
                                                class: "bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors",
                                                text: "Save",
                                                onclick: dataManager.saveVulcanizerData
                                            }
                                        ]
                                    }
                                ]
                            },
                            // Part-wise Plan
                            {
                                class: "bg-gray-50 rounded-lg p-6 mb-8 shadow-md",
                                id: "partwise-plan-container",
                                $h2: {
                                    class: "text-xl font-semibold text-gray-800 mb-4",
                                    text: "Part-wise Plan"
                                },
                                $div: [
                                    {
                                        class: "flex justify-end mb-4 space-x-2",
                                        $button: [
                                            {
                                                class: "bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors",
                                                text: "Add Part",
                                                onclick: handlers.addPart
                                            },
                                            {
                                                class: "bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors",
                                                text: "Flip Odd/Even",
                                                onclick: handlers.flipOddEven
                                            },
                                            {
                                                class: "bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors",
                                                text: "Export",
                                                onclick: () => utils.exportTableToCSV('partwiseTable', 'partwise_plan.csv')
                                            }
                                        ]
                                    },
                                    {
                                        class: "overflow-x-auto rounded-lg",
                                        id: "partwiseTableDiv",
                                        ...hx._components.PartwiseTable()
                                    }
                                ]
                            }
                        ]
                    },
                    // Right Panel
                    {
                        class: "w-full md:w-3/4",
                        $div: {
                            class: "bg-gray-50 rounded-lg p-6 mb-8 shadow-md",
                            id: "cyclewise-plan-container",
                            $h2: {
                                class: "text-2xl font-semibold text-gray-800 mb-4",
                                text: "Production Section"
                            },
                            $div: [
                                {
                                    class: "overflow-x-auto rounded-lg",
                                    id: "cyclewiseTableDiv",
                                    ...hx._components.CyclewiseTable()
                                },
                                {
                                    class: "mt-4 flex justify-end space-x-2",
                                    id: "cyclewise-actions",
                                    $button: [
                                        {
                                            class: "bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors",
                                            text: "Fill Next Cycle",
                                            onclick: handlers.fillProductionTable
                                        },
                                        {
                                            class: "bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors",
                                            text: "Save Cycles",
                                            onclick: dataManager.saveCyclewiseData
                                        },
                                        {
                                            class: "bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors",
                                            text: "Export",
                                            onclick: () => utils.exportTableToCSV('cyclewiseTable', 'cyclewise_plan.csv')
                                        }
                                    ]
                                }
                            ]
                        }
                    }
                ]
            }
        }
    }
}));

// Render function
function renderApp() {
    hx.render(hx._components.App(), 'app', { replace: true });
}

// Initialize app
window.addEventListener('load', () => {
    dataManager.loadData();
    utils.checkStockForMinCycles(appState.selectedVulcanizer);
    renderApp();

    // Subscribe to state changes
    appState.subscribe(() => {
        renderApp();
    });
});