async function fetchData() {
    const series_ids = ["CURRSL", "DEMDEPSL", "MDLM", "WTREGEN", "D2WLFOL"];

    const responses = await Promise.all(
        series_ids.map(id => fetch(`/api/observations?series_id=${id}`))
    );
    
    const data = await Promise.all(
        responses.map(response => response.json())
    );
    return data;
}

function transformData(fredData) {

    const series_ids = ["CURRSL", "DEMDEPSL", "MDLM", "WTREGEN", "D2WLFOL"];
    
    // FRED shows these series in millions, need to convert to billions
    const millionSeries = ["WTREGEN", "D2WLFOL"];

    // Harcoded CURRSL which is at index 0 for the dates cause it's the longest
    const dates = fredData[0].observations.map(obs => obs.date);

    const series = fredData.map((data, index) => {
        const lookup = new Map();
        const needsConversion = millionSeries.includes(series_ids[index]);

        data.observations.forEach(obs => {
            let value = parseFloat(obs.value);
            
            if (needsConversion) {
                value = value / 1000;
            }
            
            lookup.set(obs.date, value);
        });
        return lookup;
    });

    const values = series.map(lookup => {
        return dates.map(date => {
            return lookup.get(date) ?? null;
        });
    });

    return { dates, values }
}

function renderChart(dates, values) {
    const ctx = document.getElementById("chart");

    const seriesNames = [
        "Currency in Circulation",
        "Demand Deposits",
        "Retail Money Funds",
        "Treasury General Account",
        "Other Deposits"
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
        stack: "stack1"
    }));
    
    new Chart(ctx, {
        type: "line",
        data: {
            labels: dates,
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