const SERIES_CONFIG = {
    CURRNS:   { convertFromMillions: false },
    DEMDEPNS: { convertFromMillions: false },
    MDLM:     { convertFromMillions: false },
    SAVINGNS: { convertFromMillions: false },
    OCDNS:    { convertFromMillions: false },
    WTREGEN:  { convertFromMillions: true },
    D2WLFOL:  { convertFromMillions: true }
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
    // Hardcoded CURRNS which is at index 0 for the dates cause it's the longest
    const dates = fredData[0].observations
        .map(obs => obs.date.slice(0, 7))
        .filter(date => date >= "1959-01");

    const lookups = {};
    SERIES_IDS.forEach((id, index) => {
        const lookup = new Map();
        const needsConversion = SERIES_CONFIG[id].convertFromMillions;

        fredData[index].observations.forEach(obs => {
            let value = parseFloat(obs.value);
            
            if (needsConversion) {
                value = value / 1000;
            }
            
            const yearMonth = obs.date.slice(0, 7);
            lookup.set(yearMonth, value);
        });
        lookups[id] = lookup;
    });

    const values = [
        dates.map(date => lookups.CURRNS.get(date) ?? 0),
        dates.map(date => lookups.DEMDEPNS.get(date) ?? 0),
        // Liquid Deposits: Use MDLM when available (May 2020+), otherwise SAVINGNS + OCDNS
        dates.map(date => {
            const mdlm = lookups.MDLM.get(date);
            if (mdlm !== undefined) {
                return mdlm;
            }
            const savings = lookups.SAVINGNS.get(date) ?? 0;
            const ocd = lookups.OCDNS.get(date) ?? 0;
            return savings + ocd;
        }),
        dates.map(date => lookups.WTREGEN.get(date) ?? 0),
        dates.map(date => lookups.D2WLFOL.get(date) ?? 0)
    ];

    return { dates, values }
}

function renderChart(dates, values) {
    const seriesNames = [
        "Currency",
        "Demand Deposits",
        "Liquid Deposits",
        "U.S. Gov. Deposits",
        "Foreign Deposits"
    ];
    
    const colors = [
        "#4BC0C0",
        "#FF6384",
        "#FFCD56",
        "#36A2EB",
        "#9966FF"
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
            resetZoomButton: {
                theme: {
                    fill: "#fff",
                    stroke: "#999",
                    r: 4,
                    style: {
                        fontSize: "12px"
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
        // subtitle: {
        //     text: "click and drag to zoom"
        // },
        legend: {
            enabled: true,
            align: "center",
            verticalAlign: "top",
            layout: "horizontal"
        },
        rangeSelector: {
            enabled: false
        },
        xAxis: {
            type: "datetime"
        },
        yAxis: {
            opposite: false,
            title: {
                text: "Billions $"
            },
            labels: {
                formatter: function() {
                    return "$" + Highcharts.numberFormat(this.value, 0, ".", ",");
                }
            }
        },
        tooltip: {
            shared: true,
            split: false,
            valuePrefix: "$",
            valueSuffix: " B",
            valueDecimals: 1
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
        }
    });
}

async function main() {
    const data = await fetchData();
    const { dates, values } = transformData(data);
    renderChart(dates, values);
}

main();