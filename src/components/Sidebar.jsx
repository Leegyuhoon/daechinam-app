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
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-page-border bg-page-bg px-4 py-6 md:flex">
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

      {/* 왼쪽 아래 세로 로고 — 아래에서 위로 읽힘, 은은하게 */}
      <div className="mt-auto pl-2 pt-6">
        <img src="/brand/logo-vertical-text.png" alt="DAECHINAM" className="h-[120px] w-auto select-none opacity-30" draggable={false} />
      </div>
    </aside>
  )
}
