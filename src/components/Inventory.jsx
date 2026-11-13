import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, PackageSearch, TriangleAlert, Building2, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { api } from '../lib/api'
import PrintButton from './PrintButton'
import { downloadXlsx } from '../lib/xlsx'
import LoadingBar from './LoadingBar'

const todayLabel = () => new Date().toLocaleDateString('sv-SE')

const emptyForm = {
  name: '',
  category: '세정용품',
  scope: '본사',
  quantity: '',
  unit: '개',
  minQuantity: '',
  location: ''
}
const CATEGORIES = ['세정용품', '소모품', '장비', '안전보호구', '기타']

export default function Inventory() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [siteNames, setSiteNames] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [category, setCategory] = useState('전체')
  const [scopeFilter, setScopeFilter] = useState('전체')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([api.listInventory(), api.listRegularSiteNames().catch(() => ({ names: [] }))])
      .then(([inv, att]) => {
        setItems(inv.items || [])
        setSiteNames(att.names || [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const scopeOptions = ['본사', ...siteNames]

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('품목명을 입력해주세요.')
      return
    }
    if (form.quantity === '') {
      setError('수량을 입력해주세요.')
      return
    }
    setSubmitting(true)
    try {
      await api.upsertInventoryItem(form)
      setForm((f) => ({ ...emptyForm, scope: f.scope })) // 방금 고른 위치는 유지
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (id) => {
    try {
      await api.deleteInventoryItem(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const visible = items.filter((i) => {
    if (category !== '전체' && i.category !== category) return false
    if (scopeFilter !== '전체' && (i.scope || '본사') !== scopeFilter) return false
    return true
  })

  // 지금 보이는 목록(위치·분류 필터 적용)을 엑셀로
  const exportExcel = () => {
    const rows = [
      ['품목', '위치', '분류', '수량', '단위', '최소 수량', '부족 여부', '세부위치'],
      ...visible.map((i) => [
        i.name,
        i.scope || '본사',
        i.category,
        Number(i.quantity) || 0,
        i.unit || '',
        i.minQuantity !== '' && i.minQuantity != null ? Number(i.minQuantity) : '',
        i.minQuantity && Number(i.quantity) <= Number(i.minQuantity) ? '부족' : '',
        i.location || ''
      ])
    ]
    downloadXlsx(rows, `재고현황_${scopeFilter}_${category}_${todayLabel()}`, '재고 현황')
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-page-text">재고 현황</h1>
        <div className="flex flex-wrap gap-2">
          <PrintButton targetId="print-inventory" title={`재고 현황_${scopeFilter}_${category}_${todayLabel()}`} />
          <button
            onClick={exportExcel}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:text-page-text"
          >
            <FileSpreadsheet size={14} /> 엑셀 다운로드
          </button>
        <button
          onClick={() => navigate(-1)}
          className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
        >
          <ArrowLeft size={14} /> <span className="hidden sm:inline">뒤로가기</span>
        </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-3 rounded-xl border border-base-800 bg-base-950 p-4 sm:grid-cols-6">
        <input
          className="focus-ring col-span-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm placeholder:text-base-500 sm:col-span-2"
          placeholder="품목명"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <select
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          value={form.scope}
          onChange={(e) => setForm({ ...form, scope: e.target.value })}
        >
          {scopeOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="수량"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="단위 (개/box..)"
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
        />
        <input
          type="number"
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="최소 재고"
          value={form.minQuantity}
          onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
        />
        <input
          className="focus-ring col-span-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm sm:col-span-4"
          placeholder="세부 위치 (예: 창고 A, 2층 청소함)"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-mist-500 px-3 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50 sm:col-span-2"
        >
          <Plus size={16} /> {submitting ? '등록 중…' : '등록'}
        </button>
      </form>

      <div className="mb-3 flex flex-wrap gap-2">
        {['전체', '본사', ...siteNames].map((s) => (
          <button
            key={s}
            onClick={() => setScopeFilter(s)}
            className={`focus-ring flex items-center gap-1 rounded-full px-3 py-1 text-xs ${
              scopeFilter === s
                ? 'bg-mist-500/15 text-mist-500'
                : 'border border-page-border text-page-sub hover:bg-page-soft hover:text-page-text'
            }`}
          >
            {s !== '전체' && <Building2 size={11} />}
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['전체', ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`focus-ring rounded-full px-3 py-1 text-xs ${
              category === c
                ? 'bg-base-800 text-base-100'
                : 'border border-page-border text-page-sub hover:bg-page-soft hover:text-page-text'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div id="print-inventory" className="overflow-hidden rounded-xl border border-base-800 bg-base-950">
        {loading ? (
          <LoadingBar />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-base-500">
            <PackageSearch size={28} />
            <p className="text-sm">등록된 재고가 없어요.</p>
          </div>
        ) : (
          <>
          <div className="divide-y divide-base-800 md:hidden print:hidden">
            {visible.map((item) => {
              const low = item.minQuantity && item.quantity <= item.minQuantity
              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-base-100">{item.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-base-500">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Building2 size={12} className="text-teal-500" /> {item.scope || '본사'}
                      </span>
                      <span className="whitespace-nowrap">{item.category}</span>
                      {item.location && <span className="whitespace-nowrap">{item.location}</span>}
                    </p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold ${low ? 'text-amber-500' : 'text-base-200'}`}>
                    {low && <TriangleAlert size={13} />}
                    {item.quantity} {item.unit}
                  </span>
                  <button onClick={() => remove(item.id)} className="no-print focus-ring shrink-0 text-base-500 hover:text-red-500" aria-label="삭제">
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
          <table className="hidden w-full text-sm md:table print:table">
            <thead>
              <tr className="border-b border-base-800 text-left text-xs text-base-500">
                <th className="px-4 py-3 font-medium">품목</th>
                <th className="px-4 py-3 font-medium">위치</th>
                <th className="px-4 py-3 font-medium">분류</th>
                <th className="px-4 py-3 font-medium">수량</th>
                <th className="px-4 py-3 font-medium">세부위치</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const low = item.minQuantity && item.quantity <= item.minQuantity
                return (
                  <tr key={item.id} className="border-b border-base-800/60 last:border-0">
                    <td className="px-4 py-3 text-base-100">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-base-400">
                        <Building2 size={11} className="text-teal-500" /> {item.scope || '본사'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-base-400">{item.category}</td>
                    <td className="px-4 py-3">
                      <span className={low ? 'flex items-center gap-1 text-amber-500' : 'text-base-200'}>
                        {low && <TriangleAlert size={13} />}
                        {item.quantity} {item.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-base-400">{item.location || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => remove(item.id)} className="no-print focus-ring text-base-500 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  )
}
