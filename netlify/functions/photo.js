import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
      const blob = await store.get(id, { type: "arrayBuffer" });
      if (!blob) {
        return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "Content-Type": "application/json", ...CORS } });
      }
      return new Response(blob, {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", ...CORS },
      });
    }

    if (req.method === "POST") {
      const newId = crypto.randomUUID();
      const buf = await req.arrayBuffer();
      if (buf.byteLength > 6 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "too large" }), { status: 413, headers: { "Content-Type": "application/json", ...CORS } });
      }
      await store.set(newId, buf);
      return new Response(JSON.stringify({ id: newId }), {
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
