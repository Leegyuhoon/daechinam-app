import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Wand2, Plus, Check, Camera, Trash2, Printer } from 'lucide-react'
import {
  thisMonth,
  shiftMonth,
  daysInMonth,
  weekdayOf,
  pad,
  todayStr,
  fmtDate,
  WEEKDAYS,
  autoPlan,
  lastInspection,
  nextInspectionDue,
  needsInspectionIn,
  servicesDueIn,
  cycleLabel
} from '../../lib/rounds'
import { printElement } from '../PrintButton'
import { Modal, Label, Card, inputCls, btnPrimary, btnGhost, btnDanger, TYPE_STYLE, STATUS_LABEL } from './ui'

function VisitChip({ visit, siteName, onClick }) {
  const t = TYPE_STYLE[visit.type] || TYPE_STYLE.inspection
  const done = visit.status === 'done'
  const canceled = visit.status === 'canceled'
  return (
    <button
      onClick={onClick}
      className={`focus-ring flex w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-left text-[12px] ${t.cls} ${
        canceled ? 'line-through opacity-40' : ''
      }`}
      title={`${siteName} · ${visit.type === 'service' ? visit.serviceName : '점검'}`}
    >
      {done && <Check size={11} className="shrink-0" />}
      <span className="truncate">
        {siteName}
        {visit.type === 'service' && <span className="opacity-70"> · {visit.serviceName}</span>}
      </span>
    </button>
  )
}

function VisitModal({ initial, sites, onClose, ops, onWriteReport }) {
  const [v, setV] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const site = sites.find((s) => s.id === v.siteId)
  const services = site?.services || []
  const isNew = !v.id

  const save = async (patch = {}) => {
    const next = { ...v, ...patch }
    if (!next.siteId || !next.date) return setError('현장과 날짜를 선택해주세요.')
    if (next.type === 'service' && !next.serviceId) return setError('서비스 항목을 선택해주세요. (현장·서비스 항목 탭에서 먼저 등록)')
    if (next.type === 'service') next.serviceName = services.find((s) => s.id === next.serviceId)?.name || next.serviceName
    setSaving(true)
    setError(null)
    try {
      const saved = await ops.save('visits', next)
      if (saved.type === 'service' && saved.status === 'done') await ops.markServiceDone(saved.siteId, saved.serviceId, saved.date)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm('이 일정을 삭제할까요?')) return
    await ops.remove('visits', v.id)
    onClose()
  }

  return (
    <Modal title={isNew ? '일정 추가' : '일정'} onClose={onClose}>
      <div className="space-y-3">
        <Label text="현장">
          <select className={inputCls} value={v.siteId} onChange={(e) => setV({ ...v, siteId: e.target.value, serviceId: '' })}>
            <option value="">선택</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label text="날짜">
            <input type="date" className={inputCls} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          </Label>
          <Label text="구분">
            <select className={inputCls} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
              <option value="inspection">점검 방문</option>
              <option value="service">서비스 실행</option>
            </select>
          </Label>
        </div>
        {v.type === 'service' && (
          <Label text="서비스 항목">
            <select className={inputCls} value={v.serviceId || ''} onChange={(e) => setV({ ...v, serviceId: e.target.value })}>
              <option value="">선택</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({cycleLabel(s.cycleMonths)})
                </option>
              ))}
            </select>
          </Label>
        )}
        <Label text={v.type === 'inspection' ? '점검 결과 (점검 완료 시 월간 보고서에 그대로 들어가요)' : '메모'}>
          <textarea
            rows={3}
            className={inputCls}
            value={v.memo || ''}
            onChange={(e) => setV({ ...v, memo: e.target.value })}
            placeholder={v.type === 'inspection' ? '예: 화장실·탕비실 상태 양호. 3층 복도 모서리 먼지 → 근무자에게 전달 완료.' : '예: 작업 시간, 준비물'}
          />
        </Label>
        {!isNew && (
          <div className="flex gap-1 rounded-lg bg-base-900 p-1">
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setV({ ...v, status: key })}
                className={`focus-ring flex-1 rounded-md py-1.5 text-xs ${v.status === key ? 'bg-base-950 font-medium shadow-sm' : 'text-base-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-amber-500">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button disabled={saving} onClick={() => save()} className={btnPrimary}>
            {saving ? '저장 중…' : '저장'}
          </button>
          {!isNew && v.status !== 'done' && (
            <button disabled={saving} onClick={() => save({ status: 'done' })} className={btnGhost}>
              <Check size={14} /> 완료 처리
            </button>
          )}
          {!isNew && v.type === 'service' && (
            <button
              onClick={() => {
                onClose()
                onWriteReport({ siteId: v.siteId, serviceId: v.serviceId, date: v.date, visitId: v.id })
              }}
              className={btnGhost}
            >
              <Camera size={14} /> 전후 보고서 작성
            </button>
          )}
          {!isNew && (
            <button onClick={remove} className={`${btnDanger} ml-auto`}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default function RoundsCalendar({ data, ops, onWriteReport }) {
  const { sites, visits } = data
  const [month, setMonth] = useState(thisMonth())
  const [modal, setModal] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [mobileView, setMobileView] = useState('calendar')
  const [selDate, setSelDate] = useState(todayStr())
  const today = todayStr()
  // 달을 넘기면 선택 날짜도 그 달로 (이번 달이면 오늘)
  useEffect(() => {
    setSelDate(month === thisMonth() ? todayStr() : `${month}-01`)
  }, [month])

  const siteName = (id) => sites.find((s) => s.id === id)?.name || '(삭제된 현장)'
  const activeSites = useMemo(() => sites.filter((s) => s.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)), [sites])

  const monthVisits = useMemo(
    () => visits.filter((v) => v.date?.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date)),
    [visits, month]
  )
  const byDate = useMemo(() => {
    const map = {}
    for (const v of monthVisits) (map[v.date] = map[v.date] || []).push(v)
    return map
  }, [monthVisits])

  // 현장별 이번 달 현황
  const siteRows = activeSites.map((s) => {
    const mine = monthVisits.filter((v) => v.siteId === s.id && v.status !== 'canceled')
    const insp = mine.find((v) => v.type === 'inspection')
    const due = needsInspectionIn(s, visits, month)
    return {
      site: s,
      last: lastInspection(s.id, visits),
      next: nextInspectionDue(s, visits),
      insp,
      due,
      services: servicesDueIn(s, month),
      serviceVisits: mine.filter((v) => v.type === 'service')
    }
  })
  const targetCount = siteRows.filter((r) => r.due || r.insp).length
  const plannedCount = siteRows.filter((r) => r.insp).length
  const doneCount = siteRows.filter((r) => r.insp?.status === 'done').length

  const runAutoPlan = async () => {
    const created = autoPlan(month, sites, visits)
    if (created.length === 0) {
      alert('자동으로 배치할 일정이 없어요. (이미 배치되었거나, 남은 화·수·목이 없어요)')
      return
    }
    const summary = created.map((c) => `${fmtDate(c.date)} ${siteName(c.siteId)} ${c.type === 'service' ? `· ${c.serviceName}` : '점검'}`).join('\n')
    if (!confirm(`아래 ${created.length}건을 일정에 추가할까요? (추가 후 날짜를 옮길 수 있어요)\n\n${summary}`)) return
    setPlanning(true)
    try {
      await ops.saveMany('visits', created)
    } catch (err) {
      alert(err.message)
    } finally {
      setPlanning(false)
    }
  }

  const newVisit = (date) => setModal({ siteId: '', date: date || today, type: 'inspection', status: 'planned', memo: '' })

  // 달력 칸 (앞쪽 빈칸 포함)
  const firstWd = weekdayOf(`${month}-01`)
  const cells = [...Array(firstWd).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad(i + 1)}`)]
  const [y, m] = month.split('-')

  return (
    <div className="space-y-4">
      {/* 상단 — 월 이동 + 요약 */}
      <Card className="no-print">
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
            {month !== thisMonth() && (
              <button onClick={() => setMonth(thisMonth())} className="text-xs text-mist-500 hover:underline">
                이번 달
              </button>
            )}
          </div>
          <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
            <button onClick={runAutoPlan} disabled={planning} className={btnGhost + ' !px-2'}>
              <Wand2 size={14} className="hidden sm:block" /> <span className="whitespace-nowrap">{planning ? '배치 중…' : '자동 배치'}</span>
            </button>
            <button onClick={() => printElement('print-calendar', `정기현장 순회 계획표_${month}`)} className={btnGhost + ' !px-2'}>
              <Printer size={14} className="hidden sm:block" /> <span className="whitespace-nowrap">계획표 PDF</span>
            </button>
            <button onClick={() => newVisit()} className={btnPrimary + ' !px-2'}>
              <Plus size={14} /> <span className="whitespace-nowrap">일정 추가</span>
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['점검 대상', targetCount, 'text-base-100'],
            ['일정 배치', plannedCount, 'text-teal-500'],
            ['점검 완료', doneCount, 'text-mist-500']
          ].map(([label, n, cls]) => (
            <div key={label} className="rounded-lg bg-base-900 py-2">
              <p className={`text-lg font-semibold ${cls}`}>{n}곳</p>
              <p className="text-[12px] text-base-500">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-base-500">
          자동 배치: 이번 달 점검·서비스가 필요한데 일정이 없는 현장을 오늘 이후 화·수·목에 하루 1곳씩 채워 넣어요. 메트라이프 제주처럼 6개월 주기 현장은 첫 방문만 직접
          넣어 주시면 그다음부터 자동으로 계산돼요.
        </p>
      </Card>

      <div id="print-calendar" className="space-y-4">

        {/* 달력 (PC) */}
        <Card className="hidden !p-2 md:block print:block">
          <div className="grid grid-cols-7 text-center text-[12px] text-base-500">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`py-1.5 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-base-800">
            {cells.map((date, i) =>
              date ? (
                <div key={date} className={`group min-h-[92px] bg-base-950 p-1 ${date === today ? 'ring-2 ring-inset ring-mist-500' : ''}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-[12px] ${date < today ? 'text-base-600' : 'text-base-300'}`}>{Number(date.slice(8))}</span>
                    <button onClick={() => newVisit(date)} className="no-print rounded p-0.5 text-base-500 opacity-0 hover:bg-base-800 group-hover:opacity-100">
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {(byDate[date] || []).map((v) => (
                      <VisitChip key={v.id} visit={v} siteName={siteName(v.siteId)} onClick={() => setModal(v)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div key={`e${i}`} className="bg-base-900" />
              )
            )}
          </div>
        </Card>

        {/* 모바일 — 달력 / 목록 전환 */}
        <Card className="!p-3 md:hidden print:hidden">
          <div className="mb-3 flex gap-1 rounded-lg bg-base-900 p-1">
            {[
              ['calendar', '달력'],
              ['list', '목록']
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMobileView(key)}
                className={`focus-ring flex-1 rounded-md py-1.5 text-xs ${mobileView === key ? 'bg-base-950 font-medium shadow-sm' : 'text-base-500'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mobileView === 'calendar' ? (
            <>
              <div className="grid grid-cols-7 text-center text-[11px] text-base-500">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={`pb-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((date, i) => {
                  if (!date) return <div key={`m${i}`} />
                  const list = (byDate[date] || []).filter((v) => v.status !== 'canceled')
                  const wd = i % 7
                  const isSel = date === selDate
                  return (
                    <button
                      key={date}
                      onClick={() => setSelDate(date)}
                      className={`flex aspect-square flex-col items-center justify-start rounded-lg pt-1 text-xs ${
                        isSel ? 'bg-mist-500 text-base-950' : date === today ? 'ring-1 ring-mist-500' : list.length ? 'bg-base-900' : ''
                      }`}
                    >
                      <span className={isSel ? 'font-semibold' : wd === 0 ? 'text-red-500' : wd === 6 ? 'text-blue-500' : date < today ? 'text-base-500' : ''}>
                        {Number(date.slice(8))}
                      </span>
                      {list.length > 0 && (
                        <span className="mt-0.5 flex flex-wrap justify-center gap-0.5 px-0.5">
                          {list.slice(0, 4).map((v) => (
                            <span
                              key={v.id}
                              className={`h-1.5 w-1.5 rounded-full ${
                                isSel ? 'bg-base-950' : v.status === 'done' ? 'bg-base-500' : v.type === 'service' ? 'bg-violet-500' : 'bg-teal-500'
                              }`}
                            />
                          ))}
                        </span>
                      )}
                      {list.length > 4 && <span className="text-[10px] leading-none">+{list.length - 4}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-center gap-3 text-[11px] text-base-500">
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> 점검</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> 서비스</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-base-500" /> 완료</span>
              </div>

              <div className="mt-3 border-t border-base-800 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium">
                    {selDate?.startsWith(month) ? fmtDate(selDate) : '날짜를 눌러 보세요'} {selDate === today && <span className="text-mist-500">· 오늘</span>}
                  </p>
                  {selDate?.startsWith(month) && (
                    <button onClick={() => newVisit(selDate)} className="flex items-center gap-0.5 text-[12px] text-mist-500">
                      <Plus size={12} /> 이 날 일정 추가
                    </button>
                  )}
                </div>
                {selDate?.startsWith(month) && (byDate[selDate] || []).length > 0 ? (
                  <div className="space-y-1">
                    {byDate[selDate].map((v) => (
                      <VisitChip key={v.id} visit={v} siteName={siteName(v.siteId)} onClick={() => setModal(v)} />
                    ))}
                  </div>
                ) : (
                  selDate?.startsWith(month) && <p className="py-2 text-center text-[12px] text-base-500">이 날은 일정이 없어요.</p>
                )}
              </div>
            </>
          ) : monthVisits.length === 0 ? (
            <p className="py-6 text-center text-xs text-base-500">이번 달 일정이 없어요. "자동 배치"를 눌러 보세요.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byDate).map(([date, list]) => (
                <div key={date}>
                  <p className={`mb-1 text-xs font-medium ${date === today ? 'text-mist-500' : 'text-base-400'}`}>
                    {fmtDate(date)} {date === today && '· 오늘'}
                  </p>
                  <div className="space-y-1">
                    {list.map((v) => (
                      <VisitChip key={v.id} visit={v} siteName={siteName(v.siteId)} onClick={() => setModal(v)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 현장별 현황 */}
        <Card>
          <p className="mb-3 text-sm font-semibold">현장별 이번 달 현황</p>
          {/* 휴대폰: 현장별 한 줄 요약 */}
          <div className="divide-y divide-base-800 md:hidden print:hidden">
            {siteRows.map(({ site, last, insp, due, services, serviceVisits }) => (
              <div key={site.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-base-200">{site.name}</p>
                  {insp ? (
                    <button onClick={() => setModal(insp)} className={`shrink-0 text-xs font-medium ${insp.status === 'done' ? 'text-mist-500' : 'text-teal-500'}`}>
                      {insp.status === 'done' ? '✓ 완료' : '예정'} {fmtDate(insp.date)}
                    </button>
                  ) : due ? (
                    <span className="shrink-0 text-xs font-medium text-amber-500">점검 미배치</span>
                  ) : (
                    <span className="shrink-0 text-xs text-base-500">점검 대상 아님</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-base-500">
                  {cycleLabel(site.inspectCycleMonths)} · 마지막 {last ? fmtDate(last) : '기록 없음'}
                  {serviceVisits.map((v) => ` · ${v.status === 'done' ? '✓' : ''}${v.serviceName} ${fmtDate(v.date)}`).join('')}
                  {services
                    .filter((s) => !serviceVisits.some((v) => v.serviceId === s.id))
                    .map((s) => ` · ${s.name} 미배치`)
                    .join('')}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block print:block">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="border-b border-base-800 text-left text-base-500">
                  <th className="py-2 pr-2 font-normal">현장</th>
                  <th className="py-2 pr-2 font-normal">점검 주기</th>
                  <th className="py-2 pr-2 font-normal">마지막 점검</th>
                  <th className="py-2 pr-2 font-normal">이번 달 점검</th>
                  <th className="py-2 font-normal">이번 달 서비스</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.map(({ site, last, next, insp, due, services, serviceVisits }) => (
                  <tr key={site.id} className="border-b border-base-800/60 last:border-0">
                    <td className="py-2 pr-2 font-medium text-base-200">{site.name}</td>
                    <td className="py-2 pr-2 text-base-400">{cycleLabel(site.inspectCycleMonths)}</td>
                    <td className="py-2 pr-2 text-base-400">
                      {last ? fmtDate(last) : '기록 없음'}
                      {next && <span className="block text-[11px] text-base-500">다음 {next}</span>}
                    </td>
                    <td className="py-2 pr-2">
                      {insp ? (
                        <button onClick={() => setModal(insp)} className={insp.status === 'done' ? 'text-mist-500' : 'text-teal-500'}>
                          {insp.status === 'done' ? '✓ 완료' : '예정'} {fmtDate(insp.date)}
                        </button>
                      ) : due ? (
                        <span className="font-medium text-amber-500">미배치</span>
                      ) : (
                        <span className="text-base-600">대상 아님</span>
                      )}
                    </td>
                    <td className="py-2 text-base-400">
                      {serviceVisits.map((v) => (
                        <button key={v.id} onClick={() => setModal(v)} className="mr-2 text-violet-500">
                          {v.status === 'done' ? '✓ ' : ''}
                          {v.serviceName} {fmtDate(v.date)}
                        </button>
                      ))}
                      {services
                        .filter((s) => !serviceVisits.some((v) => v.serviceId === s.id))
                        .map((s) => (
                          <span key={s.id} className="mr-2 text-amber-500">
                            {s.name} 미배치
                          </span>
                        ))}
                      {serviceVisits.length === 0 && services.length === 0 && <span className="text-base-600">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modal && <VisitModal initial={modal} sites={activeSites} ops={ops} onClose={() => setModal(null)} onWriteReport={onWriteReport} />}
    </div>
  )
}
