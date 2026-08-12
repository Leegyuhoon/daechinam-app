import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  MapPin, ChevronLeft, ChevronRight, X, Plus, Trash2, Check, AlertTriangle,
  Pencil, Loader2, Building2, Clock3, FileText, ArrowLeft, ArrowRight, Copy, Lock,
  ShieldCheck, Delete, Settings as SettingsIcon, ClipboardList, Crosshair,
  Smartphone, ShieldAlert, Receipt, Printer, SlidersHorizontal, Repeat, Send, Bell,
  Camera, Package, Image as ImageIcon, Folder, Search, CalendarDays,
} from "lucide-react";

/* ─────────────────────────  토큰 (DAECHINAM 브랜드 컬러: 네이비 + 오렌지) ───────────────────────── */
const C = {
  bg: "#1D232A", bgSoft: "#262E37", grout: "#20262D",
  tile: "#FFFFFF", tileSoft: "#F5F2ED",
  text: "#1D232A", sub: "#71767D",
  onDark: "#F5F1EA", onDarkSub: "#9BA3AB",
  aqua: "#EB9E18", aquaDeep: "#B9720A",
  amber: "#FFB020", coral: "#FF6B5E", red: "#E5372B", blue: "#2F6FEB", blueDeep: "#1B4FC4",
  line: "#E6E2DB", lineDark: "#343C45",
};
const SANS = "'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,-apple-system,sans-serif";
const MONO = SANS; // 숫자 전용 폰트 — 모노스페이스 대신 한글과 어울리는 세련된 산세리프로 통일 (숫자 정렬은 tabular-nums로 처리)

/* 입체감 토큰 */
const RADIUS = 12;
const RADIUS_SM = 8;
const RADIUS_LG = 22;
const SHADOW_SM = "0 2px 6px rgba(10,14,18,0.10), 0 1px 2px rgba(10,14,18,0.08)";
const SHADOW_MD = "0 8px 24px rgba(10,14,18,0.16), 0 2px 6px rgba(10,14,18,0.10)";
const SHADOW_LG = "0 -8px 30px rgba(0,0,0,0.35)";
const SHADOW_DARK = "0 10px 28px rgba(0,0,0,0.45), 0 3px 8px rgba(0,0,0,0.3)";

const KEY = "cleanwork:v1";        // 공유 — 근무자·현장·기록
const DKEY = "cleanwork:device";   // 개인 — 이 기기가 누구 것인지

/* 공유 데이터: 서버(Netlify Function + Blobs)에 저장 — 모든 기기가 같은 걸 봄 */
async function loadShared() {
  const res = await fetch("/api/data");
  if (!res.ok) throw new Error("shared load failed");
  const text = await res.text();
  return text && text !== "null" ? JSON.parse(text) : null;
}
async function saveShared(obj) {
  const res = await fetch("/api/data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });
  if (!res.ok) throw new Error("shared save failed");
}

/* 개인(기기) 데이터: 이 브라우저에만 저장 — localStorage 사용 */
function loadDevice() {
  try {
    const raw = localStorage.getItem(DKEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveDevice(obj) {
  try { localStorage.setItem(DKEY, JSON.stringify(obj)); } catch (e) {}
}

/* 사진: 캔버스로 리사이즈·압축 후 서버(Netlify Blobs)에 업로드 */
function compressImage(file, maxSize = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const scale = maxSize / Math.max(width, height);
        width = Math.round(width * scale); height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}
async function uploadPhoto(file) {
  const blob = await compressImage(file);
  const res = await fetch("/api/photo", { method: "POST", body: blob });
  if (!res.ok) throw new Error("upload failed");
  const data = await res.json();
  return data.id;
}
async function uploadVideo(file) {
  const res = await fetch("/api/photo", {
    method: "POST",
    headers: { "Content-Type": file.type || "video/mp4" },
    body: file,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 413) throw new Error(`영상 용량이 너무 커요 (최대 ${err.limitMB || 25}MB). 더 짧게 촬영해 주세요.`);
    throw new Error("upload failed");
  }
  const data = await res.json();
  return data.id;
}
const photoUrl = (id) => `/api/photo?id=${id}`;

/* 화면에 보이지 않는 HTML 조각을 즉시 PDF 파일로 캡처·다운로드 */
async function downloadHtmlAsPdf(html, filename, widthPx = 800) {
  const holder = document.createElement("div");
  holder.style.cssText = `position:fixed; left:-9999px; top:0; width:${widthPx}px; background:#fff;`;
  holder.innerHTML = html;
  document.body.appendChild(holder);
  try {
    await new Promise((r) => setTimeout(r, 60)); // 레이아웃 안정화 대기
    const canvas = await html2canvas(holder, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let y = 0;
    pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      y = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, y, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(holder);
  }
}

/* ─────────────────────────  유틸  ───────────────────────── */
const pad = (n) => String(n).padStart(2, "0");
const dKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const money = (n) => Math.round(n).toLocaleString("ko-KR");
const hm = (h) => { const m = Math.max(0, Math.round(h * 60)); return `${Math.floor(m / 60)}시간 ${m % 60}분`; };
const hmc = (h) => { const m = Math.max(0, Math.round(h * 60)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const tstr = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const dist = (m) => (m == null ? "—" : m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`);

function haversine(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function nearestSite(loc, sites) {
  let best = null;
  sites.forEach((s) => { const d = haversine(loc, s); if (!best || d < best.d) best = { site: s, d }; });
  return best;
}
const TOL = (acc) => Math.min(acc || 0, 100); // GPS 오차 보정 상한 100m

const DEFAULTS = {
  workers: [], sites: [], records: [], bindings: {}, bindLog: [], adjustments: {}, transfers: [], notices: [], siteReports: [], supplyRequests: [], payslipSigns: [], siteManuals: [],
  settings: {
    payMode: "shift",        // shift = 타임제, hourly = 시간제
    shiftHours: 2,           // 1타임 기본 시간
    shiftPay: 30000,         // 1타임 지급액
    otThreshold: 30,         // 이 분을 넘겨야 추가근무 인정
    otPay: 7500,             // 인정 1회당 추가 지급액
    otRepeat: true,          // 기준 분 단위로 반복 가산
    shortThreshold: 15,      // 이 분 이상 모자라면 부족으로 표시
    wage: 15000, stdHours: 8, otPremium: false, autoBreak: true,
    adminPin: null, geofence: true, defaultRadius: 200, companyName: "대신치워주는남자",
    holidays: [], holidayMultiplier: 1.5,
  },
};
const DEV_DEFAULT = { deviceId: null, workerId: null, boundAt: null };

function migrate(p) {
  const d = { ...DEFAULTS, ...p, settings: { ...DEFAULTS.settings, ...(p.settings || {}) } };
  d.sites = (d.sites || []).map((s) => {
    const site = typeof s === "string" ? { id: uid(), name: s, lat: null, lng: null, radius: d.settings.defaultRadius } : s;
    return { workDays: [], startTime: "", endTime: "", ...site };
  });
  d.bindings = d.bindings || {}; d.bindLog = d.bindLog || []; d.adjustments = d.adjustments || {};
  d.workers = (d.workers || []).map((w) => {
    let x = w.code ? w : { ...w, code: String(Math.floor(100000 + Math.random() * 900000)) };
    if (!Array.isArray(x.siteIds)) x = { ...x, siteIds: x.siteId ? [x.siteId] : [] };
    if (!x.paySettingsBySite) x = { ...x, paySettingsBySite: {} };
    if (!Array.isArray(x.leaderSiteIds)) x = { ...x, leaderSiteIds: x.isTeamLead ? (x.siteIds || (x.siteId ? [x.siteId] : [])) : [] };
    x = { ...x, isTeamLead: x.leaderSiteIds.length > 0 };
    if (!Array.isArray(x.allowances)) x = { ...x, allowances: [] };
    if (typeof x.canSelfLogOneOff !== "boolean") x = { ...x, canSelfLogOneOff: false };
    return x;
  });
  d.transfers = (Array.isArray(d.transfers) ? d.transfers : []).map((t) => ({
    assignedWorkerId: null, assignedWorkerName: null, ...t,
  }));
  d.notices = Array.isArray(d.notices) ? d.notices : [];
  d.siteReports = Array.isArray(d.siteReports) ? d.siteReports : [];
  d.supplyRequests = Array.isArray(d.supplyRequests) ? d.supplyRequests : [];
  d.payslipSigns = Array.isArray(d.payslipSigns) ? d.payslipSigns : [];
  d.siteManuals = Array.isArray(d.siteManuals) ? d.siteManuals : [];
  delete d.deviceWorkerId;
  return d;
}

/* 정산서 계산 */
const EMPTY_ADJ = { extraLabel: "", extra: 0, deductLabel: "", deduct: 0, tax: false, memo: "" };
function payslipCalc(data, workerId, ym) {
  const worker = data.workers.find((w) => w.id === workerId);
  const recs = data.records
    .filter((r) => r.workerId === workerId && r.date.slice(0, 7) === ym && r.clockOut)
    .sort((a, b) => a.date.localeCompare(b.date) || a.clockIn.localeCompare(b.clockIn));
  const agg = aggregate(recs, worker, data.settings);
  const adj = { ...EMPTY_ADJ, ...(data.adjustments[`${workerId}:${ym}`] || {}) };
  const base = Math.round(agg.pay);
  const allowances = (worker?.allowances || []).filter((a) => Number(a.amount) > 0);
  const allowanceTotal = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const extra = (Number(adj.extra) || 0) + allowanceTotal;
  const gross = base + extra;
  const tax = adj.tax ? Math.floor((gross * 0.033) / 10) * 10 : 0;
  const deduct = Number(adj.deduct) || 0;
  return { worker, recs, agg, adj, base, extra, allowances, allowanceTotal, gross, tax, deduct, net: gross - tax - deduct };
}
const ymLabel = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;

const autoBreakH = (g) => (g >= 8 ? 1 : g >= 4 ? 0.5 : 0);
const minStr = (m) => {
  const r = Math.round(Math.abs(m));
  return r < 60 ? `${r}분` : r % 60 === 0 ? `${r / 60}시간` : `${Math.floor(r / 60)}시간 ${r % 60}분`;
};

function isHoliday(date, settings) {
  return !!(settings.holidays && settings.holidays.includes(date));
}

// 추가근무 시간을 "N회 + M분" 형태로 표시 (1회 = 120분 기준). 실제 급여는 otMin(30분 단위) 그대로 계산되고, 이건 표시용.
const OT_UNIT_MIN = 120;
function otLabel(otMin) {
  if (!otMin) return "";
  const units = Math.floor(otMin / OT_UNIT_MIN);
  const rest = otMin % OT_UNIT_MIN;
  if (units > 0 && rest > 0) return `${units}회 +${minStr(rest)}`;
  if (units > 0) return `${units}회`;
  return `+${minStr(rest)}`;
}

// 정부 발표 기준 공휴일 (관공서의 공휴일에 관한 규정 / law.go.kr). 음력 명절은 매년 날짜가 달라 연도별로 미리 계산해둠.
const KR_HOLIDAYS = {
  "2026": [
    ["2026-01-01", "신정"],
    ["2026-02-16", "설날 연휴"], ["2026-02-17", "설날"], ["2026-02-18", "설날 연휴"],
    ["2026-03-01", "삼일절"], ["2026-03-02", "삼일절 대체휴일"],
    ["2026-05-01", "근로자의 날"],
    ["2026-05-05", "어린이날"],
    ["2026-05-24", "부처님오신날"], ["2026-05-25", "부처님오신날 대체휴일"],
    ["2026-06-06", "현충일"],
    ["2026-08-15", "광복절"], ["2026-08-17", "광복절 대체휴일"],
    ["2026-09-24", "추석 연휴"], ["2026-09-25", "추석"], ["2026-09-26", "추석 연휴"],
    ["2026-10-03", "개천절"], ["2026-10-05", "개천절 대체휴일"],
    ["2026-10-09", "한글날"],
    ["2026-12-25", "크리스마스"],
  ],
  "2027": [
    ["2027-01-01", "신정"],
    ["2027-02-06", "설날 대체휴일"], ["2027-02-07", "설날"], ["2027-02-08", "설날 연휴"], ["2027-02-09", "설날 연휴"],
    ["2027-03-01", "삼일절"],
    ["2027-05-01", "근로자의 날"],
    ["2027-05-05", "어린이날"],
    ["2027-05-13", "부처님오신날"],
    ["2027-06-06", "현충일"], ["2027-06-07", "현충일 대체휴일"],
    ["2027-08-15", "광복절"], ["2027-08-16", "광복절 대체휴일"],
    ["2027-09-14", "추석 연휴"], ["2027-09-15", "추석"], ["2027-09-16", "추석 연휴"],
    ["2027-10-03", "개천절"], ["2027-10-04", "개천절 대체휴일"],
    ["2027-10-09", "한글날"], ["2027-10-11", "한글날 대체휴일"],
    ["2027-12-25", "크리스마스"], ["2027-12-27", "크리스마스 대체휴일"],
  ],
};

function calcRec(rec, settings) {
  if (!rec.clockOut) return { open: true, gross: 0, brk: 0, net: 0 };
  const i = new Date(rec.clockIn).getTime();
  let o = new Date(rec.clockOut).getTime();
  if (o <= i) o += 86400000;
  const gross = (o - i) / 3600000;
  let brk = 0;
  if (rec.breakMinutes != null) brk = rec.breakMinutes / 60;
  else if (settings.payMode !== "shift" && settings.autoBreak) brk = autoBreakH(gross);
  return { open: false, gross, brk, net: Math.max(0, gross - brk) };
}

/* 근무자의 특정 현장 급여 오버라이드가 있으면 그걸, 없으면 근무자 기본값, 그것도 없으면 전체 설정값 */
function resolvePay(worker, siteId, settings) {
  const ov = worker?.paySettingsBySite?.[siteId];
  return {
    wage: ov?.wage ?? worker?.wage ?? settings.wage,
    stdHours: ov?.stdHours ?? worker?.stdHours ?? settings.stdHours,
    shiftHours: ov?.shiftHours ?? worker?.shiftHours ?? settings.shiftHours,
    shiftPay: ov?.shiftPay ?? worker?.shiftPay ?? settings.shiftPay,
  };
}

/* 기록 한 건(= 한 타임)의 판정과 금액 */
function calcPay(rec, worker, settings) {
  const c = calcRec(rec, settings);
  if (c.open) return { ...c, open: true, pay: 0 };
  const holiday = isHoliday(rec.date, settings);
  // 일회성 근무(고정 금액)는 시급/타임 계산을 건너뛰고 지정한 금액을 그대로 사용
  if (rec.flatPay != null) {
    const pay = Number(rec.flatPay) || 0;
    return { ...c, open: false, pay, base: pay, otPay: 0, blocks: 0, diffMin: 0, otMin: 0, shortMin: 0, overMin: 0, holiday, flat: true };
  }
  const hMult = holiday ? (settings.holidayMultiplier || 1.5) : 1;
  const rp = resolvePay(worker, rec.siteId, settings);
  if (settings.payMode !== "shift") {
    const wage = rp.wage;
    const pay = c.net * wage * hMult;
    return { ...c, open: false, pay, base: pay, otPay: 0, blocks: 0, diffMin: 0, otMin: 0, shortMin: 0, holiday };
  }
  const sh = rp.shiftHours;
  const sp = rp.shiftPay * hMult;
  const th = Math.max(1, settings.otThreshold);
  const diffMin = Math.round((c.net - sh) * 60);
  let blocks = 0;
  if (diffMin >= th) blocks = settings.otRepeat ? Math.floor(diffMin / th) : 1;
  const otPay = blocks * settings.otPay * hMult;
  return {
    ...c, open: false, base: sp, otPay, pay: sp + otPay, blocks, diffMin, holiday,
    otMin: blocks * th, shortMin: Math.max(0, -diffMin), overMin: Math.max(0, diffMin), target: sh,
  };
}

function aggregate(records, worker, settings) {
  const shift = settings.payMode === "shift";
  const std = worker?.stdHours ?? settings.stdHours;
  const sh = worker?.shiftHours ?? settings.shiftHours;
  const byDate = {};
  let net = 0, pay = 0, times = 0, base = 0, otPay = 0, blocks = 0;
  let otMin = 0, shortMin = 0, overMin = 0, flags = 0;
  let holidayNet = 0, holidayPay = 0, holidayDays = 0;

  records.forEach((r) => {
    if (r.outFlag) flags++;
    const p = calcPay(r, worker, settings);
    if (p.open) return;
    const rp = resolvePay(worker, r.siteId, settings);
    times++; net += p.net; pay += p.pay;
    const b = byDate[r.date] || (byDate[r.date] = { net: 0, target: 0, times: 0, holiday: p.holiday, wageSum: 0 });
    b.net += p.net; b.times++; b.target += shift ? sh : 0;
    b.wageSum += rp.wage * p.net; // 같은 날 여러 현장(시급 다름) 근무 시 시간가중 평균 시급용
    if (p.holiday) {
      holidayNet += p.net;
      holidayPay += p.pay;
    }
    if (shift) {
      if (!p.holiday) { base += p.base; otPay += p.otPay; }
      blocks += p.blocks;
      otMin += p.otMin; shortMin += p.shortMin; overMin += p.overMin;
    }
  });

  if (!shift) {
    const hMult = settings.holidayMultiplier || 1.5;
    holidayPay = 0;
    Object.entries(byDate).forEach(([date, b]) => {
      b.target = std;
      const avgWage = b.net > 0 ? b.wageSum / b.net : settings.wage;
      if (b.holiday) {
        holidayDays++;
        holidayPay += b.net * avgWage * hMult;
        return;
      }
      const dayOt = Math.max(0, b.net - std);
      const dayReg = b.net - dayOt;
      if (dayOt > 0) otMin += dayOt * 60; else shortMin += (std - b.net) * 60;
      base += dayReg * avgWage;
      otPay += settings.otPremium ? dayOt * avgWage * 1.5 : dayOt * avgWage;
    });
    pay = base + otPay + holidayPay;
    overMin = otMin;
  } else {
    Object.entries(byDate).forEach(([date, b]) => { if (b.holiday) holidayDays++; });
  }

  return {
    net, days: Object.keys(byDate).length, times, pay, base, otPay, blocks,
    otMin, shortMin, overMin, ot: otMin / 60, short: shortMin / 60,
    holidayNet, holidayPay, holidayDays, holidayMultiplier: settings.holidayMultiplier || 1.5,
    byDate, std, sh, wage: worker?.wage ?? settings.wage, flags, shift,
  };
}


function rangeOf(mode, anchor) {
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (mode === "day") return [a, a];
  if (mode === "week") { const s = new Date(a); s.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return [s, e]; }
  if (mode === "month") return [new Date(a.getFullYear(), a.getMonth(), 1), new Date(a.getFullYear(), a.getMonth() + 1, 0)];
  return [new Date(a.getFullYear(), 0, 1), new Date(a.getFullYear(), 11, 31)];
}
function shift(mode, anchor, dir) {
  const a = new Date(anchor);
  if (mode === "day") a.setDate(a.getDate() + dir);
  if (mode === "week") a.setDate(a.getDate() + 7 * dir);
  if (mode === "month") a.setMonth(a.getMonth() + dir, 1);
  if (mode === "year") a.setFullYear(a.getFullYear() + dir, 0, 1);
  return a;
}
function labelOf(mode, anchor) {
  const [s, e] = rangeOf(mode, anchor);
  if (mode === "day") return `${s.getMonth() + 1}월 ${s.getDate()}일 (${WD[s.getDay()]})`;
  if (mode === "week") return `${s.getMonth() + 1}.${s.getDate()} – ${e.getMonth() + 1}.${e.getDate()}`;
  if (mode === "month") return `${s.getFullYear()}년 ${s.getMonth() + 1}월`;
  return `${s.getFullYear()}년`;
}

function getLoc() {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    const t = setTimeout(() => res(null), 11000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }); },
      () => { clearTimeout(t); res(null); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

function sampleData() {
  const sites = [
    { id: "s1", name: "강남타워", lat: 37.4979, lng: 127.0276, radius: 200 },
    { id: "s2", name: "판교 A동", lat: 37.3948, lng: 127.1112, radius: 200 },
    { id: "s3", name: "서초 오피스", lat: 37.4837, lng: 127.0324, radius: 150 },
  ];
  const workers = [
    { id: "w1", name: "김순자", siteId: "s1" },
    { id: "w2", name: "박영호", siteId: "s2" },
    { id: "w3", name: "이미경", siteId: "s3" },
  ];
  // 한 타임 2시간 기준: 정상 / 조금 초과 / 30분 넘게 초과 / 부족 이 섞이도록
  const mins = [118, 125, 152, 100, 120, 135, 168, 112, 122, 145, 96, 130];
  const records = [];
  const today = new Date();
  for (let i = 0; i < 34; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    if (d.getDay() === 0) continue;
    workers.forEach((w, wi) => {
      if ((i + wi) % 7 === 3) return;
      const s = sites[wi];
      const times = wi === 0 && i % 3 === 0 ? 2 : 1;   // 김순자는 가끔 하루 두 타임
      for (let t = 0; t < times; t++) {
        const m = mins[(i * 3 + wi * 5 + t * 7) % mins.length];
        const ci = new Date(d); ci.setHours(t === 0 ? 8 : 14, [0, 5, 12, 2][(i + wi) % 4], 0, 0);
        const co = new Date(ci.getTime() + m * 60000);
        const far = i === 5 && wi === 0 && t === 0;
        records.push({
          id: uid(), workerId: w.id, date: dKey(d), site: s.name, siteId: s.id,
          clockIn: ci.toISOString(), clockOut: co.toISOString(), breakMinutes: null,
          inLoc: { lat: s.lat, lng: s.lng, acc: 12 }, inDist: 20 + wi * 9,
          outLoc: null, outDist: far ? 3400 : 40, outFlag: far,
          note: i === 2 && wi === 1 ? "지하 3층 왁스 작업 추가" : "",
        });
      }
    });
  }
  return { ...DEFAULTS, sites, workers, records };
}

/* ─────────────────────────  공용 UI  ───────────────────────── */
const Eyebrow = ({ children, dark }) => (
  <div style={{ fontSize: 10.5, letterSpacing: "0.14em", fontWeight: 700, color: dark ? C.onDarkSub : C.sub }}>{children}</div>
);
const Num = ({ children, size = 22, color = C.text, weight = 900 }) => (
  <span style={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: size, fontWeight: weight, color, letterSpacing: "-0.015em" }}>{children}</span>
);
function Tile({ children, style, onClick, soft }) {
  return (
    <div onClick={onClick} className={onClick ? "pressable" : ""} style={{
      background: soft ? C.tileSoft : C.tile, padding: 14, cursor: onClick ? "pointer" : "default",
      borderRadius: RADIUS_SM, boxShadow: soft ? "none" : SHADOW_SM,
      ...style,
    }}>
      {children}
    </div>
  );
}
function Modal({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(4,12,18,0.6)", backdropFilter: "blur(3px)", animation: "backdropIn 0.2s ease" }}
      onClick={onClose}>
      <div className="w-full" style={{
        background: C.tile, maxHeight: "85%", maxWidth: 420, overflowY: "auto",
        borderRadius: RADIUS_LG, boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.3)",
        animation: "modalIn 0.22s cubic-bezier(0.2,0.8,0.3,1)",
      }} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{title}</div>
            <button onClick={onClose} className="p-1"><X size={18} color={C.sub} /></button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
const Btn = ({ children, onClick, kind = "primary", full, small, disabled }) => {
  const st = {
    primary: { background: C.aquaDeep, color: "#fff", border: "none", boxShadow: disabled ? "none" : `0 3px 10px ${C.aquaDeep}55, 0 1px 2px rgba(0,0,0,0.15)` },
    ghost: { background: C.tile, color: C.sub, border: `1px solid ${C.line}`, boxShadow: SHADOW_SM },
    danger: { background: "transparent", color: C.coral, border: `1px solid ${C.coral}` },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} className={`btn-press ${full ? "w-full" : ""}`}
      style={{
        ...st, opacity: disabled ? 0.35 : 1, padding: small ? "8px 12px" : "13px 16px",
        fontSize: small ? 13 : 14.5, fontWeight: 700, fontFamily: SANS,
        borderRadius: RADIUS_SM, transition: "transform 0.1s ease, box-shadow 0.1s ease, filter 0.1s ease",
      }}>
      {children}
    </button>
  );
};
const Field = ({ label, children }) => (
  <label className="block mb-3">
    <div className="mb-1.5"><Eyebrow>{label}</Eyebrow></div>
    {children}
  </label>
);
const inputStyle = { width: "100%", padding: "11px 12px", border: `1px solid ${C.line}`, background: C.tileSoft, fontSize: 15, fontFamily: SANS, color: C.text, outline: "none", borderRadius: RADIUS_SM };
const Row = ({ k, v, mono }) => (
  <div className="flex items-center justify-between gap-3">
    <span style={{ fontSize: 13, color: C.sub, fontWeight: 700, flexShrink: 0 }}>{k}</span>
    <span style={{ fontSize: 14, color: C.text, fontWeight: 800, fontFamily: mono ? MONO : SANS, textAlign: "right" }}>{v}</span>
  </div>
);

/* ─────────────────────────  앱  ───────────────────────── */
export default function App() {
  const [data, setData] = useState(null);
  const [dev, setDev] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("clock");
  const [unlocked, setUnlocked] = useState(false);
  const [revealAdmin, setRevealAdmin] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState("");
  const dataRef = useRef(null), devRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  useEffect(() => {
    (async () => {
      let d = DEFAULTS, v = { ...DEV_DEFAULT };
      try { const r = await loadShared(); if (r) d = migrate(r); } catch (e) {}
      const dv = loadDevice(); if (dv) v = { ...DEV_DEFAULT, ...dv };
      if (!v.deviceId) {
        v.deviceId = uid() + uid();
        saveDevice(v);
      }

      // 초대 링크로 들어온 경우 자동으로 이 기기를 그 근무자와 연결
      // 지원 형식 1) /invite/근무자ID  (권장 — 메신저 앱에서 안 잘림)
      // 지원 형식 2) ?w=근무자ID       (구버전 호환용)
      let inviteResult = null;
      try {
        const params = new URLSearchParams(window.location.search);
        const pathMatch = window.location.pathname.match(/\/invite\/([a-zA-Z0-9]+)/);
        const inviteId = (pathMatch && pathMatch[1]) || params.get("w");
        if (inviteId) {
          const w = (d.workers || []).find((x) => x.id === inviteId);
          if (!w) {
            inviteResult = { ok: false, reason: "notfound", id: inviteId, count: (d.workers || []).length };
          } else if (v.workerId === w.id) {
            inviteResult = { ok: true, name: w.name, already: true };
          } else {
            const at = new Date().toISOString();
            v = { ...v, workerId: w.id, boundAt: at };
            saveDevice(v);
            const prev = d.bindings[w.id];
            const changed = prev && prev.deviceId !== v.deviceId;
            d = {
              ...d,
              bindings: { ...d.bindings, [w.id]: { deviceId: v.deviceId, at } },
              bindLog: changed
                ? [{ workerId: w.id, at, from: prev.deviceId.slice(0, 6), to: v.deviceId.slice(0, 6) }, ...d.bindLog].slice(0, 30)
                : d.bindLog,
            };
            try { await saveShared(d); inviteResult = { ok: true, name: w.name }; }
            catch (e) { inviteResult = { ok: false, reason: "savefail" }; }
          }
          const url = new URL(window.location.href);
          url.searchParams.delete("w");
          window.history.replaceState({}, "", "/" + url.search);
        }
      } catch (e) { inviteResult = { ok: false, reason: "error", msg: String(e && e.message || e) }; }
      if (inviteResult) setInviteInfo(inviteResult);

      dataRef.current = d; devRef.current = v;
      setData(d); setDev(v); setLoading(false);
    })();
  }, []);

  const update = useCallback(async (mut) => {
    const next = typeof mut === "function" ? mut(dataRef.current) : mut;
    dataRef.current = next; setData(next);
    try { await saveShared(next); }
    catch (e) { setToast("저장 실패 — 인터넷 연결을 확인해 주세요"); }
  }, []);

  const updateDev = useCallback(async (mut) => {
    const next = typeof mut === "function" ? mut(devRef.current) : mut;
    devRef.current = next; setDev(next);
    saveDevice(next);
  }, []);

  const goTab = (k) => { if (k === "clock") { setUnlocked(false); setRevealAdmin(false); } setTab(k); };

  if (loading || !data || !dev) {
    return (
      <div className="flex items-center justify-center" style={{ background: C.bg, minHeight: 640, fontFamily: SANS }}>
        <Loader2 className="animate-spin" size={22} color={C.aqua} />
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, fontFamily: SANS, minHeight: 720 }}>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform:translateY(14px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes backdropIn { from { opacity:0; } to { opacity:1; } }
        .pressable { transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .pressable:active { transform: scale(0.97); }
        .btn-press:active { transform: scale(0.96); filter: brightness(0.94); }
      `}</style>
      <div className="relative mx-auto flex flex-col" style={{
        maxWidth: 560, minHeight: 720, overflow: "hidden",
        background: `radial-gradient(120% 60% at 50% 0%, ${C.bgSoft} 0%, ${C.bg} 55%)`,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {tab === "clock" && <ClockTab data={data} update={update} dev={dev} now={now} setToast={setToast} goTab={goTab} onRevealAdmin={() => setRevealAdmin(true)} inviteInfo={inviteInfo} />}
          {tab === "admin" && (
            unlocked
              ? <AdminArea data={data} update={update} dev={dev} updateDev={updateDev} setToast={setToast} onLock={() => setUnlocked(false)} />
              : <AdminGate data={data} update={update} setToast={setToast} onPass={() => setUnlocked(true)} />
          )}
        </div>

        <div className="sticky bottom-0 grid gap-0.5" style={{ background: C.grout, borderTop: `1px solid ${C.lineDark}`, boxShadow: "0 -6px 16px rgba(0,0,0,0.25)", gridTemplateColumns: (dev.workerId && !revealAdmin) ? "1fr" : "1fr 1fr" }}>
          {[["clock", "출퇴근", Clock3], ["admin", "관리자", Lock]]
            .filter(([k]) => k === "clock" || !dev.workerId || revealAdmin)
            .map(([k, l, I]) => {
              let badge = 0;
              if (k === "admin") {
                const lastSeenPhotos = localStorage.getItem("cleanwork:lastSeenPhotos") || "";
                badge = (data.siteReports || []).filter((r) => r.createdAt > lastSeenPhotos).length
                  + (data.supplyRequests || []).filter((r) => r.status === "requested").length;
              }
              return (
                <button key={k} onClick={() => goTab(k)} className="relative flex flex-col items-center justify-center gap-1 py-3"
                  style={{ background: tab === k ? C.bgSoft : C.bg, color: tab === k ? C.aqua : C.onDarkSub }}>
                  <div className="relative">
                    <I size={19} />
                    {badge > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: -8, minWidth: 15, height: 15, borderRadius: 999,
                        background: C.red, color: "#fff", fontSize: 9, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                      }}>{badge > 9 ? "9+" : badge}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{l}</span>
                </button>
              );
            })}
        </div>

        {toast && (
          <div className="absolute left-0 right-0 flex justify-center px-6" style={{ bottom: 78 }}>
            <div style={{ background: C.onDark, color: C.text, fontSize: 13, fontWeight: 700, padding: "10px 16px", textAlign: "center" }}>{toast}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────  근무자 화면  ───────────────────────── */
function ClockTab({ data, update, dev, now, setToast, goTab, onRevealAdmin, inviteInfo }) {
  const { workers, sites, records, settings } = data;
  const [confirm, setConfirm] = useState(null);
  const [chk, setChk] = useState({ state: "idle" });
  const [manualSite, setManualSite] = useState("");
  const [xferOpen, setXferOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [xferForm, setXferForm] = useState({ date: "", siteId: "", names: [""], message: "" });
  const worker = workers.find((w) => w.id === dev.workerId) || null;
  const today = dKey(now);
  const transfers = data.transfers || [];


  const myAssignedTransfers = worker ? (data.transfers || []).filter((t) => t.status === "assigned" && t.assignedWorkerId === worker.id) : [];
  const respondAssignedTransfer = (t, accept) => {
    update((d) => ({
      ...d,
      transfers: (d.transfers || []).map((x) => (x.id !== t.id ? x : accept
        ? { ...x, status: "approved", toWorkerId: worker.id, toWorkerName: worker.name, respondedAt: new Date().toISOString() }
        : { ...x, status: "pending", assignedWorkerId: null, assignedWorkerName: null, respondedAt: new Date().toISOString() })),
    }));
    setToast(accept ? "수락했습니다 — 그날 출근하면 자동으로 반영돼요" : "거절했습니다. 관리자에게 전달돼요");
  };

  const myPendingSigns = worker ? (data.payslipSigns || []).filter((x) => x.workerId === worker.id && !x.signedAt) : [];
  const [signOpen, setSignOpen] = useState(null); // payslipSigns entry
  const [sigData, setSigData] = useState(null);
  const [signBusy, setSignBusy] = useState(false);
  const submitSign = async () => {
    if (!sigData) { setToast("서명을 먼저 그려주세요"); return; }
    setSignBusy(true);
    try {
      await update((d) => ({
        ...d,
        payslipSigns: (d.payslipSigns || []).map((x) => (x.id === signOpen.id ? { ...x, signedAt: new Date().toISOString(), signatureDataUrl: sigData } : x)),
      }));
      setToast("서명이 완료됐습니다");
      setSignOpen(null); setSigData(null);
    } catch (e) {
      setToast("저장에 실패했어요 — 인터넷 연결을 확인해 주세요");
    } finally {
      setSignBusy(false);
    }
  };

  const [leadNoticeOpen, setLeadNoticeOpen] = useState(false);
  const [leadNoticeForm, setLeadNoticeForm] = useState({ title: "", message: "", days: "3" });
  const myLeaderSiteIds = worker ? (worker.leaderSiteIds || []) : [];
  const mySiteNames = worker ? myLeaderSiteIds.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean) : [];
  const myLeadNotices = worker ? (data.notices || []).filter((n) => n.createdBy === worker.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) : [];
  const openLeadNotice = () => { setLeadNoticeForm({ title: "", message: "", days: "3" }); setLeadNoticeOpen(true); };

  const myWorkerSiteIds2 = worker ? (worker.siteIds || (worker.siteId ? [worker.siteId] : [])) : [];

  // 사진/영상 열람: 팀장은 자기 현장 전체(팀원+본인), 일반 근무자는 자기 현장의 "팀장이 올린 것"만
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryViewer, setGalleryViewer] = useState(null);
  const myVisibleReports = worker ? (data.siteReports || []).filter((r) => {
    if (myLeaderSiteIds.includes(r.siteId)) return true; // 내가 팀장인 현장 = 전부 다 보임
    if (myWorkerSiteIds2.includes(r.siteId) && (r.authorRole === "leader" || r.authorRole === "admin")) return true; // 내 현장의 팀장·관리자 게시물
    return false;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];

  // 현장 매뉴얼: 내가 속한 현장의 매뉴얼만
  const myManuals = worker ? (data.siteManuals || []).filter((m) => myWorkerSiteIds2.includes(m.siteId)) : [];
  const [manualOpen, setManualOpen] = useState(false);

  const submitLeadNotice = () => {
    if (!leadNoticeForm.title.trim()) { setToast("제목을 입력해 주세요"); return; }
    if (myLeaderSiteIds.length === 0) { setToast("팀장으로 임명된 현장이 없어서 공지를 보낼 수 없어요"); return; }
    const start = dKey(new Date());
    const endD = new Date(); endD.setDate(endD.getDate() + (Number(leadNoticeForm.days) || 1) - 1);
    update((d) => ({
      ...d,
      notices: [...(d.notices || []), {
        id: uid(), title: leadNoticeForm.title.trim(), message: leadNoticeForm.message.trim(),
        audience: "site", siteIds: myLeaderSiteIds, siteName: mySiteNames.join("·"), workerIds: [],
        startDate: start, endDate: dKey(endD), active: true,
        createdAt: new Date().toISOString(), createdBy: worker.id, createdByName: worker.name,
      }],
    }));
    setToast("현장 동료들에게 공지를 보냈습니다");
    setLeadNoticeOpen(false);
  };

  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoForm, setPhotoForm] = useState({ siteId: "", category: "작업 후", note: "", file: null, preview: "", kind: "photo" });
  const [photoBusy, setPhotoBusy] = useState(false);
  const openPhoto = () => {
    setPhotoForm({ siteId: worker?.siteId || myWorkerSiteIds2[0] || "", category: "작업 후", note: "", file: null, preview: "", kind: "photo" });
    setPhotoOpen(true);
  };
  const pickPhotoFile = (f) => {
    if (!f) return;
    setPhotoForm((p) => ({ ...p, file: f, preview: URL.createObjectURL(f) }));
  };
  const submitPhoto = async () => {
    if (!photoForm.file) { setToast(photoForm.kind === "video" ? "영상을 먼저 촬영해 주세요" : "사진을 먼저 촬영해 주세요"); return; }
    const s = sites.find((x) => x.id === photoForm.siteId);
    const authorRole = (worker.leaderSiteIds || []).includes(photoForm.siteId) ? "leader" : "worker";
    setPhotoBusy(true);
    try {
      const mediaId = photoForm.kind === "video" ? await uploadVideo(photoForm.file) : await uploadPhoto(photoForm.file);
      update((d) => ({
        ...d,
        siteReports: [...(d.siteReports || []), {
          id: uid(), date: today, siteId: s?.id || null, siteName: s?.name || "현장 미지정",
          workerId: worker.id, workerName: worker.name, authorRole,
          category: photoForm.category, note: photoForm.note.trim(), photoId: mediaId, kind: photoForm.kind,
          createdAt: new Date().toISOString(),
        }],
      }));
      setToast(photoForm.kind === "video" ? "영상이 등록됐습니다" : "사진이 등록됐습니다");
      setPhotoOpen(false);
    } catch (e) {
      setToast(e.message || "업로드에 실패했습니다 — 인터넷 연결을 확인해 주세요");
    } finally {
      setPhotoBusy(false);
    }
  };

  const [supplyOpen, setSupplyOpen] = useState(false);
  const [supplyForm, setSupplyForm] = useState({ siteId: "", itemName: "", qty: "1", note: "" });
  const openSupply = () => {
    setSupplyForm({ siteId: worker?.siteId || sites[0]?.id || "", itemName: "", qty: "1", note: "" });
    setSupplyOpen(true);
  };
  const submitSupply = () => {
    if (!supplyForm.itemName.trim()) { setToast("품목을 입력해 주세요"); return; }
    const s = sites.find((x) => x.id === supplyForm.siteId);
    update((d) => ({
      ...d,
      supplyRequests: [...(d.supplyRequests || []), {
        id: uid(), date: today, siteId: s?.id || null, siteName: s?.name || "현장 미지정",
        workerId: worker.id, workerName: worker.name,
        itemName: supplyForm.itemName.trim(), qty: Number(supplyForm.qty) || 1, note: supplyForm.note.trim(),
        status: "requested", createdAt: new Date().toISOString(), respondedAt: null,
      }],
    }));
    setToast("용품을 요청했습니다");
    setSupplyOpen(false);
  };

  const [noticeQueue, setNoticeQueue] = useState([]);
  const [noticeShown, setNoticeShown] = useState(null);
  useEffect(() => {
    if (!worker) return;
    const seenKey = "cleanwork:noticeSeen";
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(seenKey) || "{}"); } catch (e) {}
    const myWorkerSiteIds = worker.siteIds || (worker.siteId ? [worker.siteId] : []);
    const due = (data.notices || []).filter((n) => {
      if (!n.active) return false;
      if (today < n.startDate || today > n.endDate) return false;
      if (n.audience === "custom" && !(n.workerIds || []).includes(worker.id)) return false;
      if (n.audience === "site" && !(n.siteIds || []).some((id) => myWorkerSiteIds.includes(id))) return false;
      return seen[`${n.id}:${today}`] !== true;
    });
    if (due.length > 0) {
      setNoticeQueue(due.slice(1));
      setNoticeShown(due[0]);
    }
    // eslint-disable-next-line
  }, [worker?.id, today]);
  const dismissNotice = () => {
    if (noticeShown) {
      try {
        const seenKey = "cleanwork:noticeSeen";
        const seen = JSON.parse(localStorage.getItem(seenKey) || "{}");
        seen[`${noticeShown.id}:${today}`] = true;
        localStorage.setItem(seenKey, JSON.stringify(seen));
      } catch (e) {}
    }
    if (noticeQueue.length > 0) {
      setNoticeShown(noticeQueue[0]);
      setNoticeQueue(noticeQueue.slice(1));
    } else {
      setNoticeShown(null);
    }
  };

  const myOutgoing = worker ? transfers.filter((t) => t.fromWorkerId === worker.id) : [];
  const recentOutgoing = [...myOutgoing].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const timeLabel = (t) => (t.startTime && t.endTime ? `${t.startTime}–${t.endTime}` : "하루 전체");

  const openXfer = () => {
    const defSiteId = worker?.siteId || sites[0]?.id || "";
    setXferForm({ date: today, siteId: defSiteId, names: [""], message: "" });
    setXferOpen(true);
  };
  const submitXfer = () => {
    const s = sites.find((x) => x.id === xferForm.siteId);
    const names = xferForm.names.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) { setToast("대신 근무할 사람의 이름을 한 명 이상 입력해 주세요"); return; }
    if (!xferForm.date) { setToast("날짜를 선택해 주세요"); return; }
    const at = new Date().toISOString();
    update((d) => ({
      ...d,
      transfers: [
        ...(d.transfers || []),
        ...names.map((toWorkerName) => ({
          id: uid(), date: xferForm.date, siteId: s?.id || null, siteName: s?.name || "현장 미지정",
          fromWorkerId: worker.id, fromWorkerName: worker.name,
          toWorkerId: null, toWorkerName, toRegistered: false,
          assignedWorkerId: null, assignedWorkerName: null,
          startTime: null, endTime: null,
          message: xferForm.message.trim(), status: "pending",
          createdAt: at, respondedAt: null, fulfilledRecordId: null,
        })),
      ],
    }));
    setToast(names.length > 1
      ? `${names.join(", ")}님에게 ${xferForm.date.slice(5)} 근무 양도를 요청했습니다`
      : `${names[0]}님에게 ${xferForm.date.slice(5)} 근무 양도를 요청했습니다`);
    setXferOpen(false);
  };
  const cancelXfer = (id) => {
    update((d) => ({
      ...d,
      transfers: (d.transfers || []).map((x) => (x.id === id ? { ...x, status: "cancelled", respondedAt: new Date().toISOString() } : x)),
    }));
    setToast("요청을 취소했습니다");
  };

  const open = useMemo(
    () => records.find((r) => worker && r.workerId === worker.id && r.date === today && !r.clockOut),
    [records, worker, today]
  );
  const doneToday = useMemo(
    () => records.filter((r) => worker && r.workerId === worker.id && r.date === today && r.clockOut).slice(-1)[0],
    [records, worker, today]
  );

  const geoSites = sites.filter((s) => s.lat != null);
  const geoOn = settings.geofence && geoSites.length > 0;

  const openConfirm = async (kind) => {
    setConfirm(kind); setChk({ state: "loading" });
    const v = await getLoc();
    if (!v) { setChk({ state: "fail" }); return; }
    if (kind === "in") {
      if (!geoOn) {
        setManualSite(sites.find((s) => s.id === worker.siteId)?.name || sites[0]?.name || "");
        setChk({ state: "nogeo", loc: v });
        return;
      }
      const n = nearestSite(v, geoSites);
      const inside = n.d - TOL(v.acc) <= n.site.radius;
      setChk({ state: inside ? "inside" : "outside", loc: v, site: n.site, d: n.d });
    } else {
      const s = sites.find((x) => x.id === open.siteId) || sites.find((x) => x.name === open.site);
      const d = s && s.lat != null ? haversine(v, s) : null;
      const outside = d != null && d - TOL(v.acc) > s.radius;
      setChk({ state: "outdone", loc: v, site: s, d, outside });
    }
  };

  const doClockIn = () => {
    const ts = new Date();
    const s = chk.state === "inside" ? chk.site : sites.find((x) => x.name === manualSite);
    const dateKey = dKey(ts);
    const cover = transfers.find((t) => t.status === "approved" && t.toWorkerId === worker.id && t.date === dateKey && t.siteId === s?.id && !t.fulfilledRecordId);
    const recId = uid();
    update((d) => ({
      ...d,
      records: [...d.records, {
        id: recId, workerId: worker.id, date: dateKey,
        site: s?.name || "현장 미지정", siteId: s?.id || null,
        clockIn: ts.toISOString(), clockOut: null, breakMinutes: null,
        inLoc: chk.loc, inDist: chk.state === "inside" ? Math.round(chk.d) : null,
        outLoc: null, outDist: null, outFlag: false,
        deviceId: dev.deviceId, note: "",
        coverForId: cover?.fromWorkerId || null, coverForName: cover?.fromWorkerName || null, transferId: cover?.id || null,
        coverStart: cover?.startTime || null, coverEnd: cover?.endTime || null,
      }],
      transfers: cover ? (d.transfers || []).map((t) => (t.id === cover.id ? { ...t, fulfilledRecordId: recId } : t)) : d.transfers,
    }));
    setConfirm(null);
    setToast(cover ? `출근 처리됐습니다 · ${cover.fromWorkerName}님 대신 근무` : `출근 처리됐습니다 · ${pad(ts.getHours())}:${pad(ts.getMinutes())}`);
  };
  const doClockOut = () => {
    const ts = new Date();
    update((d) => ({
      ...d, records: d.records.map((r) => (r.id === open.id ? {
        ...r, clockOut: ts.toISOString(), outLoc: chk.loc || null,
        outDist: chk.d != null ? Math.round(chk.d) : null, outFlag: !!chk.outside,
      } : r)),
    }));
    setConfirm(null);
    setToast(chk.outside ? "퇴근 처리됐습니다 · 현장 밖으로 기록됨" : `퇴근 처리됐습니다 · ${pad(ts.getHours())}:${pad(ts.getMinutes())}`);
  };

  const [codeInput, setCodeInput] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState("");
  const submitCode = async () => {
    const w = workers.find((x) => x.code === codeInput.trim());
    if (!w) { setCodeErr("일치하는 코드가 없어요. 다시 확인해 주세요."); return; }
    setCodeBusy(true); setCodeErr("");
    const at = new Date().toISOString();
    const nextDev = { ...dev, workerId: w.id, boundAt: at };
    saveDevice(nextDev);
    const prev = data.bindings[w.id];
    const changed = prev && prev.deviceId !== dev.deviceId;
    try {
      await update((d) => ({
        ...d,
        bindings: { ...d.bindings, [w.id]: { deviceId: dev.deviceId, at } },
        bindLog: changed
          ? [{ workerId: w.id, at, from: prev.deviceId.slice(0, 6), to: dev.deviceId.slice(0, 6) }, ...d.bindLog].slice(0, 30)
          : d.bindLog,
      }));
      setToast(`${w.name}님으로 연결됐습니다`);
      window.location.reload();
    } catch (e) {
      setCodeErr("연결에 실패했어요. 인터넷 연결을 확인해 주세요.");
    } finally {
      setCodeBusy(false);
    }
  };

  if (!worker) {
    return (
      <div className="px-5 pt-20 pb-10" style={{ flex: 1 }}>
        <Eyebrow dark>기기 등록이 필요합니다</Eyebrow>
        <div style={{ color: C.onDark, fontSize: 25, fontWeight: 900, lineHeight: 1.35, marginTop: 10 }}>
          이 휴대폰을 쓸 근무자가<br />아직 등록되지 않았습니다.
        </div>
        <div style={{ color: C.onDarkSub, fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
          관리자에게 받은 <b style={{ color: C.onDark }}>6자리 연결 코드</b>를 아래에 입력해 주세요.
        </div>

        <div className="mt-5">
          <input value={codeInput} onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setCodeErr(""); }}
            inputMode="numeric" placeholder="123456" maxLength={6}
            style={{
              width: "100%", padding: "16px 14px", fontSize: 26, fontWeight: 900, letterSpacing: "0.3em", textAlign: "center",
              background: C.bgSoft, border: `1.5px solid ${C.lineDark}`, color: C.onDark, borderRadius: RADIUS_SM, fontFamily: MONO,
            }} />
          {codeErr && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8, fontWeight: 700 }}>{codeErr}</div>}
          <div style={{ marginTop: 12 }}>
            <Btn full onClick={submitCode} disabled={codeInput.length !== 6 || codeBusy}>
              {codeBusy ? "연결 중…" : "연결하기"}
            </Btn>
          </div>
        </div>

        {inviteInfo && !inviteInfo.ok && (
          <div style={{ marginTop: 16, background: "#3A1414", border: `1px solid ${C.red}`, padding: 12, fontSize: 12.5, color: "#FFC9C4", lineHeight: 1.6 }}>
            {inviteInfo.reason === "notfound" && (
              <>연결 링크는 열렸지만, 그 근무자를 찾지 못했어요. 위 6자리 코드로 연결해 주세요.</>
            )}
            {inviteInfo.reason === "savefail" && <>연결 정보를 저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</>}
            {inviteInfo.reason === "error" && <>오류가 발생했어요: {inviteInfo.msg}</>}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {workers.length === 0 && <Btn full kind="ghost" onClick={() => update(sampleData())}>샘플 데이터로 먼저 둘러보기</Btn>}
          <button onClick={() => goTab("admin")} style={{ marginTop: 8, fontSize: 12, color: C.onDarkSub, fontWeight: 700, textAlign: "center" }}>
            관리자이신가요? 관리자 탭 열기
          </button>
        </div>
      </div>
    );
  }

  const std = worker.stdHours ?? settings.stdHours;
  const elapsed = open ? (now.getTime() - new Date(open.clockIn).getTime()) / 1000 : 0;
  const prog = open ? Math.min(1, elapsed / 3600 / std) : 0;
  const R = 112, CIRC = 2 * Math.PI * R;
  const canGo = confirm === "out" || chk.state === "inside" || chk.state === "nogeo";

  return (
    <div className="flex flex-col items-center px-5" style={{ flex: 1, paddingTop: 40, paddingBottom: 32 }}>
      <Eyebrow dark>{now.getFullYear()}년 {now.getMonth() + 1}월 {now.getDate()}일 {WD[now.getDay()]}요일</Eyebrow>
      <div className="mt-1.5"><Num size={40} color={C.onDark} weight={800}>{pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}</Num></div>
      <div onClick={() => {
        const now2 = Date.now();
        const last = window.__tapLog || [];
        const recent = [...last.filter((t) => now2 - t < 3000), now2];
        window.__tapLog = recent;
        if (recent.length >= 5) { window.__tapLog = []; onRevealAdmin(); setToast("관리자 탭이 임시로 열렸습니다"); }
      }} style={{ color: C.onDark, fontSize: 17, fontWeight: 800, marginTop: 14, cursor: "default" }}>{worker.name} 님</div>

      <button onClick={() => openConfirm(open ? "out" : "in")} className="relative" style={{ width: 264, height: 264, marginTop: 34 }}>
        <svg width="264" height="264" viewBox="0 0 264 264" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="circShadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.35" />
            </filter>
            <radialGradient id="circGloss" cx="35%" cy="28%" r="75%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="132" cy="132" r={R} fill="none" stroke={C.lineDark} strokeWidth="11" />
          {open && (
            <circle cx="132" cy="132" r={R} fill="none" stroke={C.aqua} strokeWidth="11"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - prog)} strokeLinecap="butt"
              transform="rotate(-90 132 132)" style={{ transition: "stroke-dashoffset 0.6s linear" }} />
          )}
          <circle cx="132" cy="132" r={R - 13} fill={open ? C.bgSoft : C.aquaDeep} filter="url(#circShadow)" />
          <circle cx="132" cy="132" r={R - 13} fill="url(#circGloss)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {open ? (
            <>
              <Eyebrow dark>근무 중 · {open.site}</Eyebrow>
              <div className="mt-2"><Num size={40} color={C.onDark} weight={800}>
                {pad(Math.floor(elapsed / 3600))}:{pad(Math.floor(elapsed / 60) % 60)}:{pad(Math.floor(elapsed) % 60)}
              </Num></div>
              <div style={{ marginTop: 12, color: C.aqua, fontSize: 21, fontWeight: 900, letterSpacing: "0.06em" }}>퇴근</div>
            </>
          ) : (
            <>
              <div style={{ color: "#fff", fontSize: 46, fontWeight: 900, letterSpacing: "0.04em" }}>출근</div>
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13.5, fontWeight: 700, marginTop: 5 }}>눌러서 기록하기</div>
            </>
          )}
        </div>
      </button>

      <div style={{ marginTop: 26, minHeight: 22, textAlign: "center" }}>
        {open ? (
          <div style={{ color: C.onDarkSub, fontSize: 13, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>{tstr(open.clockIn)} 출근 완료</div>
        ) : doneToday ? (
          <div className="flex items-center gap-1.5" style={{ color: C.onDarkSub, fontSize: 13, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
            <Check size={14} color={C.aqua} /> 오늘 {tstr(doneToday.clockIn)} – {tstr(doneToday.clockOut)} 완료
          </div>
        ) : (
          <div style={{ color: C.onDarkSub, fontSize: 13 }}>오늘 출근 기록이 아직 없습니다.</div>
        )}
      </div>

      {/* 내 출퇴근 캘린더 */}
      <div className="w-full" style={{ maxWidth: 320, marginTop: 22 }}>
        <button onClick={() => setCalOpen(true)} className="w-full flex items-center justify-center gap-2"
          style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 13.5, fontWeight: 800 }}>
          <CalendarDays size={15} /> 내 출퇴근 캘린더
        </button>
      </div>

      {/* 근무 양도 요청하기 */}
      <div className="w-full" style={{ maxWidth: 320, marginTop: 10 }}>
        <button onClick={openXfer} className="w-full flex items-center justify-center gap-2"
          style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 13.5, fontWeight: 800 }}>
          <Repeat size={15} /> 근무 양도 요청하기
        </button>

        {recentOutgoing.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {recentOutgoing.map((t) => (
              <div key={t.id} className="flex items-center justify-between" style={{ padding: "8px 2px", borderBottom: `1px solid ${C.lineDark}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.onDark }}>
                    {t.date.slice(5).replace("-", "/")} · {t.toWorkerName}님에게 요청
                  </div>
                  <div style={{ fontSize: 11, color: C.onDarkSub, marginTop: 1 }}>{t.siteName}{t.startTime ? ` · ${t.startTime}–${t.endTime}` : " · 하루 전체"}</div>
                </div>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: "2px 7px",
                    color: t.status === "approved" ? "#fff" : t.status === "assigned" ? "#fff" : t.status === "declined" || t.status === "cancelled" ? C.onDarkSub : C.bg,
                    background: t.status === "approved" ? C.aquaDeep : t.status === "assigned" ? C.blue : t.status === "pending" ? C.aqua : "transparent",
                    border: t.status === "declined" || t.status === "cancelled" ? `1px solid ${C.lineDark}` : "none",
                  }}>
                    {t.status === "pending" ? "관리자 확인 중" : t.status === "assigned" ? `${t.assignedWorkerName} 승인 대기` : t.status === "approved" ? "승인 완료" : t.status === "declined" ? "거절됨" : "취소됨"}
                  </span>
                  {t.status === "pending" && (
                    <button onClick={() => cancelXfer(t.id)} title="요청 취소"><X size={14} color={C.onDarkSub} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 나에게 온 대신 근무 요청 */}
      {myAssignedTransfers.length > 0 && (
        <div className="w-full" style={{ maxWidth: 320, marginTop: 12 }}>
          {myAssignedTransfers.map((t) => (
            <div key={t.id} style={{ background: C.tile, padding: 14, marginBottom: 8, border: `1.5px solid ${C.blue}` }}>
              <div className="flex items-center gap-1.5" style={{ color: C.blue, fontSize: 11.5, fontWeight: 800 }}>
                <Repeat size={12} /> 대신 근무 요청이 왔어요
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginTop: 6 }}>
                {t.date.slice(5).replace("-", "/")} · {t.siteName}
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{t.fromWorkerName}님의 근무를 대신 부탁받았어요</div>
              {t.message && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>"{t.message}"</div>}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Btn kind="ghost" small onClick={() => respondAssignedTransfer(t, false)}>거절</Btn>
                <Btn small onClick={() => respondAssignedTransfer(t, true)}>수락하기</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 확인·서명 필요한 정산서 */}
      {myPendingSigns.length > 0 && (
        <div className="w-full" style={{ maxWidth: 320, marginTop: 12 }}>
          {myPendingSigns.map((sgn) => (
            <div key={sgn.id} style={{ background: C.tile, padding: 14, marginBottom: 8, border: `1.5px solid ${C.aquaDeep}` }}>
              <div className="flex items-center gap-1.5" style={{ color: C.aquaDeep, fontSize: 11.5, fontWeight: 800 }}>
                <Receipt size={12} /> 확인 · 서명이 필요해요
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, marginTop: 6 }}>{ymLabel(sgn.ym)} 근무 정산서</div>
              <div style={{ fontSize: 13, color: C.coral, fontWeight: 900, marginTop: 2 }}>실지급액 {money(sgn.snapshot.net_pay)}원</div>
              <div className="mt-3">
                <Btn full small onClick={() => { setSignOpen(sgn); setSigData(null); }}>정산서 확인하고 서명하기</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 정산서 확인 · 서명 */}
      <Modal open={!!signOpen} onClose={() => !signBusy && setSignOpen(null)}>
        {signOpen && (
          <>
            <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>{ymLabel(signOpen.ym)} 근무 정산서</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3 }}>{signOpen.company}</div>
            <div className="mt-4" style={{ background: C.tileSoft, padding: 13 }}>
              {(() => {
                const s = signOpen.snapshot;
                return (
                  <>
                    <Row k={s.shift ? "기본 타임" : "기본급"} v={`${money(s.base)}원`} />
                    {s.otPay > 0 && <Row k={s.shift ? "추가근무" : "연장근무"} v={`${money(s.otPay)}원`} />}
                    {s.holidayPay > 0 && <Row k="공휴일 근무" v={`${money(s.holidayPay)}원`} />}
                    {s.extra > 0 && <Row k={s.extraLabel || "기타 수당"} v={`${money(s.extra)}원`} />}
                    <div style={{ borderTop: `1px solid ${C.line}`, margin: "8px 0" }} />
                    <Row k="지급 합계" v={`${money(s.gross)}원`} />
                    {s.tax > 0 && <Row k="원천징수" v={`−${money(s.tax)}원`} />}
                    {s.deduct > 0 && <Row k={s.deductLabel || "기타 공제"} v={`−${money(s.deduct)}원`} />}
                  </>
                );
              })()}
            </div>
            <div className="mt-2" style={{ background: C.text, padding: "13px 14px" }}>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10.5, letterSpacing: "0.1em" }}>실지급액</div>
              <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, marginTop: 3 }}>{money(signOpen.snapshot.net_pay)}원</div>
            </div>

            <div className="mt-4">
              <Eyebrow>서명</Eyebrow>
              <div className="mt-1.5"><SignaturePad onChange={setSigData} /></div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                서명하면 위 내용을 확인했다는 의미로 관리자에게 전달돼요.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Btn kind="ghost" full disabled={signBusy} onClick={() => setSignOpen(null)}>나중에</Btn>
              <Btn full disabled={signBusy || !sigData} onClick={submitSign}>{signBusy ? "저장 중…" : "서명 완료"}</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* 팀장 전용: 현장 공지 */}
      {worker?.isTeamLead && (
        <div className="w-full" style={{ maxWidth: 320, marginTop: 10 }}>
          <button onClick={openLeadNotice} className="w-full flex items-center justify-center gap-2"
            style={{ background: C.amber, border: "none", padding: "12px 0", color: "#3D2600", fontSize: 13, fontWeight: 900 }}>
            <ShieldCheck size={15} /> 우리 현장 공지 작성 (팀장)
          </button>
          {myLeadNotices.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {myLeadNotices.map((n) => {
                const live = n.active && today >= n.startDate && today <= n.endDate;
                return (
                  <div key={n.id} className="flex items-center justify-between" style={{ padding: "7px 2px", borderBottom: `1px solid ${C.lineDark}` }}>
                    <div style={{ fontSize: 12, color: C.onDark, fontWeight: 700 }}>{n.title}</div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: live ? "#fff" : C.onDarkSub, background: live ? C.blue : "transparent", padding: "2px 6px" }}>
                      {live ? "노출 중" : "종료"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 팀장 공지 작성 모달 */}
      <Modal open={leadNoticeOpen} onClose={() => setLeadNoticeOpen(false)}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>우리 현장 공지 작성</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
          {mySiteNames.join("·") || "소속 현장"} 근무자들에게만 전달돼요. 관리자도 이 공지를 확인할 수 있어요.
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          <Field label="제목">
            <input value={leadNoticeForm.title} onChange={(e) => setLeadNoticeForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="예: 내일 오전 안전점검 있습니다" style={inputStyle} />
          </Field>
          <Field label="내용 (선택)">
            <textarea value={leadNoticeForm.message} onChange={(e) => setLeadNoticeForm((f) => ({ ...f, message: e.target.value }))}
              rows={3} style={{ ...inputStyle, resize: "none" }} />
          </Field>
          <Field label="며칠간 보여줄지">
            <input type="number" min="1" value={leadNoticeForm.days} onChange={(e) => setLeadNoticeForm((f) => ({ ...f, days: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setLeadNoticeOpen(false)}>취소</Btn>
          <Btn full onClick={submitLeadNotice}>공지 보내기</Btn>
        </div>
      </Modal>

      {/* 현장 게시물 보기 · 현장 매뉴얼 */}
      {worker && (myVisibleReports.length > 0 || myManuals.length > 0) && (
        <div className="w-full grid grid-cols-2 gap-2" style={{ maxWidth: 320, marginTop: 8 }}>
          {myVisibleReports.length > 0 ? (
            <button onClick={() => setGalleryOpen(true)} className="flex items-center justify-center gap-1.5 relative"
              style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 12.5, fontWeight: 800 }}>
              <ImageIcon size={14} /> 현장 게시물 ({myVisibleReports.length})
            </button>
          ) : <div />}
          {myManuals.length > 0 ? (
            <button onClick={() => setManualOpen(true)} className="flex items-center justify-center gap-1.5"
              style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 12.5, fontWeight: 800 }}>
              <FileText size={14} /> 현장 매뉴얼 ({myManuals.length})
            </button>
          ) : <div />}
        </div>
      )}

      {/* 현장 게시물 갤러리 */}
      <Modal open={galleryOpen} onClose={() => setGalleryOpen(false)}>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>현장 게시물</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 3, marginBottom: 14 }}>
          {myLeaderSiteIds.length > 0 ? "우리 현장의 사진·영상을 모두 볼 수 있어요." : "우리 현장 팀장이 올린 사진·영상만 보여요."}
        </div>
        {myVisibleReports.length === 0 ? (
          <div style={{ fontSize: 13, color: C.sub, padding: "20px 0", textAlign: "center" }}>아직 게시물이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {myVisibleReports.map((r) => (
              <div key={r.id} onClick={() => setGalleryViewer(r)} className="pressable" style={{ cursor: "pointer" }}>
                <div style={{ position: "relative", borderRadius: RADIUS_SM, overflow: "hidden", boxShadow: SHADOW_SM, aspectRatio: "1", background: "#000" }}>
                  {r.kind === "video" ? (
                    <>
                      <video src={photoUrl(r.photoId)} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: 0, height: 0, borderTop: "6px solid transparent", borderBottom: "6px solid transparent", borderLeft: "10px solid #fff", marginLeft: 2 }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={photoUrl(r.photoId)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  )}
                  {r.authorRole === "leader" && (
                    <span style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 5px" }}>팀장</span>
                  )}
                  {r.authorRole === "admin" && (
                    <span style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 900, color: "#fff", background: C.aquaDeep, padding: "1px 5px" }}>관리자</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: C.onDarkSub, marginTop: 3 }}>{r.workerName} · {r.date.slice(5)}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <Modal open={!!galleryViewer} onClose={() => setGalleryViewer(null)}>
        {galleryViewer && (
          <>
            {galleryViewer.kind === "video" ? (
              <video src={photoUrl(galleryViewer.photoId)} controls autoPlay style={{ width: "100%", borderRadius: RADIUS_SM, display: "block", background: "#000" }} />
            ) : (
              <img src={photoUrl(galleryViewer.photoId)} style={{ width: "100%", borderRadius: RADIUS_SM, display: "block" }} />
            )}
            <div className="flex items-center gap-2 mt-3">
              <span style={{ fontSize: 11, fontWeight: 800, color: C.sub }}>{galleryViewer.category}</span>
              {galleryViewer.authorRole === "leader" && <span style={{ fontSize: 10, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 5px" }}>팀장</span>}
              {galleryViewer.authorRole === "admin" && <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: C.aquaDeep, padding: "1px 5px" }}>관리자</span>}
              <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>{galleryViewer.siteName} · {galleryViewer.workerName} · {galleryViewer.date}</span>
            </div>
            {galleryViewer.note && <div style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.6 }}>{galleryViewer.note}</div>}
          </>
        )}
      </Modal>

      {/* 현장 매뉴얼 */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)}>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>현장 매뉴얼</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 3, marginBottom: 14 }}>관리자가 등록한 우리 현장 매뉴얼이에요.</div>
        {myManuals.length === 0 ? (
          <div style={{ fontSize: 13, color: C.sub, padding: "20px 0", textAlign: "center" }}>등록된 매뉴얼이 없습니다.</div>
        ) : (
          <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
            {myManuals.map((m) => (
              <a key={m.id} href={photoUrl(m.fileId)} target="_blank" rel="noreferrer" className="pressable" style={{ display: "block" }}>
                <Tile style={{ padding: "13px 14px" }}>
                  <div className="flex items-center gap-2.5">
                    <FileText size={18} color={C.aquaDeep} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text }}>{m.fileName}</div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{m.siteName} · 열람/다운로드</div>
                    </div>
                  </div>
                </Tile>
              </a>
            ))}
          </div>
        )}
      </Modal>

      {/* 현장 사진 등록 · 용품 요청 */}
      <div className="w-full grid grid-cols-2 gap-2" style={{ maxWidth: 320, marginTop: 8 }}>
        <button onClick={openPhoto} className="flex items-center justify-center gap-1.5"
          style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 12.5, fontWeight: 800 }}>
          <Camera size={14} /> 현장 사진 등록
        </button>
        <button onClick={openSupply} className="flex items-center justify-center gap-1.5"
          style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, padding: "12px 0", color: C.onDark, fontSize: 12.5, fontWeight: 800 }}>
          <Package size={14} /> 용품 요청
        </button>
      </div>

      {/* 현장 사진 등록 작성 */}
      <Modal open={photoOpen} onClose={() => !photoBusy && setPhotoOpen(false)}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>현장 {photoForm.kind === "video" ? "영상" : "사진"} 등록</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
          시설 훼손, 작업 전후 등을 기록으로 남기면 관리자가 현장·날짜별로 확인할 수 있어요.
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          <Field label="유형">
            <div className="grid grid-cols-2 gap-1.5">
              {[["photo", "사진", Camera], ["video", "동영상", ImageIcon]].map(([k, l, Icon]) => (
                <button key={k} onClick={() => setPhotoForm((f) => ({ ...f, kind: k, file: null, preview: "" }))}
                  className="flex items-center justify-center gap-1.5"
                  style={{ padding: "9px 0", fontSize: 12.5, fontWeight: 800, background: photoForm.kind === k ? C.aquaDeep : C.tileSoft, color: photoForm.kind === k ? "#fff" : C.sub }}>
                  <Icon size={13} />{l}
                </button>
              ))}
            </div>
          </Field>
          {myWorkerSiteIds2.length > 1 && (
            <Field label="현장">
              <select value={photoForm.siteId} onChange={(e) => setPhotoForm((f) => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
                {myWorkerSiteIds2.map((id) => sites.find((s) => s.id === id)).filter(Boolean).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="구분">
            <div className="grid grid-cols-2 gap-1.5">
              {["작업 전", "작업 후", "시설 훼손", "기타"].map((c) => (
                <button key={c} onClick={() => setPhotoForm((f) => ({ ...f, category: c }))}
                  style={{ padding: "9px 0", fontSize: 12.5, fontWeight: 800, background: photoForm.category === c ? C.aquaDeep : C.tileSoft, color: photoForm.category === c ? "#fff" : C.sub }}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label={photoForm.kind === "video" ? "동영상" : "사진"}>
            {photoForm.preview ? (
              <div className="relative">
                {photoForm.kind === "video" ? (
                  <video src={photoForm.preview} controls style={{ width: "100%", borderRadius: RADIUS_SM, display: "block", background: "#000" }} />
                ) : (
                  <img src={photoForm.preview} style={{ width: "100%", borderRadius: RADIUS_SM, display: "block" }} />
                )}
                <button onClick={() => setPhotoForm((f) => ({ ...f, file: null, preview: "" }))}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 999, padding: 6 }}>
                  <X size={14} color="#fff" />
                </button>
              </div>
            ) : (
              <label style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                border: `1.5px dashed ${C.line}`, borderRadius: RADIUS_SM, padding: "28px 0", cursor: "pointer", background: C.tileSoft,
              }}>
                <Camera size={22} color={C.sub} />
                <div style={{ fontSize: 12.5, color: C.sub, fontWeight: 700, marginTop: 8 }}>
                  눌러서 {photoForm.kind === "video" ? "영상 촬영 또는 선택" : "사진 촬영 또는 선택"}
                </div>
                <input type="file" accept={photoForm.kind === "video" ? "video/*" : "image/*"} style={{ display: "none" }}
                  onChange={(e) => pickPhotoFile(e.target.files?.[0])} />
              </label>
            )}
            {photoForm.kind === "video" && (
              <div style={{ fontSize: 11.5, color: C.amber, marginTop: 6, lineHeight: 1.5 }}>
                가능하면 15초 이내로 짧게 촬영해 주세요. 길게 찍으면 업로드가 오래 걸리거나 실패할 수 있어요 (최대 25MB).
              </div>
            )}
          </Field>
          <Field label="메모 (선택)">
            <textarea value={photoForm.note} onChange={(e) => setPhotoForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="예: 3층 창틀 파손 확인" rows={2} style={{ ...inputStyle, resize: "none" }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full disabled={photoBusy} onClick={() => setPhotoOpen(false)}>취소</Btn>
          <Btn full disabled={photoBusy} onClick={submitPhoto}>{photoBusy ? "업로드 중…" : "등록하기"}</Btn>
        </div>
      </Modal>

      {/* 용품 요청 작성 */}
      <Modal open={supplyOpen} onClose={() => setSupplyOpen(false)}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>근무 용품 요청</div>
        <div className="mt-4 flex flex-col gap-2.5">
          {sites.length > 1 && (
            <Field label="현장">
              <select value={supplyForm.siteId} onChange={(e) => setSupplyForm((f) => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="품목">
            <input value={supplyForm.itemName} onChange={(e) => setSupplyForm((f) => ({ ...f, itemName: e.target.value }))}
              placeholder="예: 고무장갑, 세제, 대걸레" style={inputStyle} />
          </Field>
          <Field label="수량">
            <input type="number" min="1" value={supplyForm.qty} onChange={(e) => setSupplyForm((f) => ({ ...f, qty: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="메모 (선택)">
            <textarea value={supplyForm.note} onChange={(e) => setSupplyForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="예: 빨리 필요해요" rows={2} style={{ ...inputStyle, resize: "none" }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setSupplyOpen(false)}>취소</Btn>
          <Btn full onClick={submitSupply}>요청 보내기</Btn>
        </div>
      </Modal>

      {/* 양도 요청 작성 */}
      <Modal open={xferOpen} onClose={() => setXferOpen(false)}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>근무 양도 요청</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
          선택한 날짜의 근무를 다른 사람에게 대신 부탁해요. 관리자가 확인하고 승인하면 반영돼요.
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          <Field label="날짜">
            <input type="date" value={xferForm.date} onChange={(e) => setXferForm((f) => ({ ...f, date: e.target.value }))} style={inputStyle} />
          </Field>
          <Field label="현장">
            <select value={xferForm.siteId} onChange={(e) => setXferForm((f) => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
              {sites.length === 0 && <option value="">등록된 현장이 없습니다</option>}
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="대신 근무할 사람 (여러 명 가능)">
            <div className="flex flex-col gap-2">
              {xferForm.names.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" value={name}
                    onChange={(e) => {
                      const next = [...xferForm.names]; next[i] = e.target.value;
                      setXferForm((f) => ({ ...f, names: next }));
                    }}
                    placeholder="이름 (예: 김관리자)" style={inputStyle} />
                  {xferForm.names.length > 1 && (
                    <button onClick={() => setXferForm((f) => ({ ...f, names: f.names.filter((_, idx) => idx !== i) }))}>
                      <X size={16} color={C.sub} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setXferForm((f) => ({ ...f, names: [...f.names, ""] }))}
              className="flex items-center gap-1 mt-2" style={{ fontSize: 12, fontWeight: 800, color: C.aquaDeep }}>
              <Plus size={13} /> 대신할 사람 추가
            </button>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8, lineHeight: 1.5 }}>
              예: 2시간 근무를 1시간씩 두 명이 나눠서 대신할 경우, 이름을 두 명 다 추가해 주세요. 각각 별도 요청으로 접수되고, 관리자가 "양도" 탭에서 확인 후 승인 처리해요.
            </div>
          </Field>
          <Field label="메시지 (선택)">
            <textarea value={xferForm.message} onChange={(e) => setXferForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="예: 그날 병원 예약이 있어서 부탁드려요" rows={2} style={{ ...inputStyle, resize: "none" }} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setXferOpen(false)}>취소</Btn>
          <Btn full onClick={submitXfer}>요청 보내기</Btn>
        </div>
      </Modal>

      {/* 공지사항 */}
      <Modal open={!!noticeShown} onClose={dismissNotice}>
        {noticeShown && (
          <>
            <div className="flex items-center gap-2" style={{ color: C.blue, fontSize: 11.5, fontWeight: 800 }}>
              <Bell size={13} /> 공지사항
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginTop: 8, lineHeight: 1.35 }}>{noticeShown.title}</div>
            {noticeShown.message && (
              <div style={{ fontSize: 14, color: C.sub, marginTop: 10, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{noticeShown.message}</div>
            )}
            <div className="mt-5">
              <Btn full onClick={dismissNotice}>확인했어요{noticeQueue.length > 0 ? ` (다음 공지 ${noticeQueue.length}건)` : ""}</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* 재확인 팝업 */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1.35 }}>
          {confirm === "in" ? "출근 처리 하시겠습니까?" : "퇴근 처리 하시겠습니까?"}
        </div>

        {/* 현장 확인 배너 */}
        <div className="mt-4 flex items-start gap-2.5" style={{
          padding: "12px 13px",
          background: chk.state === "inside" ? "#FBF0DC" : chk.state === "loading" ? C.tileSoft : chk.state === "nogeo" ? C.tileSoft : "#FFF4E0",
          border: `1px solid ${chk.state === "inside" ? C.aquaDeep : chk.state === "outside" || chk.state === "fail" ? C.amber : C.line}`,
        }}>
          {chk.state === "loading" && <Loader2 size={17} className="animate-spin" color={C.sub} style={{ flexShrink: 0, marginTop: 1 }} />}
          {chk.state === "inside" && <Crosshair size={17} color={C.aquaDeep} style={{ flexShrink: 0, marginTop: 1 }} />}
          {(chk.state === "outside" || chk.state === "fail") && <ShieldAlert size={17} color={C.amber} style={{ flexShrink: 0, marginTop: 1 }} />}
          {(chk.state === "nogeo" || chk.state === "outdone") && <MapPin size={17} color={C.sub} style={{ flexShrink: 0, marginTop: 1 }} />}
          <div style={{ minWidth: 0 }}>
            {chk.state === "loading" && <div style={{ fontSize: 13.5, fontWeight: 700, color: C.sub }}>현장 위치를 확인하고 있습니다…</div>}
            {chk.state === "inside" && (
              <>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{chk.site.name} 현장 안</div>
                <div style={{ fontSize: 13.5, color: C.sub, marginTop: 2, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>중심에서 {dist(chk.d)} · 허용 반경 {chk.site.radius}m</div>
              </>
            )}
            {chk.state === "outside" && (
              <>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>현장에서 벗어나 있습니다</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.55 }}>
                  가장 가까운 {chk.site.name}까지 {dist(chk.d)}. 현장에 도착한 뒤 다시 눌러주세요.
                </div>
              </>
            )}
            {chk.state === "fail" && (
              <>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>위치를 확인할 수 없습니다</div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, lineHeight: 1.55 }}>
                  {confirm === "in"
                    ? "휴대폰 위치 권한을 켜고 실외에서 다시 시도해 주세요. 계속 안 되면 관리자에게 알려주세요."
                    : "위치 없이 퇴근 시각만 기록됩니다."}
                </div>
              </>
            )}
            {chk.state === "nogeo" && (
              <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.55 }}>
                현장 좌표가 아직 등록되지 않아 위치 확인 없이 기록됩니다.
              </div>
            )}
            {chk.state === "outdone" && (
              <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                {chk.d == null ? "현장 좌표 없음" : `${chk.site.name}에서 ${dist(chk.d)}`}
                {chk.outside && <span style={{ color: C.amber, fontWeight: 800 }}> · 현장 밖 퇴근으로 표시됩니다</span>}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-0.5" style={{ background: C.line }}>
          <Tile soft style={{ padding: "11px 14px" }}><Row k="근무자" v={worker.name} /></Tile>
          <Tile soft style={{ padding: "11px 14px" }}>
            <Row k={confirm === "in" ? "출근 시각" : "퇴근 시각"} v={`${now.getMonth() + 1}/${now.getDate()} ${pad(now.getHours())}:${pad(now.getMinutes())}`} mono />
          </Tile>
          {confirm === "out" && open && (
            <Tile soft style={{ padding: "11px 14px" }}><Row k="근무시간" v={hm((now.getTime() - new Date(open.clockIn).getTime()) / 3600000)} mono /></Tile>
          )}
          <Tile soft style={{ padding: "11px 14px" }}>
            {confirm === "in" && chk.state === "nogeo" && sites.length > 1 ? (
              <div className="flex items-center justify-between gap-3">
                <span style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>현장</span>
                <select value={manualSite} onChange={(e) => setManualSite(e.target.value)}
                  style={{ ...inputStyle, width: "auto", padding: "6px 8px", fontSize: 13.5, fontWeight: 800, background: C.tile }}>
                  {sites.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <Row k="현장" v={
                confirm === "out" ? open.site
                  : chk.state === "inside" ? chk.site.name
                    : chk.state === "nogeo" ? (manualSite || "현장 미지정") : "확인 중"
              } />
            )}
          </Tile>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setConfirm(null)}>{canGo ? "취소" : "닫기"}</Btn>
          <Btn full disabled={!canGo} onClick={confirm === "in" ? doClockIn : doClockOut}>
            {confirm === "in" ? "출근하기" : "퇴근하기"}
          </Btn>
        </div>
      </Modal>

      {calOpen && worker && (
        <AttendanceCalendar data={data} workerId={worker.id} onClose={() => setCalOpen(false)} update={update} canAdd={!!worker.canSelfLogOneOff} setToast={setToast} />
      )}
    </div>
  );
}

/* ─────────────────────────  관리자 잠금  ───────────────────────── */
function AdminGate({ data, update, setToast, onPass }) {
  const saved = data.settings.adminPin;
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState("");
  const [err, setErr] = useState("");
  const [reset, setReset] = useState(false);
  const creating = !saved;

  const submit = (v) => {
    if (creating) {
      if (!first) { setFirst(v); setPin(""); return; }
      if (first === v) { update((d) => ({ ...d, settings: { ...d.settings, adminPin: v } })); setToast("관리자 PIN을 설정했습니다"); onPass(); }
      else { setErr("두 번 입력한 번호가 다릅니다"); setFirst(""); setPin(""); }
      return;
    }
    if (v === saved) onPass();
    else { setErr("PIN이 맞지 않습니다"); setPin(""); }
  };
  const push = (n) => {
    if (pin.length >= 4) return;
    const next = pin + n;
    setPin(next); setErr("");
    if (next.length === 4) setTimeout(() => submit(next), 130);
  };

  return (
    <div className="flex flex-col items-center px-6" style={{ flex: 1, paddingTop: 52, paddingBottom: 24 }}>
      <ShieldCheck size={30} color={C.aqua} />
      <div style={{ color: C.onDark, fontSize: 21, fontWeight: 900, marginTop: 14 }}>
        {creating ? (first ? "한 번 더 입력하세요" : "관리자 PIN을 만드세요") : "관리자 PIN을 입력하세요"}
      </div>
      <div style={{ color: C.onDarkSub, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 1.6, maxWidth: 300 }}>
        근무 기록과 급여, 기기 연결은 이 번호를 아는 사람만 다룰 수 있습니다.
      </div>

      <div className="flex gap-3 mt-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 15, height: 15, borderRadius: 999, background: i < pin.length ? C.aqua : "transparent", border: `2px solid ${i < pin.length ? C.aqua : C.lineDark}` }} />
        ))}
      </div>
      <div style={{ color: C.coral, fontSize: 12.5, fontWeight: 700, marginTop: 12, minHeight: 18 }}>{err}</div>

      <div className="grid grid-cols-3 gap-0.5 mt-3" style={{ background: C.grout, width: "100%", maxWidth: 300 }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) => (
          <button key={i} disabled={k === ""} onClick={() => (k === "del" ? setPin(pin.slice(0, -1)) : k && push(k))}
            className="flex items-center justify-center"
            style={{ background: k === "" ? C.bg : C.bgSoft, height: 62, color: C.onDark, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 22, fontWeight: 700 }}>
            {k === "del" ? <Delete size={20} color={C.onDarkSub} /> : k}
          </button>
        ))}
      </div>

      {!creating && (
        <button onClick={() => setReset(true)} style={{ color: C.onDarkSub, fontSize: 12, marginTop: 20, textDecoration: "underline" }}>
          PIN을 잊으셨나요?
        </button>
      )}

      <Modal open={reset} onClose={() => setReset(false)} title="PIN 재설정">
        <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.65 }}>
          PIN을 되찾을 방법은 없습니다. 계속하면 근무자, 현장, 모든 출퇴근 기록이 함께 지워지고 처음부터 다시 시작합니다.
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setReset(false)}>취소</Btn>
          <Btn kind="danger" full onClick={() => { update(DEFAULTS); setReset(false); setPin(""); setToast("초기화했습니다"); }}>지우고 다시 시작</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────────  관리자 영역  ───────────────────────── */
function AdminArea({ data, update, dev, updateDev, setToast, onLock }) {
  const [view, setView] = useState("records");
  const [seenTick, setSeenTick] = useState(0); // 배지 갱신 트리거

  const lastSeenPhotos = localStorage.getItem("cleanwork:lastSeenPhotos") || "";
  const photoBadge = (data.siteReports || []).filter((r) => r.createdAt > lastSeenPhotos).length;
  const supplyBadge = (data.supplyRequests || []).filter((r) => r.status === "requested").length;

  const goView = (k) => {
    setView(k);
    if (k === "photos") { localStorage.setItem("cleanwork:lastSeenPhotos", new Date().toISOString()); setSeenTick((t) => t + 1); }
  };

  const tabs = [
    ["records", "근무 기록", ClipboardList, 0],
    ["transfers", "양도", Repeat, 0],
    ["photos", "사진", Camera, photoBadge],
    ["supplies", "용품", Package, supplyBadge],
    ["notices", "공지", Bell, 0],
    ["settings", "설정", SettingsIcon, 0],
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center px-4 pt-4 gap-2">
        <div className="flex gap-0.5" style={{ background: C.grout, flex: 1, overflowX: "auto" }}>
          {tabs.map(([k, l, I, badge]) => (
            <button key={k} onClick={() => goView(k)} className="relative flex items-center justify-center gap-1.5 py-2.5 px-3"
              style={{ background: view === k ? C.aqua : C.bgSoft, color: view === k ? C.bg : C.onDarkSub, fontSize: 12.5, fontWeight: 800, flexShrink: 0, whiteSpace: "nowrap" }}>
              <I size={13} />{l}
              {badge > 0 && (
                <span style={{
                  position: "absolute", top: 3, right: 3, minWidth: 15, height: 15, borderRadius: 999,
                  background: C.red, color: "#fff", fontSize: 9, fontWeight: 900,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
                }}>{badge > 9 ? "9+" : badge}</span>
              )}
            </button>
          ))}
        </div>
        <button onClick={onLock} className="flex items-center justify-center" title="잠그기"
          style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}`, width: 42, height: 40, flexShrink: 0 }}>
          <Lock size={16} color={C.onDarkSub} />
        </button>
      </div>
      {view === "records" && <RecordsView data={data} update={update} setToast={setToast} />}
      {view === "transfers" && <TransferAdminView data={data} update={update} setToast={setToast} />}
      {view === "photos" && <PhotoAdminView data={data} update={update} setToast={setToast} />}
      {view === "supplies" && <SupplyAdminView data={data} update={update} setToast={setToast} />}
      {view === "notices" && <NoticeAdminView data={data} update={update} setToast={setToast} />}
      {view === "settings" && <SettingsView data={data} update={update} dev={dev} updateDev={updateDev} setToast={setToast} />}
    </div>
  );
}

/* ─────────────────────────  현장 사진 관리(관리자, 폴더 구조)  ───────────────────────── */
/* 관리자가 현장 검수 중 사진·영상을 직접 등록하는 모달 */
function AdminUploadModal({ open, onClose, form, setForm, sites, busy, onSubmit, onPickFile }) {
  return (
    <Modal open={open} onClose={() => !busy && onClose()}>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>현장 {form.kind === "video" ? "영상" : "사진"} 등록</div>
      <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
        검수 중 촬영한 사진·영상을 등록하면, 그 현장 근무자·팀장 전체에게 보여요.
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        <Field label="유형">
          <div className="grid grid-cols-2 gap-1.5">
            {[["photo", "사진", Camera], ["video", "동영상", ImageIcon]].map(([k, l, Icon]) => (
              <button key={k} onClick={() => setForm((f) => ({ ...f, kind: k, file: null, preview: "" }))}
                className="flex items-center justify-center gap-1.5"
                style={{ padding: "9px 0", fontSize: 12.5, fontWeight: 800, background: form.kind === k ? C.aquaDeep : C.tileSoft, color: form.kind === k ? "#fff" : C.sub }}>
                <Icon size={13} />{l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="현장">
          <select value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} style={inputStyle}>
            {sites.length === 0 && <option value="">등록된 현장이 없습니다</option>}
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="구분">
          <div className="grid grid-cols-2 gap-1.5">
            {["작업 전", "작업 후", "시설 훼손", "기타"].map((c) => (
              <button key={c} onClick={() => setForm((f) => ({ ...f, category: c }))}
                style={{ padding: "9px 0", fontSize: 12.5, fontWeight: 800, background: form.category === c ? C.aquaDeep : C.tileSoft, color: form.category === c ? "#fff" : C.sub }}>{c}</button>
            ))}
          </div>
        </Field>
        <Field label={form.kind === "video" ? "동영상" : "사진"}>
          {form.preview ? (
            <div className="relative">
              {form.kind === "video" ? (
                <video src={form.preview} controls style={{ width: "100%", borderRadius: RADIUS_SM, display: "block", background: "#000" }} />
              ) : (
                <img src={form.preview} style={{ width: "100%", borderRadius: RADIUS_SM, display: "block" }} />
              )}
              <button onClick={() => setForm((f) => ({ ...f, file: null, preview: "" }))}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", borderRadius: 999, padding: 6 }}>
                <X size={14} color="#fff" />
              </button>
            </div>
          ) : (
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: `1.5px dashed ${C.line}`, borderRadius: RADIUS_SM, padding: "28px 0", cursor: "pointer", background: C.tileSoft,
            }}>
              <Camera size={22} color={C.sub} />
              <div style={{ fontSize: 12.5, color: C.sub, fontWeight: 700, marginTop: 8 }}>눌러서 {form.kind === "video" ? "영상 선택" : "사진 선택"}</div>
              <input type="file" accept={form.kind === "video" ? "video/*" : "image/*"} style={{ display: "none" }}
                onChange={(e) => onPickFile(e.target.files?.[0])} />
            </label>
          )}
        </Field>
        <Field label="메모 (선택)">
          <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="예: 3층 창틀 파손 확인, 조치 요청" rows={2} style={{ ...inputStyle, resize: "none" }} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Btn kind="ghost" full disabled={busy} onClick={onClose}>취소</Btn>
        <Btn full disabled={busy} onClick={onSubmit}>{busy ? "업로드 중…" : "등록하기"}</Btn>
      </div>
    </Modal>
  );
}

function PhotoAdminView({ data, update, setToast }) {
  const reports = data.siteReports || [];
  const [siteId, setSiteId] = useState(null);
  const [workerId, setWorkerId] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ siteId: "", category: "작업 후", note: "", file: null, preview: "", kind: "photo" });
  const [uploadBusy, setUploadBusy] = useState(false);

  const catColor = { "시설 훼손": C.red, "작업 전": C.blue, "작업 후": C.aquaDeep, "기타": C.sub };

  const openUpload = (presetSiteId) => {
    setUploadForm({ siteId: presetSiteId || data.sites[0]?.id || "", category: "작업 후", note: "", file: null, preview: "", kind: "photo" });
    setUploadOpen(true);
  };
  const pickUploadFile = (f) => {
    if (!f) return;
    setUploadForm((p) => ({ ...p, file: f, preview: URL.createObjectURL(f) }));
  };
  const submitAdminUpload = async () => {
    if (!uploadForm.file) { setToast(uploadForm.kind === "video" ? "영상을 먼저 선택해 주세요" : "사진을 먼저 선택해 주세요"); return; }
    const s = data.sites.find((x) => x.id === uploadForm.siteId);
    setUploadBusy(true);
    try {
      const mediaId = uploadForm.kind === "video" ? await uploadVideo(uploadForm.file) : await uploadPhoto(uploadForm.file);
      update((d) => ({
        ...d,
        siteReports: [...(d.siteReports || []), {
          id: uid(), date: dKey(new Date()), siteId: s?.id || null, siteName: s?.name || "현장 미지정",
          workerId: null, workerName: "관리자", authorRole: "admin",
          category: uploadForm.category, note: uploadForm.note.trim(), photoId: mediaId, kind: uploadForm.kind,
          createdAt: new Date().toISOString(),
        }],
      }));
      setToast(uploadForm.kind === "video" ? "영상을 등록했습니다" : "사진을 등록했습니다");
      setUploadOpen(false);
    } catch (e) {
      setToast(e.message || "업로드에 실패했습니다 — 인터넷 연결을 확인해 주세요");
    } finally {
      setUploadBusy(false);
    }
  };

  if (reports.length === 0) {
    return (
      <div className="flex-1 p-4">
        <Btn full onClick={() => openUpload()}>
          <span className="flex items-center justify-center gap-2"><Camera size={15} /> 사진·영상 등록 (관리자)</span>
        </Btn>
        <Tile style={{ marginTop: 10 }}><div style={{ color: C.sub, fontSize: 13 }}>등록된 현장 사진이 없습니다.</div></Tile>
        <AdminUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} form={uploadForm} setForm={setUploadForm}
          sites={data.sites} busy={uploadBusy} onSubmit={submitAdminUpload} onPickFile={pickUploadFile} />
      </div>
    );
  }

  // 1단계: 현장 폴더 목록
  if (!siteId) {
    const bySite = {};
    reports.forEach((r) => { (bySite[r.siteId || "none"] ||= { name: r.siteName, items: [] }).items.push(r); });
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Btn full onClick={() => openUpload()}>
          <span className="flex items-center justify-center gap-2"><Camera size={15} /> 사진·영상 등록 (관리자)</span>
        </Btn>
        <div className="mt-4"><Eyebrow dark>현장별로 묶어서 보여드려요 · 눌러서 열기</Eyebrow></div>
        <div className="flex flex-col gap-0.5 mt-2" style={{ background: C.grout }}>
          {Object.entries(bySite).map(([sid, g]) => (
            <Tile key={sid} onClick={() => setSiteId(sid)} style={{ padding: "14px 16px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Folder size={18} color={C.aquaDeep} />
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{g.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>{g.items.length}개</span>
                  <ChevronRight size={16} color={C.sub} />
                </div>
              </div>
            </Tile>
          ))}
        </div>
        <AdminUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} form={uploadForm} setForm={setUploadForm}
          sites={data.sites} busy={uploadBusy} onSubmit={submitAdminUpload} onPickFile={pickUploadFile} />
      </div>
    );
  }

  const siteItems = reports.filter((r) => (r.siteId || "none") === siteId);
  const siteName = siteItems[0]?.siteName || "현장";

  // 2단계: 근무자 폴더 목록
  if (!workerId) {
    const byWorker = {};
    siteItems.forEach((r) => { (byWorker[r.workerId || "none"] ||= { name: r.workerName, items: [] }).items.push(r); });
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <button onClick={() => setSiteId(null)} className="flex items-center gap-1.5 mb-3" style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>
          <ArrowLeft size={14} /> 현장 목록
        </button>
        <div className="flex items-center gap-2 mb-3">
          <Folder size={18} color={C.aquaDeep} />
          <div style={{ fontSize: 17, fontWeight: 900, color: C.text }}>{siteName}</div>
        </div>
        <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
          {Object.entries(byWorker).map(([wid, g]) => (
            <Tile key={wid} onClick={() => setWorkerId(wid)} style={{ padding: "14px 16px" }}>
              <div className="flex items-center justify-between">
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{g.name}</div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>{g.items.length}개</span>
                  <ChevronRight size={16} color={C.sub} />
                </div>
              </div>
            </Tile>
          ))}
        </div>
      </div>
    );
  }

  // 3단계: 실제 사진 목록
  const items = siteItems.filter((r) => (r.workerId || "none") === workerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const workerName = items[0]?.workerName || "근무자";

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <button onClick={() => setWorkerId(null)} className="flex items-center gap-1.5 mb-3" style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>
        <ArrowLeft size={14} /> {siteName}
      </button>
      <div style={{ fontSize: 17, fontWeight: 900, color: C.text, marginBottom: 12 }}>{workerName}</div>

      <div className="grid grid-cols-2 gap-2">
        {items.map((r) => (
          <div key={r.id} onClick={() => setViewer(r)} className="pressable" style={{ cursor: "pointer" }}>
            <div style={{ position: "relative", borderRadius: RADIUS_SM, overflow: "hidden", boxShadow: SHADOW_SM, aspectRatio: "1", background: "#000" }}>
              {r.kind === "video" ? (
                <>
                  <video src={photoUrl(r.photoId)} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(0,0,0,0.25)",
                  }}>
                    <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 0, height: 0, borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderLeft: "11px solid #fff", marginLeft: 3 }} />
                    </div>
                  </div>
                </>
              ) : (
                <img src={photoUrl(r.photoId)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
              <span style={{
                position: "absolute", top: 6, left: 6, fontSize: 9.5, fontWeight: 800, color: "#fff",
                background: catColor[r.category] || C.sub, padding: "2px 6px",
              }}>{r.category}</span>
            </div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{r.date.slice(5).replace("-", "/")}</div>
          </div>
        ))}
      </div>

      <Modal open={!!viewer} onClose={() => setViewer(null)}>
        {viewer && (
          <>
            {viewer.kind === "video" ? (
              <video src={photoUrl(viewer.photoId)} controls autoPlay style={{ width: "100%", borderRadius: RADIUS_SM, display: "block", background: "#000" }} />
            ) : (
              <img src={photoUrl(viewer.photoId)} style={{ width: "100%", borderRadius: RADIUS_SM, display: "block" }} />
            )}
            <div className="flex items-center gap-2 mt-3">
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: catColor[viewer.category] || C.sub, padding: "3px 8px" }}>{viewer.category}</span>
              <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>{viewer.siteName} · {viewer.workerName} · {viewer.date}</span>
            </div>
            {viewer.note && <div style={{ fontSize: 13, color: C.text, marginTop: 8, lineHeight: 1.6 }}>{viewer.note}</div>}
            <button onClick={() => {
              update((d) => ({ ...d, siteReports: (d.siteReports || []).filter((x) => x.id !== viewer.id) }));
              setViewer(null); setToast("삭제했습니다");
            }} className="flex items-center gap-1 mt-4" style={{ fontSize: 12.5, color: C.coral, fontWeight: 700 }}>
              <Trash2 size={14} /> 이 사진 삭제
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}

/* ─────────────────────────  용품 요청 관리(관리자)  ───────────────────────── */
function SupplyAdminView({ data, update, setToast }) {
  const [filter, setFilter] = useState("all");
  const list = [...(data.supplyRequests || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = filter === "all" ? list : list.filter((x) => x.status === filter);

  const setStatus = (id, status) => {
    update((d) => ({ ...d, supplyRequests: (d.supplyRequests || []).map((x) => (x.id === id ? { ...x, status, respondedAt: new Date().toISOString() } : x)) }));
    setToast("상태를 변경했습니다");
  };
  const remove = (id) => update((d) => ({ ...d, supplyRequests: (d.supplyRequests || []).filter((x) => x.id !== id) }));

  const badge = (status) => {
    const map = {
      requested: [C.aqua, C.bg, "요청됨"],
      approved: [C.blue, "#fff", "승인됨"],
      delivered: [C.aquaDeep, "#fff", "전달완료"],
      declined: [C.lineDark, C.onDarkSub, "거절됨"],
    };
    const [bg, col, label] = map[status] || map.requested;
    return <span style={{ fontSize: 10.5, fontWeight: 800, color: col, background: bg, padding: "2px 7px" }}>{label}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex gap-1.5 mb-3" style={{ overflowX: "auto" }}>
        {[["all", "전체"], ["requested", "요청"], ["approved", "승인"], ["delivered", "전달완료"], ["declined", "거절"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ fontSize: 12, fontWeight: 800, padding: "6px 11px", flexShrink: 0, background: filter === k ? C.aquaDeep : C.tileSoft, color: filter === k ? "#fff" : C.sub }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: "20px 4px" }}>용품 요청 내역이 없습니다.</div>}

      <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
        {shown.map((r) => (
          <Tile key={r.id} style={{ padding: "13px 14px" }}>
            <div className="flex items-start justify-between gap-2">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>{r.itemName} <span style={{ color: C.coral }}>×{r.qty}</span></div>
                <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, fontWeight: 700 }}>
                  {r.date.slice(5).replace("-", "/")} · {r.siteName} · {r.workerName}
                </div>
                {r.note && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{r.note}</div>}
              </div>
              {badge(r.status)}
            </div>
            <div className="flex gap-2 mt-3" style={{ overflowX: "auto" }}>
              {r.status === "requested" && (
                <>
                  <Btn kind="ghost" small onClick={() => setStatus(r.id, "declined")}>거절</Btn>
                  <Btn small onClick={() => setStatus(r.id, "approved")}>승인</Btn>
                </>
              )}
              {r.status === "approved" && <Btn small onClick={() => setStatus(r.id, "delivered")}>전달 완료 처리</Btn>}
              <button onClick={() => remove(r.id)} className="ml-auto flex items-center gap-1" style={{ fontSize: 12, color: C.sub, fontWeight: 700, flexShrink: 0 }}>
                <Trash2 size={13} /> 삭제
              </button>
            </div>
          </Tile>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────  근무 양도 관리(관리자)  ───────────────────────── */
function TransferAdminView({ data, update, setToast }) {
  const [filter, setFilter] = useState("all");
  const [assignPick, setAssignPick] = useState(null); // 지정 중인 transfer id
  const transfers = [...(data.transfers || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = filter === "all" ? transfers : filter === "needAction" ? transfers.filter((t) => t.status === "pending") : transfers.filter((t) => t.status === filter);

  const assignWorker = (id, w) => {
    update((d) => ({
      ...d,
      transfers: (d.transfers || []).map((t) => (t.id === id
        ? { ...t, status: "assigned", assignedWorkerId: w.id, assignedWorkerName: w.name, respondedAt: null }
        : t)),
    }));
    setToast(`${w.name}님에게 알림을 보냈습니다 — 본인 승인을 기다려요`);
    setAssignPick(null);
  };
  const approveDirect = (id) => {
    // 미등록 인원(예: 관리자 본인, 외부인)은 앱 계정이 없으니 관리자가 바로 확정
    update((d) => ({ ...d, transfers: (d.transfers || []).map((t) => (t.id === id ? { ...t, status: "approved", respondedAt: new Date().toISOString() } : t)) }));
    setToast("승인 처리했습니다 (미등록 인원 — 출근 기록은 수기로 등록해 주세요)");
  };
  const unassign = (id) => {
    update((d) => ({ ...d, transfers: (d.transfers || []).map((t) => (t.id === id ? { ...t, status: "pending", assignedWorkerId: null, assignedWorkerName: null } : t)) }));
    setToast("지정을 취소했습니다");
  };
  const setStatus = (id, status) => {
    update((d) => ({ ...d, transfers: (d.transfers || []).map((t) => (t.id === id ? { ...t, status, respondedAt: new Date().toISOString() } : t)) }));
    setToast(status === "declined" ? "거절 처리했습니다" : "삭제했습니다");
  };
  const remove = (id) => update((d) => ({ ...d, transfers: (d.transfers || []).filter((t) => t.id !== id) }));

  const badge = (status) => {
    const map = {
      pending: [C.aqua, C.bg, "관리자 확인 대기"],
      assigned: [C.blue, "#fff", "본인 승인 대기"],
      approved: [C.aquaDeep, "#fff", "승인 완료"],
      declined: [C.lineDark, C.onDarkSub, "거절됨"],
      cancelled: [C.lineDark, C.onDarkSub, "취소됨"],
    };
    const [bg, col, label] = map[status] || map.pending;
    return <span style={{ fontSize: 10.5, fontWeight: 800, color: col, background: bg, padding: "2px 7px", flexShrink: 0 }}>{label}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="flex gap-1.5 mb-3" style={{ overflowX: "auto" }}>
        {[["all", "전체"], ["pending", "확인 필요"], ["assigned", "승인 대기"], ["approved", "완료"], ["declined", "거절"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ fontSize: 12, fontWeight: 800, padding: "6px 11px", flexShrink: 0, background: filter === k ? C.aquaDeep : C.tileSoft, color: filter === k ? "#fff" : C.sub }}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: "20px 4px" }}>양도 요청 내역이 없습니다.</div>}

      <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
        {shown.map((t) => {
          const siteWorkers = (data.workers || []).filter((w) => {
            const wSites = w.siteIds || (w.siteId ? [w.siteId] : []);
            return !t.siteId || wSites.includes(t.siteId);
          });
          return (
            <Tile key={t.id} style={{ padding: "13px 14px" }}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                    {t.date.slice(5).replace("-", "/")} · {t.siteName}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap" style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>
                    {t.fromWorkerName} <ArrowRight size={12} /> "{t.toWorkerName}"님 요청
                  </div>
                  {t.assignedWorkerName && (
                    <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: 12.5, color: C.blue, fontWeight: 800 }}>
                      <ShieldCheck size={12} /> {t.assignedWorkerName}님으로 지정함
                    </div>
                  )}
                  {t.message && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>"{t.message}"</div>}
                  {t.status === "approved" && (
                    <div style={{ fontSize: 11.5, color: t.fulfilledRecordId ? C.blue : C.amber, marginTop: 4, fontWeight: 700 }}>
                      {t.fulfilledRecordId
                        ? "출근 완료 · 근무 기록에 반영됨"
                        : t.toWorkerId
                          ? `${t.toWorkerName}님 승인 완료 · 아직 출근 전`
                          : "승인됨 · 미등록 인원이라 출근 기록은 수기로 등록해 주세요"}
                    </div>
                  )}
                </div>
                {badge(t.status)}
              </div>

              {t.status === "pending" && (
                <div className="mt-3">
                  {assignPick === t.id ? (
                    <div className="flex flex-col gap-1.5">
                      <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 700, marginBottom: 2 }}>등록된 근무자 중에서 지정하세요</div>
                      <div className="flex flex-wrap gap-1.5">
                        {siteWorkers.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>이 현장에 등록된 근무자가 없어요.</div>}
                        {siteWorkers.map((w) => (
                          <button key={w.id} onClick={() => assignWorker(t.id, w)}
                            style={{ fontSize: 12, fontWeight: 800, padding: "6px 10px", background: C.tileSoft, color: C.text }}>
                            {w.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-1.5">
                        <Btn kind="ghost" small onClick={() => setAssignPick(null)}>취소</Btn>
                        <Btn kind="ghost" small onClick={() => approveDirect(t.id)}>등록 안 된 사람(예: 관리자) — 바로 승인</Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Btn kind="ghost" small onClick={() => setStatus(t.id, "declined")}>거절</Btn>
                      <Btn small onClick={() => setAssignPick(t.id)}>근무자 지정하기</Btn>
                    </div>
                  )}
                </div>
              )}
              {t.status === "assigned" && (
                <div className="flex gap-2 mt-3">
                  <Btn kind="ghost" small onClick={() => unassign(t.id)}>지정 취소</Btn>
                </div>
              )}

              <div className="flex justify-end mt-2">
                <button onClick={() => remove(t.id)} className="flex items-center gap-1" style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>
                  <Trash2 size={13} /> 삭제
                </button>
              </div>
            </Tile>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────  공지사항 관리(관리자)  ───────────────────────── */
function NoticeAdminView({ data, update, setToast }) {
  const { workers, sites } = data;
  const [edit, setEdit] = useState(null);
  const [viewer, setViewer] = useState(null);
  const notices = [...(data.notices || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = dKey(new Date());

  const openNew = () => setEdit({
    id: null, title: "", message: "", audience: "all", workerIds: [],
    mode: "range", targetDate: today, leadDays: 7, includeTarget: true,
    startDate: today, endDate: today, active: true,
  });

  const saveNotice = () => {
    if (!edit.title.trim()) { setToast("제목을 입력해 주세요"); return; }
    if (edit.audience === "site" && (edit.siteIds || []).length === 0) { setToast("현장을 한 곳 이상 선택해 주세요"); return; }
    let startDate = edit.startDate, endDate = edit.endDate;
    if (edit.mode === "target") {
      const t = parseKey(edit.targetDate);
      const s = new Date(t); s.setDate(s.getDate() - Number(edit.leadDays || 0));
      const e = new Date(t); if (!edit.includeTarget) e.setDate(e.getDate() - 1);
      startDate = dKey(s); endDate = dKey(e);
    }
    if (startDate > endDate) { setToast("종료일이 시작일보다 빨라요"); return; }
    const siteIds = edit.audience === "site" ? (edit.siteIds || []) : [];
    const siteName = siteIds.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join("·");
    const n = {
      id: edit.id || uid(), title: edit.title.trim(), message: edit.message.trim(),
      audience: edit.audience, workerIds: edit.audience === "custom" ? edit.workerIds : [],
      siteIds, siteName,
      startDate, endDate, active: edit.active,
      createdAt: edit.id ? edit.createdAt : new Date().toISOString(),
      createdBy: edit.id ? (edit.createdBy || "admin") : "admin", createdByName: edit.id ? (edit.createdByName || "관리자") : "관리자",
    };
    update((d) => ({ ...d, notices: edit.id ? (d.notices || []).map((x) => (x.id === n.id ? n : x)) : [...(d.notices || []), n] }));
    setEdit(null); setToast("공지를 저장했습니다");
  };
  const removeNotice = (id) => { update((d) => ({ ...d, notices: (d.notices || []).filter((x) => x.id !== id) })); setEdit(null); setToast("삭제했습니다"); };
  const toggleActive = (id) => update((d) => ({ ...d, notices: (d.notices || []).map((x) => (x.id === id ? { ...x, active: !x.active } : x)) }));

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <Btn full onClick={openNew}>
        <span className="flex items-center justify-center gap-2"><Plus size={15} /> 새 공지 작성</span>
      </Btn>

      <div className="flex flex-col gap-0.5 mt-3" style={{ background: C.grout }}>
        {notices.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>등록된 공지가 없습니다.</div></Tile>}
        {notices.map((n) => {
          const live = n.active && today >= n.startDate && today <= n.endDate;
          return (
            <Tile key={n.id} onClick={() => {
              if (n.createdBy && n.createdBy !== "admin") { setViewer(n); return; }
              setEdit({ ...n, mode: "range", leadDays: 7, targetDate: n.endDate, includeTarget: true, workerIds: n.workerIds || [] });
            }} style={{ padding: "13px 14px" }}>
              <div className="flex items-start justify-between gap-2">
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: C.text }}>{n.title}</span>
                    {live && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: C.blue, padding: "1px 5px" }}>노출 중</span>}
                    {!n.active && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.sub, border: `1px solid ${C.line}`, padding: "1px 5px" }}>꺼짐</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span style={{
                      fontSize: 9.5, fontWeight: 900, padding: "1px 5px",
                      color: n.createdBy === "admin" || !n.createdBy ? C.sub : "#7A4E07",
                      background: n.createdBy === "admin" || !n.createdBy ? "transparent" : C.amber,
                      border: n.createdBy === "admin" || !n.createdBy ? `1px solid ${C.line}` : "none",
                    }}>
                      {n.createdBy === "admin" || !n.createdBy ? "관리자 작성" : `팀장 · ${n.createdByName || "?"}`}
                    </span>
                  </div>
                  {n.message && <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>{n.message}</div>}
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 5, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {n.startDate.slice(5)} ~ {n.endDate.slice(5)} · {n.audience === "all" ? "전체 근무자" : n.audience === "site" ? `${n.siteName || "소속 현장"} 근무자` : `${(n.workerIds || []).length}명 지정`}
                  </div>
                </div>
                <Pencil size={14} color={C.sub} style={{ flexShrink: 0 }} />
              </div>
            </Tile>
          );
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)}>
        {edit && (
          <>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{edit.id ? "공지 수정" : "새 공지 작성"}</div>
            <div className="mt-4 flex flex-col gap-2.5">
              <Field label="제목"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="예: 이번 주 급여일 안내" style={inputStyle} /></Field>
              <Field label="내용 (선택)">
                <textarea value={edit.message} onChange={(e) => setEdit({ ...edit, message: e.target.value })} rows={3} style={{ ...inputStyle, resize: "none" }} />
              </Field>

              <Field label="받는 사람">
                <div className="grid grid-cols-3 gap-1.5">
                  {[["all", "전체 근무자"], ["site", "현장 선택"], ["custom", "선택한 사람만"]].map(([k, l]) => (
                    <button key={k} onClick={() => setEdit({ ...edit, audience: k })}
                      style={{ padding: "9px 0", fontSize: 12, fontWeight: 800, background: edit.audience === k ? C.aquaDeep : C.tileSoft, color: edit.audience === k ? "#fff" : C.sub }}>{l}</button>
                  ))}
                </div>
                {edit.audience === "site" && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sites.map((s) => {
                      const on = (edit.siteIds || []).includes(s.id);
                      return (
                        <button key={s.id} onClick={() => {
                          const cur = edit.siteIds || [];
                          setEdit({ ...edit, siteIds: on ? cur.filter((x) => x !== s.id) : [...cur, s.id] });
                        }} style={{ padding: "6px 10px", fontSize: 12, fontWeight: 800, background: on ? C.aquaDeep : C.tileSoft, color: on ? "#fff" : C.sub }}>
                          {s.name}
                        </button>
                      );
                    })}
                    {sites.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>등록된 현장이 없습니다.</div>}
                  </div>
                )}
                {edit.audience === "custom" && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {workers.map((w) => {
                      const on = (edit.workerIds || []).includes(w.id);
                      return (
                        <button key={w.id} onClick={() => {
                          const cur = edit.workerIds || [];
                          setEdit({ ...edit, workerIds: on ? cur.filter((x) => x !== w.id) : [...cur, w.id] });
                        }} style={{ padding: "6px 10px", fontSize: 12, fontWeight: 800, background: on ? C.aquaDeep : C.tileSoft, color: on ? "#fff" : C.sub }}>
                          {w.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Field>

              <Field label="노출 기간">
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {[["target", "기준일로부터 며칠 전"], ["range", "직접 기간 지정"]].map(([k, l]) => (
                    <button key={k} onClick={() => setEdit({ ...edit, mode: k })}
                      style={{ padding: "8px 0", fontSize: 12, fontWeight: 800, background: edit.mode === k ? C.aquaDeep : C.tileSoft, color: edit.mode === k ? "#fff" : C.sub }}>{l}</button>
                  ))}
                </div>
                {edit.mode === "target" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="기준일"><input type="date" value={edit.targetDate} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value })} style={inputStyle} /></Field>
                      <Field label="며칠 전부터"><input type="number" min="0" value={edit.leadDays} onChange={(e) => setEdit({ ...edit, leadDays: e.target.value })} style={inputStyle} /></Field>
                    </div>
                    <label className="flex items-center gap-2 mt-2" style={{ fontSize: 12.5, color: C.sub }}>
                      <input type="checkbox" checked={edit.includeTarget} onChange={(e) => setEdit({ ...edit, includeTarget: e.target.checked })} />
                      기준일 당일도 포함 (끄면 "전날까지"만)
                    </label>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="시작일"><input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} style={inputStyle} /></Field>
                    <Field label="종료일"><input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} style={inputStyle} /></Field>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                  이 기간 동안 근무자가 앱을 열 때마다 하루 한 번씩 공지가 화면에 떠요.
                </div>
              </Field>

              <label className="flex items-center gap-2" style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>
                <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
                활성화 (끄면 기간 안이어도 안 보임)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4">
              <Btn kind="ghost" full onClick={() => setEdit(null)}>취소</Btn>
              <Btn full onClick={saveNotice}>저장</Btn>
            </div>
            {edit.id && (
              <button onClick={() => removeNotice(edit.id)} className="w-full mt-2" style={{ fontSize: 12.5, color: C.coral, fontWeight: 700, textAlign: "center", padding: "8px 0" }}>
                이 공지 삭제
              </button>
            )}
          </>
        )}
      </Modal>

      <Modal open={!!viewer} onClose={() => setViewer(null)}>
        {viewer && (
          <>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 9.5, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "2px 6px" }}>팀장 작성</span>
              <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>{viewer.createdByName}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginTop: 10 }}>{viewer.title}</div>
            {viewer.message && <div style={{ fontSize: 14, color: C.text, marginTop: 10, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{viewer.message}</div>}
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 14, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
              노출 기간 {viewer.startDate} ~ {viewer.endDate}
            </div>
            <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>
              대상: {viewer.siteName || "소속 현장"} 근무자 전체
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Btn kind="ghost" full onClick={() => { toggleActive(viewer.id); setViewer(null); }}>{viewer.active ? "끄기" : "다시 켜기"}</Btn>
              <button onClick={() => { removeNotice(viewer.id); setViewer(null); }}
                style={{ background: "transparent", color: C.coral, border: `1px solid ${C.coral}`, fontSize: 14, fontWeight: 700 }}>
                삭제
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}


/* ─────────────────────────  근무 기록  ───────────────────────── */
function RecordsView({ data, update, setToast }) {
  const { workers, sites, records, settings } = data;
  const [mode, setMode] = useState("month");
  const [anchor, setAnchor] = useState(new Date());
  const [detail, setDetail] = useState(null);
  const [slip, setSlip] = useState(null);   // { workerId, ym }
  const [book, setBook] = useState(null);   // ym
  const [q, setQ] = useState("");
  const [siteBrowse, setSiteBrowse] = useState(false);

  const [s, e] = rangeOf(mode, anchor);
  const sk = dKey(s), ek = dKey(e);
  const inRangeAll = useMemo(() => records.filter((r) => r.date >= sk && r.date <= ek), [records, sk, ek]);

  const qNorm = q.trim().toLowerCase();
  const inRange = useMemo(() => {
    if (!qNorm) return inRangeAll;
    return inRangeAll.filter((r) => {
      const w = workers.find((x) => x.id === r.workerId);
      const name = (w?.name || "").toLowerCase();
      const site = (r.site || "").toLowerCase();
      return name.includes(qNorm) || site.includes(qNorm);
    });
  }, [inRangeAll, qNorm, workers]);

  const rows = useMemo(() => workers
    .filter((w) => !qNorm || w.name.toLowerCase().includes(qNorm) || inRange.some((r) => r.workerId === w.id))
    .map((w) => {
      const rs = inRange.filter((r) => r.workerId === w.id);
      return { w, ...aggregate(rs, w, settings) };
    })
    .filter((r) => !qNorm || r.times > 0 || r.days > 0 || workers.find((w) => w.id === r.w.id)?.name.toLowerCase().includes(qNorm))
    .sort((a, b) => b.net - a.net), [workers, inRange, settings, qNorm]);

  const shift = settings.payMode === "shift";
  const tot = rows.reduce((a, r) => ({
    net: a.net + r.net, pay: a.pay + r.pay, days: a.days + r.days, times: a.times + r.times,
    blocks: a.blocks + r.blocks, otMin: a.otMin + r.otMin, shortMin: a.shortMin + r.shortMin, flags: a.flags + r.flags,
  }), { net: 0, pay: 0, days: 0, times: 0, blocks: 0, otMin: 0, shortMin: 0, flags: 0 });
  const maxNet = Math.max(1, ...rows.map((r) => r.net));

  const downloadCsv = () => {
    const head = shift
      ? "이름,날짜,요일,현장,출근,퇴근,근무(분),기준(분),증감(분),추가인정,기본급,추가수당,금액,현장밖퇴근,비고"
      : "이름,날짜,요일,현장,출근,퇴근,휴게(분),근무시간,시급,금액,현장밖퇴근,비고";
    const lines = inRange.slice().sort((a, b) => a.date.localeCompare(b.date)).map((r) => {
      const w = workers.find((x) => x.id === r.workerId);
      const p = calcPay(r, w, settings);
      const d = parseKey(r.date);
      const common = [w?.name || "?", r.date, WD[d.getDay()], r.site || "", tstr(r.clockIn), r.clockOut ? tstr(r.clockOut) : ""];
      const tail = [r.outFlag ? "Y" : "", (r.note || "").replace(/,/g, " ")];
      return shift
        ? [...common, Math.round(p.net * 60), Math.round((p.target || 0) * 60), p.diffMin ?? "", p.blocks ?? 0,
           Math.round(p.base || 0), Math.round(p.otPay || 0), Math.round(p.pay || 0), ...tail].join(",")
        : [...common, Math.round((p.brk || 0) * 60), (p.net || 0).toFixed(2), w?.wage ?? settings.wage,
           Math.round(p.pay || 0), ...tail].join(",");
    });
    const csvText = "\uFEFF" + [head, ...lines].join("\n"); // BOM 포함 — 엑셀에서 한글 안 깨지게
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = `근무기록_${labelOf(mode, anchor).replace(/\s/g, "")}${q.trim() ? `_${q.trim()}` : ""}.csv`;
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast("엑셀 파일을 다운로드했습니다");
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const downloadPayrollPdf = async () => {
    setPdfBusy(true);
    try {
      const company = settings.companyName || "";
      const rowsHtml = rows.map(({ w, net, days, times, pay, blocks }) => `
        <tr>
          <td style="padding:8px 6px; border-bottom:1px solid #E5E1DA; font-weight:800;">${w.name}</td>
          <td style="padding:8px 6px; border-bottom:1px solid #E5E1DA; text-align:right;">${shift ? `${times}타임` : `${days}일`}</td>
          <td style="padding:8px 6px; border-bottom:1px solid #E5E1DA; text-align:right;">${hmc(net)}</td>
          <td style="padding:8px 6px; border-bottom:1px solid #E5E1DA; text-align:right;">${blocks || "—"}</td>
          <td style="padding:8px 6px; border-bottom:1px solid #E5E1DA; text-align:right; font-weight:900; color:#D8503F;">${money(pay)}원</td>
        </tr>`).join("");
      const html = `
        <div style="font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif; padding:40px; color:#1D232A;">
          ${company ? `<div style="font-size:15px; font-weight:800;">${company}</div>` : ""}
          <div style="font-size:24px; font-weight:900; margin-top:6px;">${labelOf(mode, anchor)} 급여대장${q.trim() ? ` · "${q.trim()}" 검색결과` : ""}</div>
          <div style="font-size:12px; color:#71767D; margin-top:4px;">발행일 ${dKey(new Date())}</div>
          <table style="width:100%; border-collapse:collapse; margin-top:20px; font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid #1D232A;">
                <th style="padding:8px 6px; text-align:left;">이름</th>
                <th style="padding:8px 6px; text-align:right;">${shift ? "타임" : "일수"}</th>
                <th style="padding:8px 6px; text-align:right;">근무시간</th>
                <th style="padding:8px 6px; text-align:right;">추가</th>
                <th style="padding:8px 6px; text-align:right;">지급액</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr style="border-top:2px solid #1D232A;">
                <td style="padding:10px 6px; font-weight:900;">합계 (${rows.length}명)</td>
                <td style="padding:10px 6px; text-align:right; font-weight:900;">${shift ? `${tot.times}타임` : `${tot.days}일`}</td>
                <td style="padding:10px 6px; text-align:right; font-weight:900;">${hmc(tot.net)}</td>
                <td style="padding:10px 6px; text-align:right; font-weight:900;">${tot.blocks || "—"}</td>
                <td style="padding:10px 6px; text-align:right; font-weight:900; color:#D8503F;">${money(tot.pay)}원</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
      const fname = `급여대장_${labelOf(mode, anchor).replace(/\s/g, "")}${q.trim() ? `_${q.trim()}` : ""}.pdf`;
      await downloadHtmlAsPdf(html, fname);
      setToast("PDF를 다운로드했습니다");
    } catch (e) {
      setToast("PDF 생성에 실패했어요");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setAnchor(shift(mode, anchor, -1))} className="p-2" style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}` }}>
            <ChevronLeft size={18} color={C.onDark} />
          </button>
          <div style={{ color: C.onDark, fontSize: 20, fontWeight: 900 }}>{labelOf(mode, anchor)}</div>
          <button onClick={() => setAnchor(shift(mode, anchor, 1))} className="p-2" style={{ background: C.bgSoft, border: `1px solid ${C.lineDark}` }}>
            <ChevronRight size={18} color={C.onDark} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-0.5 mt-3" style={{ background: C.grout }}>
          {[["day", "일"], ["week", "주"], ["month", "월"], ["year", "년"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className="py-2.5"
              style={{ background: mode === k ? C.onDark : C.bgSoft, color: mode === k ? C.bg : C.onDarkSub, fontSize: 13.5, fontWeight: 800 }}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mx-4 grid grid-cols-3 gap-0.5" style={{ background: C.grout }}>
        <Tile style={{ padding: 12 }}>
          <Eyebrow>{shift ? "총 타임" : "총 근무시간"}</Eyebrow>
          <div className="mt-1"><Num size={19}>{shift ? `${tot.times}회` : hmc(tot.net)}</Num></div>
        </Tile>
        <Tile style={{ padding: 12 }}>
          <Eyebrow>{shift ? "총 근무시간" : "총 근무일수"}</Eyebrow>
          <div className="mt-1"><Num size={19}>{shift ? hmc(tot.net) : `${tot.days}일`}</Num></div>
        </Tile>
        <Tile style={{ padding: 12 }}><Eyebrow>지급 합계</Eyebrow><div className="mt-1"><Num size={22} weight={900} color={C.coral}>{money(tot.pay)}</Num></div></Tile>
      </div>
      <div className="mx-4 mt-0.5 grid grid-cols-2 gap-0.5" style={{ background: C.grout }}>
        <Tile soft style={{ padding: 12 }}>
          <Eyebrow>{shift ? `추가 인정 (${tot.blocks}회)` : "추가근무"}</Eyebrow>
          <div className="mt-1"><Num size={17} color={C.blue}>+{minStr(tot.otMin)}</Num></div>
        </Tile>
        <Tile soft style={{ padding: 12 }}>
          <Eyebrow>부족시간 누계</Eyebrow>
          <div className="mt-1"><Num size={17} color={tot.shortMin > 0 ? C.red : C.sub}>−{minStr(tot.shortMin)}</Num></div>
        </Tile>
      </div>
      {tot.flags > 0 && (
        <div className="mx-4 mt-0.5 flex items-center gap-2" style={{ background: "#FFF4E0", padding: "10px 13px" }}>
          <ShieldAlert size={15} color={C.amber} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>현장 밖에서 퇴근한 기록 {tot.flags}건</span>
        </div>
      )}

      <div className="px-4 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Search size={15} color={C.onDarkSub} style={{ flexShrink: 0 }} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setSiteBrowse(false); }} placeholder="이름 또는 현장 검색"
            style={{ flex: 1, background: C.bgSoft, border: `1px solid ${C.lineDark}`, color: C.onDark, padding: "9px 11px", fontSize: 13.5, borderRadius: RADIUS_SM }} />
          {q && <button onClick={() => setQ("")}><X size={16} color={C.onDarkSub} /></button>}
          {!q && (
            <button onClick={() => setSiteBrowse((v) => !v)} className="flex items-center gap-1" title="현장별로 보기"
              style={{
                flexShrink: 0, padding: "9px 10px", fontSize: 12, fontWeight: 800, borderRadius: RADIUS_SM,
                background: siteBrowse ? C.aquaDeep : C.bgSoft, color: siteBrowse ? "#fff" : C.onDarkSub, border: `1px solid ${C.lineDark}`,
              }}>
              <Folder size={13} /> 현장별
            </button>
          )}
        </div>

        {siteBrowse && !q ? (
          <>
            <Eyebrow dark>현장별로 묶어서 보여드려요 · 눌러서 열기</Eyebrow>
            <div className="flex flex-col gap-0.5 mt-2" style={{ background: C.grout }}>
              {sites.map((site) => {
                const cnt = inRangeAll.filter((r) => r.siteId === site.id).length;
                return (
                  <Tile key={site.id} onClick={() => { setQ(site.name); setSiteBrowse(false); }} style={{ padding: "14px 16px" }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Folder size={18} color={C.aquaDeep} />
                        <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>{site.name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>{cnt}건</span>
                        <ChevronRight size={16} color={C.sub} />
                      </div>
                    </div>
                  </Tile>
                );
              })}
              {sites.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>등록된 현장이 없습니다.</div></Tile>}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow dark>{q ? `"${q}" 검색 결과 · ${rows.length}명` : "이름별 · 눌러서 상세 보기"}</Eyebrow>
              <div className="flex items-center gap-3">
                <button onClick={downloadPayrollPdf} disabled={pdfBusy} className="flex items-center gap-1" style={{ color: C.aqua, fontSize: 11.5, fontWeight: 700, opacity: pdfBusy ? 0.5 : 1 }}>
                  <Receipt size={12} /> {pdfBusy ? "생성 중…" : "급여대장(PDF)"}
                </button>
                <button onClick={downloadCsv} className="flex items-center gap-1" style={{ color: C.onDarkSub, fontSize: 11.5, fontWeight: 700 }}>
                  <FileText size={12} /> 엑셀 다운로드
                </button>
              </div>
            </div>
            {rows.length === 0 && (
              <Tile><div style={{ color: C.sub, fontSize: 13.5 }}>{q ? "검색 결과가 없습니다." : "등록된 근무자가 없습니다. 설정에서 근무자를 추가하세요."}</div></Tile>
            )}
            <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
              {rows.map(({ w, net, days, times, pay, blocks, otMin, shortMin, flags }) => (
                <Tile key={w.id} onClick={() => setDetail(w.id)} style={{ padding: "13px 14px" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: C.bgSoft, color: C.onDark, fontSize: 13, fontWeight: 800, flexShrink: 0 }} className="flex items-center justify-center">{w.name.slice(0, 1)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontWeight: 800, fontSize: 15.5, color: C.text }}>{w.name}</span>
                      {w.isTeamLead && <span style={{ fontSize: 9, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 4px" }}>팀장{(w.leaderSiteIds || []).length ? ` · ${w.leaderSiteIds.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join("·")}` : ""}</span>}
                      {flags > 0 && <ShieldAlert size={13} color={C.amber} />}
                    </div>
                    <div style={{ color: C.sub, fontSize: 11.5, marginTop: 1 }}>
                      {shift ? `${times}타임 · ${days}일` : `${days}일 근무`}
                    </div>
                  </div>
                </div>
                <div className="text-right" style={{ flexShrink: 0 }}>
                  <Num size={17}>{hmc(net)}</Num>
                  <div style={{ marginTop: 1 }}><Num size={12.5} color={C.coral} weight={700}>{money(pay)}원</Num></div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div style={{ flex: 1, height: 5, background: C.line }}>
                  <div style={{ width: `${(net / maxNet) * 100}%`, height: "100%", background: C.aquaDeep }} />
                </div>
                {blocks > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: C.blue, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>추가 {blocks}회</span>}
                {shortMin > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, color: C.red, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>−{minStr(shortMin)}</span>}
              </div>
            </Tile>
          ))}
            </div>
          </>
        )}
      </div>

      {detail && (
        <WorkerDetail data={data} update={update} workerId={detail} mode={mode} anchor={anchor}
          onClose={() => setDetail(null)} setToast={setToast}
          onPayslip={() => setSlip({ workerId: detail, ym: dKey(s).slice(0, 7) })} />
      )}
      {slip && <PayslipView data={data} update={update} {...slip} onClose={() => setSlip(null)} setToast={setToast} />}
      {book && <PayrollBook data={data} ym={book} onClose={() => setBook(null)} setToast={setToast}
        onOpenSlip={(wid) => { setBook(null); setSlip({ workerId: wid, ym: book }); }} />}
    </div>
  );
}

/* ─────────────────────────  개인 상세  ───────────────────────── */
function WorkerDetail({ data, update, workerId, mode, anchor, onClose, setToast, onPayslip }) {
  const { records, settings } = data;
  const worker = data.workers.find((w) => w.id === workerId);
  const [edit, setEdit] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const [s, e] = rangeOf(mode, anchor);
  const sk = dKey(s), ek = dKey(e);

  const recs = useMemo(
    () => records.filter((r) => r.workerId === workerId && r.date >= sk && r.date <= ek)
      .sort((a, b) => b.date.localeCompare(a.date) || b.clockIn.localeCompare(a.clockIn)),
    [records, workerId, sk, ek]
  );
  const agg = aggregate(recs, worker, settings);
  const dayList = Object.entries(agg.byDate).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDay = Math.max(agg.sh, ...dayList.map((d) => d[1].net), 1);
  const offDays = (data.transfers || [])
    .filter((t) => t.fromWorkerId === workerId && t.status === "approved" && t.date >= sk && t.date <= ek)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 고정 수당(팀장수당·주유수당 등)은 "월" 단위 개념이라 월별 조회일 때만 반영
  const allowances = mode === "month" ? (worker?.allowances || []).filter((a) => Number(a.amount) > 0) : [];
  const allowanceTotal = allowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalPay = agg.pay + allowanceTotal;

  const [exportBusy, setExportBusy] = useState(false);
  const downloadWorkerCsv = () => {
    const head = agg.shift
      ? "이름,날짜,요일,현장,출근,퇴근,근무(분),추가,금액"
      : "이름,날짜,요일,현장,출근,퇴근,근무시간,금액";
    const lines = recs.map((r) => {
      const p = calcPay(r, worker, settings);
      const d = parseKey(r.date);
      const common = [worker.name, r.date, WD[d.getDay()], r.site || "", tstr(r.clockIn), r.clockOut ? tstr(r.clockOut) : ""];
      return agg.shift
        ? [...common, Math.round(p.net * 60), p.blocks || 0, Math.round(p.pay || 0)].join(",")
        : [...common, (p.net || 0).toFixed(2), Math.round(p.pay || 0)].join(",");
    });
    const csvText = "\uFEFF" + [head, ...lines].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${worker.name}_${labelOf(mode, anchor).replace(/\s/g, "")}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast("엑셀 파일을 다운로드했습니다");
  };
  const downloadWorkerPdf = async () => {
    setExportBusy(true);
    try {
      const rowsHtml = recs.map((r) => {
        const p = calcPay(r, worker, settings);
        const d = parseKey(r.date);
        return `<tr>
          <td style="padding:7px 6px; border-bottom:1px solid #E5E1DA;">${r.date.slice(5)}(${WD[d.getDay()]})</td>
          <td style="padding:7px 6px; border-bottom:1px solid #E5E1DA;">${r.site || ""}</td>
          <td style="padding:7px 6px; border-bottom:1px solid #E5E1DA; text-align:right;">${tstr(r.clockIn)}–${r.clockOut ? tstr(r.clockOut) : "—"}</td>
          <td style="padding:7px 6px; border-bottom:1px solid #E5E1DA; text-align:right;">${p.open ? "—" : hmc(p.net)}</td>
          <td style="padding:7px 6px; border-bottom:1px solid #E5E1DA; text-align:right; font-weight:900; color:#D8503F;">${p.open ? "—" : `${money(p.pay)}원`}</td>
        </tr>`;
      }).join("");
      const html = `
        <div style="font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif; padding:40px; color:#1D232A;">
          <div style="font-size:22px; font-weight:900;">${worker.name} · ${labelOf(mode, anchor)} 근무 기록</div>
          <div style="font-size:12px; color:#71767D; margin-top:4px;">발행일 ${dKey(new Date())}</div>
          <div style="display:flex; gap:24px; margin-top:16px; font-size:13px;">
            <div>총 근무시간 <b>${hmc(agg.net)}</b></div>
            <div>지급 합계 <b style="color:#D8503F;">${money(totalPay)}원</b></div>
          </div>
          ${allowances.length > 0 ? `
          <div style="margin-top:8px; font-size:12.5px; color:#71767D;">
            ${allowances.map((a) => `${a.label} +${money(a.amount)}원`).join(" · ")}
          </div>` : ""}
          <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:12.5px;">
            <thead><tr style="border-bottom:2px solid #1D232A;">
              <th style="padding:7px 6px; text-align:left;">날짜</th>
              <th style="padding:7px 6px; text-align:left;">현장</th>
              <th style="padding:7px 6px; text-align:right;">출퇴근</th>
              <th style="padding:7px 6px; text-align:right;">근무</th>
              <th style="padding:7px 6px; text-align:right;">금액</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
      await downloadHtmlAsPdf(html, `${worker.name}_${labelOf(mode, anchor).replace(/\s/g, "")}.pdf`);
      setToast("PDF를 다운로드했습니다");
    } catch (e) {
      setToast("PDF 생성에 실패했어요");
    } finally {
      setExportBusy(false);
    }
  };

  const addManual = () => setEdit({
    id: null, workerId, date: dKey(new Date()),
    siteId: worker.siteId || data.sites[0]?.id || "", inT: "09:00", outT: "18:00", breakMinutes: "", note: "",
  });
  const openEdit = (r) => setEdit({
    id: r.id, workerId, date: r.date, siteId: r.siteId || "",
    inT: tstr(r.clockIn), outT: r.clockOut ? tstr(r.clockOut) : "",
    breakMinutes: r.breakMinutes == null ? "" : String(r.breakMinutes), note: r.note || "",
  });
  const saveEdit = () => {
    const mk = (t) => { if (!t) return null; const [h, m] = t.split(":").map(Number); const d = parseKey(edit.date); d.setHours(h, m, 0, 0); return d.toISOString(); };
    const site = data.sites.find((x) => x.id === edit.siteId);
    update((d) => {
      const base = {
        workerId, date: edit.date, site: site?.name || "현장 미지정", siteId: site?.id || null,
        clockIn: mk(edit.inT), clockOut: mk(edit.outT),
        breakMinutes: edit.breakMinutes === "" ? null : Number(edit.breakMinutes), note: edit.note,
      };
      return {
        ...d,
        records: edit.id
          ? d.records.map((r) => (r.id === edit.id ? { ...r, ...base } : r))
          : [...d.records, { id: uid(), ...base, inLoc: null, outLoc: null, inDist: null, outDist: null, outFlag: false, manual: true }],
      };
    });
    setEdit(null); setToast("기록을 저장했습니다");
  };
  const removeRec = () => {
    update((d) => ({ ...d, records: d.records.filter((r) => r.id !== edit.id) }));
    setEdit(null); setToast("기록을 삭제했습니다");
  };

  return (
    <div className="absolute inset-0 z-40 overflow-y-auto" style={{ background: C.bg }}>
      <div className="sticky top-0 flex items-center gap-3 px-4 py-3.5" style={{ background: C.bg, borderBottom: `1px solid ${C.lineDark}` }}>
        <button onClick={onClose}><ArrowLeft size={20} color={C.onDark} /></button>
        <div style={{ flex: 1 }}>
          <div className="flex items-center gap-1.5">
            <span style={{ color: C.onDark, fontSize: 18, fontWeight: 900 }}>{worker.name}</span>
            {worker.isTeamLead && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 5px" }}>팀장{(worker.leaderSiteIds || []).length ? ` · ${worker.leaderSiteIds.map((id) => data.sites.find((s) => s.id === id)?.name).filter(Boolean).join("·")}` : ""}</span>}
          </div>
          <div style={{ color: C.onDarkSub, fontSize: 11.5 }}>
            {labelOf(mode, anchor)} · {agg.shift ? `1타임 ${agg.sh}시간 / ${money(worker.shiftPay ?? settings.shiftPay)}원` : `시급 ${money(agg.wage)}원 · 1일 ${agg.std}시간`}
          </div>
        </div>
        <button onClick={() => setCalOpen(true)} className="flex items-center justify-center" title="출퇴근 캘린더"
          style={{ border: `1px solid ${C.lineDark}`, color: C.aqua, width: 38, height: 36, flexShrink: 0 }}>
          <CalendarDays size={16} />
        </button>
        <button onClick={addManual} className="flex items-center justify-center" title="기록 직접 추가"
          style={{ border: `1px solid ${C.lineDark}`, color: C.aqua, width: 38, height: 36 }}>
          <Plus size={16} />
        </button>
        <button onClick={downloadWorkerCsv} className="flex items-center justify-center" title="엑셀 다운로드"
          style={{ border: `1px solid ${C.lineDark}`, color: C.onDarkSub, width: 38, height: 36, flexShrink: 0 }}>
          <FileText size={15} />
        </button>
        <button onClick={downloadWorkerPdf} disabled={exportBusy} className="flex items-center justify-center" title="PDF 다운로드"
          style={{ border: `1px solid ${C.lineDark}`, color: C.onDarkSub, width: 38, height: 36, flexShrink: 0, opacity: exportBusy ? 0.5 : 1 }}>
          <Printer size={15} />
        </button>
        <button onClick={onPayslip} className="flex items-center gap-1 px-2.5 py-2"
          style={{ background: C.aquaDeep, color: "#fff", fontSize: 12, fontWeight: 800, height: 36 }}>
          <Receipt size={13} /> 정산서
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-0.5" style={{ background: C.grout }}>
          <Tile style={{ padding: 15 }}>
            <Eyebrow>{agg.shift ? "총 타임 수" : "총 근무시간"}</Eyebrow>
            <div className="mt-1.5"><Num size={32}>{agg.shift ? agg.times : hmc(agg.net)}{agg.shift && <span style={{ fontSize: 17 }}>회</span>}</Num></div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }}>{agg.shift ? `${agg.days}일 출근` : hm(agg.net)}</div>
          </Tile>
          <Tile style={{ padding: 15 }}>
            <Eyebrow>{agg.shift ? "실제 근무시간" : "총 근무일수"}</Eyebrow>
            <div className="mt-1.5"><Num size={32}>{agg.shift ? hmc(agg.net) : agg.days}{!agg.shift && <span style={{ fontSize: 17 }}>일</span>}</Num></div>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 2 }}>
              {agg.times ? `1타임 평균 ${minStr((agg.net / agg.times) * 60)}` : "기록 없음"}
            </div>
          </Tile>
          <Tile soft style={{ padding: 15 }}>
            <Eyebrow>{agg.shift ? `추가 인정 ${agg.blocks}회` : "추가근무"}</Eyebrow>
            <div className="mt-1.5"><Num size={24} weight={800} color={C.blue}>+{minStr(agg.otMin)}</Num></div>
            {agg.shift && <div style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>{money(agg.otPay)}원</div>}
          </Tile>
          <Tile soft style={{ padding: 15 }}>
            <Eyebrow>부족시간 누계</Eyebrow>
            <div className="mt-1.5"><Num size={24} weight={800} color={agg.shortMin > 0 ? C.red : C.sub}>−{minStr(agg.shortMin)}</Num></div>
            {agg.shift && <div style={{ color: C.sub, fontSize: 11, marginTop: 3 }}>지급액에 반영 안 함</div>}
          </Tile>
        </div>

        <div className="mt-2" style={{
          background: `linear-gradient(155deg, ${C.coral} 0%, #E85A4D 100%)`,
          padding: 18, borderRadius: RADIUS, boxShadow: `0 8px 20px ${C.coral}4D, 0 2px 6px rgba(0,0,0,0.15)`,
        }}>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, letterSpacing: "0.14em", fontWeight: 700 }}>지급해야 할 금액</div>
          <div className="mt-1.5"><Num size={40} color="#fff" weight={900}>{money(totalPay)}<span style={{ fontSize: 19 }}> 원</span></Num></div>
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 13.5, marginTop: 5, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
            {agg.shift
              ? `타임 ${agg.times}회 × ${money(worker.shiftPay ?? settings.shiftPay)}원${agg.blocks ? ` + 추가 ${agg.blocks}회 × ${money(settings.otPay)}원` : ""}`
              : `${agg.net.toFixed(2)}시간 × ${money(agg.wage)}원${settings.otPremium && agg.ot > 0.01 ? " (연장 1.5배 포함)" : ""}`}
          </div>
          {allowances.length > 0 && (
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.25)" }}>
              {allowances.map((a) => (
                <div key={a.id} className="flex items-center justify-between" style={{ marginTop: 3 }}>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12.5, fontWeight: 700 }}>{a.label}</span>
                  <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>+{money(a.amount)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {mode !== "month" && (worker?.allowances || []).some((a) => Number(a.amount) > 0) && (
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
            이 근무자는 고정 수당이 등록돼 있어요. 월별 보기로 전환하면 여기에 함께 표시·계산돼요.
          </div>
        )}

        {dayList.length > 1 && (
          <div className="mt-4" style={{ border: `1px solid ${C.lineDark}`, padding: 13 }}>
            <Eyebrow dark>{agg.shift ? `일자별 근무시간 · 타임당 ${agg.sh}시간 기준` : `일자별 근무시간 · 기준선 ${agg.std}시간`}</Eyebrow>
            <div className="flex items-end gap-0.5 mt-3" style={{ height: 74 }}>
              {dayList.map(([d, v]) => (
                <div key={d} style={{ flex: 1, height: "100%" }} className="flex flex-col justify-end" title={`${d} ${hmc(v.net)}`}>
                  <div style={{ height: `${(v.net / maxDay) * 100}%`, background: v.net >= v.target ? C.aqua : C.red, minHeight: 2 }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5" style={{ color: C.onDarkSub, fontSize: 10, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
              <span>{dayList[0][0].slice(5)}</span><span>{dayList[dayList.length - 1][0].slice(5)}</span>
            </div>
          </div>
        )}

        {offDays.length > 0 && (
          <div className="mt-4">
            <Eyebrow dark>이 기간 중 양도한 휴무 ({offDays.length}일)</Eyebrow>
            <div className="flex flex-col gap-0.5 mt-1.5" style={{ background: C.grout }}>
              {offDays.map((t) => {
                const d = parseKey(t.date);
                const partial = !!t.startTime;
                return (
                  <Tile key={t.id} soft style={{ padding: "10px 14px" }}>
                    <div className="flex items-center justify-between">
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                        {t.date.slice(5).replace("-", "/")} ({WD[d.getDay()]}) · {t.siteName}{partial ? ` · ${t.startTime}–${t.endTime}` : ""}
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: C.blue, padding: "2px 6px" }}>{partial ? "부분 양도" : "휴무 · 양도"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>
                      {t.toWorkerName}님이 {partial ? "그 시간대만 " : ""}대신 근무{t.fulfilledRecordId ? " (완료)" : " (예정)"}
                    </div>
                  </Tile>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 mb-1"><Eyebrow dark>일별 상세 · 눌러서 수정</Eyebrow></div>
        <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>
          {recs.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>이 기간에 기록이 없습니다.</div></Tile>}
          {recs.map((r) => {
            const p = calcPay(r, worker, settings);
            const d = parseKey(r.date);
            const shortish = agg.shift && !p.open && p.shortMin >= settings.shortThreshold;
            return (
              <Tile key={r.id} onClick={() => openEdit(r)} style={{ padding: "12px 14px" }}>
                <div className="flex items-start justify-between gap-3">
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-1.5">
                      <Num size={14.5}>{r.date.slice(5).replace("-", ".")}</Num>
                      <span style={{ fontSize: 11.5, color: d.getDay() === 0 ? C.coral : C.sub, fontWeight: 700 }}>({WD[d.getDay()]})</span>
                      {r.manual && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.sub, border: `1px solid ${C.line}`, padding: "1px 4px" }}>수기</span>}
                      {p.holiday && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: C.coral, padding: "1px 4px" }}>공휴일 ×{settings.holidayMultiplier ?? 1.5}</span>}
                      {r.coverForName && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: C.blue, padding: "1px 4px" }}>{r.coverForName}님 대신 근무{r.coverStart ? ` (${r.coverStart}–${r.coverEnd})` : ""}</span>}
                      {r.outFlag && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.amber, border: `1px solid ${C.amber}`, padding: "1px 4px" }}>현장 밖 퇴근</span>}
                    </div>
                    <div style={{ marginTop: 4, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13, color: C.text, fontWeight: 700 }}>
                      {tstr(r.clockIn)} – {r.clockOut ? tstr(r.clockOut) : "근무 중"}
                      {p.brk > 0 && <span style={{ color: C.sub, fontWeight: 600 }}> · 휴게 {Math.round(p.brk * 60)}분</span>}
                    </div>
                    <div className="flex items-center gap-1 mt-1" style={{ color: C.sub, fontSize: 13, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                      <Building2 size={11} />{r.site || "현장 미지정"}
                      {r.inDist != null && <><Crosshair size={11} style={{ marginLeft: 4 }} />{dist(r.inDist)}</>}
                    </div>
                    {r.note && <div style={{ marginTop: 5, fontSize: 12, color: C.text, background: C.tileSoft, padding: "5px 7px" }}>{r.note}</div>}
                  </div>
                  <div className="text-right" style={{ flexShrink: 0 }}>
                    <Num size={19}>{p.open ? "—" : hmc(p.net)}</Num>
                    {!p.open && agg.shift && (
                      <>
                        <div style={{ marginTop: 3 }}>
                          {p.blocks > 0 ? (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: C.blue, padding: "2px 5px" }}>추가 {otLabel(p.otMin)}</span>
                          ) : shortish ? (
                            <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: C.red, padding: "2px 5px" }}>부족 −{minStr(p.shortMin)}</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 800, color: C.sub, border: `1px solid ${C.line}`, padding: "1px 5px" }}>
                              {p.diffMin === 0 ? "정확" : p.diffMin > 0 ? `+${minStr(p.diffMin)}` : `−${minStr(p.shortMin)}`}
                            </span>
                          )}
                        </div>
                        <div style={{ marginTop: 4 }}><Num size={13.5} color={C.coral} weight={800}>{money(p.pay)}원</Num></div>
                      </>
                    )}
                    {!p.open && !agg.shift && (
                      <div style={{ marginTop: 4 }}><Num size={13.5} color={C.coral} weight={800}>{money(p.pay)}원</Num></div>
                    )}
                    <Pencil size={12} color={C.line} style={{ marginLeft: "auto", marginTop: 6 }} />
                  </div>
                </div>
              </Tile>
            );
          })}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "기록 수정" : "기록 직접 추가"}>
        {edit && (
          <>
            <Field label="날짜"><input type="date" value={edit.date} onChange={(ev) => setEdit({ ...edit, date: ev.target.value })} style={inputStyle} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="출근"><input type="time" value={edit.inT} onChange={(ev) => setEdit({ ...edit, inT: ev.target.value })} style={inputStyle} /></Field>
              <Field label="퇴근"><input type="time" value={edit.outT} onChange={(ev) => setEdit({ ...edit, outT: ev.target.value })} style={inputStyle} /></Field>
            </div>
            <Field label="현장">
              <select value={edit.siteId} onChange={(ev) => setEdit({ ...edit, siteId: ev.target.value })} style={inputStyle}>
                <option value="">현장 미지정</option>
                {data.sites.map((s2) => <option key={s2.id} value={s2.id}>{s2.name}</option>)}
              </select>
            </Field>
            <Field label="휴게시간 (분) · 비우면 자동 계산">
              <input type="number" inputMode="numeric" placeholder="자동" value={edit.breakMinutes} onChange={(ev) => setEdit({ ...edit, breakMinutes: ev.target.value })} style={inputStyle} />
            </Field>
            <Field label="비고">
              <textarea value={edit.note} placeholder="추가 작업, 지각 사유, 위치 오류로 인한 수기 입력 등" onChange={(ev) => setEdit({ ...edit, note: ev.target.value })} style={{ ...inputStyle, height: 74 }} />
            </Field>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {edit.id ? <Btn kind="danger" full onClick={removeRec}><span className="flex items-center justify-center gap-1.5"><Trash2 size={14} /> 삭제</span></Btn>
                : <Btn kind="ghost" full onClick={() => setEdit(null)}>취소</Btn>}
              <Btn full onClick={saveEdit}>저장</Btn>
            </div>
          </>
        )}
      </Modal>

      {calOpen && (
        <AttendanceCalendar data={data} workerId={workerId} onClose={() => setCalOpen(false)} update={update} canAdd isAdmin setToast={setToast} />
      )}
    </div>
  );
}

/* ─────────────────────────  정산서 공용  ───────────────────────── */
const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #paper, #paper * { visibility: visible !important; }
  #paper { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 0 !important; }
  .no-print { display: none !important; }
}`;

/* ─────────────────────────  출퇴근 캘린더 (근무자·관리자 공용)  ───────────────────────── */
function AttendanceCalendar({ data, update, workerId, onClose, canAdd, isAdmin, setToast }) {
  const worker = data.workers.find((w) => w.id === workerId);
  const settings = data.settings;
  const [anchor, setAnchor] = useState(new Date());
  const [selDate, setSelDate] = useState(null);
  const [oneOffOpen, setOneOffOpen] = useState(false);
  const [oneOffForm, setOneOffForm] = useState({ siteName: "", inT: "09:00", outT: "18:00", amount: "150000" });

  const y = anchor.getFullYear(), m = anchor.getMonth();
  const monthKey = `${y}-${pad(m + 1)}`;
  const first = new Date(y, m, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = dKey(new Date());

  const monthRecs = useMemo(
    () => data.records.filter((r) => r.workerId === workerId && r.date.slice(0, 7) === monthKey),
    [data.records, workerId, monthKey]
  );
  const byDate = useMemo(() => {
    const map = {};
    monthRecs.forEach((r) => { (map[r.date] ||= []).push(r); });
    return map;
  }, [monthRecs]);
  const monthAgg = aggregate(monthRecs, worker, settings);

  const [ws, we] = rangeOf("week", new Date());
  const weekRecs = useMemo(
    () => data.records.filter((r) => r.workerId === workerId && r.date >= dKey(ws) && r.date <= dKey(we)),
    [data.records, workerId, ws, we]
  );
  const weekAgg = aggregate(weekRecs, worker, settings);

  const cellStatus = (dateKey) => {
    const recs = byDate[dateKey];
    if (!recs || recs.length === 0) return "none";
    if (recs.some((r) => !r.clockOut)) return "incomplete";
    return "complete";
  };

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selRecs = selDate ? (byDate[selDate] || []) : [];
  const selDayAgg = selDate ? aggregate(selRecs, worker, settings) : null;

  const openOneOff = () => {
    setOneOffForm({ siteName: worker.siteId ? (data.sites.find((s) => s.id === worker.siteId)?.name || "") : "", inT: "09:00", outT: "18:00", amount: "150000" });
    setOneOffOpen(true);
  };
  const submitOneOff = () => {
    if (!selDate) return;
    if (!oneOffForm.siteName.trim()) { setToast("현장(장소)을 입력해 주세요"); return; }
    const mk = (t) => { const [h, mi] = t.split(":").map(Number); const d = parseKey(selDate); d.setHours(h, mi, 0, 0); return d.toISOString(); };
    update((d) => ({
      ...d,
      records: [...d.records, {
        id: uid(), workerId, date: selDate, site: oneOffForm.siteName.trim(), siteId: null,
        clockIn: mk(oneOffForm.inT), clockOut: mk(oneOffForm.outT),
        flatPay: Number(oneOffForm.amount) || 0,
        breakMinutes: null, note: "일회성 근무", manual: true,
        inLoc: null, outLoc: null, inDist: null, outDist: null, outFlag: false,
      }],
    }));
    setOneOffOpen(false);
  };

  if (!worker) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: C.tileSoft }}>
      <div className="sticky top-0 flex items-center gap-2 px-4 py-3" style={{ background: C.bg, borderBottom: `1px solid ${C.lineDark}` }}>
        <button onClick={onClose}><ArrowLeft size={20} color={C.onDark} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.onDark, fontSize: 16, fontWeight: 900 }}>{worker.name}{worker.isTeamLead ? "" : ""} 님의 출퇴근 캘린더</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 월 이동 */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setAnchor(new Date(y, m - 1, 1))} className="p-2" style={{ background: C.tile, border: `1px solid ${C.line}` }}>
            <ChevronLeft size={16} color={C.text} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{y}년 {m + 1}월</div>
          <button onClick={() => setAnchor(new Date(y, m + 1, 1))} className="p-2" style={{ background: C.tile, border: `1px solid ${C.line}` }}>
            <ChevronRight size={16} color={C.text} />
          </button>
        </div>

        {/* 이번 주 · 이번 달 요약 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div style={{ background: C.tile, padding: "12px 14px", boxShadow: SHADOW_SM, borderRadius: RADIUS_SM }}>
            <div style={{ fontSize: 10.5, color: C.sub, fontWeight: 700, letterSpacing: "0.05em" }}>이번 주</div>
            <div className="mt-1"><Num size={18}>{hmc(weekAgg.net)}</Num></div>
            <div style={{ fontSize: 11.5, color: C.coral, fontWeight: 800, marginTop: 2 }}>{money(weekAgg.pay)}원</div>
          </div>
          <div style={{ background: C.tile, padding: "12px 14px", boxShadow: SHADOW_SM, borderRadius: RADIUS_SM }}>
            <div style={{ fontSize: 10.5, color: C.sub, fontWeight: 700, letterSpacing: "0.05em" }}>{m + 1}월 합계</div>
            <div className="mt-1"><Num size={18}>{hmc(monthAgg.net)}</Num></div>
            <div style={{ fontSize: 11.5, color: C.coral, fontWeight: 800, marginTop: 2 }}>{money(monthAgg.pay)}원</div>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WD.map((w, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: i === 0 ? C.coral : i === 6 ? C.blue : C.sub }}>{w}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateKey = `${y}-${pad(m + 1)}-${pad(d)}`;
            const status = cellStatus(dateKey);
            const holiday = isHoliday(dateKey, settings);
            const isToday = dateKey === todayKey;
            const isSel = dateKey === selDate;
            const bg = status === "complete" ? C.aquaDeep : status === "incomplete" ? C.amber : C.tile;
            const col = status === "none" ? (holiday ? C.red : C.text) : "#fff";
            return (
              <button key={i} onClick={() => setSelDate(dateKey === selDate ? null : dateKey)}
                style={{
                  aspectRatio: "1", background: bg, color: col, fontSize: 12.5, fontWeight: 800,
                  border: isToday ? `2px solid ${C.blue}` : isSel ? `2px solid ${C.text}` : holiday ? `1.5px solid ${C.red}` : `1px solid ${C.line}`,
                  borderRadius: RADIUS_SM, position: "relative",
                }}>
                {d}
                {holiday && (
                  <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: status === "none" ? C.red : "#fff" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, background: C.aquaDeep, borderRadius: 3 }} /><span style={{ fontSize: 11, color: C.sub }}>출퇴근 완료</span></div>
          <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, background: C.amber, borderRadius: 3 }} /><span style={{ fontSize: 11, color: C.sub }}>퇴근 안 누름</span></div>
          <div className="flex items-center gap-1"><div style={{ width: 10, height: 10, background: C.tile, border: `1px solid ${C.line}`, borderRadius: 3 }} /><span style={{ fontSize: 11, color: C.sub }}>기록 없음</span></div>
          <div className="flex items-center gap-1"><div style={{ width: 8, height: 8, borderRadius: 999, background: C.red }} /><span style={{ fontSize: 11, color: C.sub }}>공휴일(1.5배)</span></div>
        </div>

        {/* 선택한 날짜 상세 */}
        {selDate && (
          <div className="mt-4" style={{ background: C.tile, padding: 14, boxShadow: SHADOW_SM, borderRadius: RADIUS_SM }}>
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>{selDate} ({WD[parseKey(selDate).getDay()]})</span>
              {isHoliday(selDate, settings) && (
                <span style={{ fontSize: 10, fontWeight: 900, color: "#fff", background: C.red, padding: "2px 6px" }}>
                  공휴일 · {settings.holidayMultiplier || 1.5}배
                </span>
              )}
            </div>
            {selRecs.length === 0 ? (
              <div style={{ fontSize: 13, color: C.sub, marginTop: 8 }}>이 날은 출퇴근 기록이 없어요.</div>
            ) : (
              <>
                <div className="flex flex-col gap-2 mt-2.5">
                  {selRecs.map((r) => {
                    const p = calcPay(r, worker, settings);
                    return (
                      <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8 }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{r.site || "현장 미지정"}</span>
                            {p.flat && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", background: C.blue, padding: "1px 5px" }}>일회성</span>}
                          </div>
                          {!r.clockOut && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: C.amber, padding: "1px 6px" }}>퇴근 전</span>}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 2, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                          출근 {tstr(r.clockIn)} · 퇴근 {r.clockOut ? tstr(r.clockOut) : "—"}
                          {r.clockOut && ` · ${hmc(p.net)}`}
                        </div>
                        {r.clockOut && (
                          <div style={{ fontSize: 12, color: p.holiday ? C.red : C.sub, marginTop: 3, fontWeight: p.holiday ? 800 : 400 }}>
                            {money(p.pay)}원{p.flat ? " (고정 지급액)" : ""}{p.holiday && !p.flat ? ` (공휴일 ${settings.holidayMultiplier || 1.5}배 적용됨)` : ""}
                          </div>
                        )}
                        {r.coverForName && <div style={{ fontSize: 11.5, color: C.blue, marginTop: 2, fontWeight: 700 }}>{r.coverForName}님 대신 근무</div>}
                        {r.outFlag && <div style={{ fontSize: 11.5, color: C.amber, marginTop: 2, fontWeight: 700 }}>현장 밖에서 처리됨</div>}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 700 }}>이날 합계</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: C.coral }}>{hmc(selDayAgg.net)} · {money(selDayAgg.pay)}원</span>
                </div>
              </>
            )}

            {canAdd && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <button onClick={openOneOff} className="flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 800, color: C.aquaDeep }}>
                  <Plus size={14} /> 이 날짜에 일회성 근무 추가
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={oneOffOpen} onClose={() => setOneOffOpen(false)}>
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>일회성 근무 추가</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4, lineHeight: 1.5 }}>
          {selDate} · {worker.name}님 — 정규 시급/타임 계산과 별개로, 이 날 하루치 금액을 직접 지정해서 이번 달 정산에 합산해요.
        </div>
        <div className="mt-4 flex flex-col gap-2.5">
          <Field label="현장 (직접 입력)">
            <input type="text" value={oneOffForm.siteName} onChange={(e) => setOneOffForm((f) => ({ ...f, siteName: e.target.value }))}
              placeholder="예: 강남 오피스텔 청소" style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="출근 시간"><input type="time" value={oneOffForm.inT} onChange={(e) => setOneOffForm((f) => ({ ...f, inT: e.target.value }))} style={inputStyle} /></Field>
            <Field label="퇴근 시간"><input type="time" value={oneOffForm.outT} onChange={(e) => setOneOffForm((f) => ({ ...f, outT: e.target.value }))} style={inputStyle} /></Field>
          </div>
          {isAdmin ? (
            <Field label="지급 금액 (원) · 기본 150,000원, 수정 가능">
              <input type="number" value={oneOffForm.amount} onChange={(e) => setOneOffForm((f) => ({ ...f, amount: e.target.value }))} style={inputStyle} />
            </Field>
          ) : (
            <Field label="지급 금액 (원)">
              <div style={{ ...inputStyle, display: "flex", alignItems: "center", background: C.tileSoft, color: C.sub }}>
                {money(Number(oneOffForm.amount))}원 (관리자가 정한 고정 금액)
              </div>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setOneOffOpen(false)}>취소</Btn>
          <Btn full onClick={submitOneOff}>추가하기</Btn>
        </div>
      </Modal>
    </div>
  );
}


const PaperShell = ({ title, onClose, actions, children }) => (
  <div className="absolute inset-0 z-40 overflow-y-auto" style={{ background: C.tileSoft }}>
    <style>{PRINT_CSS}</style>
    <div className="sticky top-0 flex items-center gap-2 px-4 py-3 no-print" style={{ background: C.bg, borderBottom: `1px solid ${C.lineDark}` }}>
      <button onClick={onClose}><ArrowLeft size={20} color={C.onDark} /></button>
      <div style={{ flex: 1, color: C.onDark, fontSize: 15, fontWeight: 800 }}>{title}</div>
      {actions}
    </div>
    <div className="p-3">
      <div id="paper" style={{ background: C.tile, padding: 22, borderRadius: RADIUS, boxShadow: SHADOW_MD }}>{children}</div>
      <div style={{ height: 20 }} />
    </div>
  </div>
);

const Rule = ({ thick }) => <div style={{ height: thick ? 2 : 1, background: thick ? C.text : C.line, margin: "12px 0" }} />;
const LineItem = ({ k, v, sub, bold, color }) => (
  <div className="flex items-baseline justify-between gap-3" style={{ padding: "7px 0" }}>
    <div style={{ minWidth: 0 }}>
      <span style={{ fontSize: bold ? 14 : 13.5, fontWeight: bold ? 800 : 600, color: C.text }}>{k}</span>
      {sub && <span style={{ fontSize: 11.5, color: C.sub, marginLeft: 6 }}>{sub}</span>}
    </div>
    <Num size={bold ? 16 : 14.5} color={color || C.coral} weight={bold ? 800 : 700}>{v}</Num>
  </div>
);

/* ─────────────────────────  개인 월 정산서  ───────────────────────── */
function PayslipView({ data, update, workerId, ym, onClose, setToast }) {
  const [adjOpen, setAdjOpen] = useState(false);
  const [withDays, setWithDays] = useState(true);
  const [draft, setDraft] = useState(null);
  const [sendBusy, setSendBusy] = useState(false);
  const [dlBusy, setDlBusy] = useState(false);
  const p = payslipCalc(data, workerId, ym);
  const { worker, recs, agg, adj } = p;
  const company = data.settings.companyName || "";
  const issued = new Date();

  const sign = (data.payslipSigns || []).find((x) => x.workerId === workerId && x.ym === ym) || null;

  const sendToWorker = () => {
    setSendBusy(true);
    const snapshot = {
      shift: agg.shift, times: agg.times, days: agg.days, net: agg.net,
      base: p.base, otPay: agg.otPay, holidayPay: agg.holidayPay || 0,
      extra: p.extra, extraLabel: adj.extraLabel, gross: p.gross,
      tax: p.tax, deduct: p.deduct, deductLabel: adj.deductLabel, net_pay: p.net,
    };
    update((d) => {
      const others = (d.payslipSigns || []).filter((x) => !(x.workerId === workerId && x.ym === ym));
      return {
        ...d,
        payslipSigns: [...others, {
          id: sign?.id || uid(), workerId, workerName: worker.name, ym,
          company, snapshot, sentAt: new Date().toISOString(),
          signedAt: null, signatureDataUrl: null,
        }],
      };
    });
    setToast(`${worker.name}님에게 정산서를 전달했습니다`);
    setSendBusy(false);
  };

  const downloadSigned = async () => {
    if (!sign || !sign.signedAt) return;
    setDlBusy(true);
    try {
      const s = sign.snapshot;
      const html = `
        <div style="font-family:'Noto Sans CJK KR','Noto Sans KR',sans-serif; padding:40px; color:#1D232A;">
          ${company ? `<div style="font-size:15px; font-weight:800;">${company}</div>` : ""}
          <div style="font-size:22px; font-weight:900; margin-top:6px;">${ymLabel(ym)} 근무 정산서</div>
          <div style="font-size:13px; color:#71767D; margin-top:10px;">${sign.workerName} 님</div>
          <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:13px;">
            ${s.shift
              ? `<tr><td style="padding:6px 0;">기본 타임</td><td style="padding:6px 0; text-align:right;">${money(s.base)}원</td></tr>
                 ${s.otPay ? `<tr><td style="padding:6px 0;">추가근무</td><td style="padding:6px 0; text-align:right;">${money(s.otPay)}원</td></tr>` : ""}`
              : `<tr><td style="padding:6px 0;">기본급</td><td style="padding:6px 0; text-align:right;">${money(s.base)}원</td></tr>
                 ${s.otPay ? `<tr><td style="padding:6px 0;">연장근무</td><td style="padding:6px 0; text-align:right;">${money(s.otPay)}원</td></tr>` : ""}`}
            ${s.holidayPay ? `<tr><td style="padding:6px 0;">공휴일 근무</td><td style="padding:6px 0; text-align:right;">${money(s.holidayPay)}원</td></tr>` : ""}
            ${s.extra ? `<tr><td style="padding:6px 0;">${s.extraLabel || "기타 수당"}</td><td style="padding:6px 0; text-align:right;">${money(s.extra)}원</td></tr>` : ""}
            <tr style="border-top:1px solid #E5E1DA;"><td style="padding:8px 0; font-weight:800;">지급 합계</td><td style="padding:8px 0; text-align:right; font-weight:800;">${money(s.gross)}원</td></tr>
            ${s.tax ? `<tr><td style="padding:6px 0; color:#D8503F;">원천징수</td><td style="padding:6px 0; text-align:right; color:#D8503F;">−${money(s.tax)}원</td></tr>` : ""}
            ${s.deduct ? `<tr><td style="padding:6px 0; color:#D8503F;">${s.deductLabel || "기타 공제"}</td><td style="padding:6px 0; text-align:right; color:#D8503F;">−${money(s.deduct)}원</td></tr>` : ""}
          </table>
          <div style="margin-top:14px; background:#1D232A; padding:16px; color:#fff;">
            <div style="font-size:11px; opacity:0.7; letter-spacing:0.1em;">실지급액</div>
            <div style="font-size:26px; font-weight:900; margin-top:4px;">${money(s.net_pay)}원</div>
          </div>
          <div style="margin-top:28px; display:flex; align-items:flex-end; justify-content:space-between;">
            <div style="font-size:12px; color:#71767D;">
              전달일 ${sign.sentAt.slice(0, 10)}<br/>서명일 ${sign.signedAt.slice(0, 10)}
            </div>
            <div style="text-align:center;">
              <img src="${sign.signatureDataUrl}" style="height:70px;" />
              <div style="font-size:11px; color:#71767D; border-top:1px solid #1D232A; padding-top:4px; margin-top:2px;">${sign.workerName} (서명)</div>
            </div>
          </div>
        </div>`;
      await downloadHtmlAsPdf(html, `정산서_서명본_${sign.workerName}_${ym}.pdf`);
      setToast("서명본을 다운로드했습니다");
    } catch (e) {
      setToast("다운로드에 실패했어요");
    } finally {
      setDlBusy(false);
    }
  };

  const text = useMemo(() => {
    const L = [];
    if (company) L.push(company);
    L.push(`[${ymLabel(ym)} 근무 정산서]`, `${worker.name} 님`, "");
    if (agg.shift) {
      L.push(`근무 타임  ${agg.times}회 (${agg.days}일)`);
      L.push(`근무시간   ${hm(agg.net)}`);
      if (agg.blocks) L.push(`추가 인정  ${agg.blocks}회 (+${minStr(agg.otMin)})`);
      if (agg.shortMin > 0) L.push(`부족시간   -${minStr(agg.shortMin)} (지급 반영 없음)`);
      L.push("", `기본 타임  ${agg.times}회 × ${money(worker.shiftPay ?? data.settings.shiftPay)}원 = ${money(agg.base)}원`);
      if (agg.blocks) L.push(`추가근무   ${agg.blocks}회 × ${money(data.settings.otPay)}원 = ${money(agg.otPay)}원`);
    } else {
      L.push(`근무일수  ${agg.days}일`, `근무시간  ${hm(agg.net)}`);
      L.push("", `기본급    ${money(p.base)}원`);
    }
    if (p.extra) L.push(`${adj.extraLabel || "기타 수당"}  ${money(p.extra)}원`);
    if (agg.holidayPay > 0) L.push(`공휴일 근무 ${agg.holidayNet.toFixed(1)}시간 × ${agg.holidayMultiplier}배 = ${money(agg.holidayPay)}원`);
    L.push(`지급 합계  ${money(p.gross)}원`);
    if (p.tax) L.push(`원천징수  -${money(p.tax)}원 (3.3%)`);
    if (p.deduct) L.push(`${adj.deductLabel || "기타 공제"}  -${money(p.deduct)}원`);
    L.push("──────────────", `실지급액  ${money(p.net)}원`);
    if (withDays && recs.length) {
      L.push("", "■ 타임별 내역");
      recs.forEach((r) => {
        const q = calcPay(r, worker, data.settings);
        const d = parseKey(r.date);
        const mark = q.blocks > 0 ? ` 추가+${minStr(q.otMin)}` : q.shortMin >= data.settings.shortThreshold ? ` 부족-${minStr(q.shortMin)}` : "";
        const hol = q.holiday ? ` 공휴일×${agg.holidayMultiplier}` : "";
        const cov = r.coverForName ? ` (${r.coverForName}님 대신)` : "";
        L.push(`${r.date.slice(5)}(${WD[d.getDay()]}) ${tstr(r.clockIn)}-${tstr(r.clockOut)} ${minStr(q.net * 60)}${mark}${hol}${cov} ${money(q.pay)}원`);
      });
    }
    if (adj.memo) L.push("", `※ ${adj.memo}`);
    return L.join("\n");
  }, [data, workerId, ym, withDays]);

  const saveAdj = () => {
    update((d) => ({
      ...d,
      adjustments: {
        ...d.adjustments,
        [`${workerId}:${ym}`]: {
          extraLabel: draft.extraLabel.trim(), extra: Number(draft.extra) || 0,
          deductLabel: draft.deductLabel.trim(), deduct: Number(draft.deduct) || 0,
          tax: draft.tax, memo: draft.memo.trim(),
        },
      },
    }));
    setAdjOpen(false); setToast("정산 항목을 저장했습니다");
  };

  return (
    <PaperShell title="월 정산서" onClose={onClose} actions={
      <>
        <button onClick={() => { setDraft({ ...adj, extra: adj.extra || "", deduct: adj.deduct || "" }); setAdjOpen(true); }}
          className="flex items-center justify-center" title="수당·공제"
          style={{ border: `1px solid ${C.lineDark}`, color: C.aqua, width: 36, height: 34 }}>
          <SlidersHorizontal size={15} />
        </button>
        <button onClick={() => { navigator.clipboard?.writeText(text); setToast("복사했습니다 — 문자나 카톡에 붙여넣으세요"); }}
          className="flex items-center gap-1 px-2.5" style={{ background: C.aquaDeep, color: "#fff", fontSize: 12, fontWeight: 800, height: 34 }}>
          <Copy size={13} /> 복사
        </button>
        <button onClick={() => window.print()} className="flex items-center justify-center" title="인쇄 / PDF"
          style={{ border: `1px solid ${C.lineDark}`, color: C.onDarkSub, width: 36, height: 34 }}>
          <Printer size={15} />
        </button>
      </>
    }>
      {/* 표지 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {company && <div style={{ fontSize: 15, fontWeight: 900, color: C.text, letterSpacing: "0.02em" }}>{company}</div>}
          <div style={{ fontSize: 23, fontWeight: 900, color: C.text, marginTop: 4, letterSpacing: "-0.02em" }}>
            {ymLabel(ym)} 근무 정산서
          </div>
        </div>
        <div className="text-right" style={{ flexShrink: 0 }}>
          <Eyebrow>발행일</Eyebrow>
          <div style={{ marginTop: 2 }}><Num size={12}>{dKey(issued)}</Num></div>
        </div>
      </div>
      <Rule thick />

      {/* 근무자 서명 전달 */}
      <div style={{ background: sign?.signedAt ? "#EAF3DE" : C.tileSoft, border: `1px solid ${sign?.signedAt ? "#639922" : C.line}`, padding: 13, marginBottom: 4 }}>
        {!sign && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>근무자에게 이 정산서를 전달할 수 있어요</div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, lineHeight: 1.5 }}>전달하면 근무자 앱 화면에 뜨고, 확인 후 직접 서명할 수 있어요.</div>
            <div className="mt-2.5"><Btn small onClick={sendToWorker} disabled={sendBusy}>{sendBusy ? "전달 중…" : "근무자에게 전달"}</Btn></div>
          </>
        )}
        {sign && !sign.signedAt && (
          <>
            <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
              <Send size={13} color={C.blue} /> 전달됨 · 서명 대기 중
            </div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{sign.sentAt.slice(0, 10)} 전달 · 아직 근무자가 서명하지 않았어요.</div>
            <div className="mt-2.5"><Btn small kind="ghost" onClick={sendToWorker} disabled={sendBusy}>다시 전달하기</Btn></div>
          </>
        )}
        {sign && sign.signedAt && (
          <>
            <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 800, color: "#3B6D11" }}>
              <Check size={14} color="#3B6D11" /> 서명 완료
            </div>
            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{sign.sentAt.slice(0, 10)} 전달 · {sign.signedAt.slice(0, 10)} 서명</div>
            <div className="flex items-center gap-3 mt-2.5">
              <img src={sign.signatureDataUrl} style={{ height: 40, background: "#fff", border: `1px solid ${C.line}`, padding: 4 }} />
              <Btn small onClick={downloadSigned} disabled={dlBusy}>{dlBusy ? "생성 중…" : "서명본 PDF 다운로드"}</Btn>
            </div>
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{worker.name} <span style={{ fontSize: 14, fontWeight: 700, color: C.sub }}>님</span></span>
          {worker.isTeamLead && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 5px" }}>팀장{(worker.leaderSiteIds || []).length ? ` · ${worker.leaderSiteIds.map((id) => data.sites.find((s) => s.id === id)?.name).filter(Boolean).join("·")}` : ""}</span>}
        </div>
        <div style={{ fontSize: 13.5, color: C.sub, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
          {agg.shift
            ? `1타임 ${agg.sh}시간 · ${money(worker.shiftPay ?? data.settings.shiftPay)}원`
            : `시급 ${money(agg.wage)}원 · 1일 ${agg.std}시간`}
        </div>
      </div>

      {/* 근무 요약 */}
      <div className="grid grid-cols-4 gap-0.5 mt-3" style={{ background: C.line }}>
        {(agg.shift
          ? [["근무 타임", `${agg.times}회`, C.text], ["근무시간", hmc(agg.net), C.text],
             ["추가 인정", `${agg.blocks}회`, C.blue], ["부족 누계", `−${minStr(agg.shortMin)}`, agg.shortMin > 0 ? C.red : C.sub]]
          : [["근무일수", `${agg.days}일`, C.text], ["근무시간", hmc(agg.net), C.text],
             ["추가근무", `+${hmc(agg.ot)}`, C.blue], ["부족시간", `−${hmc(agg.short)}`, agg.short > 0.01 ? C.red : C.sub]]
        ).map(([k, v, col]) => (
          <div key={k} style={{ background: C.tileSoft, padding: "10px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, letterSpacing: "0.06em" }}>{k}</div>
            <div style={{ marginTop: 3 }}><Num size={15} color={col}>{v}</Num></div>
          </div>
        ))}
      </div>

      {/* 지급 · 공제 */}
      <div className="mt-5"><Eyebrow>지급 내역</Eyebrow></div>
      <div style={{ marginTop: 4 }}>
        {agg.shift ? (
          <>
            <LineItem k="기본 타임" sub={`${agg.times}회 × ${money(worker.shiftPay ?? data.settings.shiftPay)}원`} v={`${money(agg.base)}원`} />
            {agg.blocks > 0 && <LineItem k="추가근무" sub={`${agg.blocks}회 × ${money(data.settings.otPay)}원`} v={`${money(agg.otPay)}원`} />}
          </>
        ) : (
          <>
            <LineItem k="기본급" sub={`${agg.net.toFixed(1)}시간 × ${money(agg.wage)}원`} v={`${money(agg.base)}원`} />
            {agg.otPay > 0 && <LineItem k="연장근무" sub={`${(agg.otMin / 60).toFixed(1)}시간 × ${money(agg.wage)}원 × 1.5`} v={`${money(agg.otPay)}원`} />}
          </>
        )}
        {agg.holidayPay > 0 && (
          <LineItem k="공휴일 근무" sub={`${agg.holidayNet.toFixed(1)}시간 × ${money(agg.wage)}원 × ${agg.holidayMultiplier}`} v={`${money(agg.holidayPay)}원`} />
        )}
        {p.allowances.map((a) => (
          <LineItem key={a.id} k={a.label} v={`${money(a.amount)}원`} />
        ))}
        {Number(adj.extra) > 0 && <LineItem k={adj.extraLabel || "기타 수당"} v={`${money(adj.extra)}원`} />}
        <div style={{ borderTop: `1px solid ${C.line}` }} />
        <LineItem k="지급 합계" v={`${money(p.gross)}원`} bold />
      </div>
      {agg.shift && agg.shortMin > 0 && (
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>
          기준보다 모자란 {minStr(agg.shortMin)}은 지급액에서 빼지 않았습니다. 확인용으로만 표시합니다.
        </div>
      )}

      {(p.tax > 0 || p.deduct > 0) && (
        <>
          <div className="mt-4"><Eyebrow>공제 내역</Eyebrow></div>
          <div style={{ marginTop: 4 }}>
            {p.tax > 0 && <LineItem k="원천징수" sub="사업소득 3.3%" v={`−${money(p.tax)}원`} color={C.coral} />}
            {p.deduct > 0 && <LineItem k={adj.deductLabel || "기타 공제"} v={`−${money(p.deduct)}원`} color={C.coral} />}
          </div>
        </>
      )}

      <div className="mt-4" style={{
        background: `linear-gradient(155deg, ${C.coral} 0%, #E85A4D 100%)`,
        padding: "17px 18px", borderRadius: RADIUS, boxShadow: `0 8px 20px ${C.coral}4D, 0 2px 6px rgba(0,0,0,0.15)`,
      }}>
        <div className="flex items-baseline justify-between">
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em" }}>실지급액</span>
          <Num size={34} color="#fff" weight={900}>{money(p.net)}<span style={{ fontSize: 17 }}> 원</span></Num>
        </div>
      </div>

      {adj.memo && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: C.text, background: C.tileSoft, padding: "9px 11px", lineHeight: 1.6 }}>
          ※ {adj.memo}
        </div>
      )}

      {(() => {
        const offDays = (data.transfers || [])
          .filter((t) => t.fromWorkerId === workerId && t.status === "approved" && t.date.slice(0, 7) === ym)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (offDays.length === 0) return null;
        return (
          <div className="mt-4">
            <Eyebrow>이 달 중 양도한 휴무 ({offDays.length}건)</Eyebrow>
            <div style={{ marginTop: 6 }}>
              {offDays.map((t) => (
                <div key={t.id} className="flex items-center justify-between" style={{ padding: "5px 0", fontSize: 12, color: C.sub }}>
                  <span>{t.date.slice(5).replace("-", "/")} · {t.siteName}{t.startTime ? ` (${t.startTime}–${t.endTime})` : ""}</span>
                  <span style={{ fontWeight: 700, color: C.blue }}>{t.toWorkerName}님이 대신 근무</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 일자별 */}
      <div className="flex items-center justify-between mt-6 mb-2">
        <Eyebrow>{agg.shift ? "타임별 근무 내역" : "일자별 근무 내역"}</Eyebrow>
        <button onClick={() => setWithDays(!withDays)} className="no-print" style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>
          복사에 {withDays ? "포함됨" : "제외됨"}
        </button>
      </div>
      <div style={{ borderTop: `2px solid ${C.text}` }}>
        <div className="flex items-center" style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 10.5, fontWeight: 800, color: C.sub, letterSpacing: "0.04em" }}>
          <span style={{ width: 58 }}>날짜</span>
          <span style={{ flex: 1 }}>현장</span>
          <span style={{ width: 84, textAlign: "right" }}>출퇴근</span>
          <span style={{ width: 46, textAlign: "right" }}>근무</span>
          <span style={{ width: 54, textAlign: "right" }}>증감</span>
          <span style={{ width: 58, textAlign: "right" }}>금액</span>
        </div>
        {recs.map((r) => {
          const q = calcPay(r, worker, data.settings);
          const d = parseKey(r.date);
          const shortish = q.shortMin >= data.settings.shortThreshold;
          return (
            <div key={r.id} className="flex items-center" style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}` }}>
              <span style={{ width: 58, fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13, fontWeight: 700, color: C.text }}>
                {r.date.slice(5).replace("-", ".")}<span style={{ color: d.getDay() === 0 ? C.coral : C.sub }}>({WD[d.getDay()]})</span>
              </span>
              <span style={{ flex: 1, fontSize: 11.5, color: C.sub, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", paddingRight: 6 }}>
                {r.site}{r.note ? ` · ${r.note}` : ""}
                {q.holiday && <span style={{ color: C.coral, fontWeight: 800 }}> · 공휴일×{agg.holidayMultiplier}</span>}
                {r.coverForName && <span style={{ color: C.blue, fontWeight: 800 }}> · {r.coverForName}님 대신</span>}
              </span>
              <span style={{ width: 84, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13, color: C.sub }}>{tstr(r.clockIn)}–{tstr(r.clockOut)}</span>
              <span style={{ width: 46, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 800, color: C.text }}>{hmc(q.net)}</span>
              <span style={{ width: 54, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 800, color: q.blocks > 0 ? C.blue : shortish ? C.red : C.sub }}>
                {!agg.shift ? "—" : q.blocks > 0 ? `추가 ${otLabel(q.otMin)}` : q.diffMin < 0 ? `−${minStr(q.shortMin)}` : q.diffMin > 0 ? `+${minStr(q.diffMin)}` : "정확"}
              </span>
              <span style={{ width: 58, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13, color: C.coral }}>{money(q.pay)}</span>
            </div>
          );
        })}
        {recs.length === 0 && <div style={{ padding: "14px 0", fontSize: 12.5, color: C.sub }}>이 달의 근무 기록이 없습니다.</div>}
        <div className="flex items-center" style={{ padding: "9px 0", borderBottom: `2px solid ${C.text}` }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: C.text }}>
            합계 {agg.shift ? `${agg.times}타임 (${agg.days}일)` : `${agg.days}일`}
          </span>
          <span style={{ width: 46, textAlign: "right" }}><Num size={13}>{hmc(agg.net)}</Num></span>
          <span style={{ width: 54, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 800, color: C.blue }}>{agg.blocks ? `${agg.blocks}회` : ""}</span>
          <span style={{ width: 58, textAlign: "right" }}><Num size={12}>{money(agg.pay)}</Num></span>
        </div>
      </div>

      <div className="flex items-end justify-between" style={{ marginTop: 26 }}>
        <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.6, maxWidth: 200 }}>
          위 근무 내역과 지급액을 확인하였습니다.
        </div>
        <div className="text-right">
          <div style={{ borderBottom: `1px solid ${C.text}`, width: 130, height: 26 }} />
          <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>근무자 확인 (서명)</div>
        </div>
      </div>

      {/* 수당·공제 편집 */}
      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} title="수당 · 공제 입력">
        {draft && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>
              {worker.name} 님의 {ymLabel(ym)} 정산에만 적용됩니다.
            </div>
            <Field label="기타 수당">
              <div className="flex gap-2">
                <input value={draft.extraLabel} onChange={(e) => setDraft({ ...draft, extraLabel: e.target.value })} placeholder="항목 (예: 교통비)" style={{ ...inputStyle, flex: 1 }} />
                <input type="number" inputMode="numeric" value={draft.extra} onChange={(e) => setDraft({ ...draft, extra: e.target.value })} placeholder="0" style={{ ...inputStyle, width: 110, fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right" }} />
              </div>
            </Field>
            <Field label="기타 공제">
              <div className="flex gap-2">
                <input value={draft.deductLabel} onChange={(e) => setDraft({ ...draft, deductLabel: e.target.value })} placeholder="항목 (예: 가불금)" style={{ ...inputStyle, flex: 1 }} />
                <input type="number" inputMode="numeric" value={draft.deduct} onChange={(e) => setDraft({ ...draft, deduct: e.target.value })} placeholder="0" style={{ ...inputStyle, width: 110, fontFamily: MONO, fontVariantNumeric: "tabular-nums", textAlign: "right" }} />
              </div>
            </Field>
            <div style={{ border: `1px solid ${C.line}`, padding: "4px 12px", marginBottom: 12 }}>
              <Toggle label="원천징수 3.3% 공제" desc="사업소득으로 지급하는 경우에 켭니다" first
                on={draft.tax} onChange={(v) => setDraft({ ...draft, tax: v })} />
            </div>
            <Field label="비고">
              <textarea value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} placeholder="정산서에 함께 표시할 내용" style={{ ...inputStyle, height: 64 }} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Btn kind="ghost" full onClick={() => setAdjOpen(false)}>취소</Btn>
              <Btn full onClick={saveAdj}>저장</Btn>
            </div>
          </>
        )}
      </Modal>
    </PaperShell>
  );
}

/* ─────────────────────────  전체 급여대장  ───────────────────────── */
function PayrollBook({ data, ym, onClose, setToast, onOpenSlip }) {
  const shift = data.settings.payMode === "shift";
  const rows = data.workers.map((w) => ({ w, ...payslipCalc(data, w.id, ym) })).filter((r) => r.agg.times > 0 || r.extra || r.deduct);
  const sum = rows.reduce((a, r) => ({
    days: a.days + r.agg.days, times: a.times + r.agg.times, net: a.net + r.agg.net,
    blocks: a.blocks + r.agg.blocks, gross: a.gross + r.gross,
    cut: a.cut + r.tax + r.deduct, pay: a.pay + r.net,
  }), { days: 0, times: 0, net: 0, blocks: 0, gross: 0, cut: 0, pay: 0 });

  const text = useMemo(() => {
    const L = [];
    if (data.settings.companyName) L.push(data.settings.companyName);
    L.push(`[${ymLabel(ym)} 급여대장]`, "");
    rows.forEach((r) => L.push(
      shift
        ? `${r.w.name}  ${r.agg.times}타임  추가${r.agg.blocks}회  ${money(r.net)}원`
        : `${r.w.name}  ${r.agg.days}일  ${hmc(r.agg.net)}  ${money(r.net)}원`));
    L.push("──────────────", `합계 ${rows.length}명  ${money(sum.pay)}원`);
    return L.join("\n");
  }, [data, ym]);

  return (
    <PaperShell title="급여대장" onClose={onClose} actions={
      <>
        <button onClick={() => { navigator.clipboard?.writeText(text); setToast("복사했습니다"); }}
          className="flex items-center gap-1 px-2.5" style={{ background: C.aquaDeep, color: "#fff", fontSize: 12, fontWeight: 800, height: 34 }}>
          <Copy size={13} /> 복사
        </button>
        <button onClick={() => window.print()} className="flex items-center justify-center" title="인쇄 / PDF"
          style={{ border: `1px solid ${C.lineDark}`, color: C.onDarkSub, width: 36, height: 34 }}>
          <Printer size={15} />
        </button>
      </>
    }>
      <div className="flex items-start justify-between gap-3">
        <div>
          {data.settings.companyName && <div style={{ fontSize: 15, fontWeight: 900, color: C.text, letterSpacing: "0.02em" }}>{data.settings.companyName}</div>}
          <div style={{ fontSize: 23, fontWeight: 900, color: C.text, marginTop: 4, letterSpacing: "-0.02em" }}>{ymLabel(ym)} 급여대장</div>
        </div>
        <div className="text-right" style={{ flexShrink: 0 }}>
          <Eyebrow>인원</Eyebrow>
          <div style={{ marginTop: 2 }}><Num size={14}>{rows.length}명</Num></div>
        </div>
      </div>
      <Rule thick />

      <div className="flex items-center" style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 10.5, fontWeight: 800, color: C.sub }}>
        <span style={{ flex: 1 }}>이름</span>
        <span style={{ width: 42, textAlign: "right" }}>{shift ? "타임" : "일수"}</span>
        <span style={{ width: 44, textAlign: "right" }}>추가</span>
        <span style={{ width: 66, textAlign: "right" }}>지급</span>
        <span style={{ width: 56, textAlign: "right" }}>공제</span>
        <span style={{ width: 76, textAlign: "right" }}>실지급</span>
      </div>
      {rows.map((r) => (
        <div key={r.w.id} onClick={() => onOpenSlip(r.w.id)} className="flex items-center"
          style={{ padding: "9px 0", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: C.text }}>{r.w.name}</span>
          <span style={{ width: 42, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: C.sub }}>{shift ? r.agg.times : r.agg.days}</span>
          <span style={{ width: 44, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: r.agg.blocks ? C.blue : C.sub }}>{r.agg.blocks || "—"}</span>
          <span style={{ width: 66, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: C.coral }}>{money(r.gross)}</span>
          <span style={{ width: 56, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, color: r.tax + r.deduct > 0 ? C.coral : C.sub }}>
            {r.tax + r.deduct > 0 ? `−${money(r.tax + r.deduct)}` : "—"}
          </span>
          <span style={{ width: 76, textAlign: "right" }}><Num size={14.5} weight={800} color={C.coral}>{money(r.net)}</Num></span>
        </div>
      ))}
      {rows.length === 0 && <div style={{ padding: "16px 0", fontSize: 13, color: C.sub }}>이 달의 근무 기록이 없습니다.</div>}

      <div className="flex items-center" style={{ padding: "11px 0", borderBottom: `2px solid ${C.text}` }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 900, color: C.text }}>합계</span>
        <span style={{ width: 42, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 800 }}>{shift ? sum.times : sum.days}</span>
        <span style={{ width: 44, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 800, color: C.blue }}>{sum.blocks || "—"}</span>
        <span style={{ width: 66, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 800, color: C.coral }}>{money(sum.gross)}</span>
        <span style={{ width: 56, textAlign: "right", fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: 13.5, fontWeight: 800, color: C.coral }}>
          {sum.cut > 0 ? `−${money(sum.cut)}` : "—"}
        </span>
        <span style={{ width: 76, textAlign: "right" }}><Num size={16} weight={900} color={C.coral}>{money(sum.pay)}</Num></span>
      </div>

      <div style={{ marginTop: 14, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
        {shift ? `총 ${sum.times}타임 · 추가근무 ${sum.blocks}회 · 실근무 ${hm(sum.net)}` : `총 ${sum.days}일 · 실근무 ${hm(sum.net)}`}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: C.sub, lineHeight: 1.6 }}>
        이름을 누르면 그 사람의 정산서로 넘어갑니다.
      </div>
    </PaperShell>
  );
}

/* ─────────────────────────  설정  ───────────────────────── */
function SettingsView({ data, update, dev, updateDev, setToast }) {
  const { workers, sites, settings } = data;
  const [wEdit, setWEdit] = useState(null);
  const [sEdit, setSEdit] = useState(null);
  const [cap, setCap] = useState("idle");
  const [bind, setBind] = useState(null);
  const [reset, setReset] = useState(false);
  const [pinEdit, setPinEdit] = useState(null);
  const [addrQ, setAddrQ] = useState("");
  const [addrState, setAddrState] = useState("idle"); // idle | loading | done | fail
  const [addrResults, setAddrResults] = useState([]);
  const [manualBusy, setManualBusy] = useState(false);
  const uploadManualFile = async (siteId, siteName, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setToast("파일이 너무 커요 (최대 15MB)"); return; }
    setManualBusy(true);
    try {
      const res = await fetch("/api/photo", { method: "POST", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!res.ok) throw new Error("upload failed");
      const { id: fileId } = await res.json();
      const displayName = file.name.startsWith(siteName) ? file.name : `${siteName}_${file.name}`;
      update((d) => ({
        ...d,
        siteManuals: [...(d.siteManuals || []), {
          id: uid(), siteId, siteName, fileId, fileName: displayName, contentType: file.type,
          uploadedAt: new Date().toISOString(),
        }],
      }));
      setToast("매뉴얼을 등록했습니다");
    } catch (e) {
      setToast("업로드에 실패했어요 — 인터넷 연결을 확인해 주세요");
    } finally {
      setManualBusy(false);
    }
  };
  const removeManual = (id) => update((d) => ({ ...d, siteManuals: (d.siteManuals || []).filter((m) => m.id !== id) }));

  const bound = workers.find((w) => w.id === dev.workerId);
  const noCoord = sites.filter((s) => s.lat == null).length;

  const saveWorker = () => {
    if (!wEdit.name.trim()) { setToast("이름을 입력하세요"); return; }
    const opt = (v) => (v === "" || v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const siteIds = wEdit.siteIds || [];
    const leaderSiteIds = (wEdit.leaderSiteIds || []).filter((id) => siteIds.includes(id)); // 담당 현장이 아니면 팀장 지정 무효
    const allowances = (wEdit.allowances || [])
      .filter((a) => a.label && a.label.trim())
      .map((a) => ({ id: a.id || uid(), label: a.label.trim(), amount: Number(a.amount) || 0 }));
    const w = {
      id: wEdit.id || uid(), name: wEdit.name.trim(),
      siteIds, siteId: siteIds[0] || null, // siteId는 하위호환용(대표 현장)
      wage: opt(wEdit.wage), stdHours: opt(wEdit.stdHours),
      shiftHours: opt(wEdit.shiftHours), shiftPay: opt(wEdit.shiftPay),
      paySettingsBySite: wEdit.paySettingsBySite || {},
      leaderSiteIds, isTeamLead: leaderSiteIds.length > 0, allowances,
      canSelfLogOneOff: !!wEdit.canSelfLogOneOff,
      code: wEdit.code || String(Math.floor(100000 + Math.random() * 900000)),
    };
    update((d) => ({ ...d, workers: wEdit.id ? d.workers.map((x) => (x.id === w.id ? w : x)) : [...d.workers, w] }));
    setWEdit(null); setToast("근무자를 저장했습니다");
  };
  const delWorker = () => {
    update((d) => ({
      ...d, workers: d.workers.filter((x) => x.id !== wEdit.id),
      records: d.records.filter((r) => r.workerId !== wEdit.id),
    }));
    if (dev.workerId === wEdit.id) updateDev({ ...dev, workerId: null, boundAt: null });
    setWEdit(null); setToast("근무자와 기록을 삭제했습니다");
  };

  const saveSite = () => {
    if (!sEdit.name.trim()) { setToast("현장 이름을 입력하세요"); return; }
    const s = {
      id: sEdit.id || uid(), name: sEdit.name.trim(),
      lat: sEdit.lat === "" || sEdit.lat == null ? null : Number(sEdit.lat),
      lng: sEdit.lng === "" || sEdit.lng == null ? null : Number(sEdit.lng),
      radius: Number(sEdit.radius) || settings.defaultRadius,
      workDays: sEdit.workDays || [],
      startTime: sEdit.startTime || "",
      endTime: sEdit.endTime || "",
    };
    update((d) => ({ ...d, sites: sEdit.id ? d.sites.map((x) => (x.id === s.id ? s : x)) : [...d.sites, s] }));
    setSEdit(null); setCap("idle"); setToast("현장을 저장했습니다");
  };
  const capture = async () => {
    setCap("loading");
    const v = await getLoc();
    if (v) { setSEdit((p) => ({ ...p, lat: v.lat, lng: v.lng, acc: v.acc })); setCap("ok"); }
    else setCap("fail");
  };
  const searchAddr = async () => {
    if (!addrQ.trim()) return;
    setAddrState("loading"); setAddrResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=kr&accept-language=ko&limit=5&q=${encodeURIComponent(addrQ.trim())}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const list = await res.json();
      if (!list || list.length === 0) { setAddrState("fail"); return; }
      setAddrResults(list);
      setAddrState("done");
    } catch (e) {
      setAddrState("fail");
    }
  };
  const pickAddr = (item) => {
    setSEdit((p) => ({ ...p, lat: Number(item.lat).toFixed(6), lng: Number(item.lon).toFixed(6), acc: null }));
    setCap("ok");
    setAddrResults([]); setAddrQ(item.display_name); setAddrState("idle");
  };

  const doBind = (workerId) => {
    const at = new Date().toISOString();
    updateDev({ ...dev, workerId, boundAt: workerId ? at : null });
    if (workerId) {
      update((d) => {
        const prev = d.bindings[workerId];
        const changed = prev && prev.deviceId !== dev.deviceId;
        return {
          ...d,
          bindings: { ...d.bindings, [workerId]: { deviceId: dev.deviceId, at } },
          bindLog: changed
            ? [{ workerId, at, from: prev.deviceId.slice(0, 6), to: dev.deviceId.slice(0, 6) }, ...d.bindLog].slice(0, 30)
            : d.bindLog,
        };
      });
    }
    setBind(null);
    setToast(workerId ? "이 기기를 연결했습니다" : "기기 연결을 해제했습니다");
  };

  return (
    <div className="px-4 pt-5 pb-8">
      {/* 기기 연결 */}
      <Sec title="이 기기의 근무자">
        <Tile style={{ padding: 14 }}>
          <div className="flex items-start gap-2.5">
            <Smartphone size={17} color={bound ? C.aquaDeep : C.sub} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              {bound ? (
                <>
                  <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{bound.name}</div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 2, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {dev.boundAt ? `${dev.boundAt.slice(0, 10)} 연결됨` : "연결됨"} · 기기 {dev.deviceId.slice(0, 6)}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>연결 안 됨</div>
              )}
              <div style={{ fontSize: 12, color: C.sub, marginTop: 8, lineHeight: 1.6 }}>
                이 휴대폰의 출퇴근은 연결된 한 사람 이름으로만 기록됩니다. 근무자 화면에서는 이름을 바꿀 수 없어, 한 대로 여러 명이 찍는 대리출석이 되지 않습니다.
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Btn small kind="ghost" onClick={() => setBind({ id: bound?.id || "" })}>{bound ? "다른 사람으로 변경" : "근무자 연결"}</Btn>
            {bound && <Btn small kind="danger" onClick={() => doBind(null)}>연결 해제</Btn>}
          </div>
        </Tile>
      </Sec>

      {/* 현장 */}
      <Sec title={`현장 · 좌표와 반경 (${sites.length})`} right={
        <button onClick={() => { setCap("idle"); setAddrQ(""); setAddrState("idle"); setAddrResults([]); setSEdit({ id: null, name: "", lat: "", lng: "", radius: settings.defaultRadius, workDays: [], startTime: "", endTime: "" }); }}
          className="flex items-center gap-1" style={{ color: C.aqua, fontSize: 12, fontWeight: 700 }}><Plus size={13} /> 추가</button>}>
        {sites.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>현장을 추가하고, 현장에 도착해서 좌표를 등록하세요.</div></Tile>}
        {sites.map((s) => (
          <Tile key={s.id} onClick={() => { setCap("idle"); setAddrQ(""); setAddrState("idle"); setAddrResults([]); setSEdit({ workDays: [], startTime: "", endTime: "", ...s }); }} style={{ padding: "12px 14px" }}>
            <div className="flex items-center justify-between gap-3">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{s.name}</div>
                {s.lat != null ? (
                  <div style={{ color: C.sub, fontSize: 13, marginTop: 2, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {s.lat}, {s.lng} · 반경 {s.radius}m
                  </div>
                ) : (
                  <div className="flex items-center gap-1" style={{ color: C.amber, fontSize: 11.5, marginTop: 3, fontWeight: 700 }}>
                    <AlertTriangle size={11} /> 좌표 미등록 — 위치 확인 없이 기록됨
                  </div>
                )}
                {(s.workDays && s.workDays.length > 0) || s.startTime ? (
                  <div style={{ color: C.blue, fontSize: 11, marginTop: 3, fontWeight: 700 }}>
                    {s.workDays && s.workDays.length > 0 ? s.workDays.map((d) => WD[d]).join("·") : "요일 미지정"}
                    {s.startTime ? ` · ${s.startTime}–${s.endTime}` : ""}
                  </div>
                ) : null}
              </div>
              <Pencil size={14} color={C.sub} style={{ flexShrink: 0 }} />
            </div>
          </Tile>
        ))}
        <Tile soft style={{ padding: 13 }}>
          <Toggle label="현장 반경 확인" desc="현장 밖에서는 출근 버튼이 눌리지 않습니다"
            on={settings.geofence} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, geofence: v } }))} first />
          {settings.geofence && noCoord > 0 && (
            <div style={{ color: C.amber, fontSize: 11.5, marginTop: 8, lineHeight: 1.5, fontWeight: 700 }}>
              좌표가 없는 현장 {noCoord}곳은 아직 위치 확인이 되지 않습니다.
            </div>
          )}
        </Tile>
      </Sec>

      {/* 근무자 */}
      <Sec title={`근무자 (${workers.length}명)`} right={
        <button onClick={() => setWEdit({ id: null, name: "", siteIds: sites[0] ? [sites[0].id] : [], leaderSiteIds: [], paySettingsBySite: {}, wage: "", stdHours: "", shiftHours: "", shiftPay: "" })}
          className="flex items-center gap-1" style={{ color: C.aqua, fontSize: 12, fontWeight: 700 }}><Plus size={13} /> 추가</button>}>
        {workers.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>아직 등록된 근무자가 없습니다.</div></Tile>}
        {workers.map((w) => (
          <Tile key={w.id} onClick={() => setWEdit({ ...w, wage: w.wage ?? "", stdHours: w.stdHours ?? "", shiftHours: w.shiftHours ?? "", shiftPay: w.shiftPay ?? "", siteIds: w.siteIds || (w.siteId ? [w.siteId] : []), paySettingsBySite: w.paySettingsBySite || {}, leaderSiteIds: w.leaderSiteIds || [], allowances: (w.allowances || []).map((a) => ({ ...a })) })} style={{ padding: "12px 14px" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{w.name}</span>
                  {w.isTeamLead && <span style={{ fontSize: 9.5, fontWeight: 900, color: "#7A4E07", background: C.amber, padding: "1px 5px" }}>팀장{(w.leaderSiteIds || []).length ? ` · ${w.leaderSiteIds.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean).join("·")}` : ""}</span>}
                  {w.id === dev.workerId && <span style={{ fontSize: 9.5, fontWeight: 800, color: C.aquaDeep, border: `1px solid ${C.aquaDeep}`, padding: "1px 4px" }}>이 기기</span>}
                </div>
                <div style={{ color: C.sub, fontSize: 13, marginTop: 2, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                  {(() => {
                    const ids = w.siteIds || (w.siteId ? [w.siteId] : []);
                    const names = ids.map((id) => sites.find((s) => s.id === id)?.name).filter(Boolean);
                    return names.length ? names.join(" · ") : "현장 미지정";
                  })()} · {settings.payMode === "shift"
                    ? `1타임 ${w.shiftHours ?? settings.shiftHours}h / ${money(w.shiftPay ?? settings.shiftPay)}원`
                    : `${money(w.wage ?? settings.wage)}원/h · 1일 ${w.stdHours ?? settings.stdHours}h`}
                </div>
              </div>
              <Pencil size={14} color={C.sub} />
            </div>
            <div className="flex items-center justify-between mt-2.5 pt-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 10.5, color: C.sub, fontWeight: 700 }}>연결 코드</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.coral, fontFamily: MONO, letterSpacing: "0.12em" }}>{w.code || "——————"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard?.writeText(w.code || "");
                  setToast(`${w.name}님 연결 코드를 복사했습니다`);
                }} className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: C.coral, padding: "5px 8px", flexShrink: 0 }}>
                  <Copy size={11} /> 코드
                </button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  const url = `${window.location.origin}/invite/${w.id}`;
                  navigator.clipboard?.writeText(url);
                  setToast(`${w.name}님 연결 링크를 복사했습니다`);
                }} className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 800, color: C.sub, border: `1px solid ${C.line}`, padding: "5px 8px", flexShrink: 0 }}>
                  <Copy size={11} /> 링크
                </button>
              </div>
            </div>
          </Tile>
        ))}
      </Sec>

      {/* 정산 */}
      <Sec title="정산 기준">
        <Tile style={{ padding: 14 }}>
          <Field label="회사명 · 정산서 머리글에 표시됩니다">
            <input value={settings.companyName || ""} placeholder="예: 한빛클린" style={inputStyle}
              onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, companyName: e.target.value } }))} />
          </Field>
          <div className="mb-3">
            <div className="mb-1.5"><Eyebrow>정산 방식</Eyebrow></div>
            <div className="grid grid-cols-2 gap-0.5" style={{ background: C.line }}>
              {[["shift", "타임제", "한 타임 단위로 지급"], ["hourly", "시간제", "실근무 시간 × 시급"]].map(([k, l, d2]) => (
                <button key={k} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, payMode: k } }))}
                  className="py-2.5 px-2" style={{ background: settings.payMode === k ? C.aquaDeep : C.tileSoft, color: settings.payMode === k ? "#fff" : C.sub }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>{l}</div>
                  <div style={{ fontSize: 10.5, marginTop: 2, opacity: 0.85 }}>{d2}</div>
                </button>
              ))}
            </div>
          </div>

          {settings.payMode === "shift" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="1타임 기본 시간">
                  <input type="number" step="0.5" value={settings.shiftHours} style={inputStyle}
                    onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, shiftHours: Number(e.target.value) || 0 } }))} />
                </Field>
                <Field label="1타임 지급액 (원)">
                  <input type="number" value={settings.shiftPay} style={inputStyle}
                    onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, shiftPay: Number(e.target.value) || 0 } }))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="추가 인정 기준 (분 이상)">
                  <input type="number" value={settings.otThreshold} style={inputStyle}
                    onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, otThreshold: Number(e.target.value) || 1 } }))} />
                </Field>
                <Field label="추가 1회 지급액 (원)">
                  <input type="number" value={settings.otPay} style={inputStyle}
                    onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, otPay: Number(e.target.value) || 0 } }))} />
                </Field>
              </div>
              <Toggle label={`${settings.otThreshold}분마다 반복 가산`} first
                desc={settings.otRepeat
                  ? `${settings.otThreshold * 2}분 이상 초과하면 ${money(settings.otPay * 2)}원으로 늘어납니다`
                  : `얼마를 초과하든 ${money(settings.otPay)}원만 더합니다`}
                on={settings.otRepeat} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, otRepeat: v } }))} />
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12, marginTop: 4 }}>
                <Field label="부족 표시 기준 (분 이상)">
                  <input type="number" value={settings.shortThreshold} style={inputStyle}
                    onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, shortThreshold: Number(e.target.value) || 0 } }))} />
                </Field>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: -8, lineHeight: 1.6 }}>
                  기준보다 모자란 타임에 부족 표시가 붙습니다. 지급액은 그대로 {money(settings.shiftPay)}원입니다.
                </div>
              </div>
              <div style={{ background: C.tileSoft, padding: 12, marginTop: 14 }}>
                <Eyebrow>지금 설정으로 계산하면</Eyebrow>
                <div style={{ fontSize: 13.5, color: C.text, marginTop: 7, lineHeight: 1.8, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                  {[Math.round(settings.shiftHours * 60) - 20, Math.round(settings.shiftHours * 60) + 12,
                    Math.round(settings.shiftHours * 60) + settings.otThreshold,
                    Math.round(settings.shiftHours * 60) + settings.otThreshold * 2].map((m, i) => {
                    const fake = { clockIn: new Date(2020, 0, 1, 8, 0).toISOString(), clockOut: new Date(2020, 0, 1, 8, 0, 0).toISOString() };
                    const q = calcPay({ ...fake, clockOut: new Date(2020, 0, 1, 8, m).toISOString() }, null, settings);
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span style={{ color: C.sub }}>{minStr(m)} 근무</span>
                        <span style={{ fontWeight: 800, color: q.blocks ? C.coral : q.shortMin >= settings.shortThreshold ? C.red : C.text }}>
                          {money(q.pay)}원{q.blocks ? ` (추가 ${q.blocks}회)` : q.shortMin >= settings.shortThreshold ? ` (부족 −${minStr(q.shortMin)})` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="기본 시급 (원)">
                  <input type="number" value={settings.wage} onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, wage: Number(e.target.value) || 0 } }))} style={inputStyle} />
                </Field>
                <Field label="1일 소정근로 (시간)">
                  <input type="number" step="0.5" value={settings.stdHours} onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, stdHours: Number(e.target.value) || 0 } }))} style={inputStyle} />
                </Field>
              </div>
              <Toggle label="휴게시간 자동 차감" first desc="4시간 근무 시 30분, 8시간 이상 60분을 뺍니다"
                on={settings.autoBreak} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, autoBreak: v } }))} />
              <Toggle label="연장근로 1.5배 적용" desc="1일 소정시간을 넘긴 시간에 가산 수당을 계산합니다"
                on={settings.otPremium} onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, otPremium: v } }))} />
            </>
          )}
        </Tile>
      </Sec>

      {/* 공휴일 관리 */}
      <Sec title="공휴일 · 휴일수당">
        <Tile>
          <div className="grid grid-cols-2 gap-2">
            <Field label="공휴일 배율 (배)">
              <input type="number" step="0.1" min="1" value={settings.holidayMultiplier ?? 1.5}
                onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, holidayMultiplier: Number(e.target.value) || 1 } }))}
                style={inputStyle} />
            </Field>
            <Field label="공휴일 날짜 추가">
              <input type="date" style={inputStyle}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  update((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      holidays: d.settings.holidays.includes(v) ? d.settings.holidays : [...d.settings.holidays, v].sort(),
                    },
                  }));
                  setToast(`${v}를 공휴일로 추가했습니다`);
                  e.target.value = "";
                }} />
            </Field>
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginTop: -6, lineHeight: 1.6 }}>
            등록된 날짜에 근무한 시간은 시급(또는 타임 지급액)의 {settings.holidayMultiplier ?? 1.5}배로 자동 계산됩니다.
          </div>

          <div className="flex gap-2" style={{ marginTop: 10 }}>
            {Object.keys(KR_HOLIDAYS).map((year) => (
              <button key={year}
                onClick={() => {
                  const dates = KR_HOLIDAYS[year].map(([d]) => d);
                  update((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      holidays: Array.from(new Set([...d.settings.holidays, ...dates])).sort(),
                    },
                  }));
                  setToast(`${year}년 공휴일 ${dates.length}일을 채웠습니다`);
                }}
                style={{
                  flex: 1, padding: "10px 0", fontSize: 12.5, fontWeight: 800,
                  background: C.tileSoft, border: `1px solid ${C.line}`, color: C.text,
                }}>
                {year}년 공휴일 자동 채우기
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.6 }}>
            정부 발표(관공서의 공휴일에 관한 규정) 기준 날짜예요. 근로자의 날(5/1)도 포함되어 있어요 — 5인 미만 사업장이라도 근로기준법상 유급휴일이라 근무 시 수당 대상이에요. 실제 지정 여부는 자유롭게 태그를 눌러 빼실 수 있어요.
          </div>

          {settings.holidays && settings.holidays.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
              {settings.holidays.map((h) => {
                const label = Object.values(KR_HOLIDAYS).flat().find(([d]) => d === h)?.[1];
                return (
                  <button key={h} onClick={() => update((d) => ({ ...d, settings: { ...d.settings, holidays: d.settings.holidays.filter((x) => x !== h) } }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
                      background: C.tileSoft, border: `1px solid ${C.line}`, fontSize: 13.5, fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: C.text,
                    }}>
                    {h}{label ? ` ${label}` : ""} <X size={12} color={C.sub} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>등록된 공휴일이 없습니다.</div>
          )}
        </Tile>
      </Sec>

      {/* 기기 변경 이력 */}
      {data.bindLog.length > 0 && (
        <Sec title="기기 변경 이력">
          {data.bindLog.slice(0, 8).map((l, i) => (
            <Tile key={i} soft style={{ padding: "10px 14px" }}>
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} color={C.amber} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: C.text, fontWeight: 700 }}>
                  {workers.find((w) => w.id === l.workerId)?.name || "삭제된 근무자"} 님이 다른 기기로 연결됨
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: C.sub, marginTop: 3, fontFamily: MONO, fontVariantNumeric: "tabular-nums", marginLeft: 21 }}>
                {l.at.slice(0, 10)} {l.at.slice(11, 16)} · {l.from} → {l.to}
              </div>
            </Tile>
          ))}
        </Sec>
      )}

      <Sec title="보안 · 데이터">
        <Tile style={{ padding: 14 }}>
          <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.6 }}>
            근무 기록과 급여는 관리자 PIN을 아는 사람만 볼 수 있습니다. 출퇴근 탭으로 나가면 자동으로 다시 잠깁니다.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn small kind="ghost" onClick={() => setPinEdit({ a: "", b: "" })}>PIN 변경</Btn>
            {workers.length === 0 && <Btn small kind="ghost" onClick={() => update(sampleData())}>샘플 데이터 넣기</Btn>}
            <Btn small kind="danger" onClick={() => setReset(true)}>전체 초기화</Btn>
          </div>
        </Tile>
      </Sec>

      {/* 기기 연결 모달 */}
      <Modal open={!!bind} onClose={() => setBind(null)} title="이 기기에 연결할 근무자">
        {bind && (
          <>
            <div style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, marginBottom: 12 }}>
              연결한 뒤에는 이 휴대폰의 모든 출퇴근이 이 사람 이름으로 남습니다. 근무자 본인 휴대폰에서 설정해 주세요.
            </div>
            <div className="flex flex-col gap-0.5" style={{ background: C.line }}>
              {workers.map((w) => (
                <Tile key={w.id} onClick={() => doBind(w.id)} style={{ padding: "13px 14px" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontWeight: 800, fontSize: 15, color: C.text }}>{w.name}</span>
                    {w.id === dev.workerId && <Check size={17} color={C.aquaDeep} />}
                  </div>
                </Tile>
              ))}
              {workers.length === 0 && <Tile><div style={{ color: C.sub, fontSize: 13 }}>먼저 근무자를 등록하세요.</div></Tile>}
            </div>
          </>
        )}
      </Modal>

      {/* 현장 편집 */}
      <Modal open={!!sEdit} onClose={() => { setSEdit(null); setCap("idle"); }} title={sEdit?.id ? "현장 수정" : "현장 추가"}>
        {sEdit && (
          <>
            <Field label="현장 이름"><input value={sEdit.name} onChange={(e) => setSEdit({ ...sEdit, name: e.target.value })} placeholder="예: 강남타워" style={inputStyle} /></Field>

            <div className="mb-3" style={{ background: C.tileSoft, border: `1px solid ${C.line}`, padding: 13 }}>
              <Eyebrow>현장 좌표</Eyebrow>

              <div style={{ fontSize: 12, color: C.sub, marginTop: 6, marginBottom: 8, lineHeight: 1.6 }}>
                주소로 검색하거나, 현장에 도착해서 GPS로 등록하세요.
              </div>
              <div className="flex gap-1.5">
                <input value={addrQ} onChange={(e) => setAddrQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") searchAddr(); }}
                  placeholder="예: 서울 강남구 테헤란로 123" style={{ ...inputStyle, background: C.tile, flex: 1 }} />
                <button onClick={searchAddr} disabled={addrState === "loading"}
                  style={{ background: C.aquaDeep, color: "#fff", padding: "0 16px", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {addrState === "loading" ? <Loader2 size={15} className="animate-spin" /> : "검색"}
                </button>
              </div>
              {addrState === "fail" && (
                <div style={{ color: C.amber, fontSize: 11.5, marginTop: 6, fontWeight: 700 }}>
                  주소를 찾지 못했습니다. 조금 더 정확하게(도로명+건물번호) 입력하거나 아래 GPS 방식을 이용하세요.
                </div>
              )}
              {addrResults.length > 0 && (
                <div className="mt-2 flex flex-col gap-0.5">
                  {addrResults.map((item, i) => (
                    <button key={i} onClick={() => pickAddr(item)} className="text-left"
                      style={{ background: C.tile, border: `1px solid ${C.line}`, padding: "9px 10px", fontSize: 12.5, color: C.text, lineHeight: 1.4 }}>
                      {item.display_name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ height: 1, background: C.line, margin: "12px 0" }} />

              <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6 }}>
                현장에 도착해서 아래 버튼을 누르면 지금 서 있는 자리가 현장 중심으로 등록됩니다. 건물 정문 앞이 가장 정확합니다.
              </div>
              <div className="mt-3">
                <Btn small full onClick={capture} disabled={cap === "loading"}>
                  <span className="flex items-center justify-center gap-2">
                    {cap === "loading" ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                    {cap === "loading" ? "위치 확인 중…" : "현재 위치로 등록"}
                  </span>
                </Btn>
              </div>
              {cap === "fail" && <div style={{ color: C.amber, fontSize: 11.5, marginTop: 8, fontWeight: 700 }}>위치를 가져오지 못했습니다. 실외에서 다시 시도하거나 아래에 직접 입력하세요.</div>}
              {cap === "ok" && <div style={{ color: C.aquaDeep, fontSize: 13, marginTop: 8, fontWeight: 700, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>등록됨{sEdit.acc ? ` · 오차 ±${sEdit.acc}m` : ""}</div>}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Field label="위도"><input value={sEdit.lat ?? ""} onChange={(e) => setSEdit({ ...sEdit, lat: e.target.value })} placeholder="37.4979" style={{ ...inputStyle, fontFamily: MONO, fontVariantNumeric: "tabular-nums", background: C.tile }} /></Field>
                <Field label="경도"><input value={sEdit.lng ?? ""} onChange={(e) => setSEdit({ ...sEdit, lng: e.target.value })} placeholder="127.0276" style={{ ...inputStyle, fontFamily: MONO, fontVariantNumeric: "tabular-nums", background: C.tile }} /></Field>
              </div>
            </div>

            <div className="mb-3" style={{ background: C.tileSoft, border: `1px solid ${C.line}`, padding: 13 }}>
              <Eyebrow>근무 요일 · 시간 (선택)</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 5, marginBottom: 8, lineHeight: 1.5 }}>
                이 현장에서 정기적으로 근무하는 요일과 시간대를 기록해 두면, 근무자·관리자 화면에 참고용으로 표시돼요. 출퇴근 자체를 막지는 않아요.
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WD.map((w, i) => {
                  const on = (sEdit.workDays || []).includes(i);
                  return (
                    <button key={i} onClick={() => {
                      const cur = sEdit.workDays || [];
                      setSEdit({ ...sEdit, workDays: on ? cur.filter((x) => x !== i) : [...cur, i].sort() });
                    }} style={{
                      padding: "8px 0", fontSize: 12.5, fontWeight: 800,
                      background: on ? C.aquaDeep : C.tile, color: on ? "#fff" : C.sub,
                      border: `1px solid ${on ? C.aquaDeep : C.line}`,
                    }}>{w}</button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <Field label="시작 시간"><input type="time" value={sEdit.startTime || ""} onChange={(e) => setSEdit({ ...sEdit, startTime: e.target.value })} style={inputStyle} /></Field>
                <Field label="종료 시간"><input type="time" value={sEdit.endTime || ""} onChange={(e) => setSEdit({ ...sEdit, endTime: e.target.value })} style={inputStyle} /></Field>
              </div>
            </div>

            {sEdit.id && (
              <div className="mb-3" style={{ background: C.tileSoft, border: `1px solid ${C.line}`, padding: 13 }}>
                <Eyebrow>현장 매뉴얼</Eyebrow>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 5, marginBottom: 10, lineHeight: 1.5 }}>
                  PDF, 이미지 등을 올려두면 이 현장 소속 근무자·팀장이 앱에서 열람·다운로드할 수 있어요.
                </div>
                {(data.siteManuals || []).filter((m) => m.siteId === sEdit.id).map((m) => (
                  <div key={m.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: `1px solid ${C.line}` }}>
                    <a href={photoUrl(m.fileId)} target="_blank" rel="noreferrer" className="flex items-center gap-2" style={{ minWidth: 0 }}>
                      <FileText size={14} color={C.aquaDeep} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.fileName}</span>
                    </a>
                    <button onClick={() => removeManual(m.id)} style={{ flexShrink: 0 }}><X size={14} color={C.sub} /></button>
                  </div>
                ))}
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10,
                  border: `1.5px dashed ${C.line}`, padding: "10px 0", cursor: "pointer", fontSize: 12.5, fontWeight: 800, color: C.aquaDeep,
                }}>
                  {manualBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {manualBusy ? "업로드 중…" : "매뉴얼 파일 추가"}
                  <input type="file" accept=".pdf,image/*" style={{ display: "none" }} disabled={manualBusy}
                    onChange={(e) => { uploadManualFile(sEdit.id, sEdit.name, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </div>
            )}

            <div className="mb-3">
              <div className="mb-1.5"><Eyebrow>허용 반경</Eyebrow></div>
              <div className="grid grid-cols-3 gap-0.5" style={{ background: C.line }}>
                {[50, 100, 150, 200, 300, 500].map((r) => (
                  <button key={r} onClick={() => setSEdit({ ...sEdit, radius: r })} className="py-2.5"
                    style={{ background: Number(sEdit.radius) === r ? C.aquaDeep : C.tileSoft, color: Number(sEdit.radius) === r ? "#fff" : C.sub, fontSize: 13, fontWeight: 800, fontFamily: MONO, fontVariantNumeric: "tabular-nums" }}>
                    {r}m
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 7, lineHeight: 1.5 }}>
                건물 한 동이면 100~150m, 넓은 단지나 지하 작업이 많으면 200~300m를 권합니다.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              {sEdit.id
                ? <Btn kind="danger" full onClick={() => { update((d) => ({ ...d, sites: d.sites.filter((x) => x.id !== sEdit.id) })); setSEdit(null); setToast("현장을 삭제했습니다"); }}>
                    <span className="flex items-center justify-center gap-1.5"><Trash2 size={14} /> 삭제</span>
                  </Btn>
                : <Btn kind="ghost" full onClick={() => setSEdit(null)}>취소</Btn>}
              <Btn full onClick={saveSite}>저장</Btn>
            </div>
          </>
        )}
      </Modal>

      {/* 근무자 편집 */}
      <Modal open={!!wEdit} onClose={() => setWEdit(null)} title={wEdit?.id ? "근무자 수정" : "근무자 추가"}>
        {wEdit && (
          <>
            <Field label="이름"><input value={wEdit.name} onChange={(e) => setWEdit({ ...wEdit, name: e.target.value })} placeholder="예: 김순자" style={inputStyle} /></Field>

            <Field label="담당 현장 (여러 곳 선택 가능)">
              <div className="flex flex-wrap gap-1.5">
                {sites.map((s) => {
                  const on = (wEdit.siteIds || []).includes(s.id);
                  return (
                    <button key={s.id} onClick={() => {
                      const cur = wEdit.siteIds || [];
                      setWEdit({ ...wEdit, siteIds: on ? cur.filter((id) => id !== s.id) : [...cur, s.id] });
                    }} style={{
                      padding: "8px 12px", fontSize: 12.5, fontWeight: 800,
                      background: on ? C.aquaDeep : C.tileSoft, color: on ? "#fff" : C.sub,
                    }}>{s.name}</button>
                  );
                })}
                {sites.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>등록된 현장이 없습니다.</div>}
              </div>
              {(wEdit.siteIds || []).length > 1 && (
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                  여러 현장에 배정됐어요. 첫 번째로 선택한 곳이 출근 시 기본 현장으로 표시돼요.
                </div>
              )}
            </Field>

            <Field label="팀장으로 임명할 현장 (선택)">
              {(wEdit.siteIds || []).length === 0 ? (
                <div style={{ fontSize: 12.5, color: C.sub }}>먼저 위에서 담당 현장을 선택해 주세요.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(wEdit.siteIds || []).map((sid) => {
                    const site = sites.find((s) => s.id === sid);
                    if (!site) return null;
                    const on = (wEdit.leaderSiteIds || []).includes(sid);
                    return (
                      <button key={sid} onClick={() => {
                        const cur = wEdit.leaderSiteIds || [];
                        setWEdit({ ...wEdit, leaderSiteIds: on ? cur.filter((id) => id !== sid) : [...cur, sid] });
                      }} className="flex items-center gap-1.5"
                        style={{
                          padding: "8px 12px", fontSize: 12.5, fontWeight: 800,
                          background: on ? C.amber : C.tileSoft, color: on ? "#3D2600" : C.sub,
                        }}>
                        <ShieldCheck size={13} />{site.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>
                담당 현장 중 팀장을 맡을 곳만 선택하세요. 이름 옆에 "팀장" 뱃지가 붙고, 선택한 현장 동료들에게만 공지를 보낼 수 있게 돼요.
              </div>
            </Field>

            <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2, marginBottom: 4 }}>아래는 이 근무자의 기본 급여예요 (현장 구분 없이 적용).</div>
            {settings.payMode === "shift" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="1타임 시간 · 비우면 기본값">
                  <input type="number" step="0.5" value={wEdit.shiftHours ?? ""} placeholder={String(settings.shiftHours)}
                    onChange={(e) => setWEdit({ ...wEdit, shiftHours: e.target.value })} style={inputStyle} />
                </Field>
                <Field label="1타임 지급액 · 비우면 기본값">
                  <input type="number" value={wEdit.shiftPay ?? ""} placeholder={String(settings.shiftPay)}
                    onChange={(e) => setWEdit({ ...wEdit, shiftPay: e.target.value })} style={inputStyle} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="시급 (원)"><input type="number" value={wEdit.wage ?? ""} placeholder={String(settings.wage)} onChange={(e) => setWEdit({ ...wEdit, wage: e.target.value })} style={inputStyle} /></Field>
                <Field label="1일 소정근로 (시간)"><input type="number" step="0.5" value={wEdit.stdHours ?? ""} placeholder={String(settings.stdHours)} onChange={(e) => setWEdit({ ...wEdit, stdHours: e.target.value })} style={inputStyle} /></Field>
              </div>
            )}

            {(wEdit.siteIds || []).length > 1 && (
              <div className="mt-3" style={{ background: C.tileSoft, padding: 13 }}>
                <Eyebrow>현장마다 급여를 다르게 (선택)</Eyebrow>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 5, marginBottom: 10, lineHeight: 1.5 }}>
                  특정 현장에서만 급여가 다르면 여기에 입력하세요. 비워두면 위 기본값을 그대로 씁니다.
                </div>
                <div className="flex flex-col gap-3">
                  {(wEdit.siteIds || []).map((sid) => {
                    const site = sites.find((s) => s.id === sid);
                    if (!site) return null;
                    const ov = (wEdit.paySettingsBySite || {})[sid] || {};
                    const setOv = (patch) => setWEdit({
                      ...wEdit,
                      paySettingsBySite: { ...(wEdit.paySettingsBySite || {}), [sid]: { ...ov, ...patch } },
                    });
                    return (
                      <div key={sid}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text, marginBottom: 5 }}>{site.name}</div>
                        {settings.payMode === "shift" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" step="0.5" value={ov.shiftHours ?? ""} placeholder={`시간 (기본 ${wEdit.shiftHours || settings.shiftHours})`}
                              onChange={(e) => setOv({ shiftHours: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...inputStyle, background: C.tile }} />
                            <input type="number" value={ov.shiftPay ?? ""} placeholder={`지급액 (기본 ${wEdit.shiftPay || settings.shiftPay})`}
                              onChange={(e) => setOv({ shiftPay: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...inputStyle, background: C.tile }} />
                          </div>
                        ) : (
                          <input type="number" value={ov.wage ?? ""} placeholder={`시급 (기본 ${wEdit.wage || settings.wage})`}
                            onChange={(e) => setOv({ wage: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ ...inputStyle, background: C.tile }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={() => setWEdit({ ...wEdit, canSelfLogOneOff: !wEdit.canSelfLogOneOff })}
              className="flex items-center justify-between w-full mt-3"
              style={{ background: wEdit.canSelfLogOneOff ? "#EAF3DE" : C.tileSoft, border: `1px solid ${wEdit.canSelfLogOneOff ? "#639922" : C.line}`, padding: "11px 13px" }}>
              <div style={{ minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: wEdit.canSelfLogOneOff ? "#3B6D11" : C.text }}>본인이 캘린더에서 일회성 근무 직접 등록</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 1.4 }}>켜두면 이 근무자가 본인 캘린더에서 직접 날짜·현장·금액을 입력해 추가할 수 있어요.</div>
              </div>
              <div style={{
                width: 38, height: 22, borderRadius: 999, background: wEdit.canSelfLogOneOff ? "#639922" : C.line,
                position: "relative", flexShrink: 0, marginLeft: 10,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 999, background: "#fff", position: "absolute", top: 2,
                  left: wEdit.canSelfLogOneOff ? 18 : 2, transition: "left 0.15s",
                }} />
              </div>
            </button>

            <div className="mt-3" style={{ background: C.tileSoft, padding: 13 }}>
              <Eyebrow>고정 수당 (선택)</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 5, marginBottom: 10, lineHeight: 1.5 }}>
                팀장수당, 주유수당처럼 매달 자동으로 더해줄 금액이 있으면 등록하세요. 정산서에 매달 자동으로 반영돼요.
              </div>

              {(wEdit.allowances || []).length > 0 && (
                <div className="flex flex-col gap-2 mb-2.5">
                  {wEdit.allowances.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <input value={a.label} placeholder="항목명 (예: 팀장수당)"
                        onChange={(e) => {
                          const next = [...wEdit.allowances]; next[i] = { ...a, label: e.target.value };
                          setWEdit({ ...wEdit, allowances: next });
                        }} style={{ ...inputStyle, background: C.tile, flex: 2 }} />
                      <input type="number" value={a.amount} placeholder="금액"
                        onChange={(e) => {
                          const next = [...wEdit.allowances]; next[i] = { ...a, amount: e.target.value };
                          setWEdit({ ...wEdit, allowances: next });
                        }} style={{ ...inputStyle, background: C.tile, flex: 1 }} />
                      <button onClick={() => setWEdit({ ...wEdit, allowances: wEdit.allowances.filter((x) => x.id !== a.id) })}>
                        <X size={16} color={C.sub} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-1.5">
                <button onClick={() => setWEdit({ ...wEdit, allowances: [...(wEdit.allowances || []), { id: uid(), label: "팀장수당", amount: "" }] })}
                  style={{ fontSize: 12, fontWeight: 800, color: C.aquaDeep, border: `1px solid ${C.aquaDeep}`, padding: "7px 11px" }}>
                  + 팀장수당
                </button>
                <button onClick={() => setWEdit({ ...wEdit, allowances: [...(wEdit.allowances || []), { id: uid(), label: "주유수당", amount: "" }] })}
                  style={{ fontSize: 12, fontWeight: 800, color: C.aquaDeep, border: `1px solid ${C.aquaDeep}`, padding: "7px 11px" }}>
                  + 주유수당
                </button>
                <button onClick={() => setWEdit({ ...wEdit, allowances: [...(wEdit.allowances || []), { id: uid(), label: "", amount: "" }] })}
                  style={{ fontSize: 12, fontWeight: 800, color: C.sub, border: `1px solid ${C.line}`, padding: "7px 11px" }}>
                  + 직접 입력
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              {wEdit.id ? <Btn kind="danger" full onClick={delWorker}><span className="flex items-center justify-center gap-1.5"><Trash2 size={14} /> 삭제</span></Btn>
                : <Btn kind="ghost" full onClick={() => setWEdit(null)}>취소</Btn>}
              <Btn full onClick={saveWorker}>저장</Btn>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!pinEdit} onClose={() => setPinEdit(null)} title="관리자 PIN 변경">
        {pinEdit && (
          <>
            <Field label="새 PIN (숫자 4자리)">
              <input type="password" inputMode="numeric" maxLength={4} value={pinEdit.a} onChange={(e) => setPinEdit({ ...pinEdit, a: e.target.value.replace(/\D/g, "") })} style={{ ...inputStyle, fontFamily: MONO, fontVariantNumeric: "tabular-nums", letterSpacing: "0.4em" }} />
            </Field>
            <Field label="확인">
              <input type="password" inputMode="numeric" maxLength={4} value={pinEdit.b} onChange={(e) => setPinEdit({ ...pinEdit, b: e.target.value.replace(/\D/g, "") })} style={{ ...inputStyle, fontFamily: MONO, fontVariantNumeric: "tabular-nums", letterSpacing: "0.4em" }} />
            </Field>
            <Btn full disabled={pinEdit.a.length !== 4 || pinEdit.a !== pinEdit.b}
              onClick={() => { update((d) => ({ ...d, settings: { ...d.settings, adminPin: pinEdit.a } })); setPinEdit(null); setToast("PIN을 변경했습니다"); }}>
              변경하기
            </Btn>
          </>
        )}
      </Modal>

      <Modal open={reset} onClose={() => setReset(false)} title="전체 초기화">
        <div style={{ fontSize: 14.5, color: C.text, lineHeight: 1.6 }}>
          근무자, 현장, 모든 출퇴근 기록과 관리자 PIN이 지워집니다. 되돌릴 수 없습니다.
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Btn kind="ghost" full onClick={() => setReset(false)}>취소</Btn>
          <Btn kind="danger" full onClick={() => { update(DEFAULTS); updateDev({ ...dev, workerId: null, boundAt: null }); setReset(false); setToast("초기화했습니다"); }}>모두 지우기</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ─────────────────────────  서명 패드  ───────────────────────── */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const empty = useRef(true);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getCtx = () => canvasRef.current.getContext("2d");
  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = getCtx();
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1D232A";
  };
  useEffect(() => { setupCanvas(); }, []);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = getCtx();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const ctx = getCtx();
    ctx.lineTo(x, y);
    ctx.stroke();
    empty.current = false;
    setHasDrawn(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(empty.current ? null : canvasRef.current.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    empty.current = true;
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div>
      <div style={{ position: "relative", background: "#fff", border: `1.5px dashed ${C.line}`, borderRadius: RADIUS_SM, height: 160 }}>
        <canvas ref={canvasRef}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }} />
        {!hasDrawn && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: C.sub, fontSize: 12.5 }}>
            여기에 손가락(또는 마우스)으로 서명하세요
          </div>
        )}
      </div>
      <button onClick={clear} className="flex items-center gap-1 mt-2" style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>
        <Trash2 size={12} /> 다시 서명
      </button>
    </div>
  );
}

const Sec = ({ title, children, right }) => (
  <div className="mb-5">
    <div className="flex items-center justify-between mb-2"><Eyebrow dark>{title}</Eyebrow>{right}</div>
    <div className="flex flex-col gap-0.5" style={{ background: C.grout }}>{children}</div>
  </div>
);

const Toggle = ({ label, desc, on, onChange, first }) => (
  <button onClick={() => onChange(!on)} className="flex items-center justify-between w-full gap-3 py-2.5 text-left"
    style={{ borderTop: first ? "none" : `1px solid ${C.line}` }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{label}</div>
      <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{desc}</div>
    </div>
    <div style={{ width: 44, height: 26, background: on ? C.aquaDeep : C.line, flexShrink: 0, padding: 3 }}>
      <div style={{ width: 20, height: 20, background: "#fff", marginLeft: on ? 18 : 0, transition: "margin-left .15s" }} />
    </div>
  </button>
);
