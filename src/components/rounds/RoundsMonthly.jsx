import { useState } from 'react'
import { ChevronLeft, ChevronRight, Printer, Check, BellRing, Copy, Sparkles, Eye, EyeOff, TriangleAlert, CalendarRange } from 'lucide-react'
import { thisMonth, shiftMonth, collectMonth, SCORE_LABEL, stars, portalLink, reportLink, fmtDateTime, VAT_MODES, won, chargeTotals } from '../../lib/rounds'
import { Modal, Card, Label, inputCls, btnPrimary, btnGhost } from './ui'
import MonthlyReportDoc, { scopeToWorkLines } from './MonthlyReportDoc'
import PrintButton, { printElement } from '../PrintButton'

// 기록을 바탕으로 총평 초안 만들기 (자유롭게 고쳐 쓰면 됨)
// 기록을 바탕으로 총평 초안 (회사 보고서 문체 "~함") — 자유롭게 고쳐 쓰면 됨
function draftSummary(siteName, month, d) {
  const done = d.tickets.filter((t) => t.status === 'done').length
  const issueItems = d.issues.flatMap((x) => x.items || [])
  const parts = []
  if (!d.tickets.length && !issueItems.length) parts.push('특이사항 없이 정기청소를 진행하고 있으며')
  else parts.push('정기청소를 계약 범위에 따라 정상 진행하고 있으며')
  if (d.tickets.length) parts.push(`접수된 요청사항 ${d.tickets.length}건 중 ${done}건을 조치 완료하였고`)
  if (issueItems.length) parts.push(`현장 이슈 ${issueItems.length}건에 대해 즉시 대응하였으며`)
  if (d.executions.length) parts.push(`${d.executions.map((e) => e.serviceName.replace(/^\[[^\]]*\]\s*/, '')).join(', ')} 작업을 추가로 진행하였음.`)
  let text = parts.join(' ')
  if (!/음\.$/.test(text)) text += ' 관리자 및 작업자의 요청사항을 빠른 시일 내에 해결할 수 있도록 함.'
  else text += '\n앞으로도 관리자 및 작업자의 요청사항을 빠른 시일 내에 해결할 수 있도록 함.'
  return text
}

// 장비·소모품 청구 내역 입력 — 단가표에서 고르고 수량만 넣으면 금액 자동
function ChargeEditor({ billing, charges, prevCharges, onChange, note, onNote }) {
  const vat = billing.vat || 'separate'
  const t = chargeTotals(charges, vat)
  const set = (i, patch) => onChange(charges.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const add = (it) => onChange([...charges, { id: crypto.randomUUID(), name: it?.name || '', unit: it?.unit || '개', qty: 1, price: it?.price ?? '' }])
  return (
    <div className="rounded-lg border border-mist-500/30 bg-mist-500/5 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-base-200">장비·소모품 청구 내역</p>
        <span className="text-[12px] text-base-500">{VAT_MODES[vat]}</span>
      </div>
      <div className="space-y-1.5">
        {charges.map((c, i) => (
          <div key={c.id || i} className="grid grid-cols-[1fr_3.5rem_3.5rem_5.5rem_auto] items-center gap-1.5">
            <input className={inputCls + ' !py-1.5'} value={c.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="품목" />
            <input type="number" min={0} className={inputCls + ' !px-2 !py-1.5'} value={c.qty} onChange={(e) => set(i, { qty: e.target.value })} aria-label="수량" />
            <input className={inputCls + ' !px-2 !py-1.5'} value={c.unit} onChange={(e) => set(i, { unit: e.target.value })} aria-label="단위" />
            <input type="number" min={0} className={inputCls + ' !px-2 !py-1.5'} value={c.price} onChange={(e) => set(i, { price: e.target.value })} aria-label="단가" placeholder="단가" />
            <button onClick={() => onChange(charges.filter((_, j) => j !== i))} className="px-1 text-base-500 hover:text-red-500" aria-label="삭제">
              ✕
            </button>
          </div>
        ))}
      </div>
      {charges.length > 0 && <p className="mt-1 text-[11px] text-base-500">품목 · 수량 · 단위 · 단가 순서</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(billing.items || []).map((it) => (
          <button key={it.id} onClick={() => add(it)} className="rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[12px] text-base-300 hover:border-mist-500">
            + {it.name} <span className="text-base-500">{won(it.price)}</span>
          </button>
        ))}
        <button onClick={() => add()} className="rounded-md px-2 py-1 text-[12px] text-mist-500">
          + 직접 입력
        </button>
        {prevCharges.length > 0 && charges.length === 0 && (
          <button onClick={() => onChange(prevCharges.map((c) => ({ ...c, id: crypto.randomUUID() })))} className="rounded-md px-2 py-1 text-[12px] text-mist-500 underline">
            지난달 내역 그대로 불러오기
          </button>
        )}
      </div>
      {charges.length > 0 && (
        <div className="mt-3 space-y-0.5 border-t border-base-800 pt-2 text-right text-xs text-base-300">
          {vat !== 'none' && (
            <p>
              공급가 {won(t.supply)} · 부가세 {won(t.tax)}
            </p>
          )}
          <p className="text-sm font-semibold text-base-100">청구 합계 {won(t.total)}</p>
        </div>
      )}
      <input className={inputCls + ' mt-2 !py-1.5'} value={note} onChange={(e) => onNote(e.target.value)} placeholder="청구 메모 (선택, 예: 12월 세금계산서 발행 예정)" />
    </div>
  )
}

function ReportEditor({ site, month, initial, data, ops, onClose, onGoCalendar, prevCharges = [] }) {
  const [r, setR] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [warnNoInspection, setWarnNoInspection] = useState(false)
  const noInspection = data.inspections.length === 0
  const longCycle = (Number(site.inspectCycleMonths) || 1) > 1

  // 점검 0회면 바로 공개하지 않고 경고부터
  const publish = () => {
    if (noInspection && !warnNoInspection) return setWarnNoInspection(true)
    setWarnNoInspection(false)
    save({ published: true })
  }

  const save = async (patch = {}) => {
    const next = { ...r, ...patch }
    try {
      if (next.manager) localStorage.setItem('daechinam_report_manager', next.manager)
    } catch {
      /* 무시 */
    }
    if (patch.published && !r.published) next.publishedAt = new Date().toISOString()
    setSaving(true)
    setError(null)
    try {
      const saved = await ops.save('reports', next)
      setR(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 알림을 안 켠 담당자에게 직접 보낼 수 있도록 보고서 링크 복사
  const copyLink = async () => {
    const code = await ops.ensureAccessCode(site)
    const msg = portalLink(code, 'reports')
    try {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt('아래 내용을 복사해 주세요', msg)
    }
  }

  return (
    <Modal title={`${site.name} · ${Number(month.slice(5))}월 보고서`} onClose={onClose} wide>
      <div className="no-print space-y-3">
        <div className="rounded-lg bg-base-900 px-3 py-2">
          <p className="text-xs text-base-400">업체 평가</p>
          {r.clientRating ? (
            <>
              <p className="mt-0.5 text-sm">
                <span className="text-mist-500">{stars(r.clientRating.score)}</span> <span className="font-medium">{SCORE_LABEL[r.clientRating.score]}</span>
                <span className="ml-1 text-xs text-base-500">
                  {r.clientRating.name && `${r.clientRating.name} · `}
                  {fmtDateTime(r.clientRating.at)}
                </span>
              </p>
              {r.clientRating.comment && <p className="mt-1 whitespace-pre-line text-xs text-base-300">"{r.clientRating.comment}"</p>}
            </>
          ) : (
            <p className="mt-0.5 text-xs text-base-500">{r.published ? '업체가 아직 평가하지 않았어요.' : '보고서를 공개하면 업체 페이지에서 업체가 직접 평가해요.'}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Label text="담당자 (우리 회사)">
            <input className={inputCls} value={r.manager || ''} onChange={(e) => setR({ ...r, manager: e.target.value })} placeholder="예: 정성수" />
          </Label>
          <Label text="작업자 (현장)">
            <input className={inputCls} value={r.workerNames || ''} onChange={(e) => setR({ ...r, workerNames: e.target.value })} placeholder="예: 홍길동" />
          </Label>
          <Label text="작성일" className="col-span-2 sm:col-span-1">
            <input type="date" className={inputCls} value={r.writtenDate || ''} onChange={(e) => setR({ ...r, writtenDate: e.target.value })} />
          </Label>
        </div>

        <Label text="1. 작업내용 (비워 두면 청소 범위에서 자동으로 들어가요)">
          <textarea
            rows={4}
            className={inputCls}
            value={r.workContent || ''}
            onChange={(e) => setR({ ...r, workContent: e.target.value })}
            placeholder={scopeToWorkLines(site.scope).map((l) => `- ${l}`).join('\n') || '- 1층 로비 및 휴게실 위생관리\n- 1, 2층 화장실 위생관리'}
          />
        </Label>
        {(site.scope || []).length > 0 && (
          <button
            onClick={() => setR({ ...r, workContent: scopeToWorkLines(site.scope).map((l) => `- ${l}`).join('\n') })}
            className="-mt-1 flex items-center gap-1 text-[12px] text-mist-500 hover:underline"
          >
            <Sparkles size={12} /> 청소 범위로 채운 뒤 고쳐 쓰기
          </button>
        )}

        <div>
          <p className="mb-1 text-xs text-base-400">2. 특이사항</p>
          <p className="mb-1.5 rounded-lg bg-base-900 px-2.5 py-1.5 text-[12px] text-base-400">
            자동으로 들어가요: 본사 점검 {data.inspections.length}회 · 현장 이슈 {data.issues.reduce((n, x) => n + (x.items || []).length, 0)}건 · 추가 작업 {data.executions.length}건
          </p>
          <textarea
            rows={2}
            className={inputCls}
            value={r.specialNotes || ''}
            onChange={(e) => setR({ ...r, specialNotes: e.target.value })}
            placeholder="그 밖에 적을 내용 (한 줄에 하나씩)"
          />
        </div>

        <Label text="3. 총평">
          <textarea rows={4} className={inputCls} value={r.summary} onChange={(e) => setR({ ...r, summary: e.target.value })} />
        </Label>
        <button onClick={() => setR({ ...r, summary: draftSummary(site.name, month, data) })} className="flex items-center gap-1 text-[12px] text-mist-500 hover:underline">
          <Sparkles size={12} /> 이번 달 기록으로 초안 채우기
        </button>
        <div>
          <p className="mb-1 text-xs text-base-400">제안사항 · 금액안내 (정기청소 업체 할인 적용)</p>
          <div className="space-y-1.5">
            {(r.proposals || []).map((pr, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  className={inputCls}
                  value={pr.text}
                  onChange={(e) => setR({ ...r, proposals: r.proposals.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  placeholder="예: 연말 카펫 전체 세척"
                />
                <input
                  className={inputCls + ' !w-36 shrink-0'}
                  value={pr.price}
                  onChange={(e) => setR({ ...r, proposals: r.proposals.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })}
                  placeholder="예: 45만원 (VAT 별도)"
                />
                <button onClick={() => setR({ ...r, proposals: r.proposals.filter((_, j) => j !== i) })} className="shrink-0 px-1 text-base-500 hover:text-red-500" aria-label="삭제">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setR({ ...r, proposals: [...(r.proposals || []), { text: '', price: '' }] })} className="mt-1.5 text-[12px] text-mist-500 hover:underline">
            + 제안 추가 (없으면 "별도의 제안사항 없음"으로 나가요)
          </button>
        </div>

        {site.billing?.enabled && (
          <ChargeEditor
            billing={site.billing}
            charges={r.charges || []}
            prevCharges={prevCharges}
            onChange={(charges) => setR((x) => ({ ...x, charges }))}
            note={r.chargeNote || ''}
            onNote={(chargeNote) => setR((x) => ({ ...x, chargeNote }))}
          />
        )}

        <Label text="다음 달 계획 · 건의 사항 (예정된 일정은 자동으로 들어가요)">
          <textarea rows={2} className={inputCls} value={r.nextPlan} onChange={(e) => setR({ ...r, nextPlan: e.target.value })} placeholder="예: 연말 대청소 일정 협의 요청드립니다." />
        </Label>
        {error && <p className="text-xs text-amber-500">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save()} disabled={saving} className={btnGhost}>
            {saving ? '저장 중…' : '임시 저장'}
          </button>
          {r.published ? (
            <button onClick={() => save({ published: false })} disabled={saving} className={btnGhost}>
              <EyeOff size={14} /> 공개 취소
            </button>
          ) : (
            <button onClick={publish} disabled={saving} className={btnPrimary}>
              <Eye size={14} /> 저장하고 업체에 공개
            </button>
          )}
          <button onClick={() => printElement('print-monthly-doc', `${site.name}_${month}_월간보고서`)} className={`${btnGhost} ml-auto`}>
            <Printer size={14} /> PDF 저장
          </button>
        </div>
        {noInspection && !r.published && !warnNoInspection && (
          <p className="flex items-center gap-1 text-xs text-amber-500">
            <TriangleAlert size={13} /> 이번 달 점검 기록이 0회예요. 공개 전에 월간 일정에서 점검을 완료 처리해 주세요.
          </p>
        )}
        {warnNoInspection && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
              <TriangleAlert size={15} /> 점검 기록 없이 공개할까요?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-base-300">
              {longCycle
                ? `${site.name}은(는) ${site.inspectCycleMonths}개월마다 점검하는 현장이라, 다른 특이사항이 없으면 보고서에 "이번 달은 정기 점검 대상 월이 아님"으로 나가요.`
                : '이대로 공개하면 보고서의 특이사항에 본사 점검 내용이 하나도 들어가지 않아서, 이번 달 점검을 하지 않은 것처럼 보일 수 있어요.'}
            </p>
            <p className="mt-1 text-xs text-base-500">점검을 했는데 기록만 안 했다면, 월간 일정에서 해당 점검을 "완료"로 바꾸고 점검 결과를 적어 주세요.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  onClose()
                  onGoCalendar?.()
                }}
                className={btnPrimary + ' !py-1.5 !text-xs'}
              >
                <CalendarRange size={13} /> 월간 일정에서 점검 기록하기
              </button>
              <button onClick={publish} disabled={saving} className={btnGhost + ' !py-1.5 !text-xs'}>
                그래도 공개
              </button>
              <button onClick={() => setWarnNoInspection(false)} className="px-2 text-xs text-base-500">
                취소
              </button>
            </div>
          </div>
        )}
        {r.published && (
          <div className="rounded-lg border border-mist-500/40 bg-mist-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <BellRing size={13} className="text-mist-500" /> 업체 전용 페이지에 공개됐어요.
            </p>
            <p className="mt-0.5 text-[12px] text-base-500">알림을 켠 담당자에게는 "월간 보고서 등록" 알림이 바로 전송돼요.</p>
            <button onClick={copyLink} className={`${btnGhost} mt-2 !py-1.5 !text-xs`}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '복사됨' : '보고서 링크 복사'}
            </button>
          </div>
        )}
        <p className="pt-2 text-xs font-semibold text-base-300">미리보기</p>
      </div>
      <div id="print-monthly-doc" className="rounded-xl border border-base-800 bg-base-950 p-4">
        <MonthlyReportDoc siteName={site.name} month={month} report={r} data={data} serviceReportLink={reportLink} inspectCycleMonths={site.inspectCycleMonths} scope={site.scope} vat={site.billing?.enabled ? site.billing.vat || 'separate' : null} />
      </div>
    </Modal>
  )
}

const lastManager = () => {
  try {
    return localStorage.getItem('daechinam_report_manager') || ''
  } catch {
    return ''
  }
}

export default function RoundsMonthly({ data, ops, onGoCalendar }) {
  const { sites, visits, tickets, executions, reports, issues } = data
  const [month, setMonth] = useState(shiftMonth(thisMonth(), new Date().getDate() <= 10 ? -1 : 0))
  const [editing, setEditing] = useState(null)
  const [y, m] = month.split('-')

  const activeSites = sites.filter((s) => s.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const rows = activeSites.map((site) => {
    const d = collectMonth({ siteId: site.id, month, visits, tickets, executions, issues })
    const report = reports.find((r) => r.siteId === site.id && r.month === month)
    return { site, d, report }
  })
  const publishedCount = rows.filter((r) => r.report?.published).length

  const open = ({ site, report }) =>
    setEditing({
      site,
      initial: report || {
        siteId: site.id,
        month,
        summary: '',
        nextPlan: '',
        published: false,
        manager: lastManager(),
        workerNames: site.teamLeaderName || '',
        writtenDate: new Date().toLocaleDateString('sv-SE'),
        charges: [],
        chargeNote: '',
        workContent: '',
        specialNotes: '',
        proposals: []
      }
    })

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
          <div className="flex items-center gap-3">
            <p className="text-xs text-base-400">
              보고서 공개 <span className="font-semibold text-mist-500">{publishedCount}</span> / {rows.length}곳
            </p>
            <PrintButton targetId="print-monthly-list" title={`월간 보고서 현황_${month}`} label="현황 PDF" small />
          </div>
        </div>
        <p className="mt-3 text-[12px] text-base-500">
          점검 기록(월간 일정의 점검 메모), 문의·요청 처리 내역, 현장 이슈(팀장 보고), 전후 보고서, 다음 달 일정이 자동으로 들어가요. 종합 평가와 총평만 적고 공개하면 업체 전용 페이지에서 바로 볼 수 있어요.
          매월 초에는 지난달이 먼저 보여요.
        </p>
      </Card>

      <div id="print-monthly-list" className="grid gap-2 md:grid-cols-2">
        {rows.map((row) => {
          const { site, d, report } = row
          const status = report?.published ? ['공개됨', 'bg-teal-400/10 text-teal-500'] : report ? ['작성 중', 'bg-amber-400/10 text-amber-500'] : ['작성 전', 'bg-base-800 text-base-400']
          return (
            <button key={site.id} onClick={() => open(row)} className="focus-ring block text-left">
              <Card className="!p-3 hover:border-mist-500/50">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold">{site.name}</p>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] ${status[1]}`}>
                    {report?.published && <Check size={10} className="mr-0.5 inline" />}
                    {status[0]}
                  </span>
                </div>
                <p className="text-[12px] text-base-500">
                  <span className={d.inspections.length === 0 && (Number(site.inspectCycleMonths) || 1) === 1 ? 'font-medium text-amber-500' : ''}>점검 {d.inspections.length}회</span> · 문의 {d.tickets.length}건 (완료 {d.tickets.filter((t) => t.status === 'done').length}) · 현장 이슈 {d.issues.reduce((n, x) => n + (x.items || []).length, 0)}건 · 추가 작업 {d.executions.length}건
                  {report?.clientRating ? ` · 업체 평가 ${'★'.repeat(report.clientRating.score)}` : report?.published ? ' · 평가 대기' : ''}
                  {site.billing?.enabled && (
                    <span className="font-medium text-mist-500"> · 청구 {(report?.charges || []).length ? won(chargeTotals(report.charges, site.billing.vat).total) : '미입력'}</span>
                  )}
                </p>
              </Card>
            </button>
          )
        })}
      </div>

      {editing && (
        <ReportEditor
          site={editing.site}
          month={month}
          initial={editing.initial}
          data={collectMonth({ siteId: editing.site.id, month, visits, tickets, executions, issues })}
          ops={ops}
          onClose={() => setEditing(null)}
          onGoCalendar={onGoCalendar}
          prevCharges={reports.find((x) => x.siteId === editing.site.id && x.month === shiftMonth(month, -1))?.charges || []}
        />
      )}
    </div>
  )
}
