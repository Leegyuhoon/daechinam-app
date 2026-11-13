import { getStore } from '@netlify/blobs'

// POST /api/training-verify
// body: { name, birth } -> 사전 등록된 '교육 대상자 명단'과 대조합니다.
// 명단에 없어도 응시는 막지 않고 진행시키되, verified 값으로 명단 등록 여부만 알려줍니다.
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const { name, birth } = await req.json()
    if (!name?.trim() || !birth?.trim()) {
      return Response.json({ ok: false, error: '이름과 생년월일을 모두 입력해주세요' }, { status: 400 })
    }

    const store = getStore('training-roster')
    const { blobs } = await store.list()
    let verified = false
    for (const { key } of blobs) {
      const item = await store.get(key, { type: 'json' })
      if (item && item.name === name.trim() && item.birth === birth.trim()) {
        verified = true
        break
      }
    }

    return Response.json({ ok: true, verified, name: name.trim() })
  } catch (err) {
    return Response.json({ ok: false, error: '확인 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
