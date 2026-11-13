import { X } from 'lucide-react'
import useBackClose from '../../lib/useBackClose'

export const inputCls = 'focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm text-base-100'
export const btnPrimary =
  'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50'
export const btnGhost =
  'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-sm text-base-300 hover:bg-base-800 disabled:opacity-50'
export const btnDanger =
  'focus-ring inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50'

export function Modal({ title, onClose, children, wide = false }) {
  useBackClose(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-base-950 p-5 text-base-100 shadow-xl sm:rounded-2xl ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">{title}</p>
          <button onClick={onClose} className="focus-ring rounded-md p-1 text-base-500 hover:bg-base-800">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Label({ text, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-base-400">{text}</span>
      {children}
    </label>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-base-800 bg-base-950 p-4 text-base-100 shadow-sm ${className}`}>{children}</div>
}

export const TYPE_STYLE = {
  inspection: { label: '점검', cls: 'bg-teal-400/10 text-teal-500 border-teal-400/30' },
  service: { label: '서비스', cls: 'bg-violet-400/10 text-violet-500 border-violet-400/30' }
}

export const STATUS_LABEL = { planned: '예정', done: '완료', canceled: '취소' }
