import { getStore } from '@netlify/blobs'

// GET /api/regular-site-names — 순회 관리에 등록된 운영 중 현장 이름만 (재고 현황의 위치 선택용)
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
  try {
    const sites = (await getStore('regular-ops').get('sites', { type: 'json' }).catch(() => null)) || []
    const names = sites
      .filter((s) => s.active !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      .map((s) => s.name)
    return Response.json({ names })
  } catch (err) {
    return Response.json({ names: [], error: String(err) }, { status: 500 })
  }
}
