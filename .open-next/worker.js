//@ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
//@ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "./middleware/handler.mjs";
//@ts-expect-error: Will be resolved by wrangler build
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
//@ts-expect-error: Will be resolved by wrangler build
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
//@ts-expect-error: Will be resolved by wrangler build
export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";
export default {
    async fetch(request, env, ctx) {
        return runWithCloudflareRequestContext(request, env, ctx, async () => {
            const response = maybeGetSkewProtectionResponse(request);
            if (response) {
                return response;
            }
            
            // --- CF Cache API ---
            function shouldCache(url) {
                const p = new URL(url).pathname;
                if (p.startsWith("/sitemap/") || p.startsWith("/_next/") || p.startsWith("/api/")) return false;
                if (/\.[a-z]{2,5}$/.test(p) && !p.endsWith(".html")) return false;
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
            }
            if (request.method === "GET" && shouldCache(request.url)) {
                const hit = await cacheGet(request.url);
                if (hit) return hit;
            }
            const url = new URL(request.url);
            // Serve images in development.
            // Note: "/cdn-cgi/image/..." requests do not reach production workers.
            if (url.pathname.startsWith("/cdn-cgi/image/")) {
                return handleCdnCgiImageRequest(url, env);
            }
            // Fallback for the Next default image loader.
            if (url.pathname ===
                `${globalThis.__NEXT_BASE_PATH__}/_next/image${globalThis.__TRAILING_SLASH__ ? "/" : ""}`) {
                return await handleImageRequest(url, request.headers, env);
            }
            // - `Request`s are handled by the Next server
            const reqOrResp = await middlewareHandler(request, env, ctx);
            if (reqOrResp instanceof Response) {
                if (request.method === "GET" && shouldCache(request.url)) {
                    return await cachePut(request.url, reqOrResp);
                }
                return reqOrResp;
            }
            // @ts-expect-error: resolved by wrangler build
            const { handler } = await import("./server-functions/default/handler.mjs");
            const resp = await handler(reqOrResp, env, ctx, request.signal);
            if (request.method === "GET" && shouldCache(request.url)) {
                return await cachePut(request.url, resp);
            }
            return resp;
        });
    },
};
