import { useEffect, useState } from 'react'
import { Plus, Trash2, Printer, Pencil, ArrowLeft, Eye, Wand2, ImagePlus, Loader2, FileText } from 'lucide-react'
import { api } from '../../lib/api'
import { printElement } from '../PrintButton'
import LoadingBar from '../LoadingBar'
import TripReportDoc, { daysOf } from './TripReportDoc'

const inputCls = 'focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-base-100'
const btn = 'focus-ring inline-flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-950 px-3 py-1.5 text-xs text-base-300 hover:bg-base-800'
const btnMain = 'focus-ring inline-flex items-center gap-1.5 rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50'
const today = () => new Date().toLocaleDateString('sv-SE')
const rid = () => crypto.randomUUID()

// 출장자·소속부서는 지난번 값을 기억
function lastDefaults() {
  try {
    return JSON.parse(localStorage.getItem('daechinam_trip_defaults') || '{}')
  } catch {
    return {}
  }
}

const emptyReport = () => {
  const d = lastDefaults()
  return {
    dept: d.dept || '행정지원 팀장',
    traveler: d.traveler || '',
    place: '',
    purpose: '일회성 청소 대행',
    startDate: today(),
    endDate: today(),
    overview: '',
    schedule: [],
    members: [{ name: '', role: '' }],
    zones: [{ name: '', status: '청소 완료됨' }],
    otherNotes: '이상 없음.',
    reportDate: today(),
    receipts: [],
    spotJobId: null
  }
}

function datesBetween(s, e) {
  const out = []
  if (!s) return out
  const end = e && e >= s ? e : s
  for (let t = Date.parse(s); t <= Date.parse(end) && out.length < 60; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

const fmtShort = (d) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8))}` : '')

function Section({ title, hint, children, right }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-base-100">{title}</p>
          {hint && <p className="mt-0.5 text-[12px] text-base-500">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Editor({ initial, jobs, onSaved, onCancel }) {
  const [r, setR] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(0)
  const set = (patch) => setR((x) => ({ ...x, ...patch }))
  const setRow = (key, i, patch) => setR((x) => ({ ...x, [key]: x[key].map((row, j) => (j === i ? { ...row, ...patch } : row)) }))
  const addRow = (key, row) => setR((x) => ({ ...x, [key]: [...x[key], row] }))
  const delRow = (key, i) => setR((x) => ({ ...x, [key]: x[key].filter((_, j) => j !== i) }))
  const days = daysOf(r.startDate, r.endDate)

  // 일회성 현장 기록에서 불러오기
  const fromJob = (id) => {
    const j = jobs.find((x) => x.id === id)
    if (!j) return
    set({
      spotJobId: j.id,
      place: r.place || j.siteName,
      startDate: j.date,
      endDate: j.endDate && j.endDate > j.date ? j.endDate : j.date,
      reportDate: j.endDate && j.endDate > j.date ? j.endDate : j.date,
      overview: r.overview || j.workDescription || ''
    })
  }

  // 출장 기간으로 날짜별 일정 칸 만들기
  const makeSchedule = () => {
    const dates = datesBetween(r.startDate, r.endDate)
    const existing = Object.fromEntries(r.schedule.map((s) => [s.date, s.text]))
    set({ schedule: dates.map((d, i) => ({ date: d, text: existing[d] ?? (i === 0 ? '본사에서 출발하여 현장(숙소) 도착.' : i === dates.length - 1 ? '현장 마무리 정리 후 본사 복귀.' : '현장 방문하여 청소 작업 진행.') })) })
  }

  const addReceipts = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    setUploading(files.length)
    for (const f of files) {
      try {
        const up = await api.uploadReceipt(f)
        addRow('receipts', { id: rid(), desc: '', amount: '', url: up.url })
      } catch (err) {
        setError(err.message)
      }
      setUploading((n) => n - 1)
    }
  }

  const save = async () => {
    if (!r.startDate) return setError('출장 시작일을 골라 주세요.')
    if (r.endDate && r.endDate < r.startDate) return setError('종료일이 시작일보다 빠를 수 없어요.')
    setSaving(true)
    setError(null)
    try {
      try {
        localStorage.setItem('daechinam_trip_defaults', JSON.stringify({ dept: r.dept, traveler: r.traveler }))
      } catch {
        /* 무시 */
      }
      const { item } = await api.saveTripReport(r)
      onSaved(item)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (preview) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setPreview(false)} className={btn}>
            <ArrowLeft size={14} /> 작성 화면으로
          </button>
          <button onClick={() => printElement('print-trip-doc', `출장보고서_${r.place || '현장'}_${r.startDate}`)} className={btn}>
            <Printer size={14} /> PDF 저장 · 인쇄
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl bg-white p-3 shadow-sm">
          <div id="print-trip-doc" style={{ minWidth: 640 }}>
            <TripReportDoc r={r} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-page-text">{r.id ? '출장 보고서 수정' : '출장 보고서 작성'}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className={btn}>
            <ArrowLeft size={14} /> 목록
          </button>
          <button onClick={() => setPreview(true)} className={btn}>
            <Eye size={14} /> 미리보기
          </button>
        </div>
      </div>

      {jobs.length > 0 && (
        <Section title="일회성 현장 기록에서 불러오기" hint="등록해 둔 현장을 고르면 장소 · 기간 · 작업 내용이 채워져요.">
          <select className={inputCls} value={r.spotJobId || ''} onChange={(e) => fromJob(e.target.value)}>
            <option value="">선택 안 함</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.date}
                {j.endDate && j.endDate > j.date ? ` ~ ${j.endDate.slice(5)}` : ''} · {j.siteName}
              </option>
            ))}
          </select>
        </Section>
      )}

      <Section title="기본 정보">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-base-400">
            소속 부서
            <input className={inputCls + ' mt-1'} value={r.dept} onChange={(e) => set({ dept: e.target.value })} />
          </label>
          <label className="text-xs text-base-400">
            출장자
            <input className={inputCls + ' mt-1'} value={r.traveler} onChange={(e) => set({ traveler: e.target.value })} placeholder="이름" />
          </label>
          <label className="text-xs text-base-400 sm:col-span-2">
            출장 장소
            <input className={inputCls + ' mt-1'} value={r.place} onChange={(e) => set({ place: e.target.value })} placeholder="예: 경상북도 포항 영남에너지서비스" />
          </label>
          <label className="text-xs text-base-400 sm:col-span-2">
            출장 목적
            <input className={inputCls + ' mt-1'} value={r.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </label>
          <label className="text-xs text-base-400">
            출장 시작일
            <input type="date" className={inputCls + ' mt-1'} value={r.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: r.endDate < e.target.value ? e.target.value : r.endDate })} />
          </label>
          <label className="text-xs text-base-400">
            출장 종료일 <span className="text-mist-500">(총 {days}일)</span>
            <input type="date" min={r.startDate} className={inputCls + ' mt-1'} value={r.endDate} onChange={(e) => set({ endDate: e.target.value, reportDate: e.target.value || r.reportDate })} />
          </label>
        </div>
      </Section>

      <Section title="업무 수행 사항" hint="누구의 의뢰로, 어디에서, 무슨 작업을 했는지 적어 주세요.">
        <textarea
          rows={3}
          className={inputCls}
          value={r.overview}
          onChange={(e) => set({ overview: e.target.value })}
          placeholder="예: 씨에이치엠 서비스 주식회사의 의뢰를 받아 바닥 청소 및 카펫 청소 서비스 진행을 위해 경상북도 포항에 위치한 영남에너지서비스 업체 방문함."
        />
      </Section>

      <Section
        title="날짜별 일정"
        hint="출발 · 도착 · 작업 · 복귀 내용을 날짜별로 적어요."
        right={
          <button onClick={makeSchedule} className={btn}>
            <Wand2 size={13} /> 기간으로 칸 만들기
          </button>
        }
      >
        <div className="space-y-1.5">
          {r.schedule.map((s, i) => (
            <div key={i} className="flex gap-1.5">
              <input type="date" className={inputCls + ' !w-36 shrink-0 !px-2'} value={s.date} onChange={(e) => setRow('schedule', i, { date: e.target.value })} />
              <textarea rows={1} className={inputCls} value={s.text} onChange={(e) => setRow('schedule', i, { text: e.target.value })} placeholder="예: 경기도 하남 본사에서 1시 출발, 저녁 6시 포항 숙소 도착." />
              <button onClick={() => delRow('schedule', i)} className="shrink-0 px-1 text-base-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addRow('schedule', { date: r.schedule.at(-1)?.date || r.startDate, text: '' })} className="mt-2 flex items-center gap-1 text-xs text-mist-500">
          <Plus size={13} /> 일정 추가
        </button>
      </Section>

      <Section title={`출장 인원 (총 ${r.members.filter((m) => m.name).length}명)`}>
        <div className="space-y-1.5">
          {r.members.map((m, i) => (
            <div key={i} className="flex gap-1.5">
              <input className={inputCls + ' !w-28 shrink-0'} value={m.name} onChange={(e) => setRow('members', i, { name: e.target.value })} placeholder="이름" />
              <input className={inputCls} value={m.role} onChange={(e) => setRow('members', i, { role: e.target.value })} placeholder="맡은 일 (예: 바닥 청소 및 왁스 처리)" />
              <button onClick={() => delRow('members', i)} className="shrink-0 px-1 text-base-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addRow('members', { name: '', role: '' })} className="mt-2 flex items-center gap-1 text-xs text-mist-500">
          <Plus size={13} /> 인원 추가
        </button>
      </Section>

      <Section title="청소 구역 및 완료 상황">
        <div className="space-y-1.5">
          {r.zones.map((z, i) => (
            <div key={i} className="flex gap-1.5">
              <span className="w-5 shrink-0 pt-2 text-right text-xs text-base-500">{i + 1}.</span>
              <input className={inputCls} value={z.name} onChange={(e) => setRow('zones', i, { name: e.target.value })} placeholder="구역 (예: 임원실)" />
              <input className={inputCls + ' !w-36 shrink-0'} value={z.status} onChange={(e) => setRow('zones', i, { status: e.target.value })} />
              <button onClick={() => delRow('zones', i)} className="shrink-0 px-1 text-base-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addRow('zones', { name: '', status: '청소 완료됨' })} className="mt-2 flex items-center gap-1 text-xs text-mist-500">
          <Plus size={13} /> 구역 추가
        </button>
      </Section>

      <Section title="기타 보고사항 · 보고일">
        <textarea rows={2} className={inputCls} value={r.otherNotes} onChange={(e) => set({ otherNotes: e.target.value })} />
        <label className="mt-2 block text-xs text-base-400">
          보고일
          <input type="date" className={inputCls + ' mt-1 !w-44'} value={r.reportDate} onChange={(e) => set({ reportDate: e.target.value })} />
        </label>
      </Section>

      <Section
        title="출장 경비 증빙"
        hint="영수증 사진을 올리고 내용과 금액을 적어 주세요. 보고서 2쪽에 붙어서 나와요."
        right={
          <label className={btn + ' cursor-pointer'}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} 영수증 사진
            <input type="file" accept="image/*" multiple className="hidden" onChange={addReceipts} disabled={uploading > 0} />
          </label>
        }
      >
        {r.receipts.length === 0 ? (
          <p className="text-[12px] text-base-500">아직 첨부한 영수증이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {r.receipts.map((x, i) => (
              <div key={x.id || i} className="flex gap-2 rounded-lg bg-base-900 p-2">
                {x.url ? <img src={x.url} alt="" className="h-16 w-16 shrink-0 rounded object-cover" /> : <div className="h-16 w-16 shrink-0 rounded bg-base-800" />}
                <div className="min-w-0 flex-1 space-y-1">
                  <input className={inputCls + ' !py-1.5'} value={x.desc} onChange={(e) => setRow('receipts', i, { desc: e.target.value })} placeholder="예: 포항 숙박업체 2박 예약 결제 (방 2개) 영수증" />
                  <input type="number" min={0} className={inputCls + ' !w-40 !py-1.5'} value={x.amount} onChange={(e) => setRow('receipts', i, { amount: e.target.value })} placeholder="금액 (선택)" />
                </div>
                <button onClick={() => delRow('receipts', i)} className="shrink-0 self-start px-1 text-base-500 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <p className="text-right text-xs text-base-400">
              합계 {r.receipts.reduce((n, x) => n + (Number(x.amount) || 0), 0).toLocaleString('ko-KR')}원
            </p>
          </div>
        )}
      </Section>

      {error && <p className="text-xs text-amber-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || uploading > 0} className={btnMain}>
          {saving ? '저장 중…' : '저장'}
        </button>
        <button onClick={() => setPreview(true)} className={btn}>
          <Eye size={14} /> 미리보기 · PDF
        </button>
      </div>
    </div>
  )
}

export default function TripReports({ jobs = [] }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)

  const load = () => {
    setLoading(true)
    api
      .listTripReports()
      .then(({ items }) => setItems(items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (editing) {
    return (
      <Editor
        initial={editing}
        jobs={jobs}
        onCancel={() => setEditing(null)}
        onSaved={(item) => {
          setEditing(null)
          setViewing(item)
          load()
        }}
      />
    )
  }

  if (viewing) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setViewing(null)} className={btn}>
            <ArrowLeft size={14} /> 목록
          </button>
          <button onClick={() => setEditing(viewing)} className={btn}>
            <Pencil size={14} /> 수정
          </button>
          <button onClick={() => printElement('print-trip-doc', `출장보고서_${viewing.place || '현장'}_${viewing.startDate}`)} className={btn}>
            <Printer size={14} /> PDF 저장 · 인쇄
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl bg-white p-3 shadow-sm">
          <div id="print-trip-doc" style={{ minWidth: 640 }}>
            <TripReportDoc r={viewing} />
          </div>
        </div>
      </div>
    )
  }

  const remove = async (x) => {
    if (!confirm('이 출장 보고서를 삭제할까요?')) return
    await api.deleteTripReport(x.id)
    load()
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-page-sub">출장 보고서 ({items.length})</p>
        <button onClick={() => setEditing(emptyReport())} className={btnMain}>
          <Plus size={14} /> 출장 보고서 작성
        </button>
      </div>
      {loading ? (
        <LoadingBar tone="dark" />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-base-800 bg-base-950 py-10 text-center text-xs text-base-500">
          <FileText size={22} className="mx-auto mb-2 text-base-600" />
          아직 작성한 출장 보고서가 없어요.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-xl border border-base-800 bg-base-950 p-3">
              <button onClick={() => setViewing(x)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-base-100">{x.place || '(장소 미입력)'}</p>
                <p className="text-[12px] text-base-500">
                  {fmtShort(x.startDate)}
                  {x.endDate && x.endDate > x.startDate ? ` ~ ${fmtShort(x.endDate)}` : ''} ({daysOf(x.startDate, x.endDate)}일) · {x.traveler || '출장자 미입력'} · 인원 {(x.members || []).filter((m) => m.name).length}명
                  {(x.receipts || []).length > 0 && ` · 영수증 ${x.receipts.length}장`}
                </p>
              </button>
              <button onClick={() => setEditing(x)} className="text-base-500 hover:text-mist-500" aria-label="수정">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(x)} className="text-base-500 hover:text-red-500" aria-label="삭제">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
