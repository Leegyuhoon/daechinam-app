import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import Workers from './components/Workers'
import Sites from './components/Sites'
import SpotJobs from './components/SpotJobs'
import Inventory from './components/Inventory'
import SafetyTraining from './components/SafetyTraining'
import Training from './components/Training'
import ClientReports from './components/ClientReports'
import ClientReportView from './components/ClientReportView'
import Rounds from './components/Rounds'
import ServiceReportView from './components/ServiceReportView'
import ClientPortal from './components/ClientPortal'

function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-page-bg">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 pb-24 pt-6 sm:px-8 sm:pb-8">{children}</main>
      <MobileNav />
    </div>
  )
}

// 접속 인트로 화면 — 회사 로고가 나타나고 골드 막대가 차오른 뒤 부드럽게 사라짐
// 업체 담당자용 화면에서는 "고객센터", 근로자 교육 화면에서는 "안전교육", 관리 화면에서는 "통합 관리"
function Splash({ leaving }) {
  const { pathname } = useLocation()
  const caption =
    pathname.startsWith('/client') || pathname.startsWith('/service-report')
      ? '고객센터'
      : pathname.startsWith('/training')
        ? '안전교육'
        : '통합 관리'
  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#1D232A' }}
    >
      <picture className="splash-logo block w-[220px] max-w-[70vw] sm:w-[280px]">
        <source srcSet="/brand/logo-wordmark.webp" type="image/webp" />
        <img src="/brand/logo-wordmark.png" alt="DAECHINAM 대신 치워주는 남자" className="h-auto w-full" />
      </picture>
      <div className="mt-8 h-[3px] w-28 overflow-hidden rounded-full" style={{ background: '#343C45' }}>
        <div className="splash-bar h-full rounded-full" style={{ background: '#EB9E18' }} />
      </div>
      <p className="splash-caption mt-3 text-[12px] tracking-[0.2em]" style={{ color: '#9BA3AB' }}>
        {caption}
      </p>
    </div>
  )
}

export default function App() {
  const [splash, setSplash] = useState('on') // on → leaving → off
  useEffect(() => {
    const t1 = setTimeout(() => setSplash('leaving'), 1300)
    const t2 = setTimeout(() => setSplash('off'), 1600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <>
      {splash !== 'off' && <Splash leaving={splash === 'leaving'} />}
      <Routes>
        {/* 근로자용 / 업체 담당자용 — 관리 UI 없이 독립된 화면 */}
        <Route path="/training" element={<Training />} />
        <Route path="/client-report" element={<ClientReportView />} />
        <Route path="/service-report" element={<ServiceReportView />} />
        <Route path="/client" element={<ClientPortal />} />

        {/* 본사 관리용 — 사이드바 포함 */}
        <Route
          path="/*"
          element={
            <AdminLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/rounds" replace />} />
                <Route path="/workers" element={<Workers />} />
                <Route path="/sites" element={<Sites />} />
                <Route path="/rounds" element={<Rounds />} />
                <Route path="/spot-jobs" element={<SpotJobs />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/safety" element={<SafetyTraining />} />
                <Route path="/client-reports" element={<ClientReports />} />
              </Routes>
            </AdminLayout>
          }
        />
      </Routes>
    </>
  )
}
