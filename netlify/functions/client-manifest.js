// GET /api/client-manifest?c=코드 — 업체 페이지를 홈 화면에 추가할 때 업체 페이지로 열리도록 하는 매니페스트
// (아이폰은 홈 화면에 추가한 뒤에만 웹 푸시 알림을 받을 수 있음)
export default async (req) => {
  const code = (new URL(req.url).searchParams.get('c') || '').replace(/[^a-zA-Z0-9]/g, '')
  return new Response(
    JSON.stringify({
      name: '(주)이엘씨_대치남 고객센터',
      short_name: '대치남 고객센터',
      start_url: `/client?c=${code}`,
      scope: '/',
      display: 'standalone',
      background_color: '#1D232A',
      theme_color: '#1D232A',
      icons: [
        { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    }),
    { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' } }
  )
}
