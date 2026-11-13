import { getStore } from '@netlify/blobs'

const STORE_NAME = 'inventory'

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
      if (!body.name) {
        return Response.json({ error: '품목명이 필요합니다' }, { status: 400 })
      }
      const id = body.id || crypto.randomUUID()
      const item = {
        id,
        name: body.name,
        category: body.category || '기타',
        scope: body.scope || '본사', // '본사' 또는 현장명
        quantity: Number(body.quantity) || 0,
        unit: body.unit || '개',
        minQuantity: Number(body.minQuantity) || 0,
        location: body.location || '',
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
    return Response.json({ error: '재고 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
