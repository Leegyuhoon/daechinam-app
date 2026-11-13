import { Plus, Trash2, Copy } from 'lucide-react'
import { SCOPE_FREQS, ZONE_TEMPLATES, makeZone } from '../../lib/rounds'
import { inputCls } from './ui'

// 현장 청소 범위 편집 — 구역별 항목과 주기
export default function ScopeEditor({ scope, onChange, otherSites = [] }) {
  const setZone = (zi, patch) => onChange(scope.map((z, i) => (i === zi ? { ...z, ...patch } : z)))
  const setItem = (zi, ii, patch) => setZone(zi, { items: scope[zi].items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) })
  const addItem = (zi) => setZone(zi, { items: [...scope[zi].items, { id: crypto.randomUUID(), task: '', freq: '매일' }] })
  const removeItem = (zi, ii) => setZone(zi, { items: scope[zi].items.filter((_, j) => j !== ii) })
  const removeZone = (zi) => onChange(scope.filter((_, i) => i !== zi))

  const copyFrom = (siteId) => {
    const src = otherSites.find((s) => s.id === siteId)
    if (!src?.scope?.length) return
    if (scope.length && !confirm(`'${src.name}'의 청소 범위로 바꿀까요? 지금 입력한 내용은 사라져요.`)) return
    onChange(src.scope.map((z) => makeZone(z.zone, (z.items || []).map((it) => [it.task, it.freq]))))
  }

  const withScope = otherSites.filter((s) => s.scope?.length)

  return (
    <div className="rounded-lg border border-base-800 bg-base-900 p-3">
      <p className="mb-1 text-xs font-medium text-base-300">청소 범위 (구역 · 항목 · 주기)</p>
      <p className="mb-3 text-[12px] text-base-500">업체 전용 페이지의 "청소 범위"에 그대로 보여요. 계약서 내용을 기준으로 적어 두면 점검할 때 기준표로도 쓸 수 있어요.</p>

      <div className="space-y-2">
        {scope.map((z, zi) => (
          <div key={z.id} className="rounded-lg bg-base-950 p-2">
            <div className="mb-1.5 flex gap-1.5">
              <input className={inputCls + ' !py-1.5 font-medium'} value={z.zone} onChange={(e) => setZone(zi, { zone: e.target.value })} placeholder="구역명 (예: 3층 화장실)" />
              <button onClick={() => removeZone(zi)} className="focus-ring shrink-0 rounded-lg px-2 text-base-500 hover:text-red-500" title="구역 삭제">
                <Trash2 size={14} />
              </button>
            </div>
            <input className={inputCls + ' mb-1.5 !py-1 !text-xs'} value={z.note || ''} onChange={(e) => setZone(zi, { note: e.target.value })} placeholder="구역 메모 (선택, 예: 남녀 각 2곳)" />
            <div className="space-y-1">
              {z.items.map((it, ii) => (
                <div key={it.id} className="flex gap-1">
                  <input className={inputCls + ' !py-1 !text-xs'} value={it.task} onChange={(e) => setItem(zi, ii, { task: e.target.value })} placeholder="청소 항목" />
                  <select className={inputCls + ' !w-24 shrink-0 !px-1.5 !py-1 !text-xs'} value={it.freq} onChange={(e) => setItem(zi, ii, { freq: e.target.value })}>
                    {SCOPE_FREQS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                  <button onClick={() => removeItem(zi, ii)} className="shrink-0 px-1 text-base-500 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => addItem(zi)} className="mt-1 flex items-center gap-1 text-[12px] text-base-400 hover:text-mist-500">
              <Plus size={11} /> 항목 추가
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button onClick={() => onChange([...scope, makeZone('')])} className="focus-ring flex items-center gap-1 rounded-md border border-base-700 bg-base-950 px-2 py-1 text-[12px] text-base-300">
          <Plus size={11} /> 빈 구역
        </button>
        {Object.keys(ZONE_TEMPLATES).map((name) => (
          <button key={name} onClick={() => onChange([...scope, makeZone(name, ZONE_TEMPLATES[name])])} className="focus-ring rounded-md px-2 py-1 text-[12px] text-base-500 hover:text-mist-500">
            + {name}
          </button>
        ))}
      </div>
      {withScope.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-base-500">
          <Copy size={11} />
          <select className="rounded border border-base-700 bg-base-950 px-1.5 py-1 text-[12px]" value="" onChange={(e) => copyFrom(e.target.value)}>
            <option value="">다른 현장에서 복사…</option>
            {withScope.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
