import { getStore } from '@netlify/blobs'

const STORE_NAME = 'client-report-periods'
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD

function checkAdmin(req) {
  if (!ADMIN_PASSWORD) return true
  return req.headers.get('x-client-admin-password') === ADMIN_PASSWORD
}

// item: {
//   id, companyId, period(YYYY-MM),
//   kpi, responseTimes, reviewMeetings, escalation,
//   companyOverview, staffing:[[역할,인원,근무시간]...], safetyPolicy, differentiation,
//   equipmentCost:[[품목,규격,비용]...],
//   createdAt, updatedAt
// }
export default async (req) => {
  if (!checkAdmin(req)) {
    return Response.json({ error: '관리자 비밀번호가 필요합니다' }, { status: 401 })
  }

  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const companyId = url.searchParams.get('companyId')
      const { blobs } = await store.list()
      const items = []
      for (const { key } of blobs) {
        const item = await store.get(key, { type: 'json' })
        if (item && (!companyId || item.companyId === companyId)) items.push(item)
      }
      items.sort((a, b) => (b.period || '').localeCompare(a.period || ''))
      return Response.json({ items })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      if (!body.companyId || !body.period) {
        return Response.json({ error: 'companyId와 기간(period)이 필요합니다' }, { status: 400 })
      }
      const id = body.id || crypto.randomUUID()
      const item = {
        id,
        companyId: body.companyId,
        period: body.period,
        kpi: body.kpi || {},
        responseTimes: body.responseTimes || {},
        reviewMeetings: body.reviewMeetings || {},
        escalation: body.escalation || {},
        companyOverview: body.companyOverview || '',
        staffing: Array.isArray(body.staffing) ? body.staffing : [],
        safetyPolicy: body.safetyPolicy || '',
        differentiation: body.differentiation || '',
        equipmentCost: Array.isArray(body.equipmentCost) ? body.equipmentCost : [],
        createdAt: body.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      await store.setJSON(id, item)
      return Response.json({ item })
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return Response.json({ error: 'id가 필요합니다' }, { status: 400 })
      await store.delete(id)
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '보고 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
