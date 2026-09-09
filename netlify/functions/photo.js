import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Media-Type",
};

const MAX_IMAGE = 6 * 1024 * 1024;   // 6MB
const MAX_VIDEO = 40 * 1024 * 1024;  // 40MB (짧은 영상 기준 — 요즘 스마트폰은 몇 초만 찍어도 화질이 높아 용량이 큼)
const MAX_DOC = 15 * 1024 * 1024;    // 15MB (매뉴얼 PDF 등)

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
      const headers = { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", ...CORS };
      // ?download=1 이 붙어 있으면(다운로드 버튼용), 브라우저가 그냥 보여주지 않고 실제로 저장하도록 강제함
      if (url.searchParams.get("download")) {
        const rawName = url.searchParams.get("filename") || "file";
        const safeName = rawName.replace(/[\\/:*?"<>|]/g, "_");
        headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(safeName)}"`;
      }
      return new Response(result.data, { status: 200, headers });
    }

    if (req.method === "POST") {
      const newId = crypto.randomUUID();
      const contentType = req.headers.get("content-type") || "application/octet-stream";
      const isVideo = contentType.startsWith("video/");
      const isImage = contentType.startsWith("image/");
      const buf = await req.arrayBuffer();
      const cap = isVideo ? MAX_VIDEO : isImage ? MAX_IMAGE : MAX_DOC;
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
