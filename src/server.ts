import { fetchFredData, startCacheRefresh, SERIES_IDS } from "./fred";

const port = process.env.PORT || 3000;

const highstock = await Bun.file("node_modules/highcharts/highstock.js").text();
const highstockGzip = Bun.gzipSync(highstock);

function acceptsGzip(request: Request) {
    return (request.headers.get("Accept-Encoding") || "").includes("gzip");
}

startCacheRefresh();

Bun.serve({
    port,

    async fetch(request: Request) {
        const url = new URL(request.url);

        if (url.pathname === "/api/observations") {
            const series_id = url.searchParams.get("series_id");

            if (!series_id || !SERIES_IDS.includes(series_id)) {
                return new Response("Valid series_id is required", { status: 400 });
            }

            const data = await fetchFredData(series_id);

            if (!data) {
                return new Response("Failed to fetch data from FRED", { status: 502 });
            }

            const gzip = acceptsGzip(request);
            return new Response(gzip ? data.gzip : data.json, {
                headers: {
                    "Content-Type": "application/json",
                    ...(gzip && { "Content-Encoding": "gzip" })
                }
            });
        }

        if (url.pathname === "/lib/highstock.js") {
            const gzip = acceptsGzip(request);
            return new Response(gzip ? highstockGzip : highstock, {
                headers: {
                    "Content-Type": "text/javascript",
                    "Cache-Control": "public, max-age=86400",
                    ...(gzip && { "Content-Encoding": "gzip" })
                }
            });
        }

        if (url.pathname === "/") {
            return new Response(Bun.file("public/index.html"));
        }

        const file = Bun.file(`public${url.pathname}`);
            if (await file.exists()) {
                return new Response(file);
        }

        return new Response("Not found", { status: 404 });
    }
});

console.log(`Server running at http://localhost:${port}`);
