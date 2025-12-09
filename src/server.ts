import { fetchFredData } from "./fred";

Bun.serve({
    port: process.env.PORT || 3000,

    async fetch(request: Request) {
        const url = new URL(request.url);

        if (url.pathname === "/api/observations") {
            const series_id = url.searchParams.get("series_id");

            if (!series_id) {
                return new Response("Series_id is required", { status: 400 });
            }

            const data = await fetchFredData(series_id);

            return new Response(JSON.stringify(data), {
                headers: {
                    "Content-Type": "application/json"
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

console.log("Server running at http://localhost:3000");

