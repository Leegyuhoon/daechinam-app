// 웹 푸시 알림용 서비스 워커 — 알림 표시와 알림을 눌렀을 때 페이지 열기만 담당
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '(주)이엘씨_대치남', {
      body: data.body || '',
      icon: '/icons/icon-192.png?v=2',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
      tag: data.tag || undefined
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url === url && 'focus' in c) return c.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
