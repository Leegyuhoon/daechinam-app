import { NavLink } from 'react-router-dom'
import { Package, ShieldCheck, CalendarDays, Send, CalendarRange } from 'lucide-react'

const items = [
  { to: '/rounds', label: '정기 현장 관리', icon: CalendarRange },
  { to: '/spot-jobs', label: '일회성 현장 관리', icon: CalendarDays },
  { to: '/inventory', label: '재고 현황', icon: Package },
  { to: '/safety', label: '안전교육', icon: ShieldCheck },
  { to: '/client-reports', label: '업체 보고', icon: Send }
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-page-border bg-page-bg px-4 py-6">
      <p className="mb-8 px-2 text-sm font-semibold leading-snug text-page-text">
        (주)이엘씨_대치남 통합 관리
      </p>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-mist-500/15 text-mist-400 font-medium'
                  : 'text-page-sub hover:bg-page-soft hover:text-page-text'
              }`
            }
          >
            <Icon size={18} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-lg border border-page-border px-3 py-2.5 text-xs text-page-sub">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mist-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mist-400" />
        </span>
        (주)이엘씨_대치남 관리 사이트
      </div>
    </aside>
  )
}
