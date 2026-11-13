import { getStore } from '@netlify/blobs'

const SPOT_PASSWORD = process.env.SPOT_JOBS_PASSWORD

// POST /api/spot-media-finalize
// body(JSON): { uploadId, totalChunks, contentType, filename, kind: 'photo'|'video' }
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (SPOT_PASSWORD && req.headers.get('x-spot-password') !== SPOT_PASSWORD) {
    return Response.json({ error: '비밀번호가 필요합니다' }, { status: 401 })
  }

  try {
    const { uploadId, totalChunks, contentType, filename, kind } = await req.json()
    if (!uploadId || !totalChunks) {
      return Response.json({ error: 'uploadId / totalChunks가 필요합니다' }, { status: 400 })
    }

    const store = getStore('spot-job-media')
    await store.setJSON(uploadId, {
      totalChunks,
      contentType: contentType || 'application/octet-stream',
      filename: filename || 'file',
      kind: kind || 'photo',
      createdAt: new Date().toISOString()
    })

    return Response.json({
      id: uploadId,
      url: `/api/spot-media?id=${uploadId}`,
      kind: kind || 'photo',
      filename: filename || 'file'
    })
  } catch (err) {
    return Response.json({ error: '업로드 마무리 실패', detail: String(err) }, { status: 500 })
  }
}
