// 품의서(구매 승인 요청) 서버 — 주소: /api/approval
// 관리자가 작성 → 링크를 카톡 등으로 대표에게 전달 → 대표가 링크를 열어 승인 비밀번호(숫자)를 입력하고 승인/반려 + 지시사항 입력.
// 저장 위치(Netlify Blobs, 스토어 "daechinam-approvals"):  d:<id>  품의서 1건
// 대표용 링크의 토큰과 승인 비밀번호는 해시로만 저장함(서버에도 원문이 남지 않음).
import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";
import { getChatStore, pushTo, mutate } from "./chat.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS } });

function store() {
  try { return getStore({ name: "daechinam-approvals", consistency: "strong" }); } catch (e) { return getStore("daechinam-approvals"); }
}
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const pinHash = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString("hex");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const newToken = () => crypto.randomBytes(24).toString("base64url");
const okPin = (p) => /^\d{4,8}$/.test(String(p || ""));
const clip = (v, n) => String(v == null ? "" : v).slice(0, n);

// 입력 양식 정리(길이 제한·타입 보정) — 화면에서 온 값을 그대로 믿지 않음
function cleanForm(f) {
  f = f || {};
  const items = (Array.isArray(f.items) ? f.items : []).slice(0, 40).map((it) => ({
    name: clip(it.name, 100), qty: Number(it.qty) || 0, unit: clip(it.unit, 20), price: Number(it.price) || 0,
  }));
  const o = {};
  for (const k of ["docNo", "dept", "authorRank", "authorName", "writeDate", "execDate", "to", "coop", "title", "supplier", "deliverDate", "payDate", "payMethod", "attachments", "remark"])
    o[k] = clip(f[k], 300);
  o.intro = clip(f.intro, 2000);
  o.payNote = clip(f.payNote, 500);
  o.vatIncluded = !!f.vatIncluded;
  o.items = items;
  const supply = items.reduce((s, it) => s + Math.round(it.qty * it.price), 0);
  const vat = f.vatIncluded ? 0 : Math.round(supply * 0.1);
  o.supply = supply; o.vat = vat; o.total = supply + vat;
  return o;
}
// 화면에 내보낼 때는 해시·잠금 정보를 빼고 보냄
function pub(d) {
  const { tokenHash, pinHash: ph, salt, fails, lockedUntil, ...rest } = d;
  return rest;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const st = store();
  try {
    if (req.method === "GET") {
      const action = url.searchParams.get("action") || "list";
      if (action === "list") {
        const { blobs } = await st.list({ prefix: "d:" });
        const docs = (await Promise.all(blobs.slice(0, 300).map((b) => st.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
        docs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        return json({ docs: docs.map(pub) });
      }
      if (action === "doc") { // 대표가 링크로 열 때
        const id = url.searchParams.get("id") || "", token = url.searchParams.get("token") || "";
        const d = await st.get(`d:${id}`, { type: "json" }).catch(() => null);
        if (!d || !safeEq(sha(token), d.tokenHash)) return json({ error: "not found" }, 404);
        return json({ doc: pub(d) });
      }
      return json({ error: "unknown action" }, 400);
    }
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const b = await req.json().catch(() => ({}));

    if (b.action === "create") {
      if (!okPin(b.pin)) return json({ error: "pin" }, 400);
      const id = crypto.randomUUID().slice(0, 12);
      const token = newToken(), salt = crypto.randomBytes(12).toString("hex");
      const now = new Date().toISOString();
      const d = { id, tokenHash: sha(token), salt, pinHash: pinHash(b.pin, salt), createdAt: now, updatedAt: now, status: "pending", form: cleanForm(b.form), directive: "", decidedAt: null, fails: 0, lockedUntil: 0 };
      await st.setJSON(`d:${id}`, d);
      return json({ ok: true, id, token, doc: pub(d) });
    }

    if (b.action === "update") { // 대기·반려 상태에서만 수정(승인된 문서는 못 고침). 수정하면 다시 '승인 대기'
      const r = await mutate(st, `d:${clip(b.id, 40)}`, (cur) => {
        if (!cur || cur.status === "approved") return undefined;
        return { next: { ...cur, form: cleanForm(b.form), status: "pending", directive: cur.status === "rejected" ? "" : cur.directive, decidedAt: null, prevDirective: cur.status === "rejected" ? cur.directive : cur.prevDirective, updatedAt: new Date().toISOString() } };
      });
      if (!r.changed) return json({ error: "cannot update" }, 409);
      return json({ ok: true, doc: pub(r.value) });
    }

    if (b.action === "relink") { // 새 링크 발급(기존 링크는 못 쓰게 됨) — 승인 비밀번호 필요
      const cur = await st.get(`d:${clip(b.id, 40)}`, { type: "json" }).catch(() => null);
      if (!cur || !okPin(b.pin) || !safeEq(pinHash(b.pin, cur.salt), cur.pinHash)) return json({ error: "pin" }, 403);
      const token = newToken();
      await mutate(st, `d:${cur.id}`, (c) => (c ? { next: { ...c, tokenHash: sha(token) } } : undefined));
      return json({ ok: true, token });
    }

    if (b.action === "delete") {
      await st.delete(`d:${clip(b.id, 40)}`);
      return json({ ok: true });
    }

    if (b.action === "decide") { // 대표가 승인/반려
      const decision = b.decision === "approved" ? "approved" : b.decision === "rejected" ? "rejected" : null;
      if (!decision) return json({ error: "bad decision" }, 400);
      const id = clip(b.id, 40);
      let result = { code: "notfound" };
      const r = await mutate(st, `d:${id}`, (cur) => {
        if (!cur || !safeEq(sha(b.token || ""), cur.tokenHash)) { result = { code: "notfound" }; return undefined; }
        if (cur.status !== "pending") { result = { code: "done" }; return undefined; }
        if (cur.lockedUntil && cur.lockedUntil > Date.now()) { result = { code: "locked" }; return undefined; }
        if (!okPin(b.pin) || !safeEq(pinHash(b.pin, cur.salt), cur.pinHash)) {
          const fails = (cur.fails || 0) + 1;
          result = { code: "pin", left: Math.max(0, 5 - fails) };
          return { next: { ...cur, fails: fails >= 5 ? 0 : fails, lockedUntil: fails >= 5 ? Date.now() + 10 * 60 * 1000 : 0 } };
        }
        result = { code: "ok" };
        return { next: { ...cur, status: decision, directive: clip(b.directive, 1000), decidedAt: new Date().toISOString(), fails: 0, lockedUntil: 0 } };
      });
      if (result.code === "ok") {
        const d = r.value;
        try {
          await pushTo(getChatStore(), "admin", {
            title: decision === "approved" ? "품의서가 승인됐어요" : "품의서가 반려됐어요",
            body: `${d.form.title || "품의서"}${d.directive ? " — " + d.directive.slice(0, 60) : ""}`,
            tag: `approval-${d.id}`, url: "/?approvals=1",
          });
        } catch (e) { /* 알림 실패는 승인 결과에 영향 없음 */ }
        return json({ ok: true, doc: pub(d) });
      }
      return json({ error: result.code, left: result.left }, result.code === "notfound" ? 404 : result.code === "pin" ? 403 : 409);
    }
    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
};

export const config = { path: "/api/approval" };
