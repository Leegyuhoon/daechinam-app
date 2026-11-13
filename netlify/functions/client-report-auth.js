const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD

// POST /api/client-report-auth
// body: { password } — "업체 보고" 관리(카테고리 생성/삭제) 화면 접근용 관리자 비밀번호
export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!ADMIN_PASSWORD) {
    return Response.json(
      { ok: false, error: 'CLIENT_REPORT_ADMIN_PASSWORD 환경변수가 설정되어 있지 않습니다. Netlify 사이트 설정에서 추가한 뒤 다시 배포해주세요.' },
      { status: 500 }
    )
  }

  try {
    const { password } = await req.json()
    if (password === ADMIN_PASSWORD) return Response.json({ ok: true })
    return Response.json({ ok: false, error: '비밀번호가 올바르지 않습니다' }, { status: 401 })
  } catch (err) {
    return Response.json({ ok: false, error: '요청 처리 중 오류', detail: String(err) }, { status: 500 })
  }
}
