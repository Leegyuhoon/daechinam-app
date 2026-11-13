import { getStore } from '@netlify/blobs'

const STORE_NAME = 'safety-results'

// result shape:
// { id, courseId, userName, score, total, passed, answeredAt }

export default async (req) => {
  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const courseId = url.searchParams.get('courseId')
      const { blobs } = await store.list()
      const results = []
      for (const { key } of blobs) {
        const r = await store.get(key, { type: 'json' })
        if (r && (!courseId || r.courseId === courseId)) results.push(r)
      }
      results.sort((a, b) => (b.answeredAt || '').localeCompare(a.answeredAt || ''))
      return Response.json({ results })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const id = crypto.randomUUID()
      const result = {
        id,
        courseId: body.courseId,
        userName: body.userName || '익명',
        verified: !!body.verified,
        score: Number(body.score) || 0,
        total: Number(body.total) || 0,
        passed: !!body.passed,
        answeredAt: new Date().toISOString()
      }
      await store.setJSON(id, result)
      return Response.json({ result })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '결과 저장 중 오류', detail: String(err) }, { status: 500 })
  }
}
