import { getStore } from '@netlify/blobs'

function chunkKey(id, index) {
  return `${id}:chunk:${String(index).padStart(5, '0')}`
}

const SPOT_PASSWORD = process.env.SPOT_JOBS_PASSWORD

// POST /api/spot-media-chunk
// 헤더: X-Upload-Id, X-Chunk-Index, X-Spot-Password / 본문: 해당 조각의 바이너리 (사진·영상 공용)
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (SPOT_PASSWORD && req.headers.get('x-spot-password') !== SPOT_PASSWORD) {
    return Response.json({ error: '비밀번호가 필요합니다' }, { status: 401 })
  }
  if (!req.body) return Response.json({ error: '청크 데이터가 없습니다' }, { status: 400 })

  const id = req.headers.get('x-upload-id')
  const indexStr = req.headers.get('x-chunk-index')
  if (!id || indexStr == null) {
    return Response.json({ error: 'x-upload-id / x-chunk-index 헤더가 필요합니다' }, { status: 400 })
  }
  const index = parseInt(indexStr, 10)
  if (Number.isNaN(index) || index < 0) {
    return Response.json({ error: 'x-chunk-index가 올바르지 않습니다' }, { status: 400 })
  }

  try {
    const buffer = await req.arrayBuffer()
    const store = getStore('spot-job-media')
    await store.set(chunkKey(id, index), buffer)
    return Response.json({ ok: true, index })
  } catch (err) {
    return Response.json({ error: '청크 업로드 실패', detail: String(err) }, { status: 500 })
  }
}
