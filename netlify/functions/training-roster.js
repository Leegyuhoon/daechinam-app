import { getStore } from '@netlify/blobs'

const STORE_NAME = 'training-roster'

// 본사에서 미리 등록해두는 '교육 대상자 명단' (선택 사항)
// item: { id, name, birth(6자리), org, updatedAt }
export default async (req) => {
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
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      return Response.json({ items })
    }

    if (req.method === 'POST') {
      const body = await req.json()
      if (!body.name?.trim() || !body.birth?.trim()) {
        return Response.json({ error: '이름과 생년월일이 필요합니다' }, { status: 400 })
      }
      const id = body.id || crypto.randomUUID()
      const item = {
        id,
        name: body.name.trim(),
        birth: body.birth.trim(),
        org: body.org?.trim() || '',
        updatedAt: new Date().toISOString()
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
    return Response.json({ error: '대상자 명단 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
