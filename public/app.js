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

async function fetchData() {
    const responses = await Promise.all(
        SERIES_IDS.map(id => fetch(`/api/observations?series_id=${id}`))
    );
    
    const data = await Promise.all(
        responses.map(response => response.json())
    );
    return data;
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

    return { dates, values }
}

function renderChart(dates, values) {
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

    // Convert dates to timestamps and pair with values for Highcharts
    const series = values.map((seriesValues, index) => ({
        name: seriesNames[index],
        data: dates.map((date, i) => [
            Date.UTC(
                parseInt(date.slice(0, 4)),
                parseInt(date.slice(5, 7)) - 1,
                1
            ),
            seriesValues[i]
        ]),
        color: colors[index],
        fillOpacity: 0.7
    }));

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
                let rows = "";
                
                // Iterate in reverse to show top of stack first
                for (let i = this.points.length - 1; i >= 0; i--) {
                    const point = this.points[i];
                    total += point.y;
                    rows += `<tr>
                        <td><span style="color:${point.color}">●</span> ${point.series.name}:</td>
                        <td style="text-align:right;padding-left:8px;font-weight:500">$${Highcharts.numberFormat(point.y, 1)} B</td>
                    </tr>`;
                }
                
                return `<div style="font-size:13px">
                    <div style="font-weight:600;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px">${date}</div>
                    <table style="margin-bottom:6px">${rows}</table>
                    <div style="font-weight:700;border-top:1px solid #1a4d2e;padding-top:6px;color:#1a4d2e">
                        Total TMS: $${Highcharts.numberFormat(total, 1)} B
                    </div>
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

async function main() {
    const data = await fetchData();
    const { dates, values } = transformData(data);
    renderChart(dates, values);
}

main();