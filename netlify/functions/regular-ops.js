import { getStore } from '@netlify/blobs'
import { notify, clip } from '../lib/push.js'

// 정기현장 순회 관리 — 현장(서비스 항목 포함), 일정(점검·서비스 방문), 서비스 실행(전후 기록),
// 업체 문의(tickets), 월간 보고서(reports)
// 관리자 비밀번호는 "업체 보고"와 같은 CLIENT_REPORT_ADMIN_PASSWORD를 함께 씁니다.
const STORE_NAME = 'regular-ops'
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD
const COLLECTIONS = ['sites', 'visits', 'executions', 'tickets', 'reports', 'issues']

// 처음 열 때 한 번만 자동 등록되는 현장 목록 (이후엔 화면에서 수정·추가·삭제)
const SEED_SITES = [
  '은혜광성교회',
  'CSA 위례',
  'SG메디컬',
  'EM365',
  '정상어학원 미사',
  '정상어학원 하남',
  '라조리오',
  '진경산업',
  '봉주르 팔당',
  '메트라이프 본사',
  '메트라이프 제주'
]

function checkAdmin(req) {
  if (!ADMIN_PASSWORD) return true
  return req.headers.get('x-client-admin-password') === ADMIN_PASSWORD
}

async function readCol(store, name) {
  const data = await store.get(name, { type: 'json' }).catch(() => null)
  return Array.isArray(data) ? data : []
}

function seedSites() {
  const now = new Date().toISOString()
  return SEED_SITES.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    order: i,
    inspectCycleMonths: name === '메트라이프 제주' ? 6 : 1,
    contactName: '',
    contactPhone: '',
    workHours: '',
    address: '',
    memo: name === '메트라이프 제주' ? '제주 현장 — 1년에 2번 정도 방문' : '',
    active: true,
    services: [],
    createdAt: now
  }))
}

// item: 각 컬렉션의 레코드 (id 필수, 없으면 생성)
export default async (req) => {
  if (!checkAdmin(req)) {
    return Response.json({ error: '관리자 비밀번호가 필요합니다' }, { status: 401 })
  }

  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      let sites = await readCol(store, 'sites')
      const seeded = await store.get('seeded', { type: 'json' }).catch(() => null)
      if (sites.length === 0 && !seeded) {
        sites = seedSites()
        await store.setJSON('sites', sites)
        await store.setJSON('seeded', { at: new Date().toISOString() })
      }
      const [visits, executions, tickets, reports, issues] = await Promise.all(
        ['visits', 'executions', 'tickets', 'reports', 'issues'].map((c) => readCol(store, c))
      )
      return Response.json({ sites, visits, executions, tickets, reports, issues })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { collection } = body
      if (!COLLECTIONS.includes(collection)) {
        return Response.json({ error: '알 수 없는 항목입니다' }, { status: 400 })
      }
      // 문의 답변·상태 변경은 서버에서 메시지를 덧붙여서, 그사이 업체가 남긴 메시지를 덮어쓰지 않게 함
      if (collection === 'tickets' && body.action === 'reply') {
        const list = await readCol(store, 'tickets')
        const t = list.find((x) => x.id === body.id)
        if (!t) return Response.json({ error: '문의를 찾을 수 없습니다' }, { status: 404 })
        const now = new Date().toISOString()
        const text = String(body.text || '').trim()
        const media = (Array.isArray(body.media) ? body.media : [])
          .filter((m) => typeof m?.url === 'string' && m.url.startsWith('/api/regular-'))
          .slice(0, 10)
          .map((m) => ({ url: m.url, kind: m.kind === 'video' ? 'video' : 'photo' }))
        const executionId = /^[0-9a-f-]{36}$/i.test(body.executionId || '') ? body.executionId : null
        if (text || media.length || executionId) {
          t.messages = [...(t.messages || []), { id: crypto.randomUUID(), from: 'admin', text, media, executionId, at: now }]
          t.lastAdminAt = now
          if (executionId) t.executionIds = [...new Set([...(t.executionIds || []), executionId])]
        }
        if (['open', 'progress', 'done'].includes(body.status)) t.status = body.status
        t.updatedAt = now
        await store.setJSON('tickets', list)
        if (text || media.length || executionId) {
          const site = (await readCol(store, 'sites')).find((s) => s.id === t.siteId)
          if (site?.accessCode) {
            await notify({ role: 'client', siteId: site.id }, {
              title: '(주)이엘씨_대치남 답변 도착',
              body: clip(text) || '조치 사진·영상을 보냈습니다',
              url: `/client?c=${site.accessCode}&tab=tickets`,
              tag: `ticket-${t.id}`
            })
          }
        }
        return Response.json({ item: t, items: [t] })
      }

      const incoming = Array.isArray(body.items) ? body.items : body.item ? [body.item] : []
      if (incoming.length === 0) return Response.json({ error: '저장할 내용이 없습니다' }, { status: 400 })

      const list = await readCol(store, collection)
      const now = new Date().toISOString()
      // 월간 보고서가 새로 공개되면 업체에 알림
      const publishFlags = incoming.map(
        (r) => collection === 'reports' && r.published && !list.find((x) => x.id === r.id)?.published
      )
      const saved = incoming.map((raw) => {
        const item = { ...raw, id: raw.id || crypto.randomUUID(), updatedAt: now }
        if (!item.createdAt) item.createdAt = now
        const idx = list.findIndex((x) => x.id === item.id)
        if (collection === 'reports') {
          // 업체 평가는 업체 페이지에서만 바뀜 — 관리자 화면의 오래된 사본으로 덮어쓰지 않게
          item.clientRating = idx >= 0 ? list[idx].clientRating || null : null
          delete item.rating
        }
        if (idx >= 0) list[idx] = item
        else list.push(item)
        return item
      })
      await store.setJSON(collection, list)
      const newlyPublished = saved.filter((_, i) => publishFlags[i])
      if (newlyPublished.length) {
        const sites = await readCol(store, 'sites')
        for (const r of newlyPublished) {
          const site = sites.find((s) => s.id === r.siteId)
          if (!site?.accessCode) continue
          await notify({ role: 'client', siteId: site.id }, {
            title: '(주)이엘씨_대치남 월간 보고서',
            body: `${Number(String(r.month).slice(5))}월 청소 관리 보고서가 등록되었습니다.`,
            url: `/client?c=${site.accessCode}&tab=reports`,
            tag: `report-${r.id}`
          })
        }
      }
      return Response.json({ items: saved, item: saved[0] })
    }

    if (req.method === 'DELETE') {
      const collection = url.searchParams.get('collection')
      const id = url.searchParams.get('id')
      if (!COLLECTIONS.includes(collection) || !id) {
        return Response.json({ error: 'collection과 id가 필요합니다' }, { status: 400 })
      }
      const list = await readCol(store, collection)
      await store.setJSON(
        collection,
        list.filter((x) => x.id !== id)
      )
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '정기현장 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
