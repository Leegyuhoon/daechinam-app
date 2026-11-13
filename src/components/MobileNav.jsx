import { NavLink } from 'react-router-dom'
import { Package, ShieldCheck, CalendarDays, CalendarRange } from 'lucide-react'

const items = [
  { to: '/rounds', label: '정기현장', icon: CalendarRange },
  { to: '/spot-jobs', label: '일회성', icon: CalendarDays },
  { to: '/inventory', label: '재고', icon: Package },
  { to: '/safety', label: '안전교육', icon: ShieldCheck }
]

export default function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-page-border bg-page-bg/95 backdrop-blur md:hidden">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `focus-ring flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] whitespace-nowrap ${
              isActive ? 'text-mist-400' : 'text-page-sub'
            }`
          }
        >
          <Icon size={19} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
