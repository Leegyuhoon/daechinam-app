import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
  Users,
  Building2,
  RefreshCw,
  MapPinOff,
  Megaphone,
  ClipboardList,
  PackageCheck,
  Crown,
  ListChecks,
  Trophy,
  ArrowLeft,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Download
} from 'lucide-react'
import { api } from '../lib/api'
import { hoursOf } from '../lib/hours'

// 월별 추이 — 골드 톤 하나로 통일된 그러데이션 (과거 → 최근 순으로 점점 밝아짐)
const monthColor = (i, total) => {
  const lightness = 30 + (i / Math.max(1, total - 1)) * 30 // 30% ~ 60%
  return `hsl(35, 70%, ${lightness}%)`
}

const TONE_CLASSES = {
  mist: 'text-mist-500 bg-mist-500/10',
  teal: 'text-teal-500 bg-teal-500/10',
  violet: 'text-violet-500 bg-violet-500/10',
  amber: 'text-amber-500 bg-amber-500/10'
}
const TONE_TEXT = {
  mist: 'text-mist-500',
  teal: 'text-teal-500',
  violet: 'text-violet-500',
  amber: 'text-amber-500'
}

function StatCard({ icon: Icon, label, value, tone = 'mist', onClick }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring rounded-xl border border-base-800 bg-base-950 p-4 text-left shadow-sm transition-colors hover:border-mist-500/40"
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
      <p className="text-2xl font-semibold text-base-100">{value}</p>
      <p className="mt-0.5 text-xs text-base-400">{label}</p>
    </button>
  )
}

function Panel({ title, icon: Icon, children, badge, tone = 'mist', action }) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium text-base-200">
          <Icon size={15} className={TONE_TEXT[tone]} /> {title}
        </p>
        <div className="flex items-center gap-2">
          {badge != null && badge > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[12px] font-medium text-amber-500">
              {badge}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </div>
  )
}

// 모달 — 다크 페이지 배경 위에 뜨는 상세/목록 보기 공용 오버레이
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl border border-base-800 bg-base-950 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-base-800 px-4 py-3">
          <p className="text-sm font-semibold text-base-100">{title}</p>
          <button onClick={onClose} className="focus-ring rounded-lg p-1 text-base-500 hover:bg-base-800 hover:text-base-200">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

function FilterChips({ options, value, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`focus-ring rounded-full px-2.5 py-1 text-[12px] font-medium ${
            value === opt.value ? 'bg-mist-500/15 text-mist-500' : 'border border-base-800 text-base-400 hover:bg-base-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const timeAgo = (iso) => {
  if (!iso) return ''
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}시간 전`
  return `${Math.floor(diffMin / 1440)}일 전`
}

const formatTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul'
  })
}

const formatMonth = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return `${y}.${m}`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [state, setState] = useState({
    loading: true,
    error: null,
    daily: [],
    ongoing: [],
    siteBreakdown: [],
    roster: [],
    notices: [],
    siteReports: [],
    supplyRequests: [],
    pendingSupplyCount: 0
  })
  const [statModal, setStatModal] = useState(null) // 'today' | 'ongoing' | 'sites' | 'outflag'
  const [noticesOpen, setNoticesOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [suppliesOpen, setSuppliesOpen] = useState(false)
  const [noticePeriod, setNoticePeriod] = useState('전체')
  const [noticeSite, setNoticeSite] = useState('전체')
  const [openNoticeId, setOpenNoticeId] = useState(null)
  const [reportPeriod, setReportPeriod] = useState('전체')
  const [reportSite, setReportSite] = useState('전체')
  const [openReportId, setOpenReportId] = useState(null)
  const [supplyPeriod, setSupplyPeriod] = useState('전체')
  const [supplySite, setSupplySite] = useState('전체')
  const [noticeDetail, setNoticeDetail] = useState(null)
  const [reportDetail, setReportDetail] = useState(null)

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .getAttendanceSummary()
      .then((data) => setState({ loading: false, error: null, ...data }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })))
  }

  useEffect(load, [])

  const today = state.daily?.[state.daily.length - 1]
  const outFlagTotal = (state.daily || []).reduce((sum, d) => sum + (d.outFlag || 0), 0)
  const leaderNames = useMemo(() => new Set((state.roster || []).filter((w) => w.isTeamLead).map((w) => w.name)), [state.roster])
  const leaders = (state.roster || []).filter((w) => w.isTeamLead)

  const monthlyMap = {}
  for (const d of state.daily || []) {
    const month = d.date?.slice(0, 7)
    if (!month) continue
    monthlyMap[month] = (monthlyMap[month] || 0) + (d.checkedIn || 0)
  }
  const chartData = Object.entries(monthlyMap)
    .map(([month, checkedIn]) => ({ date: month, checkedIn }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)

  const outFlagRecords = useMemo(
    () => (state.records || []).filter((r) => r.outFlag).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [state.records]
  )

  const todayDate = today?.date || null
  const todayRecords = useMemo(
    () =>
      (state.records || [])
        .filter((r) => r.date === todayDate)
        .sort((a, b) => (b.clockIn || '').localeCompare(a.clockIn || '')),
    [state.records, todayDate]
  )
  const todayBySite = useMemo(() => {
    const map = {}
    for (const r of todayRecords) {
      const key = r.site || '미지정'
      map[key] = map[key] || []
      map[key].push(r)
    }
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [todayRecords])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const hoursByWorker = {}
  for (const r of state.records || []) {
    if (!r.date?.startsWith(thisMonth)) continue
    hoursByWorker[r.workerId] = (hoursByWorker[r.workerId] || 0) + hoursOf(r)
  }
  const nameById = Object.fromEntries((state.roster || []).map((w) => [w.id, w.name]))
  const topWorkers = Object.entries(hoursByWorker)
    .map(([id, hours]) => ({ id, name: nameById[id] || '알수없음', hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)
  const topMax = topWorkers[0]?.hours || 1

  // 공지·신고·비품 — 연월/현장 필터 옵션 계산
  const buildPeriodOptions = (items, dateField) => {
    const set = new Set()
    items.forEach((it) => {
      const d = it[dateField]
      if (d) set.add(String(d).slice(0, 7))
    })
    return ['전체', ...Array.from(set).sort().reverse()]
  }
  const buildSiteOptions = (items) => {
    const set = new Set()
    items.forEach((it) => {
      if (it.siteName) set.add(it.siteName)
    })
    return ['전체', ...Array.from(set).sort()]
  }

  const noticePeriodOptions = useMemo(() => buildPeriodOptions(state.notices || [], 'createdAt'), [state.notices])
  const noticeSiteOptions = useMemo(() => buildSiteOptions(state.notices || []), [state.notices])
  const filteredNotices = useMemo(() => {
    return (state.notices || [])
      .filter((n) => noticePeriod === '전체' || (n.createdAt || '').slice(0, 7) === noticePeriod)
      .filter((n) => noticeSite === '전체' || n.siteName === noticeSite)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  }, [state.notices, noticePeriod, noticeSite])

  const reportPeriodOptions = useMemo(() => buildPeriodOptions(state.siteReports || [], 'date'), [state.siteReports])
  const reportSiteOptions = useMemo(() => buildSiteOptions(state.siteReports || []), [state.siteReports])
  const filteredReports = useMemo(() => {
    return (state.siteReports || [])
      .filter((r) => reportPeriod === '전체' || (r.date || '').slice(0, 7) === reportPeriod)
      .filter((r) => reportSite === '전체' || r.siteName === reportSite)
      .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
  }, [state.siteReports, reportPeriod, reportSite])

  const supplyPeriodOptions = useMemo(() => buildPeriodOptions(state.supplyRequests || [], 'date'), [state.supplyRequests])
  const supplySiteOptions = useMemo(() => buildSiteOptions(state.supplyRequests || []), [state.supplyRequests])
  const filteredSupplies = useMemo(() => {
    return (state.supplyRequests || [])
      .filter((s) => supplyPeriod === '전체' || (s.date || '').slice(0, 7) === supplyPeriod)
      .filter((s) => supplySite === '전체' || s.siteName === supplySite)
      .sort((a, b) => (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || ''))
  }, [state.supplyRequests, supplyPeriod, supplySite])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-page-text">출퇴근 대시보드</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <ArrowLeft size={14} /> 뒤로가기
          </button>
          <button
            onClick={load}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <RefreshCw size={14} className={state.loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {state.error && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={Users}
          label="오늘 출근 기록 · 눌러서 명단 보기"
          value={state.loading ? '—' : today?.checkedIn ?? 0}
          tone="mist"
          onClick={() => setStatModal('today')}
        />
        <StatCard
          icon={Users}
          label="현재 근무중 · 눌러서 보기"
          value={state.loading ? '—' : state.ongoing?.length ?? 0}
          tone="teal"
          onClick={() => setStatModal('ongoing')}
        />
        <StatCard
          icon={Building2}
          label="등록 현장 · 눌러서 보기"
          value={state.loading ? '—' : state.siteCount ?? 0}
          tone="violet"
          onClick={() => setStatModal('sites')}
        />
        <StatCard
          icon={MapPinOff}
          label="반경 이탈 누적 · 눌러서 보기"
          value={state.loading ? '—' : outFlagTotal}
          tone="amber"
          onClick={() => setStatModal('outflag')}
        />
      </div>

      {/* 오늘 출퇴근 명단 — 현장별로 묶어서 표시 */}
      <div className="mt-6 rounded-xl border border-base-800 bg-base-950 p-4 shadow-sm">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-base-200">
          <ListChecks size={15} className="text-mist-500" />
          오늘 출퇴근 명단 {todayDate && <span className="text-xs font-normal text-base-500">({todayDate})</span>}
          <span className="ml-auto text-xs font-normal text-base-500">현장별 · 인원 많은 순</span>
        </p>
        {todayRecords.length === 0 ? (
          <p className="py-4 text-center text-sm text-base-500">오늘 출퇴근 기록이 없어요.</p>
        ) : (
          <div className="space-y-4">
            {todayBySite.map(([siteName, recs]) => (
              <div key={siteName}>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-base-300">
                  <Building2 size={12} className="text-violet-500" /> {siteName}
                  <span className="text-base-500">· {recs.length}명</span>
                </p>
                <div className="overflow-x-auto rounded-lg border border-base-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-800 bg-base-900 text-left text-xs text-base-500">
                        <th className="py-2 pl-3 pr-4 font-medium">이름</th>
                        <th className="py-2 pr-4 font-medium">출근</th>
                        <th className="py-2 pr-4 font-medium">퇴근</th>
                        <th className="py-2 pr-3 font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recs
                        .slice()
                        .sort((a, b) => (b.clockIn || '').localeCompare(a.clockIn || ''))
                        .map((r, i) => (
                          <tr key={r.id} className={`border-b border-base-800/60 last:border-0 ${i % 2 === 1 ? 'bg-base-900/40' : ''}`}>
                            <td className="py-2 pl-3 pr-4 text-base-100">
                              <span className="flex items-center gap-1.5">
                                {r.workerName}
                                {leaderNames.has(r.workerName) && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-500">
                                    <Crown size={9} /> 팀장
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-base-300">{formatTime(r.clockIn)}</td>
                            <td className="py-2 pr-4 text-base-300">{formatTime(r.clockOut)}</td>
                            <td className="py-2 pr-3">
                              {r.outFlag ? (
                                <span className="flex items-center gap-1 text-xs text-amber-500">
                                  <MapPinOff size={12} /> 반경 이탈
                                </span>
                              ) : r.ongoing ? (
                                <span className="text-xs text-teal-500">근무중</span>
                              ) : (
                                <span className="text-xs text-base-500">완료</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-base-800 bg-base-950 p-4 shadow-sm lg:col-span-2">
          <p className="mb-3 text-sm font-medium text-base-200">월별 출퇴근 추이 (최근 {chartData.length}개월)</p>
          <div className="relative h-64" style={{ filter: 'drop-shadow(0 10px 14px rgba(185,114,10,0.18))' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {chartData.map((_, i) => {
                    const base = monthColor(i, chartData.length)
                    return (
                      <linearGradient id={`monthGrad-${i}`} key={i} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={base} stopOpacity={1} />
                        <stop offset="100%" stopColor={base} stopOpacity={0.72} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <Pie
                  data={chartData}
                  dataKey="checkedIn"
                  nameKey="date"
                  innerRadius="52%"
                  outerRadius="85%"
                  paddingAngle={3}
                  cornerRadius={6}
                  label={({ percent }) => (percent > 0.08 ? `${Math.round(percent * 100)}%` : '')}
                  labelLine={false}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={`url(#monthGrad-${i})`} stroke="#FFFFFF" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #D8DEE1', borderRadius: 8, fontSize: 12 }}
                  formatter={(value, _name, entry) => [`${value}건`, formatMonth(entry.payload.date)]}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => formatMonth(value)}
                  wrapperStyle={{ fontSize: 11, color: '#576068' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute left-[38%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-2xl font-semibold text-base-100">
                {chartData.reduce((sum, d) => sum + (d.checkedIn || 0), 0)}
              </p>
              <p className="text-[12px] text-base-500">건 · 월별 합계</p>
            </div>
          </div>
          {!state.loading && chartData.length === 0 && !state.error && (
            <p className="py-8 text-center text-sm text-base-500">아직 표시할 출퇴근 데이터가 없어요.</p>
          )}

          {(state.siteBreakdown || []).length > 0 && (
            <div className="mt-4 border-t border-base-800 pt-4">
              <p className="mb-2 text-xs text-base-400">현장별 근무 횟수</p>
              <div className="space-y-1.5">
                {state.siteBreakdown.slice(0, 6).map((s) => {
                  const max = state.siteBreakdown[0]?.count || 1
                  return (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0 truncate text-base-300">{s.name}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-base-800">
                        <div
                          className="h-1.5 rounded-full bg-red-500"
                          style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-base-400">{s.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <Panel title="이번달 근무시간 TOP5" icon={Trophy} tone="violet">
          {topWorkers.length === 0 ? (
            <p className="text-sm text-base-500">이번달 근무 기록이 없어요.</p>
          ) : (
            <ul className="space-y-2.5">
              {topWorkers.map((w, i) => (
                <li key={w.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-base-200">
                      <span className="text-base-500">{i + 1}</span> {w.name}
                      {leaderNames.has(w.name) && <Crown size={11} className="text-violet-500" />}
                    </span>
                    <span className="text-base-400">{w.hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-base-800">
                    <div
                      className="h-1.5 rounded-full bg-red-500"
                      style={{ width: `${Math.max(6, (w.hours / topMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* 공지사항 — 크게, 전체보기로 필터링해서 보기 */}
      <div className="mt-4">
        <Panel
          title="공지사항"
          icon={Megaphone}
          tone="violet"
          action={
            (state.notices || []).length > 0 && (
              <button
                onClick={() => setNoticesOpen(true)}
                className="focus-ring rounded-full border border-base-800 px-2.5 py-1 text-[12px] text-base-400 hover:bg-base-800"
              >
                전체보기 ({state.notices.length})
              </button>
            )
          }
        >
          {(state.notices || []).length === 0 ? (
            <p className="text-sm text-base-500">공지사항이 없어요.</p>
          ) : (
            <ul className="space-y-3">
              {state.notices.slice(0, 4).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => setNoticeDetail(n)}
                    className="focus-ring w-full rounded-lg bg-base-900 p-3 text-left text-sm hover:bg-base-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-base-100">{n.title}</p>
                      <span className="shrink-0 text-[12px] text-base-500">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-base-400">{n.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-base-500">
                      {n.siteName && <span className="text-mist-500">{n.siteName}</span>}
                      <span>· {n.createdByName || '관리자'} 작성</span>
                      {typeof n.readBy?.length === 'number' && (
                        <span className="flex items-center gap-0.5 text-teal-500">
                          <Check size={10} /> {n.readBy.length}명 확인
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="현장 신고·이슈"
          icon={ClipboardList}
          tone="teal"
          action={
            (state.siteReports || []).length > 0 && (
              <button
                onClick={() => setReportsOpen(true)}
                className="focus-ring rounded-full border border-base-800 px-2.5 py-1 text-[12px] text-base-400 hover:bg-base-800"
              >
                전체보기 ({state.siteReports.length})
              </button>
            )
          }
        >
          {(state.siteReports || []).length === 0 ? (
            <p className="text-sm text-base-500">등록된 현장 신고가 없어요.</p>
          ) : (
            <ul className="space-y-3">
              {state.siteReports.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setReportDetail(r)}
                    className="focus-ring w-full rounded-lg p-2 text-left text-sm hover:bg-base-900"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-base-100">{r.category || '기타'}</p>
                      <span className="text-[12px] text-base-500">{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-base-400">{r.note}</p>
                    <p className="mt-1 flex items-center gap-2 text-[12px] text-mist-500">
                      {r.siteName} · {r.workerName}
                      {(r.mediaUrls || []).length > 0 && (
                        <span className="text-teal-500">첨부 {r.mediaUrls.length}개</span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="비품 요청"
          icon={PackageCheck}
          badge={state.pendingSupplyCount}
          tone="mist"
          action={
            (state.supplyRequests || []).length > 0 && (
              <button
                onClick={() => setSuppliesOpen(true)}
                className="focus-ring rounded-full border border-base-800 px-2.5 py-1 text-[12px] text-base-400 hover:bg-base-800"
              >
                전체보기 ({state.supplyRequests.length})
              </button>
            )
          }
        >
          {(state.supplyRequests || []).length === 0 ? (
            <p className="text-sm text-base-500">비품 요청이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {state.supplyRequests.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
                  <div>
                    <p className="text-base-100">
                      {s.itemName} <span className="text-base-400">× {s.qty}</span>
                    </p>
                    <p className="text-xs text-base-400">
                      {s.siteName} · {s.workerName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[12px] ${
                      s.status === 'delivered' ? 'bg-mist-500/15 text-mist-500' : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    {s.status === 'delivered' ? '완료' : s.status === 'approved' ? '승인' : '대기'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── 통계 카드 상세 모달 ── */}
      {statModal === 'today' && (
        <Modal title={`오늘 출근 기록 (${todayDate || ''})`} onClose={() => setStatModal(null)} wide>
          {todayRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">오늘 기록이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {todayRecords.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-base-100">
                    {r.workerName}
                    {leaderNames.has(r.workerName) && <Crown size={11} className="text-violet-500" />}
                  </span>
                  <span className="text-xs text-base-400">{r.site}</span>
                  <span className="text-xs text-base-400">
                    {formatTime(r.clockIn)}–{formatTime(r.clockOut)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {statModal === 'ongoing' && (
        <Modal title={`현재 근무중 (${state.ongoing?.length ?? 0}명)`} onClose={() => setStatModal(null)}>
          {(state.ongoing || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">현재 출근 중인 인원이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {state.ongoing.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-base-100">
                    {r.workerName}
                    {leaderNames.has(r.workerName) && <Crown size={11} className="text-violet-500" />}
                  </span>
                  <span className="text-xs text-base-400">{r.site}</span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {statModal === 'sites' && (
        <Modal title="등록 현장" onClose={() => setStatModal(null)}>
          {(state.siteBreakdown || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">현장 데이터가 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {state.siteBreakdown.map((s) => (
                <li key={s.name} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
                  <span className="text-base-100">{s.name}</span>
                  <span className="text-xs text-base-400">누적 {s.count}건</span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {statModal === 'outflag' && (
        <Modal title={`반경 이탈 기록 (${outFlagRecords.length}건)`} onClose={() => setStatModal(null)} wide>
          {outFlagRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">반경 이탈 기록이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {outFlagRecords.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 text-base-100">
                    {r.workerName}
                    {leaderNames.has(r.workerName) && <Crown size={11} className="text-violet-500" />}
                  </span>
                  <span className="text-xs text-base-400">
                    {r.site} · {r.date}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* ── 공지사항 전체보기 ── */}
      {noticesOpen && (
        <Modal title="공지사항 전체보기" onClose={() => setNoticesOpen(false)} wide>
          <FilterChips
            options={noticePeriodOptions.map((p) => ({ value: p, label: p === '전체' ? '전체 기간' : formatMonth(p) }))}
            value={noticePeriod}
            onChange={setNoticePeriod}
          />
          {noticeSiteOptions.length > 1 && (
            <FilterChips
              options={noticeSiteOptions.map((s) => ({ value: s, label: s === '전체' ? '전체 현장' : s }))}
              value={noticeSite}
              onChange={setNoticeSite}
            />
          )}
          {filteredNotices.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">조건에 맞는 공지가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredNotices.map((n) => {
                const isOpen = openNoticeId === n.id
                return (
                  <div key={n.id} className="rounded-lg border border-base-800 bg-base-900">
                    <button
                      onClick={() => setOpenNoticeId(isOpen ? null : n.id)}
                      className="focus-ring flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown size={13} className="shrink-0 text-base-500" />
                        ) : (
                          <ChevronRight size={13} className="shrink-0 text-base-500" />
                        )}
                        <span className="text-sm font-medium text-base-100">{n.title}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-base-500">{(n.createdAt || '').slice(0, 10)}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-base-800 p-3 pt-2.5">
                        {n.message && (
                          <p className="whitespace-pre-line text-sm text-base-300">{n.message}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-base-500">
                          {n.siteName && <span className="text-mist-500">{n.siteName}</span>}
                          <span>작성자: {n.createdByName || '관리자'}</span>
                        </div>
                        <div className="mt-2">
                          <p className="mb-1 text-[12px] font-medium text-base-400">
                            확인 {n.readBy?.length ?? 0}명
                          </p>
                          {n.readBy?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {n.readBy.map((rb, i) => (
                                <span
                                  key={i}
                                  className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-500"
                                >
                                  {rb.workerName || rb.name || '이름없음'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[12px] text-base-500">확인 기록이 없어요.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {/* ── 현장 신고·이슈 전체보기 ── */}
      {reportsOpen && (
        <Modal title="현장 신고·이슈 전체보기" onClose={() => setReportsOpen(false)} wide>
          <FilterChips
            options={reportPeriodOptions.map((p) => ({ value: p, label: p === '전체' ? '전체 기간' : formatMonth(p) }))}
            value={reportPeriod}
            onChange={setReportPeriod}
          />
          {reportSiteOptions.length > 1 && (
            <FilterChips
              options={reportSiteOptions.map((s) => ({ value: s, label: s === '전체' ? '전체 현장' : s }))}
              value={reportSite}
              onChange={setReportSite}
            />
          )}
          {filteredReports.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">조건에 맞는 신고가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredReports.map((r) => {
                const isOpen = openReportId === r.id
                const mediaUrls = r.mediaUrls || []
                return (
                  <div key={r.id} className="rounded-lg border border-base-800 bg-base-900">
                    <button
                      onClick={() => setOpenReportId(isOpen ? null : r.id)}
                      className="focus-ring flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center gap-2">
                        {isOpen ? (
                          <ChevronDown size={13} className="shrink-0 text-base-500" />
                        ) : (
                          <ChevronRight size={13} className="shrink-0 text-base-500" />
                        )}
                        <span className="text-sm font-medium text-base-100">{r.category || '기타'}</span>
                        <span className="text-xs text-base-500">{r.siteName}</span>
                      </span>
                      <span className="shrink-0 text-[12px] text-base-500">{r.date}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-base-800 p-3 pt-2.5">
                        {r.note && <p className="whitespace-pre-line text-sm text-base-300">{r.note}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-base-500">
                          <span>작성자: {r.workerName || '알수없음'}</span>
                          {r.authorRole && (
                            <span>({r.authorRole === 'leader' ? '팀장' : r.authorRole === 'admin' ? '관리자' : '근로자'})</span>
                          )}
                        </div>
                        {mediaUrls.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {mediaUrls.map((url, i) => (
                              <div key={url} className="group relative overflow-hidden rounded-lg border border-base-800 bg-base-950">
                                {r.kind === 'video' ? (
                                  <video src={url} controls className="aspect-square w-full object-cover" />
                                ) : (
                                  <img src={url} alt={`첨부 ${i + 1}`} className="aspect-square w-full object-cover" />
                                )}
                                <a
                                  href={url}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="focus-ring absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <Download size={10} /> 저장
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {/* ── 공지사항 단건 상세 (미리보기 목록에서 바로 클릭) ── */}
      {noticeDetail && (
        <Modal title={noticeDetail.title} onClose={() => setNoticeDetail(null)}>
          {noticeDetail.message && (
            <p className="whitespace-pre-line text-sm text-base-300">{noticeDetail.message}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-base-500">
            {noticeDetail.siteName && <span className="text-mist-500">{noticeDetail.siteName}</span>}
            <span>작성자: {noticeDetail.createdByName || '관리자'}</span>
            <span>{(noticeDetail.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
          </div>
          <div className="mt-3 border-t border-base-800 pt-3">
            <p className="mb-1.5 text-[12px] font-medium text-base-400">확인 {noticeDetail.readBy?.length ?? 0}명</p>
            {noticeDetail.readBy?.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {noticeDetail.readBy.map((rb, i) => (
                  <span key={i} className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] text-teal-500">
                    {rb.workerName || rb.name || '이름없음'}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-base-500">확인 기록이 없어요.</p>
            )}
          </div>
        </Modal>
      )}

      {/* ── 현장 신고·이슈 단건 상세 (미리보기 목록에서 바로 클릭) ── */}
      {reportDetail && (
        <Modal title={reportDetail.category || '기타'} onClose={() => setReportDetail(null)} wide>
          {reportDetail.note && <p className="whitespace-pre-line text-sm text-base-300">{reportDetail.note}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-base-500">
            <span className="text-mist-500">{reportDetail.siteName}</span>
            <span>작성자: {reportDetail.workerName || '알수없음'}</span>
            {reportDetail.authorRole && (
              <span>
                ({reportDetail.authorRole === 'leader' ? '팀장' : reportDetail.authorRole === 'admin' ? '관리자' : '근로자'})
              </span>
            )}
            <span>{reportDetail.date}</span>
          </div>
          {(reportDetail.mediaUrls || []).length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {reportDetail.mediaUrls.map((url, i) => (
                <div key={url} className="group relative overflow-hidden rounded-lg border border-base-800 bg-base-950">
                  {reportDetail.kind === 'video' ? (
                    <video src={url} controls className="aspect-square w-full object-cover" />
                  ) : (
                    <img src={url} alt={`첨부 ${i + 1}`} className="aspect-square w-full object-cover" />
                  )}
                  <a
                    href={url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring absolute bottom-1 right-1 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Download size={10} /> 저장
                  </a>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── 비품 요청 전체보기 ── */}
      {suppliesOpen && (
        <Modal title="비품 요청 전체보기" onClose={() => setSuppliesOpen(false)} wide>
          <FilterChips
            options={supplyPeriodOptions.map((p) => ({ value: p, label: p === '전체' ? '전체 기간' : formatMonth(p) }))}
            value={supplyPeriod}
            onChange={setSupplyPeriod}
          />
          {supplySiteOptions.length > 1 && (
            <FilterChips
              options={supplySiteOptions.map((s) => ({ value: s, label: s === '전체' ? '전체 현장' : s }))}
              value={supplySite}
              onChange={setSupplySite}
            />
          )}
          {filteredSupplies.length === 0 ? (
            <p className="py-6 text-center text-sm text-base-500">조건에 맞는 요청이 없어요.</p>
          ) : (
            <ul className="space-y-1.5">
              {filteredSupplies.map((s) => (
                <li key={s.id} className="rounded-lg bg-base-900 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-base-100">
                      {s.itemName} <span className="text-base-400">× {s.qty}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] ${
                        s.status === 'delivered' ? 'bg-mist-500/15 text-mist-500' : 'bg-amber-500/15 text-amber-500'
                      }`}
                    >
                      {s.status === 'delivered' ? '완료' : s.status === 'approved' ? '승인' : '대기'}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-base-500">
                    {s.siteName} · {s.workerName} · {s.date}
                    {s.vendor && ` · ${s.vendor}`}
                    {s.totalPrice != null && ` · ${s.totalPrice.toLocaleString('ko-KR')}원`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}
