import { useEffect, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { api } from '../lib/api'

// siteName에 해당하는 실제 출퇴근 기록을 보여줍니다.
// period(YYYY-MM)를 주면 그 달만 필터링, compact=true면 A4 한 장에 맞게 좁게 표시합니다.
export default function SiteChecklist({ siteName, period, limit = 14, compact = false }) {
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!siteName) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .getAttendanceSummary()
      .then((data) => {
        let records = (data.records || []).filter((r) => r.site === siteName)
        if (period) records = records.filter((r) => r.date?.startsWith(period))

        const byDate = {}
        for (const r of records) {
          const d = r.date || '날짜미상'
          byDate[d] = byDate[d] || []
          byDate[d].push(r)
        }
        let sorted = Object.entries(byDate)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([date, recs]) => ({ date, recs }))
        if (!period) sorted = sorted.slice(0, limit)
        setDays(sorted)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [siteName, period, limit])

  if (!siteName) return null
  if (loading) return <p className="text-xs text-base-500">불러오는 중…</p>
  if (error) return <p className="text-xs text-amber-500">{error}</p>
  if (days.length === 0) return <p className="text-xs text-base-500">해당 기간 출근 기록이 없어요.</p>

  if (compact) {
    const totalDays = days.length
    const totalVisits = days.reduce((sum, d) => sum + d.recs.length, 0)
    return (
      <div>
        <p className="mb-1.5 text-[12px] text-base-500">
          근무일 {totalDays}일 · 총 {totalVisits}건
        </p>
        <div className="flex flex-wrap gap-1">
          {days.map(({ date, recs }) => (
            <span
              key={date}
              title={recs.map((r) => r.workerName).join(', ')}
              className="rounded bg-base-900 px-1.5 py-0.5 text-[11px] text-base-300"
            >
              {date.slice(5)} ({recs.length})
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {days.map(({ date, recs }) => (
        <div key={date} className="rounded-lg bg-base-900 p-3">
          <p className="mb-1.5 text-xs font-medium text-base-300">{date}</p>
          <ul className="space-y-1">
            {recs.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-base-200">
                  {r.ongoing ? (
                    <Clock size={12} className="text-teal-500" />
                  ) : (
                    <CheckCircle2 size={12} className="text-mist-500" />
                  )}
                  {r.workerName}
                </span>
                <span className="text-base-500">{r.ongoing ? '근무중' : '완료'}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
