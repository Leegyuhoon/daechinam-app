import { getStore } from '@netlify/blobs'

function chunkKey(id, index) {
  return `${id}:chunk:${String(index).padStart(5, '0')}`
}

// GET /api/safety-video?id=...
// 1) 새 방식(조각 업로드): id 자리에 { totalChunks, contentType } 매니페스트가 저장돼 있고,
//    실제 데이터는 `${id}:chunk:00000`, `${id}:chunk:00001`... 로 나뉘어 저장되어 있습니다.
//    조각들을 순서대로 이어붙여 하나의 스트림으로 재생합니다.
// 2) 예전 방식(단일 업로드)으로 저장된 영상은 그대로 하위호환으로 재생됩니다.
export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return new Response('id가 필요합니다', { status: 400 })

  const store = getStore('safety-videos')

  try {
    const manifest = await store.get(id, { type: 'json' }).catch(() => null)

    if (manifest && manifest.totalChunks) {
      const { totalChunks, contentType } = manifest
      let index = 0
      let currentReader = null

      const stream = new ReadableStream({
        async pull(controller) {
          try {
            while (true) {
              if (!currentReader) {
                if (index >= totalChunks) {
                  controller.close()
                  return
                }
                const chunkStream = await store.get(chunkKey(id, index), { type: 'stream' })
                if (!chunkStream) {
                  controller.error(new Error(`영상 조각 ${index}을(를) 찾을 수 없습니다`))
                  return
                }
                currentReader = chunkStream.getReader()
                index += 1
              }
              const { done, value } = await currentReader.read()
              if (done) {
                currentReader = null
                continue
              }
              controller.enqueue(value)
              return
            }
          } catch (err) {
            controller.error(err)
          }
        }
      })

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': contentType || 'video/mp4',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      })
    }

    // 레거시: 단일 blob으로 저장된 영상
    const meta = await store.getMetadata(id)
    if (!meta) return new Response('영상을 찾을 수 없습니다', { status: 404 })
    const single = await store.get(id, { type: 'stream' })
    if (!single) return new Response('영상을 찾을 수 없습니다', { status: 404 })

    return new Response(single, {
      status: 200,
      headers: {
        'Content-Type': meta.metadata?.contentType || 'video/mp4',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (err) {
    return Response.json({ error: '영상 재생 실패', detail: String(err) }, { status: 500 })
  }
}
