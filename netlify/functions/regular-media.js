import { getStore } from '@netlify/blobs'

// GET /api/regular-media?id=... — 조각을 이어 붙여 영상 재생 (공개, 추측 불가 id)
// 아이폰 사파리는 Range 요청으로만 영상을 재생해서 부분 요청(206)을 지원함
const chunkKey = (id, i) => `${id}:chunk:${String(i).padStart(5, '0')}`

export default async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405 })
  const id = new URL(req.url).searchParams.get('id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('id가 올바르지 않습니다', { status: 400 })

  const store = getStore('regular-media')
  try {
    const m = await store.get(id, { type: 'json' }).catch(() => null)
    if (!m) return new Response('파일을 찾을 수 없습니다', { status: 404 })
    const { size, chunkSize, totalChunks, contentType } = m

    let start = 0
    let end = size - 1
    let status = 200
    const range = req.headers.get('range')
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      if (match) {
        if (match[1] === '' && match[2] !== '') {
          start = Math.max(0, size - Number(match[2]))
        } else {
          start = Number(match[1] || 0)
          if (match[2] !== '') end = Math.min(size - 1, Number(match[2]))
        }
        if (start > end || start >= size) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
        }
        status = 206
      }
    }
    // Netlify 함수 응답은 약 6MB 제한 — 한 번에 최대 4MB씩만 보냄 (브라우저가 이어서 요청함)
    const MAX = 4 * 1024 * 1024
    if (end - start + 1 > MAX) {
      end = start + MAX - 1
      status = 206
    }

    const headers = {
      'Content-Type': contentType || 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
    if (req.method === 'HEAD') return new Response(null, { status, headers })

    const first = Math.floor(start / chunkSize)
    const last = Math.min(totalChunks - 1, Math.floor(end / chunkSize))
    let i = first
    const stream = new ReadableStream({
      async pull(controller) {
        if (i > last) return controller.close()
        const buf = await store.get(chunkKey(id, i), { type: 'arrayBuffer' })
        if (!buf) return controller.error(new Error(`조각 ${i} 없음`))
        const bytes = new Uint8Array(buf)
        const chunkStart = i * chunkSize
        const from = Math.max(0, start - chunkStart)
        const to = Math.min(bytes.length, end - chunkStart + 1)
        controller.enqueue(bytes.subarray(from, to))
        i += 1
      }
    })
    return new Response(stream, { status, headers })
  } catch (err) {
    return new Response(`재생 실패: ${String(err)}`, { status: 500 })
  }
}
