/**
 * Postbuild script: inject CF Cache API into OpenNext worker.js
 * Caches GET 200 responses for content pages (1 year).
 * Skips sitemap, _next, api, and non-200 responses.
 */
import { readFileSync, writeFileSync } from "fs";

const WORKER_PATH = ".open-next/worker.js";
const worker = readFileSync(WORKER_PATH, "utf-8");

// 1. Cache helpers
const cacheHelpers = `
            // --- CF Cache API ---
            function shouldCache(url) {
                const p = new URL(url).pathname;
                if (p.startsWith("/sitemap/") || p.startsWith("/_next/") || p.startsWith("/api/")) return false;
                if (/\\.[a-z]{2,5}$/.test(p) && !p.endsWith(".html")) return false;
                return true;
            }
            async function cacheGet(url) {
                try {
                    const key = new Request(url, { method: "GET", headers: {} });
                    const hit = await caches.default.match(key);
                    if (hit) {
                        const r = new Response(hit.body, hit);
                        r.headers.set("x-cache", "HIT");
                        return r;
                    }
                } catch(e) {}
                return null;
            }
            async function cachePut(url, resp) {
                if (resp.status !== 200) {
                    resp.headers.set("x-cache", "SKIP-" + resp.status);
                    return resp;
                }
                try {
                    const body = await resp.arrayBuffer();
                    const key = new Request(url, { method: "GET", headers: {} });
                    const h = new Headers(resp.headers);
                    h.delete("vary");
                    h.set("cache-control", "public, max-age=31536000, s-maxage=31536000");
                    await caches.default.put(key, new Response(body, { status: 200, headers: h }));
                    const rh = new Headers(resp.headers);
                    rh.set("cache-control", "public, max-age=31536000, s-maxage=31536000");
                    rh.set("x-cache", "MISS");
                    return new Response(body, { status: 200, headers: rh });
                } catch(e) {
                    resp.headers.set("x-cache", "ERR");
                    return resp;
                }
            }`;

// Inject after skew protection check
let patched = worker.replace(
    "const url = new URL(request.url);",
    cacheHelpers + "\n            const url = new URL(request.url);"
);

// 2. Cache lookup before middleware
const lastHelperLine = cacheHelpers.split("\n").pop().trim();
patched = patched.replace(
    lastHelperLine + "\n            const url = new URL(request.url);",
    lastHelperLine + `
            if (request.method === "GET" && shouldCache(request.url)) {
                const hit = await cacheGet(request.url);
                if (hit) return hit;
            }
            const url = new URL(request.url);`
);

// 3. Intercept middleware Response return
patched = patched.replace(
    `            if (reqOrResp instanceof Response) {
                return reqOrResp;
            }`,
    `            if (reqOrResp instanceof Response) {
                if (request.method === "GET" && shouldCache(request.url)) {
                    return await cachePut(request.url, reqOrResp);
                }
                return reqOrResp;
            }`
);

// 4. Intercept handler return
patched = patched.replace(
    `            return handler(reqOrResp, env, ctx, request.signal);`,
    `            const resp = await handler(reqOrResp, env, ctx, request.signal);
            if (request.method === "GET" && shouldCache(request.url)) {
                return await cachePut(request.url, resp);
            }
            return resp;`
);


// 7. Block /_next/image at Worker entry — unoptimized: true means this route should never be hit
patched = patched.replace(
    `            const url = new URL(request.url);`,
    `            const url = new URL(request.url);
            if (url.pathname === "/_next/image") {
                return new Response("Not Found", {
                    status: 404,
                    headers: { "Cache-Control": "public, max-age=86400" }
                });
            }`
);

writeFileSync(WORKER_PATH, patched);
console.log("✓ Injected CF Cache API (URL+status-based, middleware+handler)");
