import { getStore } from '@netlify/blobs'

// POST /api/safety-video-upload
// 요청 본문 = 영상 파일 바이너리 그대로, 헤더로 Content-Type / X-Filename 전달
export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  if (!req.body) {
    return Response.json({ error: '파일 데이터가 없습니다' }, { status: 400 })
  }

  try {
    const store = getStore('safety-videos')
    const id = crypto.randomUUID()
    const contentType = req.headers.get('content-type') || 'video/mp4'
    const filename = decodeURIComponent(req.headers.get('x-filename') || 'video')

    await store.set(id, req.body, { metadata: { contentType, filename } })

    return Response.json({ id, url: `/api/safety-video?id=${id}` })
  } catch (err) {
    return Response.json({ error: '영상 업로드 실패', detail: String(err) }, { status: 500 })
  }
}
