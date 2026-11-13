import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  X,
  Users,
  Wallet,
  Image as ImageIcon,
  Video,
  UploadCloud,
  Loader2,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Lock
} from 'lucide-react'
import { api } from '../lib/api'
import PrintButton from './PrintButton'
import LoadingBar from './LoadingBar'
import TripReports from './trip/TripReports'

const emptyJob = {
  siteName: '',
  date: '',
  employeeCount: '',
  dayWorkerCount: '',
  dayWorkerRate: '',
  endDate: '',
  workDescription: '',
  media: []
}

const won = (n) => `${(n || 0).toLocaleString('ko-KR')}원`

// 작업 일수 (종료일 포함), 기간 표시
const daysOf = (start, end) => (start && end && end > start ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1 : 1)
const rangeLabel = (j) => (j.endDate && j.endDate > j.date ? `${j.date} ~ ${j.endDate.slice(5)} (${daysOf(j.date, j.endDate)}일)` : j.date)

function MediaUploader({ media, onAdd }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError(null)
    for (const file of files) {
      const kind = file.type.startsWith('video') ? 'video' : 'photo'
      setUploading(true)
      setProgress(0)
      try {
        const res = await api.uploadSpotMedia(file, kind, setProgress)
        onAdd({ id: res.id, url: res.url, kind: res.kind, filename: res.filename })
      } catch (err) {
        setError(err.message)
      } finally {
        setUploading(false)
      }
    }
    e.target.value = ''
  }

  return (
    <div>
      <label className="focus-ring flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-base-700 px-3 py-4 text-sm text-base-400 hover:border-mist-500 hover:text-mist-500">
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> 업로드 중… {progress}%
          </>
        ) : (
          <>
            <UploadCloud size={16} /> 사진·영상 추가 (여러 개 선택 가능)
          </>
        )}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={uploading}
        />
      </label>
      {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}

      {media.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-lg border border-base-800 bg-base-900">
              {m.kind === 'video' ? (
                <video src={m.url} className="aspect-square w-full object-cover" muted />
              ) : (
                <img src={m.url} alt={m.filename} className="aspect-square w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function JobForm({ initialJob, onSaved, onCancel }) {
  const [job, setJob] = useState(initialJob || emptyJob)
  const [multiDay, setMultiDay] = useState(!!(initialJob?.endDate && initialJob.endDate > initialJob.date))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const days = multiDay ? daysOf(job.date, job.endDate) : 1
  const total = (Number(job.dayWorkerCount) || 0) * (Number(job.dayWorkerRate) || 0) * days

  const save = async () => {
    setError(null)
    if (!job.siteName.trim() || !job.date) {
      setError('현장명과 날짜를 입력해주세요.')
      return
    }
    if (multiDay && (!job.endDate || job.endDate <= job.date)) {
      setError('종료일은 시작일 다음 날 이후로 골라 주세요.')
      return
    }
    setSaving(true)
    try {
      await api.upsertSpotJob({ ...job, endDate: multiDay ? job.endDate : null })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <p className="mb-3 text-sm font-medium text-base-200">
        {initialJob ? '일회성 현장 수정' : '일회성 현장 등록'}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="현장명 (예: 은혜교회 대청소)"
          value={job.siteName}
          onChange={(e) => setJob({ ...job, siteName: e.target.value })}
        />
        <div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label={multiDay ? '시작일' : '작업일'}
              className="focus-ring min-w-0 flex-1 rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
              value={job.date}
              onChange={(e) => setJob({ ...job, date: e.target.value })}
            />
            {multiDay && (
              <>
                <span className="text-xs text-base-500">~</span>
                <input
                  type="date"
                  aria-label="종료일"
                  min={job.date || undefined}
                  className="focus-ring min-w-0 flex-1 rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
                  value={job.endDate || ''}
                  onChange={(e) => setJob({ ...job, endDate: e.target.value })}
                />
              </>
            )}
          </div>
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-base-400">
            <input type="checkbox" checked={multiDay} onChange={(e) => setMultiDay(e.target.checked)} />
            여러 날 작업 (시작일 ~ 종료일)
            {multiDay && job.date && job.endDate > job.date && <span className="font-medium text-mist-500">· 총 {days}일</span>}
          </label>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-base-400">직원 인원</label>
          <input
            type="number"
            min={0}
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
            value={job.employeeCount}
            onChange={(e) => setJob({ ...job, employeeCount: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-base-400">일용직 인원</label>
          <input
            type="number"
            min={0}
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
            value={job.dayWorkerCount}
            onChange={(e) => setJob({ ...job, dayWorkerCount: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-base-400">일용직 인당 {multiDay ? '하루 금액(일당)' : '금액'}</label>
          <input
            type="number"
            min={0}
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
            placeholder="원"
            value={job.dayWorkerRate}
            onChange={(e) => setJob({ ...job, dayWorkerRate: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-base-400">
        <Wallet size={13} className="text-red-500" />
        일용직 총액: <span className="font-medium text-base-200">{won(total)}</span>
        {multiDay && days > 1 && (
          <span className="text-base-500">
            ({Number(job.dayWorkerCount) || 0}명 × {won(Number(job.dayWorkerRate) || 0)} × {days}일)
          </span>
        )}
      </div>

      <textarea
        className="focus-ring mt-3 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
        placeholder="작업 내용"
        rows={3}
        value={job.workDescription}
        onChange={(e) => setJob({ ...job, workDescription: e.target.value })}
      />

      <div className="mt-3">
        <MediaUploader
          media={job.media}
          onAdd={(m) => setJob((j) => ({ ...j, media: [...j.media, m] }))}
        />
      </div>

      {error && <p className="mt-3 text-xs text-amber-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="focus-ring rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {saving ? '저장 중…' : initialJob ? '수정 저장' : '등록'}
        </button>
        <button onClick={onCancel} className="focus-ring rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300">
          취소
        </button>
      </div>
    </div>
  )
}

function PasswordGate({ onOk }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setChecking(true)
    try {
      await api.verifySpotPassword(pw)
      onOk()
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-base-800 bg-base-950 p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mist-500/15 text-mist-500">
            <Lock size={16} />
          </div>
          <p className="text-sm font-semibold text-base-100">일회성 현장 관리</p>
        </div>
        <p className="mb-4 text-xs text-base-400">
          이름·연락처 등 개인정보가 포함된 화면이라 비밀번호가 필요해요.
        </p>
        <input
          type="password"
          autoFocus
          className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="focus-ring mt-3 w-full rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {checking ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </div>
  )
}

export default function SpotJobs() {
  const navigate = useNavigate()
  // 탭: 현장 기록 / 출장 보고서 (주소 ?view=trip → 뒤로 가기로 이전 탭)
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'trip' ? 'trip' : 'jobs'
  const [unlocked, setUnlocked] = useState(false)
  const [checkingStored, setCheckingStored] = useState(true)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = () => {
    setLoading(true)
    api.listSpotJobs().then(({ items }) => setJobs(items)).finally(() => setLoading(false))
  }

  useEffect(() => {
    const stored = localStorage.getItem('daechinam_spot_pw')
    if (stored) {
      api
        .verifySpotPassword(stored)
        .then(() => setUnlocked(true))
        .catch(() => {})
        .finally(() => setCheckingStored(false))
    } else {
      setCheckingStored(false)
    }
  }, [])

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked])

  const openNew = () => {
    setEditingJob(null)
    setShowForm(true)
  }
  const openEdit = (job) => {
    setEditingJob(job)
    setShowForm(true)
  }
  const remove = async (id) => {
    if (!confirm('이 기록을 삭제할까요? 삭제하면 되돌릴 수 없어요.')) return
    await api.deleteSpotJob(id)
    load()
  }

  if (checkingStored) return null
  if (!unlocked) return <PasswordGate onOk={() => setUnlocked(true)} />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-page-text">일회성 현장 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <ArrowLeft size={14} /> 뒤로가기
          </button>
          <button
            onClick={load}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {view === 'jobs' && <button
            onClick={() => (showForm ? setShowForm(false) : openNew())}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Plus size={14} /> 등록
          </button>}
          <button
            onClick={() => {
              api.clearSpotPassword()
              setUnlocked(false)
            }}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Lock size={14} />
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-page-border bg-page-soft p-1">
        {[
          ['jobs', '현장 기록'],
          ['trip', '출장 보고서']
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => key !== view && setParams(key === 'trip' ? { view: 'trip' } : {})}
            className={`focus-ring flex-1 rounded-lg py-2 text-sm ${view === key ? 'bg-base-950 font-medium text-base-100 shadow-sm' : 'text-page-sub hover:text-page-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'trip' ? (
        <TripReports jobs={jobs} />
      ) : (
      <>
      {showForm && (
        <div className="mb-6">
          <JobForm
            key={editingJob?.id || 'new'}
            initialJob={editingJob}
            onSaved={() => {
              setShowForm(false)
              setEditingJob(null)
              load()
            }}
            onCancel={() => {
              setShowForm(false)
              setEditingJob(null)
            }}
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-base-400">직접 등록한 일회성 현장 ({jobs.length})</p>
        {jobs.length > 0 && <PrintButton targetId="print-spot-all" title={`일회성 현장 목록_${new Date().toLocaleDateString('sv-SE')}`} label="목록 PDF 저장" small />}
      </div>

      {/* PDF 저장용 목록 (화면에는 안 보임) */}
      <div id="print-spot-all" className="print-only">
        <table className="w-full border-collapse text-[12px] text-base-100">
          <thead>
            <tr className="bg-base-900 text-left">
              {['날짜', '현장', '일수', '직원', '일용', '일용 인당(일)', '일용 총액', '작업 내용'].map((h) => (
                <th key={h} className="border border-base-700 px-2 py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...jobs]
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              .map((j) => (
                <tr key={j.id}>
                  <td className="whitespace-nowrap border border-base-700 px-2 py-1 align-top">
                    {j.date}
                    {j.endDate && j.endDate > j.date && <span className="block">~ {j.endDate}</span>}
                  </td>
                  <td className="border border-base-700 px-2 py-1 align-top">{j.siteName}</td>
                  <td className="border border-base-700 px-2 py-1 text-right align-top">{daysOf(j.date, j.endDate)}</td>
                  <td className="border border-base-700 px-2 py-1 text-right align-top">{j.employeeCount || 0}</td>
                  <td className="border border-base-700 px-2 py-1 text-right align-top">{j.dayWorkerCount || 0}</td>
                  <td className="whitespace-nowrap border border-base-700 px-2 py-1 text-right align-top">{won(Number(j.dayWorkerRate) || 0)}</td>
                  <td className="whitespace-nowrap border border-base-700 px-2 py-1 text-right align-top">{won(j.dayWorkerTotal)}</td>
                  <td className="whitespace-pre-line border border-base-700 px-2 py-1 align-top">{j.workDescription}</td>
                </tr>
              ))}
            <tr className="bg-base-900 font-medium">
              <td colSpan={6} className="border border-base-700 px-2 py-1 text-right">
                합계 ({jobs.length}건)
              </td>
              <td className="whitespace-nowrap border border-base-700 px-2 py-1 text-right">{won(jobs.reduce((n, j) => n + (j.dayWorkerTotal || 0), 0))}</td>
              <td className="border border-base-700 px-2 py-1" />
            </tr>
          </tbody>
        </table>
      </div>
      {loading ? (
        <LoadingBar tone="dark" />
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-base-800 bg-base-950 p-10 text-base-500">
          <CalendarDays size={28} />
          <p className="text-sm">등록된 일회성 현장이 없어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => {
            const isOpen = openId === j.id
            const photoCount = j.media.filter((m) => m.kind === 'photo').length
            const videoCount = j.media.filter((m) => m.kind === 'video').length

            return (
              <div key={j.id} id={`print-spot-${j.id}`} className="rounded-xl border border-base-800 bg-base-950 shadow-sm">
                <button
                  onClick={() => setOpenId(isOpen ? null : j.id)}
                  className="focus-ring flex w-full items-start justify-between gap-2 p-4 text-left"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    {isOpen ? (
                      <ChevronDown size={16} className="shrink-0 text-base-500" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-base-500" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-base-100">{j.siteName}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-400">
                        <span className="whitespace-nowrap">{rangeLabel(j)}</span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Users size={12} /> 직원 {j.employeeCount} · 일용 {j.dayWorkerCount}
                        </span>
                        {(photoCount > 0 || videoCount > 0) && (
                          <span className="flex items-center gap-1 text-base-500">
                            {photoCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <ImageIcon size={11} /> {photoCount}
                              </span>
                            )}
                            {videoCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Video size={11} /> {videoCount}
                              </span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 whitespace-nowrap pt-0.5 text-xs font-medium text-base-300">
                    <Wallet size={12} className="text-red-500" />
                    {won(j.dayWorkerTotal)}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-base-800 p-4 pt-3">
                    {j.workDescription && (
                      <p className="mb-3 whitespace-pre-line text-sm text-base-300">{j.workDescription}</p>
                    )}

                    {j.media.length > 0 && (
                      <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {j.media.map((m) =>
                          m.kind === 'video' ? (
                            <video key={m.id} src={m.url} controls className="aspect-square w-full rounded-lg bg-black object-cover" />
                          ) : (
                            <img
                              key={m.id}
                              src={m.url}
                              alt={m.filename}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          )
                        )}
                      </div>
                    )}

                    <div className="no-print flex items-center gap-3">
                      <PrintButton
                        targetId={`print-spot-${j.id}`}
                        title={`일회성 현장_${j.siteName}_${j.date}${j.endDate && j.endDate > j.date ? `~${j.endDate}` : ''}`}
                        className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-mist-500"
                      />
                      <button
                        onClick={() => openEdit(j)}
                        className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-mist-500"
                      >
                        <Pencil size={12} /> 수정
                      </button>
                      <button
                        onClick={() => remove(j.id)}
                        className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-red-500"
                      >
                        <X size={12} /> 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>
      )}
    </div>
  )
}
