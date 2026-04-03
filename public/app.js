const SERIES_CONFIG = {
    CURRNS:           { convertFromMillions: false },
    DEMDEPNS:         { convertFromMillions: false },
    MDLNM:            { convertFromMillions: false },
    SAVINGNS:         { convertFromMillions: false },
    OCDNS:            { convertFromMillions: false },
    WTREGEN:          { convertFromMillions: true },
    GDBFRW:           { convertFromMillions: true },
    BOGZ1FL763123005Q: { convertFromMillions: true },
    WDFOL:            { convertFromMillions: true },
    DDDFOINS:         { convertFromMillions: false },
    DDDFCBNS:         { convertFromMillions: false }
};

const SERIES_IDS = Object.keys(SERIES_CONFIG);

const OVERLAY_SERIES = ["M1NS", "M2NS"];
const CPI_SERIES = "CPIAUCNS";
const MVPY_SERIES = ["GDP", "GDPC1"];

async function fetchData() {
    const allIds = [...SERIES_IDS, ...OVERLAY_SERIES, CPI_SERIES, ...MVPY_SERIES];
    const responses = await Promise.all(
        allIds.map(id => fetch(`/api/observations?series_id=${id}`))
    );

    const data = await Promise.all(
        responses.map(response => response.json())
    );
    const tmsEnd = SERIES_IDS.length;
    const overlayEnd = tmsEnd + OVERLAY_SERIES.length;
    const cpiIdx = overlayEnd;
    return {
        tmsData: data.slice(0, tmsEnd),
        overlayData: data.slice(tmsEnd, overlayEnd),
        cpiData: data[cpiIdx],
        gdpData: data[cpiIdx + 1],
        rgdpData: data[cpiIdx + 2]
    };
}

function transformData(fredData) {
    // Hardcoded CURRNS which is at index 0 for the dates starting in 1959
    const dates = fredData[0].observations
        .map(obs => obs.date.slice(0, 7))
        .filter(date => date >= "1959-01");

    const lookups = {};
    SERIES_IDS.forEach((id, index) => {
        const lookup = new Map();
        const needsConversion = SERIES_CONFIG[id].convertFromMillions;

        fredData[index].observations.forEach(obs => {
            let value = parseFloat(obs.value);
            
            // Skip missing/invalid data (FRED uses "." for missing values)
            if (isNaN(value)) {
                return;
            }
            
            if (needsConversion) {
                value = value / 1000;
            }
            
            // For GDBFRW, only use data before WTREGEN starts
            if (id === "GDBFRW" && obs.date > "2002-12-18") {
                return;
            }
            
            const yearMonth = obs.date.slice(0, 7);
            lookup.set(yearMonth, value);
        });
        lookups[id] = lookup;
    });

    // Forward-fill quarterly series to monthly
    const quarterlySeries = ["BOGZ1FL763123005Q"];
    quarterlySeries.forEach(id => {
        const lookup = lookups[id];
        let lastValue = 0;
        dates.forEach(date => {
            if (lookup.has(date)) {
                lastValue = lookup.get(date);
            } else {
                lookup.set(date, lastValue);
            }
        });
    });

    const values = [
        // 1. Currency
        dates.map(date => lookups.CURRNS.get(date) || 0),
        
        // 2. Demand Deposits
        dates.map(date => lookups.DEMDEPNS.get(date) || 0),
        
        // 3. Other Liquid Deposits
        dates.map(date => {
            // Other Liquid Deposits: MDLNM (May 2020+) or SAVINGNS + OCDNS
            const mdlnm = lookups.MDLNM.get(date);
            return mdlnm !== undefined
                ? mdlnm 
                : (lookups.SAVINGNS.get(date) || 0) + (lookups.OCDNS.get(date) || 0);
        }),
        
        // 4. U.S. Gov. Deposits = FED (GDBFRW pre-2002 / WTREGEN 2002+) + Commercial Banks
        dates.map(date => {
            const fedDeposits = lookups.WTREGEN.get(date) || lookups.GDBFRW.get(date) || 0;
            const bankDeposits = lookups.BOGZ1FL763123005Q.get(date) || 0;
            return fedDeposits + bankDeposits;
        }),
        
        // 5. Foreign Deposits = FED + Commercial Banks (DDDFOINS + DDDFCBNS)
        dates.map(date => {
            const fedDeposits = lookups.WDFOL.get(date) || 0;
            const bankDeposits = (lookups.DDDFOINS.get(date) || 0) + (lookups.DDDFCBNS.get(date) || 0);
            return fedDeposits + bankDeposits;
        })
    ];

    return { dates, values };
}

function transformOverlayData(overlayData, dates) {
    return OVERLAY_SERIES.map((id, index) => {
        const lookup = new Map();
        overlayData[index].observations.forEach(obs => {
            const value = parseFloat(obs.value);
            if (!isNaN(value)) {
                lookup.set(obs.date.slice(0, 7), value);
            }
        });
        return dates.map(date => lookup.get(date) || null);
    });
}

function renderChart(dates, values, overlayValues) {
    const seriesNames = [
        "Currency",
        "Demand Deposits",
        "Other Liquid Deposits",
        "U.S. Gov. Deposits",
        "Foreign Deposits"
    ];
    
    const colors = [
        "#0d2818",  // Deep forest green (Currency - bottom)
        "#1a4d2e",  // Forest green (Demand Deposits)
        "#40916c",  // Emerald (Liquid Deposits)
        "#74c69d",  // Mint green (U.S. Gov. Deposits)
        "#d4a017"   // Rich gold (Foreign Deposits - top)
    ];

    const overlayNames = ["M1", "M2"];
    const overlayColors = ["#b33000", "#6a1b9a"];

    // Convert dates to timestamps
    const timestamps = dates.map(date => Date.UTC(
        parseInt(date.slice(0, 4)),
        parseInt(date.slice(5, 7)) - 1,
        1
    ));

    // TMS component area series
    const series = values.map((seriesValues, index) => ({
        name: seriesNames[index],
        data: timestamps.map((ts, i) => [ts, seriesValues[i]]),
        color: colors[index],
        fillOpacity: 0.7
    }));

    // M1/M2 overlay line series (M2 visible by default, M1 hidden)
    overlayValues.forEach((seriesValues, index) => {
        series.push({
            type: "line",
            name: overlayNames[index],
            data: timestamps.map((ts, i) => [ts, seriesValues[i]]),
            color: overlayColors[index],
            lineWidth: 2,
            dashStyle: "Dash",
            visible: index === 1,
            stacking: undefined,
            fillOpacity: 0,
            marker: { enabled: false },
            legendSymbol: "rectangle"
        });
    });

    Highcharts.stockChart("chart", {
        chart: {
            type: "area",
            zoomType: "x",
            backgroundColor: "transparent",
            resetZoomButton: {
                theme: {
                    fill: "rgba(255,255,255,0.8)",
                    stroke: "#1a4d2e",
                    r: 4,
                    style: {
                        fontSize: "12px",
                        color: "#1a4d2e"
                    }
                },
                position: {
                    align: "right",
                    x: -10,
                    y: 10
                }
            }
        },
        title: {
            text: null
        },
        subtitle: {
            text: "Click and Drag to Zoom",
            align: "right",
            y: 48,
            style: {
                fontSize: "12px",
                color: "#888"
            }
        },
        legend: {
            enabled: true,
            align: "center",
            verticalAlign: "top",
            layout: "horizontal",
            itemStyle: {
                fontWeight: "600",
                color: "#333"
            }
        },
        responsive: {
            rules: [{
                condition: {
                    maxWidth: 1050
                },
                chartOptions: {
                    subtitle: {
                        text: null
                    }
                }
            }, {
                condition: {
                    maxWidth: 600
                },
                chartOptions: {
                    legend: {
                        itemStyle: {
                            fontSize: "10px"
                        },
                        itemDistance: 8
                    },
                    yAxis: {
                        labels: {
                            formatter: function() {
                                // Compact format: 20k instead of 20,000
                                if (this.value >= 1000) {
                                    return (this.value / 1000) + "k";
                                }
                                return this.value;
                            }
                        }
                    }
                }
            }]
        },
        rangeSelector: {
            enabled: false
        },
        xAxis: {
            type: "datetime",
            gridLineWidth: 0,
            lineColor: "rgba(0, 0, 0, 0.1)",
            tickColor: "rgba(0, 0, 0, 0.2)",
            labels: {
                style: {
                    fontWeight: "500",
                    color: "#555"
                }
            },
            events: {
                afterSetExtremes: function(e) {
                    const chart = this.chart;
                    const dataMin = this.dataMin;
                    const dataMax = this.dataMax;
                    const isFullRange = e.min <= dataMin && e.max >= dataMax;
                    if (!isFullRange && !chart.resetZoomButton) {
                        chart.showResetZoom();
                    }
                }
            }
        },
        yAxis: {
            opposite: false,
            title: {
                text: "Billions $",
                style: {
                    fontWeight: "600",
                    color: "#444"
                }
            },
            gridLineColor: "rgba(0, 0, 0, 0.06)",
            lineColor: "rgba(0, 0, 0, 0.1)",
            tickColor: "rgba(0, 0, 0, 0.2)",
            labels: {
                formatter: function() {
                    return Highcharts.numberFormat(this.value, 0, ".", ",");
                },
                style: {
                    fontWeight: "500",
                    color: "#555"
                }
            }
        },
        tooltip: {
            shared: true,
            split: false,
            useHTML: true,
            formatter: function() {
                const date = Highcharts.dateFormat("%B %Y", this.x);
                let total = 0;
                let tmsRows = "";
                let overlayRows = "";

                for (let i = this.points.length - 1; i >= 0; i--) {
                    const point = this.points[i];
                    const isOverlay = point.series.options.type === "line";
                    const row = `<tr>
                        <td><span style="color:${point.color}">●</span> ${point.series.name}:</td>
                        <td style="text-align:right;padding-left:8px;font-weight:500">$${Highcharts.numberFormat(point.y, 1)} B</td>
                    </tr>`;
                    if (isOverlay) {
                        overlayRows += row;
                    } else {
                        total += point.y;
                        tmsRows += row;
                    }
                }

                return `<div style="font-size:13px">
                    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px">${date}</div>
                    <table style="margin-bottom:6px">${tmsRows}</table>
                    <div style="font-weight:700;border-top:1px solid #1a4d2e;padding-top:6px;color:#1a4d2e">
                        Total TMS: $${Highcharts.numberFormat(total, 1)} B
                    </div>
                    ${overlayRows ? `<table style="margin-top:6px;border-top:1px solid #ddd;padding-top:4px">${overlayRows}</table>` : ""}
                </div>`;
            }
        },
        plotOptions: {
            area: {
                stacking: "normal",
                lineWidth: 1,
                marker: {
                    enabled: false
                }
            }
        },
        series: series,
        navigator: {
            enabled: false
        },
        scrollbar: {
            enabled: false
        },
        credits: {
            enabled: false
        },
        accessibility: {
            enabled: false
        },
        exporting: {
            enabled: false
        }
    });
}

function buildQuarterlyData(dates, tmsValues, m2Data, gdpData, rgdpData, cpiData) {
    const monthlyTMS = dates.map((_, i) =>
        tmsValues.reduce((sum, s) => sum + s[i], 0)
    );

    const dateIdx = new Map();
    dates.forEach((d, i) => dateIdx.set(d, i));

    const m2Lookup = new Map();
    m2Data.observations.forEach(obs => {
        const v = parseFloat(obs.value);
        if (!isNaN(v)) m2Lookup.set(obs.date.slice(0, 7), v);
    });

    const cpiLookup = new Map();
    cpiData.observations.forEach(obs => {
        const v = parseFloat(obs.value);
        if (!isNaN(v)) cpiLookup.set(obs.date.slice(0, 7), v);
    });

    const gdpLookup = new Map();
    gdpData.observations.forEach(obs => {
        const v = parseFloat(obs.value);
        if (!isNaN(v)) gdpLookup.set(obs.date.slice(0, 7), v);
    });

    const rgdpLookup = new Map();
    rgdpData.observations.forEach(obs => {
        const v = parseFloat(obs.value);
        if (!isNaN(v)) rgdpLookup.set(obs.date.slice(0, 7), v);
    });

    const qMonths = {
        "01": ["01", "02", "03"],
        "04": ["04", "05", "06"],
        "07": ["07", "08", "09"],
        "10": ["10", "11", "12"]
    };

    const quarters = gdpData.observations
        .map(obs => obs.date.slice(0, 7))
        .filter(q => q >= "1959-01");

    const result = [];
    quarters.forEach(q => {
        const year = q.slice(0, 4);
        const qm = q.slice(5, 7);
        const months = qMonths[qm];
        if (!months) return;

        let tmsSum = 0, tmsN = 0, m2Sum = 0, m2N = 0, cpiSum = 0, cpiN = 0;
        months.forEach(m => {
            const key = year + "-" + m;
            const ti = dateIdx.get(key);
            if (ti !== undefined) { tmsSum += monthlyTMS[ti]; tmsN++; }
            const mv = m2Lookup.get(key);
            if (mv !== undefined) { m2Sum += mv; m2N++; }
            const cv = cpiLookup.get(key);
            if (cv !== undefined) { cpiSum += cv; cpiN++; }
        });

        const ngdp = gdpLookup.get(q);
        const rgdp = rgdpLookup.get(q);
        if (!tmsN || !m2N || !cpiN || !ngdp || !rgdp) return;

        result.push({
            quarter: q,
            ts: Date.UTC(parseInt(year), parseInt(qm) - 1, 1),
            tms: tmsSum / tmsN,
            m2: m2Sum / m2N,
            cpi: cpiSum / cpiN,
            ngdp,
            rgdp
        });
    });

    return result;
}

function getDecomposition(qData, source) {
    const results = [];
    for (let i = 4; i < qData.length; i++) {
        const c = qData[i], p = qData[i - 4];
        const m = source === "tms" ? c.tms : c.m2;
        const mP = source === "tms" ? p.tms : p.m2;

        const mGrowth = (m / mP - 1) * 100;
        const ngdpGrowth = (c.ngdp / p.ngdp - 1) * 100;
        const rgdpGrowth = (c.rgdp / p.rgdp - 1) * 100;
        const cpiGrowth = (c.cpi / p.cpi - 1) * 100;

        // MV = PQ decomposition: %ΔM = %ΔQ + %ΔP + (-%ΔV)
        results.push({
            ts: c.ts,
            moneyGrowth: mGrowth,
            rgdpGrowth: rgdpGrowth,                   // %ΔQ — absorbed by real growth
            velocityAbsorption: mGrowth - ngdpGrowth,  // -%ΔV — absorbed by velocity decline
            inflation: ngdpGrowth - rgdpGrowth,         // %ΔP — GDP deflator (what's left)
            cpiGrowth: cpiGrowth                        // actual CPI for comparison
        });
    }
    return results;
}

function getPriceLevels(qData) {
    const b = qData[0];
    // Without money growth (M constant, V constant): P ∝ 1/Q
    return qData.map(d => ({
        ts: d.ts,
        actual: d.cpi,
        counterfactual: b.cpi * (b.rgdp / d.rgdp)
    }));
}

function renderAnalysisSection(dates, tmsValues, m2Data, gdpData, rgdpData, cpiData) {
    const qData = buildQuarterlyData(dates, tmsValues, m2Data, gdpData, rgdpData, cpiData);
    let source = "tms";
    let decompChart = null;
    let priceChart = null;

    function pctTooltip() {
        return {
            shared: true,
            useHTML: true,
            formatter: function() {
                const date = Highcharts.dateFormat("%B %Y", this.x);
                let rows = "";
                this.points.forEach(p => {
                    rows += `<tr>
                        <td><span style="color:${p.color}">\u25CF</span> ${p.series.name}:</td>
                        <td style="text-align:right;padding-left:8px;font-weight:500">${Highcharts.numberFormat(p.y, 1)}%</td>
                    </tr>`;
                });
                return `<div style="font-size:13px">
                    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px">${date}</div>
                    <table>${rows}</table>
                </div>`;
            }
        };
    }

    function updateDecomp() {
        const data = getDecomposition(qData, source);
        const toSeries = (key) => data.map(d => [d.ts, Math.round(d[key] * 100) / 100]);
        const moneyLabel = source === "tms" ? "TMS Growth" : "M2 Growth";

        if (decompChart) { decompChart.destroy(); decompChart = null; }

        decompChart = Highcharts.chart("growth-chart", {
            chart: { backgroundColor: "transparent", zoomType: "x" },
            title: { text: null },
            legend: {
                enabled: true,
                align: "center",
                verticalAlign: "top",
                layout: "horizontal",
                itemStyle: { fontWeight: "600", color: "#333" }
            },
            xAxis: {
                type: "datetime",
                gridLineWidth: 0,
                lineColor: "rgba(0,0,0,0.1)",
                labels: { style: { fontWeight: "500", color: "#555" } },
                events: {
                    afterSetExtremes: function(e) {
                        const chart = this.chart;
                        const isFullRange = e.min <= this.dataMin && e.max >= this.dataMax;
                        if (!isFullRange && !chart.resetZoomButton) {
                            chart.showResetZoom();
                        }
                    }
                }
            },
            yAxis: {
                title: { text: "YoY % Change", style: { fontWeight: "600", color: "#444" } },
                labels: { format: "{value}%", style: { fontWeight: "500", color: "#555" } },
                gridLineColor: "rgba(0,0,0,0.06)",
                plotLines: [{ value: 0, color: "rgba(0,0,0,0.2)", width: 1 }]
            },
            tooltip: pctTooltip(),
            plotOptions: {
                column: { stacking: "normal", borderWidth: 0, pointPadding: 0, groupPadding: 0.05 },
                line: { marker: { enabled: false } }
            },
            series: [
                { type: "column", name: "Real GDP Growth", data: toSeries("rgdpGrowth"), color: "#40916c", stack: "decomp" },
                { type: "column", name: "Velocity Absorption", data: toSeries("velocityAbsorption"), color: "#5c6bc0", stack: "decomp" },
                { type: "column", name: "Inflation", data: toSeries("inflation"), color: "#e65100", stack: "decomp" },
                { type: "line", name: moneyLabel, data: toSeries("moneyGrowth"), color: "#1a4d2e", lineWidth: 2, zIndex: 5 }
            ],
            credits: { enabled: false },
            accessibility: { enabled: false },
            exporting: { enabled: false }
        });
    }

    // Price level chart with ratio annotation
    const priceData = getPriceLevels(qData);
    const actualSeries = priceData.map(d => [d.ts, Math.round(d.actual * 100) / 100]);
    const counterSeries = priceData.map(d => [d.ts, Math.round(d.counterfactual * 100) / 100]);

    function drawRatioAnnotation(chart) {
        // Remove previous annotation if any
        if (chart.ratioGroup) { chart.ratioGroup.destroy(); chart.ratioGroup = null; }

        const xAxis = chart.xAxis[0];
        const yAxis = chart.yAxis[0];
        const maxTs = xAxis.max;

        // Find the last data point within the visible range
        let last = null;
        for (let i = priceData.length - 1; i >= 0; i--) {
            if (priceData[i].ts <= maxTs) { last = priceData[i]; break; }
        }
        if (!last) return;

        const ratio = last.actual / last.counterfactual;
        const label = ratio >= 10 ? Math.round(ratio) + "x" : ratio.toFixed(1) + "x";

        const x = xAxis.toPixels(last.ts);
        const yTop = yAxis.toPixels(last.actual);
        const yBot = yAxis.toPixels(last.counterfactual);
        const yMid = (yTop + yBot) / 2;

        const group = chart.renderer.g("ratio-annotation").attr({ zIndex: 7 }).add();

        // Vertical line
        chart.renderer.path(["M", x, yTop, "L", x, yBot])
            .attr({ stroke: "#444", "stroke-width": 1.5, "stroke-dasharray": "4,3" })
            .add(group);

        // Arrow heads
        chart.renderer.path(["M", x - 4, yTop + 8, "L", x, yTop, "L", x + 4, yTop + 8])
            .attr({ stroke: "#444", "stroke-width": 1.5, fill: "none" })
            .add(group);
        chart.renderer.path(["M", x - 4, yBot - 8, "L", x, yBot, "L", x + 4, yBot - 8])
            .attr({ stroke: "#444", "stroke-width": 1.5, fill: "none" })
            .add(group);

        // Label — position to the left of the line so it doesn't clip at the edge
        const lbl = chart.renderer.label(label, 0, 0)
            .css({ fontSize: "13px", fontWeight: "700", color: "#444" })
            .attr({ zIndex: 8 })
            .add(group);
        const bbox = lbl.getBBox();
        lbl.attr({ x: x - bbox.width - 8, y: yMid - bbox.height / 2 });

        chart.ratioGroup = group;
    }

    priceChart = Highcharts.chart("cumulative-chart", {
        chart: {
            backgroundColor: "transparent",
            zoomType: "x",
            events: {
                load: function() { drawRatioAnnotation(this); },
                redraw: function() { drawRatioAnnotation(this); }
            }
        },
        title: { text: null },
        legend: {
            enabled: true,
            align: "center",
            verticalAlign: "top",
            layout: "horizontal",
            itemStyle: { fontWeight: "600", color: "#333" }
        },
        xAxis: {
            type: "datetime",
            gridLineWidth: 0,
            lineColor: "rgba(0,0,0,0.1)",
            labels: { style: { fontWeight: "500", color: "#555" } },
            events: {
                afterSetExtremes: function(e) {
                    const chart = this.chart;
                    const isFullRange = e.min <= this.dataMin && e.max >= this.dataMax;
                    if (!isFullRange && !chart.resetZoomButton) {
                        chart.showResetZoom();
                    }
                }
            }
        },
        yAxis: {
            type: "logarithmic",
            title: { text: "CPI", style: { fontWeight: "600", color: "#444" } },
            gridLineColor: "rgba(0,0,0,0.06)",
            labels: {
                formatter: function() {
                    return Highcharts.numberFormat(this.value, 0);
                },
                style: { fontWeight: "500", color: "#555" }
            }
        },
        tooltip: {
            shared: true,
            useHTML: true,
            formatter: function() {
                const date = Highcharts.dateFormat("%B %Y", this.x);
                let rows = "";
                this.points.forEach(p => {
                    rows += `<tr>
                        <td><span style="color:${p.color}">\u25CF</span> ${p.series.name}:</td>
                        <td style="text-align:right;padding-left:8px;font-weight:500">${Highcharts.numberFormat(p.y, 1)}</td>
                    </tr>`;
                });
                return `<div style="font-size:13px">
                    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px">${date}</div>
                    <table>${rows}</table>
                </div>`;
            }
        },
        plotOptions: {
            area: { marker: { enabled: false }, lineWidth: 2.5 },
        },
        series: [
            { type: "area", name: "Actual CPI", data: actualSeries, color: "#b33000", fillOpacity: 0.2 },
            { type: "area", name: "Without Money Creation", data: counterSeries, color: "#1a4d2e", fillOpacity: 0.2 }
        ],
        credits: { enabled: false },
        accessibility: { enabled: false },
        exporting: { enabled: false }
    });

    updateDecomp();

    document.querySelectorAll(".analysis-toggle-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".analysis-toggle-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            source = this.dataset.source;
            updateDecomp();
        });
    });
}

async function main() {
    const { tmsData, overlayData, cpiData, gdpData, rgdpData } = await fetchData();
    const { dates, values } = transformData(tmsData);
    const overlayValues = transformOverlayData(overlayData, dates);
    renderChart(dates, values, overlayValues);

    let analysisRendered = false;
    document.getElementById("show-analysis").addEventListener("click", function(e) {
        e.preventDefault();
        const section = document.querySelector(".analysis-section");
        section.classList.add("visible");
        this.style.display = "none";
        if (!analysisRendered) {
            analysisRendered = true;
            renderAnalysisSection(dates, values, overlayData[1], gdpData, rgdpData, cpiData);
        }
        section.scrollIntoView({ behavior: "smooth" });
    });
}

main();