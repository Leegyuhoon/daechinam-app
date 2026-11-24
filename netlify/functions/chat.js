// 근무자 ↔ 관리자 1:1 채팅 + 푸시 알림 서버 (Netlify Function, 주소: /api/chat)
//
// 저장 위치(Netlify Blobs, 스토어 이름 "daechinam-chat"):
//   t:<근무자id>    그 근무자와 관리자의 대화 { messages:[...], readA:"관리자가 마지막으로 읽은 시각", readW:"근무자가 ..." }
//   inbox           대화 목록 요약 { <근무자id>: { name, lastAt, lastText, lastFrom, unreadA, unreadW } }
//   push:<소유자>   푸시 알림을 받을 기기 목록 (소유자 = "admin" 또는 근무자id)
//
// 푸시 알림은 Netlify 환경변수 VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT 가 설정돼 있을 때만 동작함.
// 설정이 없으면 채팅 자체는 그대로 되고, 푸시만 꺼진 상태로 조용히 넘어감.
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const JSON_H = { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS };
const MAX_TEXT = 1000;
const MAX_MESSAGES = 600; // 대화방 하나에 보관하는 최대 메시지 수(넘으면 오래된 것부터 지움)

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: JSON_H });

function getChatStore() {
  try { return getStore({ name: "daechinam-chat", consistency: "strong" }); } catch (e) { return getStore("daechinam-chat"); }
}

// 여러 사람이 동시에 보내도 서로의 메시지를 덮어쓰지 않게, "내가 읽은 버전 그대로일 때만 저장"하고 아니면 다시 읽어서 재시도함
async function mutate(store, key, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    let entry = null;
    try { entry = await store.getWithMetadata(key, { type: "json" }); } catch (e) { entry = null; }
    const cur = entry && entry.data !== undefined ? entry.data : null;
    const res = fn(cur);
    if (res === undefined) return { changed: false, value: cur };
    const next = res.next;
    try {
      const w = await store.setJSON(key, next, entry && entry.etag ? { onlyIfMatch: entry.etag } : { onlyIfNew: true });
      if (w && w.modified === false) { await new Promise((r) => setTimeout(r, 40 + Math.random() * 80)); continue; }
    } catch (e) {
      // 조건부 쓰기를 못 쓰는 환경이면 그냥 저장(마지막 수단)
      await store.setJSON(key, next);
    }
    return { changed: true, value: next, extra: res.extra };
  }
  throw new Error("busy");
}

const preview = (m) => (m.imageId && !m.text ? "📷 사진" : (m.text || "").replace(/\s+/g, " ").slice(0, 60));

/* ───────────── 웹 푸시(외부 라이브러리 없이 Node 내장 crypto만 사용) ───────────── */
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

function hkdf(salt, ikm, info, len) {
  const prk = crypto.createHmac("sha256", salt).update(ikm).digest();
  const out = []; let prev = Buffer.alloc(0); let n = 0;
  while (Buffer.concat(out).length < len) {
    n += 1;
    prev = crypto.createHmac("sha256", prk).update(Buffer.concat([prev, info, Buffer.from([n])])).digest();
    out.push(prev);
  }
  return Buffer.concat(out).subarray(0, len);
}

// RFC 8291 (aes128gcm) 로 알림 내용을 암호화
function encryptPayload(sub, payloadBuf) {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(authSecret, shared, keyInfo, 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const enc = Buffer.concat([cipher.update(Buffer.concat([payloadBuf, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, enc]);
}

function vapidHeader(endpoint, pub, priv, subject) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const pubBuf = fromB64u(pub);
  const key = crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64u(pubBuf.subarray(1, 33)), y: b64u(pubBuf.subarray(33, 65)), d: priv },
    format: "jwk",
  });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${pub}`;
}

async function sendPush(sub, payload) {
  const pub = process.env.VAPID_PUBLIC, priv = process.env.VAPID_PRIVATE;
  if (!pub || !priv) return "disabled";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@daechinam.example";
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidHeader(sub.endpoint, pub, priv, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "high",
    },
    body: encryptPayload(sub, Buffer.from(JSON.stringify(payload))),
  });
  if (res.status === 404 || res.status === 410) return "gone";
  return res.ok ? "ok" : `fail:${res.status}`;
}

async function pushTo(store, owner, payload) {
  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) return;
  let list = [];
  try { list = (await store.get(`push:${owner}`, { type: "json" })) || []; } catch (e) { list = []; }
  if (!list.length) return;
  const results = await Promise.allSettled(list.map((s) => sendPush(s, payload)));
  const dead = new Set();
  results.forEach((r, i) => { if (r.status === "fulfilled" && r.value === "gone") dead.add(list[i].endpoint); });
  if (dead.size) {
    await mutate(store, `push:${owner}`, (cur) => ({ next: (cur || []).filter((s) => !dead.has(s.endpoint)) })).catch(() => {});
  }
}

/* ───────────── 요청 처리 ───────────── */
export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const store = getChatStore();
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      if (action === "vapid") return json({ key: process.env.VAPID_PUBLIC || null });
      if (action === "inbox") {
        const inbox = (await store.get("inbox", { type: "json" })) || {};
        return json({ inbox });
      }
      if (action === "unread") {
        const wid = url.searchParams.get("workerId");
        const inbox = (await store.get("inbox", { type: "json" })) || {};
        return json({ unread: (inbox[wid] && inbox[wid].unreadW) || 0 });
      }
      if (action === "thread") {
        const wid = url.searchParams.get("workerId");
        if (!wid) return json({ error: "workerId required" }, 400);
        const since = url.searchParams.get("since") || "";
        const t = (await store.get(`t:${wid}`, { type: "json" })) || { messages: [], readA: "", readW: "" };
        const msgs = since ? t.messages.filter((m) => m.at > since) : t.messages.slice(-150);
        return json({ messages: msgs, readA: t.readA || "", readW: t.readW || "", total: t.messages.length });
      }
      return json({ error: "unknown action" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body;

      if (action === "send") {
        const { workerId, workerName, from, cid } = body;
        let text = String(body.text || "").trim().slice(0, MAX_TEXT);
        const imageId = body.imageId ? String(body.imageId).slice(0, 80) : "";
        if (!workerId || (from !== "worker" && from !== "admin")) return json({ error: "bad request" }, 400);
        if (!text && !imageId) return json({ error: "empty" }, 400);
        const id = String(cid || crypto.randomUUID()).slice(0, 60);
        const msg = { id, from, at: "" };
        if (text) msg.text = text;
        if (imageId) msg.imageId = imageId;

        let added = false;
        let out = null;
        await mutate(store, `t:${workerId}`, (cur) => {
          const t = cur || { messages: [], readA: "", readW: "" };
          const dup = t.messages.find((m) => m.id === id);
          if (dup) { out = dup; return undefined; } // 같은 메시지를 다시 보내도 한 번만 저장
          added = true;
          // 시각은 저장하는 순간에 정하고, 직전 메시지보다 항상 뒤가 되게 함 → 화면이 "이 시각 이후"로 새 메시지를 가져와도 빠지는 게 없음
          const lastMs = t.messages.length ? Date.parse(t.messages[t.messages.length - 1].at) : 0;
          const at = new Date(Math.max(Date.now(), lastMs + 1)).toISOString();
          out = { ...msg, at };
          const messages = [...t.messages, out].slice(-MAX_MESSAGES);
          // 보낸 사람 쪽은 자기 메시지를 읽은 것으로 침
          const mark = from === "admin" ? { readA: at } : { readW: at };
          return { next: { ...t, messages, ...mark } };
        });
        if (added) {
          const at = out.at;
          await mutate(store, "inbox", (cur) => {
            const inbox = cur || {};
            const e = inbox[workerId] || { name: "", lastAt: "", lastText: "", lastFrom: "", unreadA: 0, unreadW: 0 };
            const next = {
              ...e, name: workerName || e.name, lastAt: at, lastText: preview(out), lastFrom: from,
              unreadA: from === "worker" ? (e.unreadA || 0) + 1 : 0,
              unreadW: from === "admin" ? (e.unreadW || 0) + 1 : 0,
            };
            return { next: { ...inbox, [workerId]: next } };
          });
          const title = from === "worker" ? `${workerName || "근무자"}님의 메시지` : "관리자 메시지";
          await pushTo(store, from === "worker" ? "admin" : workerId, {
            title, body: preview(out), tag: `chat-${workerId}`, url: from === "worker" ? "/?chat=admin&w=" + encodeURIComponent(workerId) : "/?chat=1",
          }).catch(() => {});
        }
        return json({ ok: true, message: out });
      }

      if (action === "read") {
        const { workerId, by } = body;
        if (!workerId || (by !== "admin" && by !== "worker")) return json({ error: "bad request" }, 400);
        const at = new Date().toISOString();
        await mutate(store, `t:${workerId}`, (cur) => {
          if (!cur) return undefined;
          return { next: { ...cur, ...(by === "admin" ? { readA: at } : { readW: at }) } };
        });
        await mutate(store, "inbox", (cur) => {
          const inbox = cur || {};
          const e = inbox[workerId];
          if (!e) return undefined;
          const key = by === "admin" ? "unreadA" : "unreadW";
          if (!e[key]) return undefined;
          return { next: { ...inbox, [workerId]: { ...e, [key]: 0 } } };
        });
        return json({ ok: true, at });
      }

      if (action === "subscribe" || action === "unsubscribe") {
        const { owner, sub } = body;
        if (!owner || !sub || !sub.endpoint) return json({ error: "bad request" }, 400);
        await mutate(store, `push:${owner}`, (cur) => {
          const list = (cur || []).filter((s) => s.endpoint !== sub.endpoint);
          if (action === "unsubscribe") return { next: list };
          if (!sub.keys || !sub.keys.p256dh || !sub.keys.auth) return undefined;
          list.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, at: new Date().toISOString() });
          return { next: list.slice(-6) }; // 기기 6대까지
        });
        return json({ ok: true });
      }

      return json({ error: "unknown action" }, 400);
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
};

export const config = { path: "/api/chat" };
