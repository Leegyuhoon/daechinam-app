// 웹 푸시 알림 — 브라우저 쪽 도우미 (관리자 · 업체 페이지 공용)

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

// 'unsupported' | 'ios-needs-home' | 'denied' | 'on' | 'off'
export async function pushStatus() {
  if (isIOS() && !isStandalone()) return 'ios-needs-home'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = reg && (await reg.pushManager.getSubscription())
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

// role: 'admin' (headers에 관리자 비밀번호) | 'client' (code 필요)
export async function enablePush({ role, code, headers = {} }) {
  const cfg = await fetch('/api/push-subscribe').then((r) => r.json())
  if (!cfg.enabled || !cfg.publicKey) throw new Error('알림 기능이 아직 설정되지 않았어요. (Netlify 환경변수 VAPID 확인)')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림이 허용되지 않았어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.')

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) })
  }

  const res = await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ subscription: sub.toJSON(), role, code })
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || '알림 등록에 실패했어요')
  return true
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  const sub = reg && (await reg.pushManager.getSubscription())
  if (!sub) return
  await fetch('/api/push-subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint })
  }).catch(() => {})
  await sub.unsubscribe()
}
