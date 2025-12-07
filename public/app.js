async function fetchData() {

    const series_ids = ["CURRNS", "DEMDEPNS", "MDLM", "SAVINGNS", "OCDNS", "WTREGEN", "D2WLFOL"];

    const responses = await Promise.all(
        series_ids.map(id => fetch(`/api/observations?series_id=${id}`))
    );
    
    const data = await Promise.all(
        responses.map(response => response.json())
    );
    return data;
}

function transformData(fredData) {

    const series_ids = ["CURRNS", "DEMDEPNS", "MDLM", "SAVINGNS", "OCDNS", "WTREGEN", "D2WLFOL"];
    
    // FRED shows these series in millions, need to convert to billions
    const millionSeries = ["WTREGEN", "D2WLFOL"];

    // Hardcoded CURRNS which is at index 0 for the dates cause it's the longest
    const dates = fredData[0].observations
        .map(obs => obs.date.slice(0, 7))
        .filter(date => date >= "1959-01");


    const seriesLookups = fredData.map((data, index) => {
        const lookup = new Map();
        const needsConversion = millionSeries.includes(series_ids[index]);

        data.observations.forEach(obs => {
            let value = parseFloat(obs.value);
            
            if (needsConversion) {
                value = value / 1000;
            }
            
            // Use year-month as key to handle different date frequencies
            const yearMonth = obs.date.slice(0, 7);
            lookup.set(yearMonth, value);
        });
        return lookup;
    });

    const CURRNSLookup = seriesLookups[0];
    const DEMDEPNSLookup = seriesLookups[1];
    const mdlmLookup = seriesLookups[2];
    const SAVINGNSLookup = seriesLookups[3];
    const OCDNSLookup = seriesLookups[4];
    const wtregenLookup = seriesLookups[5];
    const d2wlfolLookup = seriesLookups[6];

    const values = [
        // Currency in Circulation
        dates.map(date => CURRNSLookup.get(date) ?? 0),
        // Demand Deposits
        dates.map(date => DEMDEPNSLookup.get(date) ?? 0),
        // Liquid Deposits (MDLM + SAVINGNS + OCDNS combined)
        dates.map(date => {
            const mdlm = mdlmLookup.get(date) ?? 0;
            const savings = SAVINGNSLookup.get(date) ?? 0;
            const ocd = OCDNSLookup.get(date) ?? 0;
            return mdlm + savings + ocd;
        }),
        // US Gov Deposits
        dates.map(date => wtregenLookup.get(date) ?? 0),
        // Foreign Deposits
        dates.map(date => d2wlfolLookup.get(date) ?? 0)
    ];

    return { dates, values }
}

function renderChart(dates, values) {
    const ctx = document.getElementById("chart");

    const seriesNames = [
        "Currency in Circulation",
        "Demand Deposits",
        "Liquid Deposits",
        "US Gov Deposits",
        "Foreign Deposits"
    ];
    
    const colors = [
        "rgba(75, 192, 192, 0.7)",
        "rgba(255, 99, 132, 0.7)",
        "rgba(255, 205, 86, 0.7)",
        "rgba(54, 162, 235, 0.7)",
        "rgba(153, 102, 255, 0.7)"
    ];

    const datasets = values.map((values, index) => ({
        label: seriesNames[index],
        data: values,
        borderColor: colors[index],
        backgroundColor: colors[index],
        fill: true,
        stack: "stack1",
        spanGaps: true
    }));
    
    const yearLabels = dates.map(date => date.slice(0, 4));

    new Chart(ctx, {
        type: "line",
        data: {
            labels: yearLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: "Date" }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: "Billions $" }
                }
            },
            plugins: {
                tooltip: {
                    mode: "index"
                }
            }
        }
    });
}

async function main() {
    const data = await fetchData();
    const { dates, values } = transformData(data);
    renderChart(dates, values);
}

main();