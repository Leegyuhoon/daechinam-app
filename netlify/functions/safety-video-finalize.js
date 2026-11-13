import { getStore } from '@netlify/blobs'

// POST /api/safety-video-finalize
// body(JSON): { uploadId, totalChunks, contentType, filename }
// 모든 조각 업로드가 끝난 뒤 호출 — 조각들을 재생 시 이어붙일 수 있도록 매니페스트를 저장합니다.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const { uploadId, totalChunks, contentType, filename } = await req.json()
    if (!uploadId || !totalChunks) {
      return Response.json({ error: 'uploadId / totalChunks가 필요합니다' }, { status: 400 })
    }

    const store = getStore('safety-videos')
    await store.setJSON(uploadId, {
      totalChunks,
      contentType: contentType || 'video/mp4',
      filename: filename || 'video',
      createdAt: new Date().toISOString()
    })

    return Response.json({ id: uploadId, url: `/api/safety-video?id=${uploadId}` })
  } catch (err) {
    return Response.json({ error: '업로드 마무리 실패', detail: String(err) }, { status: 500 })
  }
}
