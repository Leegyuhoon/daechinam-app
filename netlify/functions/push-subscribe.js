import { getStore } from '@netlify/blobs'
import { pushEnabled, publicKey, saveSub, removeSub } from '../lib/push.js'

// GET    /api/push-subscribe                → { enabled, publicKey }
// POST   /api/push-subscribe  { subscription, role: 'admin' }            (관리자 비밀번호 헤더 필요)
//                             { subscription, role: 'client', code }      (업체 접속 코드로 확인)
// DELETE /api/push-subscribe  { endpoint }  → 알림 끄기
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD

export default async (req) => {
  try {
    if (req.method === 'GET') return Response.json({ enabled: pushEnabled(), publicKey: publicKey() })

    if (req.method === 'POST') {
      if (!pushEnabled()) return Response.json({ error: '알림 기능이 아직 설정되지 않았습니다 (VAPID 환경변수)' }, { status: 500 })
      const { subscription, role, code } = await req.json()
      if (!subscription?.endpoint || !subscription?.keys) return Response.json({ error: '구독 정보가 올바르지 않습니다' }, { status: 400 })

      if (role === 'admin') {
        if (ADMIN_PASSWORD && req.headers.get('x-client-admin-password') !== ADMIN_PASSWORD) {
          return Response.json({ error: '관리자 비밀번호가 필요합니다' }, { status: 401 })
        }
        await saveSub({ endpoint: subscription.endpoint, keys: subscription.keys, role: 'admin' })
        return Response.json({ ok: true })
      }

      if (role === 'client') {
        const sites = (await getStore('regular-ops').get('sites', { type: 'json' }).catch(() => null)) || []
        const site = code && sites.find((s) => s.accessCode === code)
        if (!site) return Response.json({ error: '링크가 올바르지 않습니다' }, { status: 404 })
        await saveSub({ endpoint: subscription.endpoint, keys: subscription.keys, role: 'client', siteId: site.id })
        return Response.json({ ok: true })
      }

      return Response.json({ error: '알 수 없는 요청입니다' }, { status: 400 })
    }

    if (req.method === 'DELETE') {
      const { endpoint } = await req.json()
      if (endpoint) await removeSub(endpoint)
      return Response.json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  } catch (err) {
    return Response.json({ error: '알림 설정 중 오류', detail: String(err) }, { status: 500 })
  }
}
