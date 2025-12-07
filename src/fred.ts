const apiKey = process.env.FRED_API_KEY;

export async function fetchFredData(seriesId: string) {
    try {
        const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        
            const data = await response.json();
            return data;

    } catch (error) {
        console.error(error);
    }
}

