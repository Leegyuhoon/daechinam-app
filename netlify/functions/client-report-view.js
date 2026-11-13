import { getStore } from '@netlify/blobs'

// POST /api/client-report-view
// body: { companyId, password, period? }
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const { companyId, password, period } = await req.json()
    if (!companyId || !password) {
      return Response.json({ ok: false, error: 'companyId와 비밀번호가 필요합니다' }, { status: 400 })
    }

    const companyStore = getStore('client-companies')
    const company = await companyStore.get(companyId, { type: 'json' })
    if (!company) return Response.json({ ok: false, error: '해당 업체를 찾을 수 없습니다' }, { status: 404 })
    if (company.password !== password) {
      return Response.json({ ok: false, error: '비밀번호가 올바르지 않습니다' }, { status: 401 })
    }

    const reportStore = getStore('client-report-periods')
    const { blobs } = await reportStore.list()
    const all = []
    for (const { key } of blobs) {
      const item = await reportStore.get(key, { type: 'json' })
      if (item && item.companyId === companyId) all.push(item)
    }
    all.sort((a, b) => (b.period || '').localeCompare(a.period || ''))

    const periods = all.map((r) => r.period)
    const selected = period ? all.find((r) => r.period === period) : all[0]

    return Response.json({
      ok: true,
      companyName: company.companyName,
      siteName: company.siteName || '',
      periods,
      report: selected || null
    })
  } catch (err) {
    return Response.json({ ok: false, error: '조회 중 오류', detail: String(err) }, { status: 500 })
  }
}
