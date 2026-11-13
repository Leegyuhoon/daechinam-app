import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Clock, MapPinOff, RefreshCw, Building2, Crown, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { hoursOf } from '../lib/hours'

export default function Workers() {
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: null, records: [], roster: [] })
  const [openWorkerId, setOpenWorkerId] = useState(null)
  const [openSiteKey, setOpenSiteKey] = useState(null)

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .getAttendanceSummary()
      .then((data) => setState({ loading: false, error: null, ...data }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })))
  }
  useEffect(load, [])

  const byWorker = useMemo(() => {
    const map = {}
    for (const r of state.records || []) {
      map[r.workerId] = map[r.workerId] || []
      map[r.workerId].push(r)
    }
    return map
  }, [state.records])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const today = new Date().toISOString().slice(0, 10)

  const toggleWorker = (id) => {
    setOpenWorkerId(openWorkerId === id ? null : id)
    setOpenSiteKey(null)
  }

  const cards = useMemo(() => {
    return (state.roster || []).map((w) => {
      const records = (byWorker[w.id] || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const monthHours = records.filter((r) => r.date?.startsWith(thisMonth)).reduce((sum, r) => sum + hoursOf(r), 0)
      const totalHours = records.reduce((sum, r) => sum + hoursOf(r), 0)
      const flagCount = records.filter((r) => r.outFlag).length
      const ongoingToday = records.some((r) => r.date === today && r.ongoing)
      return { w, records, monthHours, totalHours, flagCount, ongoingToday }
    })
  }, [state.roster, byWorker, thisMonth, today])
  const maxMonthHours = Math.max(1, ...cards.map((c) => c.monthHours))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-page-text">근로자 현황</h1>
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
            <RefreshCw size={14} className={state.loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {state.error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
          {state.error}
        </div>
      )}

      {state.loading ? (
        <p className="p-8 text-center text-sm text-page-sub">불러오는 중…</p>
      ) : cards.length === 0 ? (
        <p className="p-8 text-center text-sm text-page-sub">등록된 근로자가 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(({ w, records, monthHours, totalHours, flagCount, ongoingToday }) => {
            const isOpen = openWorkerId === w.id
            const bySite = {}
            for (const r of records) {
              const key = r.site || '미지정'
              bySite[key] = bySite[key] || []
              bySite[key].push(r)
            }
            const siteNames = Object.keys(bySite).sort(
              (a, b) => bySite[b].reduce((s, r) => s + hoursOf(r), 0) - bySite[a].reduce((s, r) => s + hoursOf(r), 0)
            )

            return (
              <div key={w.id} className="overflow-hidden rounded-xl border border-base-800 bg-base-950 shadow-sm">
                <button
                  onClick={() => toggleWorker(w.id)}
                  className="focus-ring flex w-full flex-col items-center gap-2 p-4 text-center"
                >
                  <div className="flex items-center gap-1.5">
                    {ongoingToday && <span className="h-2 w-2 rounded-full bg-teal-500" />}
                    <span className="text-sm font-medium text-base-100">{w.name}</span>
                    {w.isTeamLead && <Crown size={12} className="text-violet-500" />}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-base-800">
                    <div
                      className="h-1.5 rounded-full bg-red-500"
                      style={{ width: `${Math.max(6, (monthHours / maxMonthHours) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-base-500">
                    <span>{monthHours.toFixed(1)}h 이번달</span>
                    {flagCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <MapPinOff size={10} /> {flagCount}
                      </span>
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-base-800 p-3 pt-3">
                    <div className="mb-2 flex justify-center gap-3 text-[12px] text-base-500">
                      <span>누적 {totalHours.toFixed(1)}h</span>
                      <span>기록 {records.length}건</span>
                    </div>

                    {records.length === 0 ? (
                      <p className="text-center text-xs text-base-500">출근 기록이 없어요.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {siteNames.map((siteName) => {
                          const siteKey = `${w.id}:${siteName}`
                          const siteRecords = bySite[siteName]
                            .slice()
                            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                          const siteHours = siteRecords.reduce((sum, r) => sum + hoursOf(r), 0)
                          const isSiteOpen = openSiteKey === siteKey

                          return (
                            <div key={siteName} className="rounded-lg border border-base-800 bg-base-900">
                              <button
                                onClick={() => setOpenSiteKey(isSiteOpen ? null : siteKey)}
                                className="focus-ring flex w-full items-center justify-between px-2.5 py-1.5 text-left"
                              >
                                <span className="flex items-center gap-1 text-[12px] font-medium text-base-200">
                                  {isSiteOpen ? (
                                    <ChevronDown size={11} className="text-base-500" />
                                  ) : (
                                    <ChevronRight size={11} className="text-base-500" />
                                  )}
                                  <Building2 size={11} className="text-teal-500" /> {siteName}
                                </span>
                                <span className="text-[11px] text-base-500">{siteHours.toFixed(1)}h</span>
                              </button>

                              {isSiteOpen && (
                                <ul className="space-y-1 border-t border-base-800 p-1.5">
                                  {siteRecords.slice(0, 15).map((r) => (
                                    <li
                                      key={r.id}
                                      className="flex items-center justify-between rounded-md bg-base-950 px-2 py-1.5 text-[12px]"
                                    >
                                      <span className="text-base-300">{r.date}</span>
                                      <div className="flex items-center gap-1.5 text-base-400">
                                        <Clock size={10} /> {hoursOf(r).toFixed(1)}h
                                        {r.ongoing && <span className="text-teal-500">진행중</span>}
                                        {r.outFlag && <MapPinOff size={10} className="text-amber-500" />}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
