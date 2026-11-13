import { getStore } from '@netlify/blobs'

const STORE_NAME = 'safety-courses'

// course shape:
// {
//   id, title, description, videoUrl, createdAt,
//   questions: [{ id, prompt, options: [string], correctIndex }]
// }

export default async (req) => {
  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const { blobs } = await store.list()
      const courses = []
      for (const { key } of blobs) {
        const c = await store.get(key, { type: 'json' })
        if (c) courses.push(c)
      }
      courses.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      return Response.json({ courses })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const id = body.id || crypto.randomUUID()
      const course = {
        id,
        title: body.title,
        description: body.description || '',
        videoUrl: body.videoUrl,
        questions: Array.isArray(body.questions) ? body.questions : [],
        passRatio: Number(body.passRatio) > 0 ? Number(body.passRatio) : 80, // % 단위
        targetIds: Array.isArray(body.targetIds) ? body.targetIds : [], // 이 과정을 들어야 하는 대상자(training-roster id 목록)
        createdAt: body.createdAt || new Date().toISOString()
      }
      await store.setJSON(id, course)
      return Response.json({ course })
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return Response.json({ error: 'id가 필요합니다' }, { status: 400 })
      await store.delete(id)
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '안전교육 과정 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
