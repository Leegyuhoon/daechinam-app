import { getStore } from '@netlify/blobs'
import webpush from 'web-push'

// 웹 푸시 공용 도우미 — 구독 저장소: regular-push / key 'subs'
// sub: { id, endpoint, keys, role: 'admin'|'client', siteId?, createdAt }
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'

export const pushEnabled = () => !!(PUBLIC_KEY && PRIVATE_KEY)
export const publicKey = () => PUBLIC_KEY || ''

const store = () => getStore('regular-push')

export async function readSubs() {
  const data = await store().get('subs', { type: 'json' }).catch(() => null)
  return Array.isArray(data) ? data : []
}

export async function saveSub(sub) {
  const subs = (await readSubs()).filter((s) => s.endpoint !== sub.endpoint)
  subs.push({ ...sub, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
  await store().setJSON('subs', subs)
}

export async function removeSub(endpoint) {
  const subs = await readSubs()
  await store().setJSON(
    'subs',
    subs.filter((s) => s.endpoint !== endpoint)
  )
}

// target: { role: 'admin' } 또는 { role: 'client', siteId }
// payload: { title, body, url }
// 실패해도 본래 작업(문의 저장 등)에는 영향이 없도록 오류를 삼킴
export async function notify(target, payload) {
  if (!pushEnabled()) return
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
    const subs = await readSubs()
    const targets = subs.filter((s) => s.role === target.role && (target.role !== 'client' || s.siteId === target.siteId))
    if (!targets.length) return
    const gone = []
    await Promise.all(
      targets.map((s) =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24 })
          .catch((err) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(s.endpoint) // 만료된 구독
          })
      )
    )
    if (gone.length) {
      const fresh = await readSubs()
      await store().setJSON(
        'subs',
        fresh.filter((s) => !gone.includes(s.endpoint))
      )
    }
  } catch {
    // 알림 실패는 무시
  }
}

export const clip = (text, n = 60) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
