import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Users, MapPinOff, RefreshCw, CalendarDays, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { hoursOf } from '../lib/hours'

export default function Sites() {
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: null, records: [] })
  const [openSite, setOpenSite] = useState(null)
  const [openDateKey, setOpenDateKey] = useState(null)

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .getAttendanceSummary()
      .then((data) => setState({ loading: false, error: null, ...data }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })))
  }
  useEffect(load, [])

  const bySite = useMemo(() => {
    const map = {}
    for (const r of state.records || []) {
      if (!r.siteId) continue
      const key = r.site || '미지정'
      map[key] = map[key] || []
      map[key].push(r)
    }
    return map
  }, [state.records])

  const cards = useMemo(() => {
    return Object.keys(bySite)
      .map((name) => {
        const records = bySite[name]
        const workerSet = new Set(records.map((r) => r.workerId))
        const totalHours = records.reduce((sum, r) => sum + hoursOf(r), 0)
        const flagCount = records.filter((r) => r.outFlag).length
        return { name, records, workerCount: workerSet.size, totalHours, flagCount }
      })
      .sort((a, b) => b.records.length - a.records.length)
  }, [bySite])
  const maxHours = Math.max(1, ...cards.map((c) => c.totalHours))

  const toggleSite = (name) => {
    setOpenSite(openSite === name ? null : name)
    setOpenDateKey(null)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-page-text">정기 현장</h1>
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
        <p className="p-8 text-center text-sm text-page-sub">표시할 현장 데이터가 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map(({ name, records, workerCount, totalHours, flagCount }) => {
            const isSiteOpen = openSite === name
            const byDate = {}
            for (const r of records) {
              const key = r.date || '알수없음'
              byDate[key] = byDate[key] || []
              byDate[key].push(r)
            }
            const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

            return (
              <div key={name} className="overflow-hidden rounded-xl border border-base-800 bg-base-950 shadow-sm">
                <button
                  onClick={() => toggleSite(name)}
                  className="focus-ring flex w-full flex-col items-center gap-2 p-4 text-center"
                >
                  <span className="text-sm font-medium text-base-100">{name}</span>
                  <div className="h-1.5 w-full rounded-full bg-base-800">
                    <div
                      className="h-1.5 rounded-full bg-red-500"
                      style={{ width: `${Math.max(6, (totalHours / maxHours) * 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-base-500">
                    <span className="flex items-center gap-0.5">
                      <Users size={10} /> {workerCount}명
                    </span>
                    <span>{totalHours.toFixed(1)}h</span>
                    {flagCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <MapPinOff size={10} /> {flagCount}
                      </span>
                    )}
                  </div>
                </button>

                {isSiteOpen && (
                  <div className="space-y-1.5 border-t border-base-800 p-3 pt-3">
                    {dates.map((date) => {
                      const dateKey = `${name}:${date}`
                      const dateRecords = byDate[date]
                      const isDateOpen = openDateKey === dateKey

                      return (
                        <div key={date} className="rounded-lg border border-base-800 bg-base-900">
                          <button
                            onClick={() => setOpenDateKey(isDateOpen ? null : dateKey)}
                            className="focus-ring flex w-full items-center justify-between px-2.5 py-1.5 text-left"
                          >
                            <span className="flex items-center gap-1 text-[12px] font-medium text-base-200">
                              {isDateOpen ? (
                                <ChevronDown size={11} className="text-base-500" />
                              ) : (
                                <ChevronRight size={11} className="text-base-500" />
                              )}
                              <CalendarDays size={11} className="text-teal-500" /> {date}
                            </span>
                            <span className="text-[11px] text-base-500">{dateRecords.length}명</span>
                          </button>

                          {isDateOpen && (
                            <ul className="space-y-1 border-t border-base-800 p-1.5">
                              {dateRecords.map((r) => (
                                <li
                                  key={r.id}
                                  className="flex items-center justify-between rounded-md bg-base-950 px-2 py-1.5 text-[12px]"
                                >
                                  <span className="text-base-300">{r.workerName}</span>
                                  <div className="flex items-center gap-1.5 text-base-400">
                                    {hoursOf(r).toFixed(1)}h
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
            )
          })}
        </div>
      )}
    </div>
  )
}
