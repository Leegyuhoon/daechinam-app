const SPOT_PASSWORD = process.env.SPOT_JOBS_PASSWORD

// POST /api/spot-auth
// body: { password }
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!SPOT_PASSWORD) {
    return Response.json(
      { ok: false, error: 'SPOT_JOBS_PASSWORD 환경변수가 설정되어 있지 않습니다. Netlify 사이트 설정에서 추가한 뒤 다시 배포해주세요.' },
      { status: 500 }
    )
  }

  try {
    const { password } = await req.json()
    if (password === SPOT_PASSWORD) {
      return Response.json({ ok: true })
    }
    return Response.json({ ok: false, error: '비밀번호가 올바르지 않습니다' }, { status: 401 })
  } catch (err) {
    return Response.json({ ok: false, error: '요청 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
