import { getStore } from '@netlify/blobs'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const CLAUDE_MODEL = 'claude-sonnet-5'

function extractVideoId(videoUrl) {
  try {
    const u = new URL(videoUrl, 'https://placeholder.local')
    return u.searchParams.get('id')
  } catch {
    return null
  }
}

function chunkKey(id, index) {
  return `${id}:chunk:${String(index).padStart(5, '0')}`
}

// 조각(청크) 업로드된 영상과 예전 단일 업로드 영상 둘 다 지원해서 전체 버퍼를 읽어옵니다.
async function loadVideoBuffer(store, id) {
  const manifest = await store.get(id, { type: 'json' }).catch(() => null)

  if (manifest && manifest.totalChunks) {
    const parts = []
    for (let i = 0; i < manifest.totalChunks; i++) {
      const buf = await store.get(chunkKey(id, i), { type: 'arrayBuffer' })
      if (!buf) throw new Error(`영상 조각 ${i}을(를) 찾을 수 없습니다`)
      parts.push(new Uint8Array(buf))
    }
    const total = parts.reduce((sum, p) => sum + p.length, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const p of parts) {
      merged.set(p, offset)
      offset += p.length
    }
    return { buffer: merged.buffer, contentType: manifest.contentType, filename: manifest.filename }
  }

  // 레거시: 단일 blob
  const meta = await store.getMetadata(id)
  const buffer = await store.get(id, { type: 'arrayBuffer' })
  if (!buffer) return null
  return { buffer, contentType: meta?.metadata?.contentType, filename: meta?.metadata?.filename }
}

// 1) 영상 버퍼를 Whisper API로 보내 대본(텍스트)을 얻습니다.
async function transcribe(buffer, contentType, filename) {
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: contentType }), filename || 'video.mp4')
  form.append('model', 'whisper-1')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form
  })
  if (!res.ok) throw new Error(`음성인식 실패 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return data.text
}

// 2) 대본을 Claude API에 보내 4지선다 문제를 JSON으로 생성합니다.
async function generateQuestions(transcript, count = 4) {
  const prompt = `다음은 현장 근로자용 안전교육 영상의 대본입니다. 이 내용을 바탕으로 근로자의 이해도를 확인할 수 있는 객관식(4지선다) 문제를 ${count}개 만들어주세요. 실제 대본에 나온 핵심 안전수칙 위주로 출제하세요.

반드시 아래 형식의 순수 JSON 배열만 출력하세요. 설명, 마크다운 코드블록, 다른 텍스트를 절대 포함하지 마세요:
[{"prompt":"문제 텍스트","options":["보기1","보기2","보기3","보기4"],"correctIndex":0}]

대본:
"""
${transcript.slice(0, 12000)}
"""`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!res.ok) throw new Error(`AI 문제 생성 실패 (${res.status}): ${await res.text()}`)
  const data = await res.json()
  const text = (data.content || []).map((b) => b.text || '').join('')
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  if (!OPENAI_API_KEY || !ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          'OPENAI_API_KEY / ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다. Netlify 사이트 설정에서 추가한 뒤 다시 배포해주세요.'
      },
      { status: 500 }
    )
  }

  try {
    const { videoUrl, questionCount } = await req.json()
    const videoId = extractVideoId(videoUrl)
    if (!videoId) return Response.json({ error: '영상 ID를 확인할 수 없습니다' }, { status: 400 })

    const store = getStore('safety-videos')
    const loaded = await loadVideoBuffer(store, videoId)
    if (!loaded) return Response.json({ error: '영상을 찾을 수 없습니다' }, { status: 404 })

    // Whisper API는 파일당 25MB 제한이 있어요. 조각 업로드로 저장은 커져도, 음성인식은 여전히 이 한도 안에서만 동작해요.
    if (loaded.buffer.byteLength > 25 * 1024 * 1024) {
      return Response.json(
        { error: '영상이 너무 커요 (25MB 초과). AI 자동 문제 생성은 25MB 이하 영상만 지원돼요.' },
        { status: 413 }
      )
    }

    const transcript = await transcribe(
      loaded.buffer,
      loaded.contentType || 'video/mp4',
      loaded.filename || 'video.mp4'
    )

    const rawQuestions = await generateQuestions(transcript, questionCount || 4)
    const questions = rawQuestions.map((q) => ({
      id: crypto.randomUUID(),
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex
    }))

    return Response.json({ transcript, questions })
  } catch (err) {
    return Response.json({ error: 'AI 문제 생성 실패', detail: String(err) }, { status: 500 })
  }
}
