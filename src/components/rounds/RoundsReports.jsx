import { useEffect, useState } from 'react'
import { Plus, Copy, Check, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { todayStr, fmtDate, reportLink } from '../../lib/rounds'
import { Modal, Label, Card, inputCls, btnPrimary, btnGhost, btnDanger } from './ui'
import PrintButton from '../PrintButton'
import { MediaPicker, Thumb } from './Media'

function ExecutionModal({ initial, sites, visits, ops, onClose }) {
  const [ex, setEx] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const site = sites.find((s) => s.id === ex.siteId)
  const services = site?.services || []

  const save = async () => {
    if (!ex.siteId || !ex.date) return setError('현장과 작업일을 입력해주세요.')
    const serviceName = ex.serviceId ? services.find((s) => s.id === ex.serviceId)?.name || ex.serviceName : ex.serviceName
    if (!serviceName?.trim()) return setError('작업 항목을 선택하거나 입력해주세요.')
    if (ex.before.length + ex.after.length === 0) return setError('작업 전 또는 작업 후 사진·영상을 하나 이상 올려주세요.')
    setSaving(true)
    setError(null)
    try {
      const saved = await ops.save('executions', { ...ex, serviceName: serviceName.trim(), siteName: site?.name || '' })
      if (saved.serviceId) await ops.markServiceDone(saved.siteId, saved.serviceId, saved.date)
      // 월간 일정에서 넘어온 경우 그 일정을 완료 처리
      const visit = ex.visitId ? visits.find((v) => v.id === ex.visitId) : null
      if (visit) await ops.save('visits', { ...visit, status: 'done', executionId: saved.id, date: saved.date })
      onClose(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={ex.id ? '전후 보고서 수정' : '전후 보고서 작성'} onClose={() => onClose()} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="현장">
            <select className={inputCls} value={ex.siteId} onChange={(e) => setEx({ ...ex, siteId: e.target.value, serviceId: '' })}>
              <option value="">선택</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Label>
          <Label text="작업일">
            <input type="date" className={inputCls} value={ex.date} onChange={(e) => setEx({ ...ex, date: e.target.value })} />
          </Label>
          <Label text="작업 항목">
            <select className={inputCls} value={ex.serviceId || ''} onChange={(e) => setEx({ ...ex, serviceId: e.target.value })}>
              <option value="">직접 입력 (일회성 작업)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Label>
          {!ex.serviceId ? (
            <Label text="작업명">
              <input className={inputCls} value={ex.serviceName || ''} onChange={(e) => setEx({ ...ex, serviceName: e.target.value })} placeholder="예: 회의실 카펫 얼룩 제거" />
            </Label>
          ) : (
            <Label text="작업자">
              <input className={inputCls} value={ex.worker || ''} onChange={(e) => setEx({ ...ex, worker: e.target.value })} placeholder="예: 홍길동 외 2명" />
            </Label>
          )}
          {!ex.serviceId && (
            <Label text="작업자">
              <input className={inputCls} value={ex.worker || ''} onChange={(e) => setEx({ ...ex, worker: e.target.value })} placeholder="예: 홍길동 외 2명" />
            </Label>
          )}
          <Label text="작업 내용 · 특이사항" className="sm:col-span-2">
            <textarea rows={3} className={inputCls} value={ex.note || ''} onChange={(e) => setEx({ ...ex, note: e.target.value })} placeholder="예: 11층 카펫 전체 세척, 커피 얼룩 3곳 집중 처리. 건조까지 약 6시간 소요." />
          </Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['before', '작업 전'],
            ['after', '작업 후']
          ].map(([key, label]) => (
            <div key={key}>
              <p className="mb-1.5 text-xs font-medium text-base-300">
                {label} <span className="font-normal text-base-500">({ex[key].length}개)</span>
              </p>
              <MediaPicker
                media={ex[key]}
                onBusyChange={setUploading}
                onChange={(upd) => setEx((x) => ({ ...x, [key]: typeof upd === 'function' ? upd(x[key]) : upd }))}
              />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-base-500">같은 위치를 같은 각도로 찍어 순서대로 올리면 보고서에서 전/후가 나란히 짝지어져요.</p>

        {error && <p className="text-xs text-amber-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || uploading} className={btnPrimary}>
            {saving ? '저장 중…' : uploading ? '첨부 올리는 중…' : '저장'}
          </button>
          <button onClick={() => onClose()} className={btnGhost}>
            취소
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CopyLink({ id }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportLink(id))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt('아래 링크를 복사해서 보내 주세요', reportLink(id))
    }
  }
  return (
    <button onClick={copy} className={btnPrimary + ' !px-3 !py-1.5 !text-xs'}>
      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '복사됨' : '링크 복사'}
    </button>
  )
}

const newExecution = (prefill = {}) => ({
  siteId: '',
  serviceId: '',
  serviceName: '',
  date: todayStr(),
  worker: '',
  note: '',
  before: [],
  after: [],
  ...prefill
})

export default function RoundsReports({ data, ops, prefill, clearPrefill }) {
  const { sites, visits, executions } = data
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('')
  const [justSaved, setJustSaved] = useState(null)

  useEffect(() => {
    if (prefill) {
      setModal(newExecution(prefill))
      clearPrefill()
    }
  }, [prefill])

  const siteName = (ex) => sites.find((s) => s.id === ex.siteId)?.name || ex.siteName || '(삭제된 현장)'
  const list = executions.filter((e) => !filter || e.siteId === filter).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const activeSites = sites.filter((s) => s.active !== false)

  const remove = async (ex) => {
    if (!confirm('이 보고서를 삭제할까요? 업체에 보낸 링크도 더 이상 열리지 않아요.')) return
    await ops.remove('executions', ex.id)
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select className={inputCls + ' !w-auto !border-page-border !bg-page-soft !text-page-text'} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">전체 현장</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {list.length > 0 && (
            <PrintButton
              targetId="print-executions"
              title={`전후 보고서 목록_${filter ? sites.find((s) => s.id === filter)?.name : '전체'}_${new Date().toLocaleDateString('sv-SE')}`}
            />
          )}
          <button onClick={() => setModal(newExecution({ siteId: filter }))} className={btnPrimary}>
            <Plus size={14} /> 전후 보고서 작성
          </button>
        </div>
      </div>

      {justSaved && (
        <Card className="mb-3 border-mist-500/40">
          <p className="text-sm font-medium">보고서가 저장됐어요.</p>
          <p className="mt-0.5 text-xs text-base-400">이달 월간 보고서에 자동으로 들어가요. 바로 보여 주고 싶으면 링크를 복사해 보내면 로그인 없이 볼 수 있어요.</p>
          <div className="mt-2 flex gap-2">
            <CopyLink id={justSaved.id} />
            <button onClick={() => setJustSaved(null)} className={btnGhost + ' !py-1.5 !text-xs'}>
              닫기
            </button>
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-xs text-base-500">
            아직 작성된 전후 보고서가 없어요.
            <br />
            카펫 세척처럼 정기 서비스를 하거나 요청 작업을 처리했을 때 전/후 사진으로 남겨 보세요.
          </p>
        </Card>
      ) : (
        <div id="print-executions" className="grid gap-3 md:grid-cols-2">
          {list.map((ex) => (
            <Card key={ex.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {ex.ticketId && <span className="mr-1 rounded bg-amber-400/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-500">요청 처리</span>}
                    {ex.serviceName}
                  </p>
                  <p className="text-[12px] text-base-500">
                    {siteName(ex)} · {fmtDate(ex.date)} {ex.worker && `· ${ex.worker}`}
                  </p>
                </div>
                <div className="no-print flex gap-1">
                  <button onClick={() => setModal({ ...newExecution(), ...ex })} className={btnGhost + ' !px-2 !py-1.5'}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(ex)} className={btnDanger + ' !px-2 !py-1.5'}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-1.5">
                {[
                  ['전', ex.before?.[0]],
                  ['후', ex.after?.[0]]
                ].map(([label, p]) => (
                  <div key={label} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-base-900">
                    {p ? <Thumb m={p} className="h-full w-full" /> : <div className="flex h-full items-center justify-center text-[12px] text-base-600">사진 없음</div>}
                    <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">작업 {label}</span>
                  </div>
                ))}
              </div>
              {ex.note && <p className="mb-2 line-clamp-3 whitespace-pre-line text-[12px] text-base-400">{ex.note}</p>}
              <div className="flex items-center gap-2">
                <span className="no-print flex items-center gap-2">
                  <CopyLink id={ex.id} />
                <a href={reportLink(ex.id)} target="_blank" rel="noreferrer" className={btnGhost + ' !px-3 !py-1.5 !text-xs'}>
                  <ExternalLink size={13} /> 미리보기
                </a>
                </span>
                <span className="ml-auto text-[12px] text-base-500">
                  사진 {ex.before?.length || 0}+{ex.after?.length || 0}장
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <ExecutionModal
          initial={modal}
          sites={activeSites}
          visits={visits}
          ops={ops}
          onClose={(saved) => {
            setModal(null)
            if (saved) setJustSaved(saved)
          }}
        />
      )}
    </div>
  )
}
