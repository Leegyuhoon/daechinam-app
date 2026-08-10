import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore("daechinam-data");
  const key = "shared";

  try {
    if (req.method === "GET") {
      const value = await store.get(key);
      return new Response(value ?? "null", {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    if (req.method === "PUT") {
      const body = await req.text();
      JSON.parse(body); // 유효한 JSON인지만 검증
      await store.set(key, body);
      return new Response(JSON.stringify({ ok: true }), {
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
  path: "/api/data",
};
