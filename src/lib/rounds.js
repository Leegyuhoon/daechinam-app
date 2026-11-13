// 정기현장 순회 관리 — 날짜 계산 도우미 (모든 날짜는 'YYYY-MM-DD' 문자열, 한국 시간 기준)

export const pad = (n) => String(n).padStart(2, '0')

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function thisMonth() {
  return todayStr().slice(0, 7)
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function addMonths(dateStr, n) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1 + Number(n || 0), 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}

export function monthEnd(month) {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${pad(new Date(y, m, 0).getDate())}`
}

export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() // 0=일
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export function fmtDate(dateStr) {
  if (!dateStr) return '-'
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}/${Number(d)}(${WEEKDAYS[weekdayOf(dateStr)]})`
}

export function cycleLabel(months) {
  const n = Number(months) || 1
  if (n === 1) return '매월'
  if (n === 12) return '연 1회'
  if (n === 6) return '연 2회 (6개월)'
  if (n === 3) return '분기 1회'
  return `${n}개월마다`
}

export const CYCLE_OPTIONS = [1, 2, 3, 4, 6, 12]

// 마지막 점검 완료일
export function lastInspection(siteId, visits) {
  return visits
    .filter((v) => v.siteId === siteId && v.type === 'inspection' && v.status === 'done')
    .map((v) => v.date)
    .sort()
    .pop() || null
}

// 다음 점검 예정일 (기록이 없으면 null)
export function nextInspectionDue(site, visits) {
  const last = lastInspection(site.id, visits)
  return last ? addMonths(last, site.inspectCycleMonths || 1) : null
}

export function serviceNextDue(service) {
  return service.lastDoneDate ? addMonths(service.lastDoneDate, service.cycleMonths || 1) : null
}

// 해당 월에 점검이 필요한 현장인지
export function needsInspectionIn(site, visits, month) {
  if (site.active === false) return false
  const cycle = Number(site.inspectCycleMonths) || 1
  const due = nextInspectionDue(site, visits)
  if (!due) return cycle === 1 // 매월 현장은 기록이 없으면 이번 달 대상, 그 외(제주 등)는 직접 배치
  return due <= monthEnd(month)
}

// 해당 월에 실행이 필요한 서비스 항목 목록
export function servicesDueIn(site, month) {
  if (site.active === false) return []
  return (site.services || []).filter((s) => {
    const due = serviceNextDue(s)
    if (!due) return false // 마지막 실행일이 없으면 직접 배치
    return due <= monthEnd(month)
  })
}

// 자동 배치 — 이번 달 점검/서비스 대상 중 아직 일정이 없는 것을 화·수·목에 하루 1곳씩 순서대로 배치
export function autoPlan(month, sites, visits) {
  const today = todayStr()
  const slots = []
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = `${month}-${pad(d)}`
    const wd = weekdayOf(date)
    if (date >= today && wd >= 2 && wd <= 4) slots.push(date)
  }
  if (slots.length === 0) return []

  const inMonth = visits.filter((v) => v.date?.startsWith(month) && v.status !== 'canceled')
  const busy = new Set(inMonth.map((v) => v.date))
  const free = slots.filter((d) => !busy.has(d))
  const pool = free.length ? free : slots

  const created = []
  let i = 0
  const ordered = [...sites].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  for (const site of ordered) {
    if (site.active === false) continue
    const siteVisits = inMonth.filter((v) => v.siteId === site.id)
    const hasInspection = siteVisits.some((v) => v.type === 'inspection')
    const dueServices = servicesDueIn(site, month).filter(
      (s) => !siteVisits.some((v) => v.type === 'service' && v.serviceId === s.id)
    )
    const needInspection = !hasInspection && needsInspectionIn(site, visits, month)
    if (!needInspection && dueServices.length === 0) continue

    const date = siteVisits[0]?.date || pool[i++ % pool.length]
    if (needInspection) {
      created.push({ siteId: site.id, date, type: 'inspection', status: 'planned', memo: '' })
    }
    for (const s of dueServices) {
      created.push({ siteId: site.id, date, type: 'service', serviceId: s.id, serviceName: s.name, status: 'planned', memo: '' })
    }
  }
  return created
}

export function reportLink(executionId) {
  return `${window.location.origin}/service-report?id=${executionId}`
}

// ── 업체 소통 · 월간 보고서 ─────────────────────────────

export const TICKET_CATEGORIES = ['질문', '불편 사항', '개선 요청', '작업 요청']
export const TICKET_STATUS = { open: '접수', progress: '처리 중', done: '완료' }
// 직접 등록할 때 고르는 경로 (업체 페이지로 들어온 문의는 자동으로 'web')
export const TICKET_SOURCES = { web: '업체 페이지', phone: '전화', sms: '문자', visit: '현장 방문', email: '이메일', etc: '기타' }
export const sourceLabel = (s) => TICKET_SOURCES[s] || (s === 'kakao' ? '카카오' : '업체 페이지')

// 문의 첨부 (예전 사진 필드 photos + 새 첨부 media)
export const ticketMedia = (t) => [...(t.photos || []).map((p) => ({ url: p.url, kind: 'photo' })), ...(t.media || [])]
// 업체 만족도 평가 (업체 페이지에서 월간 보고서를 보고 매김)
export const SCORE_LABEL = { 5: '매우 만족', 4: '만족', 3: '보통', 2: '불만족', 1: '매우 불만족' }
export const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export function newAccessCode() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export function portalLink(code, tab) {
  return `${window.location.origin}/client?c=${code}${tab ? `&tab=${tab}` : ''}`
}

// 답변이 필요한 문의: 완료가 아니고, 업체의 마지막 메시지 이후 우리 답변이 없음
export function needsReply(t) {
  if (t.status === 'done') return false
  const msgs = t.messages || []
  const last = msgs[msgs.length - 1]
  return !last || last.from === 'client'
}

export function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 월간 보고서에 들어갈 그달 기록을 모음 (관리자 화면·업체 페이지 공용)
export function collectMonth({ siteId, month, visits, tickets, executions, issues }) {
  const mine = (x) => !siteId || x.siteId === siteId
  const next = shiftMonth(month, 1)
  return {
    inspections: visits
      .filter((v) => mine(v) && v.type === 'inspection' && v.status === 'done' && v.date?.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date)),
    tickets: tickets
      .filter((t) => mine(t) && (t.createdAt || '').slice(0, 7) === month)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    executions: executions.filter((e) => mine(e) && e.date?.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date)),
    issues: (issues || [])
      .filter((x) => mine(x) && x.showInReport !== false && x.date?.startsWith(month))
      .sort((a, b) => a.date.localeCompare(b.date)),
    nextVisits: visits
      .filter((v) => mine(v) && v.status !== 'canceled' && v.date?.startsWith(next))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}

// ── 청소 범위 (구역 · 항목 · 주기) ─────────────────────

export const SCOPE_FREQS = ['매일', '주 3회', '주 2회', '주 1회', '월 2회', '월 1회', '분기 1회', '필요 시']

// 빠르게 추가할 수 있는 기본 구역 템플릿 (추가 후 자유롭게 수정)
export const ZONE_TEMPLATES = {
  사무실: [
    ['바닥 청소 (진공·물걸레)', '매일'],
    ['휴지통 비우기 · 분리수거', '매일'],
    ['책상 외 공용 가구 먼지 제거', '주 2회']
  ],
  화장실: [
    ['변기 · 소변기 · 세면대 세척', '매일'],
    ['바닥 청소 · 물기 제거', '매일'],
    ['휴지 · 핸드타월 · 비누 보충', '매일'],
    ['거울 · 칸막이 닦기', '매일'],
    ['배수구 · 타일 줄눈 청소', '주 1회']
  ],
  탕비실: [
    ['싱크대 · 개수대 세척', '매일'],
    ['테이블 · 조리대 닦기', '매일'],
    ['음식물 쓰레기 처리', '매일'],
    ['냉장고 외부 · 전자레인지 내부', '주 1회']
  ],
  회의실: [
    ['테이블 · 의자 정돈 및 닦기', '매일'],
    ['바닥 청소', '매일']
  ],
  '복도 · 계단': [
    ['바닥 청소', '매일'],
    ['난간 · 손잡이 닦기', '주 2회']
  ],
  '출입구 · 엘리베이터': [
    ['출입문 유리 · 손잡이 닦기', '매일'],
    ['엘리베이터 내부 · 버튼 닦기', '매일'],
    ['매트 털기', '주 1회']
  ],
  '예배당 · 강당': [
    ['좌석 · 바닥 청소', '주 1회'],
    ['강단 정리 · 먼지 제거', '주 1회']
  ],
  강의실: [
    ['책상 · 의자 닦기', '매일'],
    ['칠판 · 화이트보드 정리', '매일'],
    ['바닥 청소', '매일']
  ]
}

export function makeZone(name, rows = []) {
  return {
    id: crypto.randomUUID(),
    zone: name,
    note: '',
    items: rows.map(([task, freq]) => ({ id: crypto.randomUUID(), task, freq }))
  }
}

export function scopeCount(scope = []) {
  return { zones: scope.length, items: scope.reduce((n, z) => n + (z.items || []).length, 0) }
}

// ── 현장 이슈 (팀장 통화 보고 등) ─────────────────────
export const ISSUE_STATUS = { done: '조치 완료', progress: '조치 중', check: '확인 필요' }
export const ISSUE_SOURCES = { phone: '전화', visit: '현장 방문', sms: '문자', etc: '기타' }
export const issueItemCount = (list) => list.reduce((n, x) => n + (x.items || []).length, 0)
export const openIssueItems = (list) =>
  list.flatMap((x) => (x.items || []).filter((it) => it.status !== 'done').map((it) => ({ ...it, record: x })))

// ── 장비·소모품 비용 청구 (청구 현장만) ─────────────────
export const VAT_MODES = { separate: '부가세 별도 (10%)', included: '부가세 포함', none: '부가세 없음' }
export const won = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`
// charges: [{ qty, price }] → 공급가 · 부가세 · 합계
export function chargeTotals(charges = [], vat = 'separate') {
  const sum = charges.reduce((n, c) => n + (Number(c.qty) || 0) * (Number(c.price) || 0), 0)
  if (vat === 'separate') {
    const tax = Math.round(sum * 0.1)
    return { supply: sum, tax, total: sum + tax }
  }
  if (vat === 'included') {
    const supply = Math.round(sum / 1.1)
    return { supply, tax: sum - supply, total: sum }
  }
  return { supply: sum, tax: 0, total: sum }
}
