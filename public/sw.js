// 최소한의 서비스 워커 — PWA "설치 가능" 조건을 충족시키기 위한 용도예요.
// 지금은 캐싱 없이 그냥 통과시키기만 해요 (나중에 오프라인 지원을 추가할 수도 있어요).
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // 지금은 그냥 네트워크 그대로 통과 — 캐싱 안 함
});
