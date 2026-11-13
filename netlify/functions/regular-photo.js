import { getStore } from '@netlify/blobs'

// 정기현장 전후 사진
// POST /api/regular-photo  (관리자 비밀번호 또는 업체 접속 코드 필요, 본문: 이미지 바이너리 — 브라우저에서 미리 압축해서 보냄)
// GET  /api/regular-photo?id=...  (공개 — 업체 담당자에게 보내는 전후 보고서 링크에서 보여야 해서,
//                                 추측할 수 없는 무작위 id로만 열람 가능)
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD
const MAX_BYTES = 5 * 1024 * 1024

export default async (req) => {
  const store = getStore('regular-photos')
  const url = new URL(req.url)

  try {
    if (req.method === 'POST') {
      const isAdmin = !ADMIN_PASSWORD || req.headers.get('x-client-admin-password') === ADMIN_PASSWORD
      if (!isAdmin) {
        // 업체 담당자 페이지에서 문의 사진을 올릴 때 — 현장 접속 코드로 확인
        const code = req.headers.get('x-client-code')
        const sites = code ? await getStore('regular-ops').get('sites', { type: 'json' }).catch(() => null) : null
        if (!code || !(sites || []).some((s) => s.accessCode === code)) {
          return Response.json({ error: '업로드 권한이 없습니다' }, { status: 401 })
        }
      }
      const buffer = await req.arrayBuffer()
      if (!buffer.byteLength) return Response.json({ error: '사진 데이터가 없습니다' }, { status: 400 })
      if (buffer.byteLength > MAX_BYTES) return Response.json({ error: '사진이 너무 큽니다 (5MB 이하)' }, { status: 413 })
      const contentType = req.headers.get('content-type') || 'image/jpeg'
      const id = crypto.randomUUID()
      await store.set(id, buffer, { metadata: { contentType, createdAt: new Date().toISOString() } })
      return Response.json({ id, url: `/api/regular-photo?id=${id}` })
    }

    if (req.method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) return new Response('id가 필요합니다', { status: 400 })
      const result = await store.getWithMetadata(id, { type: 'arrayBuffer' })
      if (!result || !result.data) return new Response('사진을 찾을 수 없습니다', { status: 404 })
      return new Response(result.data, {
        status: 200,
        headers: {
          'Content-Type': result.metadata?.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '사진 처리 실패', detail: String(err) }, { status: 500 })
  }
}
