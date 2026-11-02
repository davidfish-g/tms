const apiKey = process.env.FRED_API_KEY;

// Every series the frontend requests; anything else is rejected so the API key can't be used as an open proxy
export const SERIES_IDS = [
    "CURRNS", "DEMDEPNS", "MDLNM", "SAVINGNS", "OCDNS", "WTREGEN", "GDBFRW",
    "BOGZ1FL763123005Q", "WDFOL", "DDDFOINS", "DDDFCBNS",
    "M1NS", "M2NS", "CPIAUCNS", "GDP", "GDPC1"
];

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

type CacheEntry = { json: string; gzip: Uint8Array };

const cache = new Map<string, CacheEntry>();

async function loadSeries(seriesId: string): Promise<CacheEntry | undefined> {
    try {
        console.log(`Fetching ${seriesId} from FRED API...`);
        const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=1959-01-01`);

        if (!response.ok) {
            throw new Error(`Failed to fetch ${seriesId}: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { observations: { date: string; value: string }[] };

        // Keep only what the frontend uses; the realtime_* fields more than double the payload
        const json = JSON.stringify({
            observations: data.observations.map(({ date, value }) => ({ date, value }))
        });
        const entry = { json, gzip: Bun.gzipSync(json) };

        cache.set(seriesId, entry);
        return entry;

    } catch (error) {
        // On failure the previous cached copy (if any) keeps being served
        console.error(error);
    }
}

export async function fetchFredData(seriesId: string) {
    return cache.get(seriesId) ?? loadSeries(seriesId);
}

// Fetch everything at startup and refresh on a timer so visitors never wait on FRED
export function startCacheRefresh() {
    const refreshAll = () => Promise.all(SERIES_IDS.map(loadSeries));
    refreshAll();
    setInterval(refreshAll, REFRESH_INTERVAL);
}
