import { getStore } from '@netlify/blobs'

const STORE_NAME = 'client-companies'
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD

function checkAdmin(req) {
  if (!ADMIN_PASSWORD) return true // 환경변수 미설정 시엔 막지 않음
  return req.headers.get('x-client-admin-password') === ADMIN_PASSWORD
}

// item: { id, companyName, password, siteName, createdAt }
export default async (req) => {
  if (!checkAdmin(req)) {
    return Response.json({ error: '관리자 비밀번호가 필요합니다' }, { status: 401 })
  }

  const store = getStore(STORE_NAME)
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const { blobs } = await store.list()
      const items = []
      for (const { key } of blobs) {
        const item = await store.get(key, { type: 'json' })
        if (item) items.push(item)
      }
      items.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''))
      return Response.json({ items })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      if (!body.companyName?.trim() || !body.password?.trim()) {
        return Response.json({ error: '업체명과 비밀번호가 필요합니다' }, { status: 400 })
      }
      const id = body.id || crypto.randomUUID()
      const item = {
        id,
        companyName: body.companyName.trim(),
        password: body.password,
        siteName: body.siteName || '',
        createdAt: body.createdAt || new Date().toISOString()
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
    return Response.json({ error: '업체 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
