// daily: [{ date: 'YYYY-MM-DD', checkedIn: number }] — 최근 12주를 히트맵으로 표시
export default function Heatmap({ daily }) {
  const map = Object.fromEntries((daily || []).map((d) => [d.date, d.checkedIn]))
  const todayIso = new Date().toISOString().slice(0, 10)
  const end = daily?.length ? daily[daily.length - 1].date : todayIso

  const endDate = new Date(end)
  const start = new Date(endDate)
  start.setDate(start.getDate() - 83) // 약 12주
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day // 월요일로 정렬
  start.setDate(start.getDate() + diff)

  const weeks = []
  const cur = new Date(start)
  while (cur <= endDate) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const iso = cur.toISOString().slice(0, 10)
      week.push({ date: iso, count: map[iso] || 0 })
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
  }

  const max = Math.max(1, ...(daily || []).map((d) => d.checkedIn))
  const colorFor = (c) => {
    if (c === 0) return 'bg-base-800'
    const ratio = c / max
    if (ratio > 0.66) return 'bg-mist-500'
    if (ratio > 0.33) return 'bg-mist-500/60'
    return 'bg-mist-500/30'
  }

  return (
    <div className="flex gap-[3px] overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {week.map((d) => (
            <div
              key={d.date}
              title={`${d.date} · 출근 ${d.count}건`}
              className={`h-3 w-3 rounded-[2px] ${colorFor(d.count)}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
