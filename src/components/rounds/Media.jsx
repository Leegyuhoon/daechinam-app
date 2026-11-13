import { useState } from 'react'
import { ImagePlus, Video, X, Loader2, Play, Download } from 'lucide-react'
import { api } from '../../lib/api'
import { downloadMedia, downloadAll } from '../../lib/download'

// 사진·영상 첨부 고르기 — code를 주면 업체 페이지용(접속 코드로 업로드)
export function MediaPicker({ media, onChange, code, max = 10, compact = false, onBusyChange }) {
  const [uploads, setUploads] = useState([]) // 진행 중: { key, name, progress, kind }
  const [error, setError] = useState(null)

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, max - media.length))
    e.target.value = ''
    if (!files.length) return
    setError(null)
    onBusyChange?.(true)
    const added = []
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Math.random()}`
      const kind = f.type?.startsWith('video/') ? 'video' : 'photo'
      setUploads((u) => [...u, { key, name: f.name, progress: 0, kind }])
      try {
        const m = await api.uploadAttachment(f, {
          code,
          onProgress: (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, progress: p } : x)))
        })
        added.push(m)
        onChange((prev) => [...prev, m])
      } catch (err) {
        setError(err.message)
      }
      setUploads((u) => u.filter((x) => x.key !== key))
    }
    onBusyChange?.(false)
  }

  const size = compact ? 'h-14 w-14' : 'h-16 w-16'
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {media.map((m, i) => (
          <div key={m.url} className={`relative ${size} overflow-hidden rounded-lg bg-base-900`}>
            {m.kind === 'video' ? (
              <div className="flex h-full w-full items-center justify-center bg-base-200 text-base-950">
                <Play size={18} />
              </div>
            ) : (
              <img src={m.url} alt="" className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {uploads.map((u) => (
          <div key={u.key} className={`flex ${size} flex-col items-center justify-center rounded-lg bg-base-900 text-[11px] text-base-500`}>
            <Loader2 size={16} className="animate-spin" />
            {u.kind === 'video' ? `${u.progress}%` : '올리는 중'}
          </div>
        ))}
        {media.length + uploads.length < max && (
          <label className={`flex ${size} cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-base-700 text-[11px] text-base-500 hover:text-mist-500`}>
            <span className="flex gap-0.5">
              <ImagePlus size={14} />
              <Video size={14} />
            </span>
            사진·영상
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={pick} />
          </label>
        )}
      </div>
      {error && <p className="mt-1 text-[12px] text-amber-500">{error}</p>}
    </div>
  )
}

// 첨부 보기 — 사진은 눌러서 크게, 영상은 바로 재생, 각각 내려받기 버튼
// name: 내려받을 때 파일 이름 앞부분 (예: "메트라이프본사_문의_1112")
export function MediaView({ media = [], size = 'h-20 w-20', name = '첨부' }) {
  const [busy, setBusy] = useState({}) // url → 진행률
  const [allBusy, setAllBusy] = useState(false)
  const [error, setError] = useState(null)
  if (!media.length) return null

  const one = async (m, i) => {
    setError(null)
    setBusy((b) => ({ ...b, [m.url]: 0 }))
    try {
      await downloadMedia(m, `${name}_${m.kind === 'video' ? '영상' : '사진'}${i + 1}`, (p) => setBusy((b) => ({ ...b, [m.url]: p })))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy((b) => {
        const n = { ...b }
        delete n[m.url]
        return n
      })
    }
  }
  const all = async () => {
    setError(null)
    setAllBusy(true)
    try {
      await downloadAll(media, name)
    } catch (err) {
      setError(err.message)
    } finally {
      setAllBusy(false)
    }
  }

  const DlBtn = ({ m, i, className = '' }) => (
    <button
      type="button"
      onClick={() => one(m, i)}
      disabled={m.url in busy}
      className={`no-print flex items-center gap-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white ${className}`}
      aria-label="내려받기"
    >
      {m.url in busy ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
      {m.url in busy && m.kind === 'video' ? `${busy[m.url]}%` : ''}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {media.map((m, i) =>
          m.kind === 'video' ? (
            <div key={m.url} className="relative w-full max-w-xs">
              <video src={m.url} controls playsInline preload="metadata" className="max-h-56 w-full rounded-lg bg-black" />
              <DlBtn m={m} i={i} className="absolute right-1.5 top-1.5" />
            </div>
          ) : (
            <div key={m.url} className="relative">
              <a href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} alt="" className={`${size} rounded-md object-cover`} />
              </a>
              <DlBtn m={m} i={i} className="absolute bottom-1 right-1" />
            </div>
          )
        )}
      </div>
      {media.length > 1 && (
        <button type="button" onClick={all} disabled={allBusy} className="no-print mt-1 flex items-center gap-1 text-[12px] text-base-500 hover:text-mist-500">
          {allBusy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} {allBusy ? '내려받는 중…' : `전체 다운로드 (${media.length}개)`}
        </button>
      )}
      {error && <p className="mt-1 text-[12px] text-amber-500">{error}</p>}
    </div>
  )
}

export const isVideo = (m) => m?.kind === 'video' || /\/api\/regular-media/.test(m?.url || '')

// 썸네일 한 칸 — 사진이면 이미지, 영상이면 재생 표시 (controls=true면 바로 재생 가능)
export function Thumb({ m, className = '', controls = false, alt = '' }) {
  if (!m) return null
  if (isVideo(m)) {
    return controls ? (
      <video src={m.url} controls playsInline preload="metadata" className={`bg-black object-contain ${className}`} />
    ) : (
      <div className={`flex items-center justify-center bg-base-200 text-base-950 ${className}`}>
        <Play size={18} />
      </div>
    )
  }
  return <img src={m.url} alt={alt} className={`object-cover ${className}`} />
}
