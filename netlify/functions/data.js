import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, If-Match",
  "Access-Control-Expose-Headers": "ETag",
};

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore("daechinam-data");
  const key = "shared";

  try {
    if (req.method === "GET") {
      // 값과 함께 "지금 버전이 몇 번째인지"(etag)도 같이 내려주려고 시도함(여러 기기 동시 저장 충돌 방지용).
      // 혹시 이 방식이 어떤 이유로든 실패하면, 즉시 예전의 단순한 방식(그냥 값만 반환)으로 자동 전환함 —
      // 새 기능 때문에 서비스 전체가 멈추는 일이 절대 없도록 하기 위함.
      try {
        const entry = await store.getWithMetadata(key, { type: "text" });
        const headers = { "Content-Type": "application/json", ...CORS };
        if (entry?.etag) headers["ETag"] = entry.etag;
        return new Response(entry?.data ?? "null", { status: 200, headers });
      } catch (e) {
        const value = await store.get(key);
        return new Response(value ?? "null", { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
      }
    }

    if (req.method === "PUT") {
      const body = await req.text();
      JSON.parse(body); // 유효한 JSON인지만 검증
      const ifMatch = req.headers.get("if-match");
      let conflict = false;
      if (ifMatch) {
        // 근무자/관리자가 여러 기기(휴대폰+PC 등)에서 동시에 저장을 시도하면, 둘 다 "내가 마지막으로 본 버전"을
        // 기준으로 쓰려고 함 — 이때 먼저 저장한 쪽이 버전을 올려버리면, 뒤에 저장하려는 쪽은 자기가 봤던 버전이
        // 이미 낡은 것이므로 여기서 실패시킴(그냥 덮어쓰지 않음). 그러면 클라이언트가 최신본을 다시 받아서
        // 그 위에 자기 변경사항을 다시 적용해 재시도함 — 이렇게 해야 한쪽 기기의 저장이 다른 쪽에 씻겨나가지 않음.
        // 이 조건부 쓰기 자체가 어떤 이유로든 동작 안 하면(에러), 조용히 예전처럼 무조건 저장으로 넘어감.
        try {
          const result = await store.set(key, body, { onlyIfMatch: ifMatch });
          if (!result || result.modified === false) conflict = true;
        } catch (e) {
          await store.set(key, body);
        }
      } else {
        // If-Match 없이 오는 예전 클라이언트 호환용 — 조건 없이 그냥 씀
        await store.set(key, body);
      }
      if (conflict) {
        return new Response(JSON.stringify({ error: "conflict", conflict: true }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      const headers = { "Content-Type": "application/json", ...CORS };
      try {
        const after = await store.getWithMetadata(key, { type: "text" });
        if (after?.etag) headers["ETag"] = after.etag;
      } catch (e) {}
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
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
