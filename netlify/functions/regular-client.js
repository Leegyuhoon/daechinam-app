import { getStore } from '@netlify/blobs'
import { notify, clip } from '../lib/push.js'

// 업체 담당자 전용 페이지(/client?c=접속코드) API — 로그인 없이, 현장마다 다른 추측 불가 코드로만 접근
// GET  /api/regular-client?c=코드        → 현장명, 문의 내역, 공개된 월간 보고서와 보고서에 필요한 기록
// POST /api/regular-client?c=코드
//   { action: 'ticket', category, content, authorName, photos }  → 새 문의 등록
//   { action: 'reply', ticketId, text }                          → 기존 문의에 추가 메시지
const CATEGORIES = ['질문', '불편 사항', '개선 요청', '작업 요청']

function nextDue(sv) {
  if (!sv.lastDoneDate) return null
  const [y, m, d] = sv.lastDoneDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + (Number(sv.cycleMonths) || 1), 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(d, last))
  return t.toISOString().slice(0, 10)
}

async function readCol(store, name) {
  const data = await store.get(name, { type: 'json' }).catch(() => null)
  return Array.isArray(data) ? data : []
}

// 첨부: 사진(/api/regular-photo) · 영상(/api/regular-media)만 허용
function cleanMedia(list) {
  return (Array.isArray(list) ? list : [])
    .filter((m) => typeof m?.url === 'string' && /^\/api\/regular-(photo|media)\?id=[0-9a-f-]{36}$/i.test(m.url))
    .slice(0, 10)
    .map((m) => ({ url: m.url, kind: m.url.startsWith('/api/regular-media') ? 'video' : 'photo' }))
}
const ticketMedia = (t) => [...(t.photos || []).map((p) => ({ url: p.url, kind: 'photo' })), ...(t.media || [])]

const publicTicket = (t) => ({
  id: t.id,
  category: t.category,
  content: t.content,
  authorName: t.authorName || '',
  media: ticketMedia(t),
  status: t.status || 'open',
  messages: (t.messages || []).map((m) => ({ from: m.from, text: m.text, at: m.at, media: m.media || [], executionId: m.executionId || null })),
  executionIds: t.executionIds || [],
  createdAt: t.createdAt
})

export default async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('c')
  if (!code || code.length < 8) return Response.json({ ok: false, error: '잘못된 링크입니다' }, { status: 400 })

  const store = getStore('regular-ops')

  try {
    const sites = await readCol(store, 'sites')
    const site = sites.find((s) => s.accessCode === code && s.active !== false)
    if (!site) return Response.json({ ok: false, error: '링크가 만료되었거나 올바르지 않습니다' }, { status: 404 })

    if (req.method === 'GET') {
      const [tickets, reports, visits, executions, issues] = await Promise.all(
        ['tickets', 'reports', 'visits', 'executions', 'issues'].map((c) => readCol(store, c))
      )
      const mine = (x) => x.siteId === site.id
      return Response.json({
        ok: true,
        site: {
          name: site.name,
          inspectCycleMonths: Number(site.inspectCycleMonths) || 1,
          vat: site.billing?.enabled ? site.billing.vat || 'separate' : null,
          scope: (site.scope || []).map((z) => ({ zone: z.zone, note: z.note || '', items: (z.items || []).map((it) => ({ task: it.task, freq: it.freq })) })),
          services: (site.services || []).map((sv) => ({ name: sv.name, cycleMonths: sv.cycleMonths, next: nextDue(sv) }))
        },
        tickets: tickets.filter(mine).map(publicTicket).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
        reports: reports
          .filter((r) => mine(r) && r.published)
          .map((r) => ({
            id: r.id,
            month: r.month,
            clientRating: r.clientRating || null,
            summary: r.summary,
            nextPlan: r.nextPlan,
            publishedAt: r.publishedAt,
            manager: r.manager || '',
            workerNames: r.workerNames || '',
            writtenDate: r.writtenDate || '',
            workContent: r.workContent || '',
            specialNotes: r.specialNotes || '',
            proposals: (r.proposals || []).map((p) => ({ text: p.text || '', price: p.price || '' })),
            // 청구 현장일 때만 청구 내역
            charges: site.billing?.enabled ? (r.charges || []).map((c) => ({ name: c.name || '', unit: c.unit || '', qty: Number(c.qty) || 0, price: Number(c.price) || 0 })) : [],
            chargeNote: site.billing?.enabled ? r.chargeNote || '' : ''
          }))
          .sort((a, b) => b.month.localeCompare(a.month)),
        visits: visits
          .filter((v) => mine(v) && v.status !== 'canceled')
          .map((v) => ({ id: v.id, date: v.date, type: v.type, status: v.status, serviceName: v.serviceName || '', memo: v.memo || '' })),
        // 현장 이슈 — "월간 보고서에 포함"한 것만, 팀장 이름·연락처 같은 내부 정보는 빼고
        issues: issues
          .filter((x) => mine(x) && x.showInReport !== false)
          .map((x) => ({
            id: x.id,
            siteId: x.siteId,
            date: x.date,
            source: x.source,
            items: (x.items || []).map((it) => ({ issue: it.issue, action: it.action, status: it.status })),
            media: (x.media || []).map((m) => ({ url: m.url, kind: m.kind || 'photo' })),
            showInReport: true
          })),
        executions: executions.filter(mine).map((e) => ({
          id: e.id,
          date: e.date,
          serviceName: e.serviceName,
          ticketId: e.ticketId || null,
          before: (e.before || []).slice(0, 6).map((p) => ({ url: p.url, kind: p.kind || 'photo' })),
          after: (e.after || []).slice(0, 6).map((p) => ({ url: p.url, kind: p.kind || 'photo' }))
        }))
      })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const now = new Date().toISOString()
      const tickets = await readCol(store, 'tickets')

      if (body.action === 'ticket') {
        const content = String(body.content || '').trim()
        const media = cleanMedia(body.media || body.photos)
        if (!content && !media.length) return Response.json({ ok: false, error: '내용을 입력해주세요' }, { status: 400 })
        const ticket = {
          id: crypto.randomUUID(),
          siteId: site.id,
          category: CATEGORIES.includes(body.category) ? body.category : '질문',
          content: content.slice(0, 2000),
          authorName: String(body.authorName || '').trim().slice(0, 40),
          media,
          source: 'web',
          status: 'open',
          messages: [],
          lastClientAt: now,
          createdAt: now,
          updatedAt: now
        }
        tickets.push(ticket)
        await store.setJSON('tickets', tickets)
        await notify({ role: 'admin' }, {
          title: `새 문의 · ${site.name}`,
          body: `[${ticket.category}] ${clip(ticket.content) || '사진·영상 첨부'}`,
          url: '/rounds?tab=tickets',
          tag: `ticket-${ticket.id}`
        })
        return Response.json({ ok: true, ticket: publicTicket(ticket) })
      }

      // 업체가 월간 보고서에 만족도 평가 (1~5점 + 한마디), 다시 평가하면 덮어씀
      if (body.action === 'rate') {
        const score = Math.round(Number(body.score))
        if (!(score >= 1 && score <= 5)) return Response.json({ ok: false, error: '평가 점수를 골라 주세요' }, { status: 400 })
        const reports = await readCol(store, 'reports')
        const r = reports.find((x) => x.id === body.reportId && x.siteId === site.id && x.published)
        if (!r) return Response.json({ ok: false, error: '보고서를 찾을 수 없습니다' }, { status: 404 })
        r.clientRating = {
          score,
          comment: String(body.comment || '').trim().slice(0, 1000),
          name: String(body.name || '').trim().slice(0, 40),
          at: now
        }
        await store.setJSON('reports', reports)
        await notify({ role: 'admin' }, {
          title: `업체 평가 · ${site.name}`,
          body: `${Number(String(r.month).slice(5))}월 보고서 ${'★'.repeat(score)}${'☆'.repeat(5 - score)}${r.clientRating.comment ? ` — ${clip(r.clientRating.comment, 40)}` : ''}`,
          url: '/rounds?tab=monthly',
          tag: `rate-${r.id}`
        })
        return Response.json({ ok: true, clientRating: r.clientRating })
      }

      if (body.action === 'reply') {
        const text = String(body.text || '').trim()
        const media = cleanMedia(body.media)
        const t = tickets.find((x) => x.id === body.ticketId && x.siteId === site.id)
        if (!t || (!text && !media.length)) return Response.json({ ok: false, error: '문의를 찾을 수 없거나 내용이 비어 있습니다' }, { status: 400 })
        t.messages = [...(t.messages || []), { id: crypto.randomUUID(), from: 'client', text: text.slice(0, 2000), media, at: now }]
        t.lastClientAt = now
        t.updatedAt = now
        if (t.status === 'done') t.status = 'open' // 완료 후 다시 문의하면 다시 열림
        await store.setJSON('tickets', tickets)
        await notify({ role: 'admin' }, {
          title: `추가 문의 · ${site.name}`,
          body: clip(text) || '사진·영상을 보냈습니다',
          url: '/rounds?tab=tickets',
          tag: `ticket-${t.id}`
        })
        return Response.json({ ok: true, ticket: publicTicket(t) })
      }

      return Response.json({ ok: false, error: '알 수 없는 요청입니다' }, { status: 400 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ ok: false, error: '처리 중 오류가 발생했습니다', detail: String(err) }, { status: 500 })
  }
}
