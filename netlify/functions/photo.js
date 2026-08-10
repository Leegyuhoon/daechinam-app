import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Media-Type",
};

const MAX_IMAGE = 6 * 1024 * 1024;   // 6MB
const MAX_VIDEO = 25 * 1024 * 1024;  // 25MB (짧은 영상 기준)

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore("daechinam-photos");
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (req.method === "GET") {
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
      }
      const result = await store.getWithMetadata(id, { type: "arrayBuffer" });
      if (!result || !result.data) {
        return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS } });
      }
      const contentType = (result.metadata && result.metadata.contentType) || "image/jpeg";
      return new Response(result.data, {
        status: 200,
        headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", ...CORS },
      });
    }

    if (req.method === "POST") {
      const newId = crypto.randomUUID();
      const contentType = req.headers.get("content-type") || "application/octet-stream";
      const isVideo = contentType.startsWith("video/");
      const buf = await req.arrayBuffer();
      const cap = isVideo ? MAX_VIDEO : MAX_IMAGE;
      if (buf.byteLength > cap) {
        return new Response(JSON.stringify({ error: "too large", limitMB: Math.round(cap / 1024 / 1024) }), { status: 413, headers: { "Content-Type": "application/json", ...CORS } });
      }
      await store.set(newId, buf, { metadata: { contentType } });
      return new Response(JSON.stringify({ id: newId, contentType }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e && e.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
};

export const config = {
  path: "/api/photo",
};
