import { cycleLabel } from '../../lib/rounds'

// 현장 청소 범위 보기 (관리자 현장 카드 · 업체 페이지 공용)
// scope = [{ zone, note, items: [{ task, freq }] }], services = 정기 서비스 항목
const FREQ_CLS = {
  매일: 'bg-teal-400/10 text-teal-500',
  '필요 시': 'bg-base-800 text-base-400'
}

export default function ScopeView({ scope = [], services = [], compact = false }) {
  if (scope.length === 0 && services.length === 0) {
    return <p className="text-[12px] text-base-500">등록된 청소 범위가 없습니다.</p>
  }
  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
        {scope.map((z) => (
          <div key={z.id || z.zone} className="rounded-lg border border-base-800 p-2.5" style={{ breakInside: 'avoid' }}>
            <p className="text-xs font-semibold text-base-200">{z.zone}</p>
            {z.note && <p className="mt-0.5 text-[11px] text-base-500">{z.note}</p>}
            <ul className="mt-1.5 space-y-1">
              {(z.items || []).map((it) => (
                <li key={it.id || it.task} className="flex items-start justify-between gap-2 text-[12px]">
                  <span className="text-base-300">· {it.task}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${FREQ_CLS[it.freq] || 'bg-mist-500/10 text-mist-600'}`}>{it.freq}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {services.length > 0 && (
        <div className="rounded-lg border border-base-800 p-2.5" style={{ breakInside: 'avoid' }}>
          <p className="text-xs font-semibold text-base-200">정기 특별 작업</p>
          <ul className="mt-1.5 space-y-1">
            {services.map((s) => (
              <li key={s.id || s.name} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="text-base-300">
                  · {s.name}
                  {s.next && <span className="text-base-500"> (다음 예정 {s.next})</span>}
                </span>
                <span className="shrink-0 rounded bg-violet-400/10 px-1.5 py-0.5 text-[11px] text-violet-500">{cycleLabel(s.cycleMonths)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
