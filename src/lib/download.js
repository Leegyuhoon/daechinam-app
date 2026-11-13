// 첨부 사진·영상 내려받기
// 영상은 서버가 4MB씩 나눠 보내므로, 조각을 차례로 받아 하나의 파일로 합친 뒤 저장
const CHUNK = 4 * 1024 * 1024

async function fetchWhole(url, onProgress) {
  const first = await fetch(url, { headers: { Range: `bytes=0-${CHUNK - 1}` } })
  if (!first.ok) throw new Error(`내려받기 실패 (${first.status})`)
  const type = first.headers.get('content-type') || 'application/octet-stream'
  const range = first.headers.get('content-range') // bytes 0-4194303/12345678
  const total = range ? Number(range.split('/')[1]) : null
  const parts = [await first.arrayBuffer()]
  if (first.status === 206 && total) {
    let got = parts[0].byteLength
    onProgress?.(Math.round((got / total) * 100))
    while (got < total) {
      const res = await fetch(url, { headers: { Range: `bytes=${got}-${Math.min(total, got + CHUNK) - 1}` } })
      if (!res.ok) throw new Error(`내려받기 실패 (${res.status})`)
      const buf = await res.arrayBuffer()
      if (!buf.byteLength) break
      parts.push(buf)
      got += buf.byteLength
      onProgress?.(Math.round((got / total) * 100))
    }
  }
  return new Blob(parts, { type })
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }

export async function downloadMedia(m, baseName, onProgress) {
  const blob = await fetchWhole(m.url, onProgress)
  const ext = EXT[blob.type] || (m.kind === 'video' ? 'mp4' : 'jpg')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${baseName}.${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export async function downloadAll(media, baseName, onProgress) {
  for (let i = 0; i < media.length; i++) {
    const kind = media[i].kind === 'video' ? '영상' : '사진'
    await downloadMedia(media[i], `${baseName}_${kind}${i + 1}`, (p) => onProgress?.(i, p))
    await new Promise((r) => setTimeout(r, 400)) // 브라우저가 여러 파일 저장을 막지 않도록 간격
  }
}
