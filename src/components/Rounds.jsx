import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PushToggle from './PushToggle'
import { Lock, CalendarRange, Building2, Camera, RefreshCw, MessagesSquare, FileText, ClipboardList } from 'lucide-react'
import { api } from '../lib/api'
import RoundsCalendar from './rounds/RoundsCalendar'
import RoundsSites from './rounds/RoundsSites'
import RoundsReports from './rounds/RoundsReports'
import RoundsTickets from './rounds/RoundsTickets'
import RoundsMonthly from './rounds/RoundsMonthly'
import RoundsIssues from './rounds/RoundsIssues'
import { needsReply, newAccessCode } from '../lib/rounds'
import { inputCls, btnPrimary } from './rounds/ui'
import LoadingBar from './LoadingBar'

function PasswordGate({ onOk }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setChecking(true)
    try {
      await api.verifyClientAdminPassword(pw)
      onOk()
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-base-800 bg-base-950 p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mist-500/15 text-mist-500">
            <Lock size={16} />
          </div>
          <p className="text-sm font-semibold text-base-100">정기 현장 관리</p>
        </div>
        <p className="mb-4 text-xs text-base-400">"업체 보고"와 같은 관리자 비밀번호로 들어갈 수 있어요.</p>
        <input type="password" autoFocus className={inputCls} placeholder="관리자 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} />
        {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
        <button type="submit" disabled={checking} className={`${btnPrimary} mt-3 w-full`}>
          {checking ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </div>
  )
}

const TABS = [
  { key: 'calendar', label: '월간 일정', short: '일정', icon: CalendarRange },
  { key: 'tickets', label: '업체 소통', short: '소통', icon: MessagesSquare },
  { key: 'issues', label: '현장 이슈', short: '이슈', icon: ClipboardList },
  { key: 'monthly', label: '월간 보고서', short: '월간보고', icon: FileText },
  { key: 'reports', label: '전후 보고서', short: '전후보고', icon: Camera },
  { key: 'sites', label: '현장·서비스', short: '현장', icon: Building2 }
]

export default function Rounds() {
  const [authed, setAuthed] = useState(true)
  const [state, setState] = useState({ loading: true, error: null, sites: [], visits: [], executions: [], tickets: [], reports: [], issues: [] })
  // 탭을 주소(?tab=)에 기록 → 휴대폰 뒤로 가기로 이전 탭으로 돌아감
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'calendar'
  const setTab = (t) => {
    if (t !== tab) setParams({ tab: t })
  }
  const [reportPrefill, setReportPrefill] = useState(null)

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    api
      .listRegularOps()
      .then(async (data) => {
        setState({ loading: false, error: null, tickets: [], reports: [], issues: [], ...data })
        // 업체 전용 페이지 접속 코드가 없는 현장은 미리 만들어 둠 (링크 복사를 바로 할 수 있게)
        const missing = (data.sites || []).filter((s) => !s.accessCode)
        if (missing.length) {
          const { items } = await api.saveRegularMany('sites', missing.map((s) => ({ ...s, accessCode: newAccessCode() })))
          upsertLocal('sites', items)
        }
      })
      .catch((err) => {
        if (String(err.message).includes('401')) {
          api.clearClientAdminPassword()
          setAuthed(false)
        }
        setState((s) => ({ ...s, loading: false, error: err.message }))
      })
  }
  useEffect(load, [])

  // 저장 후 화면 목록을 바로 갱신 (다시 불러오지 않고)
  const upsertLocal = (collection, items) =>
    setState((s) => {
      const list = [...s[collection]]
      for (const it of items) {
        const i = list.findIndex((x) => x.id === it.id)
        if (i >= 0) list[i] = it
        else list.push(it)
      }
      return { ...s, [collection]: list }
    })

  const ops = {
    save: async (collection, item) => {
      const { item: saved } = await api.saveRegular(collection, item)
      upsertLocal(collection, [saved])
      return saved
    },
    saveMany: async (collection, items) => {
      if (!items.length) return []
      const { items: saved } = await api.saveRegularMany(collection, items)
      upsertLocal(collection, saved)
      return saved
    },
    remove: async (collection, id) => {
      await api.deleteRegular(collection, id)
      setState((s) => ({ ...s, [collection]: s[collection].filter((x) => x.id !== id) }))
    },
    replyTicket: async (id, text, status, media, executionId) => {
      const { item } = await api.replyTicket(id, text, status, media, executionId)
      upsertLocal('tickets', [item])
      return item
    },
    ensureAccessCode: async (site) => {
      if (site.accessCode) return site.accessCode
      const latest = state.sites.find((s) => s.id === site.id)
      if (latest?.accessCode) return latest.accessCode
      const { item } = await api.saveRegular('sites', { ...site, accessCode: newAccessCode() })
      upsertLocal('sites', [item])
      return item.accessCode
    },
    // 서비스 항목의 마지막 실행일 갱신 (더 최근 날짜일 때만)
    markServiceDone: async (siteId, serviceId, date) => {
      const site = state.sites.find((s) => s.id === siteId)
      if (!site || !serviceId) return
      const services = (site.services || []).map((sv) =>
        sv.id === serviceId && (!sv.lastDoneDate || date > sv.lastDoneDate) ? { ...sv, lastDoneDate: date } : sv
      )
      const { item: saved } = await api.saveRegular('sites', { ...site, services })
      upsertLocal('sites', [saved])
    }
  }

  const openReportFor = (prefill) => {
    setTab('reports')
    // 앞 팝업이 닫히며 기록을 되돌린 뒤에 새 팝업을 열도록 살짝 늦춤
    setTimeout(() => setReportPrefill(prefill), 150)
  }

  if (!authed) {
    return (
      <PasswordGate
        onOk={() => {
          setAuthed(true)
          load()
        }}
      />
    )
  }

  const data = { sites: state.sites, visits: state.visits, executions: state.executions, tickets: state.tickets, reports: state.reports, issues: state.issues }
  const replyCount = state.tickets.filter(needsReply).length

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-page-text">정기 현장 관리</h1>
          <p className="mt-1 hidden text-xs text-page-sub sm:block">점검 일정 · 업체 소통 · 현장 이슈 · 월간 보고서 · 작업 전후 보고서</p>
        </div>
        <div className="flex items-start gap-2">
          <PushToggle role="admin" headers={api.adminHeaders()} />
          <button onClick={load} className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border px-3 py-1.5 text-xs text-page-sub hover:text-page-text">
            <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-6 gap-0.5 rounded-xl border border-page-border bg-page-soft p-1 md:flex md:gap-1">
        {TABS.map(({ key, label, short, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`focus-ring relative flex flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-lg px-0.5 py-1.5 text-[12px] transition-colors md:flex-1 md:flex-row md:gap-1.5 md:px-3 md:py-2 md:text-sm ${
              tab === key ? 'bg-base-950 font-semibold text-base-100 shadow-sm' : 'text-page-sub hover:text-page-text'
            }`}
          >
            <Icon size={16} />
            <span className="md:hidden">{short}</span>
            <span className="hidden md:inline">{label}</span>
            {key === 'tickets' && replyCount > 0 && (
              <span className="absolute right-0.5 top-0.5 rounded-full bg-amber-500 px-1.5 text-[12px] font-semibold leading-4 text-white md:static">{replyCount}</span>
            )}
          </button>
        ))}
      </div>

      {state.error && authed && (
        <p className="mb-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-400">{state.error}</p>
      )}

      {state.loading && state.sites.length === 0 ? (
        <LoadingBar tone="dark" className="!py-20" />
      ) : tab === 'calendar' ? (
        <RoundsCalendar data={data} ops={ops} onWriteReport={openReportFor} />
      ) : tab === 'sites' ? (
        <RoundsSites data={data} ops={ops} />
      ) : tab === 'issues' ? (
        <RoundsIssues data={data} ops={ops} />
      ) : tab === 'tickets' ? (
        <RoundsTickets data={data} ops={ops} />
      ) : tab === 'monthly' ? (
        <RoundsMonthly data={data} ops={ops} onGoCalendar={() => setTab('calendar')} />
      ) : (
        <RoundsReports data={data} ops={ops} prefill={reportPrefill} clearPrefill={() => setReportPrefill(null)} />
      )}
    </div>
  )
}
