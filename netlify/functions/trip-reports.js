import { getStore } from '@netlify/blobs'

// 출장 보고서 — 일회성 현장 관리와 같은 비밀번호(SPOT_JOBS_PASSWORD)로 보호
// GET 목록 · POST 저장(id 없으면 새로) · DELETE ?id=
const STORE_NAME = 'trip-reports'
const SPOT_PASSWORD = process.env.SPOT_JOBS_PASSWORD

const checkPassword = (req) => !SPOT_PASSWORD || req.headers.get('x-spot-password') === SPOT_PASSWORD
const str = (v, n = 4000) => String(v ?? '').slice(0, n)
const rows = (list, map, max = 60) => (Array.isArray(list) ? list.slice(0, max).map(map) : [])

export default async (req) => {
  if (!checkPassword(req)) return Response.json({ error: '비밀번호가 필요합니다' }, { status: 401 })
  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const { blobs } = await store.list()
      const items = []
      for (const { key } of blobs) {
        const item = await store.get(key, { type: 'json' }).catch(() => null)
        if (item) items.push(item)
      }
      items.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
      return Response.json({ items })
    }

    if (req.method === 'POST') {
      const b = await req.json()
      if (!b.startDate) return Response.json({ error: '출장 시작일이 필요합니다' }, { status: 400 })
      const id = b.id || crypto.randomUUID()
      const prev = b.id ? await store.get(id, { type: 'json' }).catch(() => null) : null
      const item = {
        id,
        dept: str(b.dept, 100),
        traveler: str(b.traveler, 100),
        place: str(b.place, 300),
        purpose: str(b.purpose, 300),
        startDate: str(b.startDate, 10),
        endDate: b.endDate && b.endDate >= b.startDate ? str(b.endDate, 10) : str(b.startDate, 10),
        overview: str(b.overview),
        schedule: rows(b.schedule, (r) => ({ date: str(r.date, 10), text: str(r.text, 1000) })),
        members: rows(b.members, (r) => ({ name: str(r.name, 50), role: str(r.role, 300) })),
        zones: rows(b.zones, (r) => ({ name: str(r.name, 200), status: str(r.status, 300) })),
        otherNotes: str(b.otherNotes),
        reportDate: str(b.reportDate, 10),
        receipts: rows(b.receipts, (r) => ({ id: str(r.id, 60), desc: str(r.desc, 500), amount: Number(r.amount) || 0, url: str(r.url, 500) }), 30),
        spotJobId: b.spotJobId ? str(b.spotJobId, 60) : null,
        createdAt: prev?.createdAt || new Date().toISOString(),
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
    return Response.json({ error: '출장 보고서 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
