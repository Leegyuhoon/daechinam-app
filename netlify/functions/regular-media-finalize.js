import { getStore } from '@netlify/blobs'
import { canUpload } from '../lib/auth.js'

// POST /api/regular-media-finalize  body: { uploadId, totalChunks, size, chunkSize, contentType, filename }
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  if (!(await canUpload(req))) return Response.json({ error: '업로드 권한이 없습니다' }, { status: 401 })
  try {
    const { uploadId, totalChunks, size, chunkSize, contentType, filename } = await req.json()
    if (!/^[0-9a-f-]{36}$/i.test(uploadId || '') || !totalChunks || !size || !chunkSize) {
      return Response.json({ error: '업로드 정보가 올바르지 않습니다' }, { status: 400 })
    }
    await getStore('regular-media').setJSON(uploadId, {
      totalChunks,
      size,
      chunkSize,
      contentType: contentType || 'video/mp4',
      filename: filename || 'video',
      createdAt: new Date().toISOString()
    })
    return Response.json({ id: uploadId, url: `/api/regular-media?id=${uploadId}`, kind: 'video' })
  } catch (err) {
    return Response.json({ error: '업로드 마무리 실패', detail: String(err) }, { status: 500 })
  }
}
