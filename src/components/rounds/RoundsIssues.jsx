import { useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, Phone, ChevronLeft, ChevronRight, EyeOff } from 'lucide-react'
import { thisMonth, shiftMonth, todayStr, fmtDate, ISSUE_STATUS, ISSUE_SOURCES, issueItemCount } from '../../lib/rounds'
import { Modal, Label, Card, inputCls, btnPrimary, btnGhost, btnDanger } from './ui'
import { MediaPicker, MediaView } from './Media'
import PrintButton from '../PrintButton'

const STATUS_CLS = {
  done: 'bg-teal-400/10 text-teal-500',
  progress: 'bg-amber-400/10 text-amber-500',
  check: 'bg-red-400/10 text-red-500'
}

const newItem = () => ({ id: crypto.randomUUID(), issue: '', action: '', status: 'done' })

// 통화(보고) 1건 = 현장 · 날짜 · 보고자 + 이슈 여러 개
function IssueModal({ initial, sites, ops, onClose }) {
  const [r, setR] = useState({ ...initial, items: initial.items?.length ? initial.items.map((i) => ({ ...i })) : [newItem()] })
  const [media, setMedia] = useState(initial.media || [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const site = sites.find((s) => s.id === r.siteId)
  const setItem = (i, patch) => setR((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }))

  const pickSite = (siteId) => {
    const s = sites.find((x) => x.id === siteId)
    // 보고자를 비워 뒀으면 그 현장 팀장으로 채움
    setR((x) => ({ ...x, siteId, reporter: x.reporter || s?.teamLeaderName || '' }))
  }

  const save = async () => {
    const items = r.items.filter((it) => it.issue.trim() || it.action.trim())
    if (!r.siteId || !r.date) return setError('현장과 날짜를 골라 주세요.')
    if (!items.length) return setError('이슈 내용을 하나 이상 적어 주세요.')
    setSaving(true)
    setError(null)
    try {
      try {
        localStorage.setItem('daechinam_last_issue_site', r.siteId)
      } catch {
        /* 저장 안 돼도 무시 */
      }
      await ops.save('issues', { ...r, items: items.map((it) => ({ ...it, issue: it.issue.trim(), action: it.action.trim() })), media })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm('이 기록을 삭제할까요?')) return
    await ops.remove('issues', r.id)
    onClose()
  }

  return (
    <Modal title={r.id ? '현장 이슈 수정' : '현장 이슈 기록 (통화·보고 내용)'} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="현장">
            <select className={inputCls} value={r.siteId} onChange={(e) => pickSite(e.target.value)}>
              <option value="">선택</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Label>
          <Label text="날짜 (이슈가 있었던 날 또는 보고 받은 날)">
            <input type="date" className={inputCls} value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
          </Label>
          <Label text="보고자">
            <input
              className={inputCls}
              value={r.reporter}
              onChange={(e) => setR({ ...r, reporter: e.target.value })}
              placeholder={site?.teamLeaderName ? `예: ${site.teamLeaderName} 팀장` : '예: 김OO 팀장'}
            />
          </Label>
          <Label text="받은 방법">
            <select className={inputCls} value={r.source} onChange={(e) => setR({ ...r, source: e.target.value })}>
              {Object.entries(ISSUE_SOURCES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Label>
        </div>

        <div className="space-y-2">
          {r.items.map((it, i) => (
            <div key={it.id} className="rounded-lg border border-base-800 bg-base-900 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium text-base-300">이슈 {i + 1}</p>
                {r.items.length > 1 && (
                  <button onClick={() => setR((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }))} className="text-base-500 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                className={inputCls + ' mb-1.5'}
                value={it.issue}
                onChange={(e) => setItem(i, { issue: e.target.value })}
                placeholder="무슨 일이 있었나요? 예: 3층 남자화장실 소변기 막힘"
              />
              <textarea
                rows={2}
                className={inputCls + ' mb-1.5'}
                value={it.action}
                onChange={(e) => setItem(i, { action: e.target.value })}
                placeholder="어떻게 처리했나요? 예: 팀장이 뚫음 처리 후 시설팀에 배관 점검 요청"
              />
              <div className="flex gap-1">
                {Object.entries(ISSUE_STATUS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setItem(i, { status: k })}
                    className={`focus-ring flex-1 rounded-md border py-1 text-[12px] ${it.status === k ? `${STATUS_CLS[k]} border-current font-medium` : 'border-base-700 text-base-500'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setR((x) => ({ ...x, items: [...x.items, newItem()] }))} className="flex items-center gap-1 text-xs text-mist-500">
            <Plus size={13} /> 이슈 추가 (한 통화에 여러 건)
          </button>
        </div>

        <div>
          <p className="mb-1 text-xs text-base-400">팀장이 보내 준 사진·영상 (선택)</p>
          <MediaPicker media={media} onChange={setMedia} onBusyChange={setUploading} />
        </div>

        <label className="flex items-start gap-1.5 text-xs text-base-300">
          <input type="checkbox" className="mt-0.5" checked={r.showInReport !== false} onChange={(e) => setR({ ...r, showInReport: e.target.checked })} />
          <span>
            월간 보고서에 포함
            <span className="block text-[12px] text-base-500">체크를 풀면 내부 기록으로만 남고 업체에는 보이지 않아요. 보고자 이름은 업체에 보이지 않아요.</span>
          </span>
        </label>

        {error && <p className="text-xs text-amber-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={save} disabled={saving || uploading} className={btnPrimary}>
            {saving ? '저장 중…' : uploading ? '첨부 올리는 중…' : '저장'}
          </button>
          <button onClick={onClose} className={btnGhost}>
            취소
          </button>
          {r.id && (
            <button onClick={remove} className={`${btnDanger} ml-auto`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function RoundsIssues({ data, ops }) {
  const { sites, issues } = data
  const [month, setMonth] = useState(thisMonth())
  const [siteFilter, setSiteFilter] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [modal, setModal] = useState(null)

  const activeSites = sites.filter((s) => s.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const siteName = (id) => sites.find((s) => s.id === id)?.name || '(삭제된 현장)'

  const list = useMemo(
    () =>
      issues
        .filter((x) => x.date?.startsWith(month))
        .filter((x) => !siteFilter || x.siteId === siteFilter)
        .filter((x) => !onlyOpen || (x.items || []).some((it) => it.status !== 'done'))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')),
    [issues, month, siteFilter, onlyOpen]
  )
  const openCount = issues.flatMap((x) => x.items || []).filter((it) => it.status !== 'done').length

  const openNew = () => {
    let last = ''
    try {
      last = localStorage.getItem('daechinam_last_issue_site') || ''
    } catch {
      /* 무시 */
    }
    const siteId = siteFilter || (activeSites.some((s) => s.id === last) ? last : '')
    const s = sites.find((x) => x.id === siteId)
    setModal({ siteId, date: todayStr(), reporter: s?.teamLeaderName || '', source: 'phone', items: [], media: [], showInReport: true })
  }

  const [y, m] = month.split('-')

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setMonth(shiftMonth(month, -1))} className={btnGhost + ' !px-2'}>
              <ChevronLeft size={16} />
            </button>
            <p className="min-w-[110px] text-center text-base font-semibold">
              {y}년 {Number(m)}월
            </p>
            <button onClick={() => setMonth(shiftMonth(month, 1))} className={btnGhost + ' !px-2'}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {list.length > 0 && <PrintButton targetId="print-issues" title={`현장 이슈 기록_${siteFilter ? siteName(siteFilter) : '전체'}_${month}`} />}
            <button onClick={openNew} className={btnPrimary}>
              <Phone size={14} /> 통화 내용 기록
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select className={inputCls + ' !w-auto !py-1.5 !text-xs'} value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="">전체 현장</option>
            {activeSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-base-400">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> 조치 중·확인 필요만
          </label>
          {openCount > 0 && <span className="ml-auto text-[12px] text-amber-500">미완료 이슈 전체 {openCount}건</span>}
        </div>
        <p className="mt-3 text-[12px] text-base-500">
          팀장과 통화하면서 들은 그날·그 주의 이슈와 처리 내용을 적어 두세요. 한 번 통화에 여러 건을 함께 적을 수 있고, "월간 보고서에 포함"한 기록은 그달 보고서의 "현장 이슈 · 조치
          내역"에 자동으로 들어가요.
        </p>
      </Card>

      {list.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-xs text-base-500">이 달 기록이 없어요. 팀장과 통화한 뒤 "통화 내용 기록"을 눌러 남겨 보세요.</p>
        </Card>
      ) : (
        <div id="print-issues" className="space-y-2">
          {list.map((x) => (
            <Card key={x.id} className="!p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {siteName(x.siteId)} <span className="font-normal text-base-500">· {fmtDate(x.date)}</span>
                  </p>
                  <p className="text-[12px] text-base-500">
                    {[x.reporter, ISSUE_SOURCES[x.source]].filter(Boolean).join(' · ')}
                    {x.showInReport === false && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-base-400">
                        <EyeOff size={10} /> 내부 기록
                      </span>
                    )}
                  </p>
                </div>
                <button onClick={() => setModal(x)} className={btnGhost + ' no-print !px-2 !py-1.5'}>
                  <Pencil size={13} />
                </button>
              </div>
              <div className="space-y-1.5">
                {(x.items || []).map((it) => (
                  <div key={it.id} className="rounded-lg bg-base-900 px-2.5 py-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-line text-base-200">{it.issue || '-'}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${STATUS_CLS[it.status] || STATUS_CLS.done}`}>{ISSUE_STATUS[it.status] || '조치 완료'}</span>
                    </div>
                    {it.action && <p className="mt-1 whitespace-pre-line text-base-400">→ {it.action}</p>}
                  </div>
                ))}
              </div>
              {(x.media || []).length > 0 && (
                <div className="mt-2">
                  <MediaView media={x.media} size="h-16 w-16" name={`${siteName(x.siteId).replace(/\s+/g, '')}_현장이슈_${x.date}`} />
                </div>
              )}
            </Card>
          ))}
          <p className="text-right text-[12px] text-base-500">
            {list.length}회 보고 · 이슈 {issueItemCount(list)}건
          </p>
        </div>
      )}

      {modal && <IssueModal initial={modal} sites={activeSites} ops={ops} onClose={() => setModal(null)} />}
    </div>
  )
}
