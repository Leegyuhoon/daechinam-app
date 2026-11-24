import crypto from "node:crypto";

// 영상 전용: Cloudflare R2에 폰이 직접 올리고(서명된 임시 주소), 볼 때도 R2에서 바로 내려받음.
// 환경변수: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const J = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS, ...extra } });

const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// AWS SigV4 쿼리 서명(미리 서명된 주소). R2는 region "auto", service "s3"
export function presign(method, key, expires, extraQuery = {}, now = new Date()) {
  const acct = process.env.R2_ACCOUNT_ID, ak = process.env.R2_ACCESS_KEY_ID, sk = process.env.R2_SECRET_ACCESS_KEY, bucket = process.env.R2_BUCKET;
  const host = `${acct}.r2.cloudflarestorage.com`;
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20261124T083000Z
  const day = amz.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const q = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${ak}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery,
  };
  const qs = Object.keys(q).sort().map((k) => `${enc(k)}=${enc(q[k])}`).join("&");
  const path = `/${bucket}/${key.split("/").map(enc).join("/")}`;
  const canonical = [method, path, qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + sk, day), "auto"), "s3"), "aws4_request");
  const sig = crypto.createHmac("sha256", kSigning).update(sts).digest("hex");
  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
}

const configured = () => !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp", "video/x-matroska": "mkv" };

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  try {
    // 업로드 준비: 폰이 R2로 바로 PUT 할 임시 주소를 발급
    if (req.method === "POST") {
      if (!configured()) return J({ error: "r2 not configured" }, 503);
      const body = await req.json().catch(() => ({}));
      const ct = String(body.contentType || "video/mp4");
      if (!ct.startsWith("video/")) return J({ error: "video only" }, 400);
      const uuid = crypto.randomUUID();
      const key = `v/${uuid}.${EXT[ct] || "mp4"}`;
      return J({ id: `r2_${uuid}.${EXT[ct] || "mp4"}`, uploadUrl: presign("PUT", key, 3600) });
    }
    // 재생/다운로드: R2의 임시 주소로 연결(302)
    if (req.method === "GET") {
      if (!configured()) return J({ error: "r2 not configured" }, 503);
      const id = url.searchParams.get("id") || "";
      const m = /^r2_([0-9a-f-]{36}\.[a-z0-9]{2,4})$/.exec(id);
      if (!m) return J({ error: "bad id" }, 400);
      const extra = {};
      if (url.searchParams.get("download")) {
        const name = (url.searchParams.get("filename") || "video.mp4").replace(/[\\/:*?"<>|]/g, "_");
        extra["response-content-disposition"] = `attachment; filename*=UTF-8''${enc(name)}`;
      }
      const loc = presign("GET", `v/${m[1]}`, 6 * 3600, extra);
      return new Response(null, { status: 302, headers: { Location: loc, "Cache-Control": "private, max-age=1800", ...CORS } });
    }
    return J({ error: "method not allowed" }, 405);
  } catch (e) {
    return J({ error: String((e && e.message) || e) }, 500);
  }
};

export const config = { path: "/api/video" };
