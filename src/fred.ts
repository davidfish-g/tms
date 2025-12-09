const apiKey = process.env.FRED_API_KEY;

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

export async function fetchFredData(seriesId: string) {
    const cached = cache.get(seriesId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Cache hit for ${seriesId}`);
        return cached.data;
    }

    try {
        console.log(`Fetching ${seriesId} from FRED API...`);
        const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        cache.set(seriesId, { data, timestamp: Date.now() });
        
        return data;

    } catch (error) {
        console.error(error);
    }
}

