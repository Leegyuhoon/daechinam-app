import { getStore } from '@netlify/blobs'
import { canUpload } from '../lib/auth.js'

// POST /api/regular-media-chunk — 영상을 4MB 조각으로 나눠 올림
// 헤더: X-Upload-Id, X-Chunk-Index, (X-Client-Admin-Password 또는 X-Client-Code)
const chunkKey = (id, i) => `${id}:chunk:${String(i).padStart(5, '0')}`

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!(await canUpload(req))) return Response.json({ error: '업로드 권한이 없습니다' }, { status: 401 })

  const id = req.headers.get('x-upload-id') || ''
  const index = parseInt(req.headers.get('x-chunk-index') || '', 10)
  if (!/^[0-9a-f-]{36}$/i.test(id) || Number.isNaN(index) || index < 0 || index > 200) {
    return Response.json({ error: '업로드 정보가 올바르지 않습니다' }, { status: 400 })
  }
  try {
    const buffer = await req.arrayBuffer()
    if (!buffer.byteLength) return Response.json({ error: '데이터가 없습니다' }, { status: 400 })
    await getStore('regular-media').set(chunkKey(id, index), buffer)
    return Response.json({ ok: true, index })
  } catch (err) {
    return Response.json({ error: '조각 업로드 실패', detail: String(err) }, { status: 500 })
  }
}
