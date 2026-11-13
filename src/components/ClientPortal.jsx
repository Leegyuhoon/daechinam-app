import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PenLine, MessagesSquare, FileText, ListChecks, Send, Printer, ChevronLeft, CheckCircle2, Paperclip } from 'lucide-react'
import { api } from '../lib/api'
import { TICKET_CATEGORIES, TICKET_STATUS, fmtDateTime, collectMonth, reportLink, SCORE_LABEL } from '../lib/rounds'
import MonthlyReportDoc from './rounds/MonthlyReportDoc'
import ScopeView from './rounds/ScopeView'
import { MediaPicker, MediaView } from './rounds/Media'
import PushToggle from './PushToggle'
import { printElement } from './PrintButton'
import TicketsPrint from './rounds/TicketsPrint'
import LoadingBar from './LoadingBar'

// 업체 담당자 전용 페이지 (/client?c=접속코드) — 문의 남기기 · 답변 확인 · 월간 보고서
const inputCls = 'focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm text-base-100'
const STATUS_CLS = { open: 'bg-amber-400/10 text-amber-500', progress: 'bg-teal-400/10 text-teal-500', done: 'bg-base-800 text-base-400' }

function NewTicket({ code, onDone }) {
  const [t, setT] = useState({ category: '불편 사항', content: '', authorName: '' })
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = async () => {
    if (!t.content.trim() && !media.length) return setError('내용을 입력해주세요.')
    setSending(true)
    setError(null)
    try {
      await api.clientPortalPost(code, { action: 'ticket', ...t, media })
      onDone()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs text-base-400">어떤 내용인가요?</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {TICKET_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setT({ ...t, category: c })}
              className={`focus-ring rounded-lg border py-2 text-sm ${t.category === c ? 'border-mist-500 bg-mist-500/10 font-medium' : 'border-base-700 text-base-400'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <textarea
        rows={5}
        className={inputCls}
        value={t.content}
        onChange={(e) => setT({ ...t, content: e.target.value })}
        placeholder="예: 3층 여자화장실 휴지가 오후에 자주 떨어져요. / 회의실 카펫 얼룩 제거가 가능할까요?"
      />
      <div>
        <p className="mb-1 text-xs text-base-400">사진·영상 첨부 (선택, 영상은 300MB까지)</p>
        <MediaPicker media={media} onChange={setMedia} code={code} onBusyChange={setUploading} />
      </div>
      <input className={inputCls} value={t.authorName} onChange={(e) => setT({ ...t, authorName: e.target.value })} placeholder="성함 또는 부서 (선택)" />
      {error && <p className="text-xs text-amber-500">{error}</p>}
      <button
        onClick={send}
        disabled={sending || uploading}
        className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg bg-mist-500 py-3 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
      >
        <Send size={15} /> {sending ? '보내는 중…' : uploading ? '첨부 올리는 중…' : '보내기'}
      </button>
    </div>
  )
}

// 월간 보고서 만족도 평가 — 업체 담당자가 직접 매김 (다시 매기면 바뀜)
function RateReport({ code, report, onRated }) {
  const cur = report.clientRating
  const [editing, setEditing] = useState(!cur)
  const [score, setScore] = useState(cur?.score || 0)
  const [comment, setComment] = useState(cur?.comment || '')
  const [name, setName] = useState(cur?.name || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = async () => {
    if (!score) return setError('별점을 골라 주세요.')
    setSending(true)
    setError(null)
    try {
      const { clientRating } = await api.clientPortalPost(code, { action: 'rate', reportId: report.id, score, comment, name })
      onRated(clientRating)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (!editing && cur) {
    return (
      <div className="no-print mt-4 rounded-xl border border-base-800 bg-base-900 p-4 text-center">
        <p className="text-sm">
          남겨 주신 평가 <span className="text-mist-500">{'★'.repeat(cur.score)}{'☆'.repeat(5 - cur.score)}</span> <span className="font-medium">{SCORE_LABEL[cur.score]}</span>
        </p>
        {cur.comment && <p className="mt-1 whitespace-pre-line text-xs text-base-400">"{cur.comment}"</p>}
        <button onClick={() => setEditing(true)} className="mt-2 text-xs text-base-500 underline">
          평가 수정하기
        </button>
      </div>
    )
  }

  return (
    <div className="no-print mt-4 rounded-xl border border-mist-500/40 bg-mist-500/5 p-4">
      <p className="text-center text-sm font-semibold">이번 달 청소 관리는 어떠셨나요?</p>
      <p className="mt-0.5 text-center text-xs text-base-500">평가와 의견은 서비스 개선에 사용됩니다.</p>
      <div className="my-3 flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} aria-label={`${n}점`} className={`text-3xl leading-none transition-transform active:scale-90 ${n <= score ? 'text-mist-500' : 'text-base-700'}`}>
            ★
          </button>
        ))}
      </div>
      <p className="mb-3 h-5 text-center text-sm font-medium text-mist-600">{score ? SCORE_LABEL[score] : ''}</p>
      <textarea rows={3} className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="좋았던 점이나 아쉬운 점을 자유롭게 남겨 주세요. (선택)" />
      <input className={inputCls + ' mt-2'} value={name} onChange={(e) => setName(e.target.value)} placeholder="성함 또는 부서 (선택)" />
      {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
      <div className="mt-3 flex gap-2">
        {cur && (
          <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-base-700 py-2.5 text-sm text-base-400">
            취소
          </button>
        )}
        <button onClick={send} disabled={sending} className="focus-ring flex-1 rounded-lg bg-mist-500 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50">
          {sending ? '보내는 중…' : '평가 보내기'}
        </button>
      </div>
    </div>
  )
}

function TicketItem({ t, code, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [sending, setSending] = useState(false)
  const answered = (t.messages || []).some((m) => m.from === 'admin')

  const reply = async () => {
    if (!text.trim() && !media.length) return
    setSending(true)
    try {
      const { ticket } = await api.clientPortalPost(code, { action: 'reply', ticketId: t.id, text, media })
      setText('')
      setMedia([])
      setShowAttach(false)
      onUpdated(ticket)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-3">
      <button onClick={() => setOpen(!open)} className="block w-full text-left">
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="rounded bg-base-900 px-1.5 py-0.5 text-base-400">{t.category}</span>
          <span className={`rounded px-1.5 py-0.5 ${STATUS_CLS[t.status] || STATUS_CLS.open}`}>{TICKET_STATUS[t.status] || '접수'}</span>
          {answered && <span className="rounded bg-mist-500/15 px-1.5 py-0.5 text-mist-600">답변 있음</span>}
          <span className="ml-auto text-base-500">{fmtDateTime(t.createdAt)}</span>
        </div>
        <p className={`text-sm ${open ? 'whitespace-pre-line' : 'line-clamp-2'}`}>{t.content || '(사진·영상 첨부)'}</p>
        {!open && (t.media || []).length > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-base-500">
            <Paperclip size={11} /> 첨부 {t.media.length}개
          </p>
        )}
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <MediaView media={t.media || []} size="h-16 w-16" name="문의첨부" />
          {(t.messages || []).map((m, i) => (
            <div key={i} className={`flex ${m.from === 'admin' ? '' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'admin' ? 'bg-mist-500/15' : 'bg-base-900'}`}>
                {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                {(m.media || []).length > 0 && (
                  <div className="mt-1">
                    <MediaView media={m.media} size="h-16 w-16" name={m.from === 'admin' ? '조치사진' : '추가첨부'} />
                  </div>
                )}
                {m.executionId && (
                  <a href={reportLink(m.executionId)} target="_blank" rel="noreferrer" className="mt-1 block text-[12px] font-medium text-mist-600 underline">
                    작업 전후 보고서 보기
                  </a>
                )}
                <p className="mt-0.5 text-[11px] text-base-500">
                  {m.from === 'admin' ? '(주)이엘씨_대치남' : '작성자'} · {fmtDateTime(m.at)}
                </p>
              </div>
            </div>
          ))}
          {showAttach && <MediaPicker media={media} onChange={setMedia} code={code} onBusyChange={setUploading} compact />}
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowAttach(!showAttach)}
              className={`focus-ring shrink-0 rounded-lg border px-2.5 ${showAttach || media.length ? 'border-mist-500 text-mist-500' : 'border-base-700 text-base-500'}`}
              aria-label="사진·영상 첨부"
            >
              <Paperclip size={15} />
            </button>
            <input className={inputCls + ' !py-2'} value={text} onChange={(e) => setText(e.target.value)} placeholder="추가로 남길 말씀" />
            <button
              onClick={reply}
              disabled={sending || uploading || (!text.trim() && !media.length)}
              className="focus-ring shrink-0 rounded-lg bg-mist-500 px-3 text-base-950 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ClientPortal() {
  const [params, setParams] = useSearchParams()
  const code = params.get('c')
  // 탭·보고서 화면을 주소에 기록 → 휴대폰 뒤로 가기로 이전 화면으로
  const tab = params.get('tab') || 'new'
  const reportMonth = params.get('m') || null
  const setReportMonth = (m) => {
    const next = new URLSearchParams(params)
    if (m) next.set('m', m)
    else next.delete('m')
    setParams(next)
  }
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [justSent, setJustSent] = useState(false)
  const openedFromList = useRef(false)

  const load = () =>
    api
      .clientPortalLoad(code)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }))
  useEffect(() => {
    if (!code) setState({ loading: false, error: '잘못된 링크입니다', data: null })
    else load()
  }, [code])

  // 홈 화면에 추가하면 관리 사이트가 아닌 이 업체 페이지로 열리도록 매니페스트 교체
  useEffect(() => {
    if (!code) return
    const link = document.querySelector('link[rel="manifest"]')
    const title = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    const prev = [link?.getAttribute('href'), title?.getAttribute('content')]
    link?.setAttribute('href', `/api/client-manifest?c=${encodeURIComponent(code)}`)
    title?.setAttribute('content', '대치남 고객센터')
    document.title = '(주)이엘씨_대치남 고객센터'
    return () => {
      if (prev[0]) link?.setAttribute('href', prev[0])
      if (prev[1]) title?.setAttribute('content', prev[1])
    }
  }, [code])

  const go = (t) => {
    setJustSent(false)
    if (t === tab && !reportMonth) return
    const next = new URLSearchParams(params)
    next.set('tab', t)
    next.delete('m')
    setParams(next)
  }

  if (state.loading || state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg px-4">
        {state.loading ? <LoadingBar tone="dark" /> : <p className="text-sm text-page-sub">{state.error}</p>}
      </div>
    )
  }

  const { site, tickets, reports, visits, executions } = state.data
  const issues = state.data.issues || []
  const report = reportMonth && reports.find((r) => r.month === reportMonth)

  return (
    <div className="min-h-screen bg-page-bg px-3 pb-10 pt-6 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="no-print mb-4">
          <p className="text-[12px] text-page-sub">(주)이엘씨_대치남 고객 전용</p>
          <p className="text-lg font-semibold text-page-text">{site.name}</p>
        </div>

        <PushToggle role="client" code={code} variant="client" />

        <div className="no-print mb-4 flex gap-1 rounded-xl border border-page-border bg-page-soft p-1">
          {[
            ['new', '문의 남기기', PenLine],
            ['tickets', `문의 내역${tickets.length ? ` ${tickets.length}` : ''}`, MessagesSquare],
            ['reports', '월간 보고서', FileText],
            ['scope', '청소 범위', ListChecks]
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => go(key)}
              className={`focus-ring flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs sm:text-sm ${
                tab === key ? 'bg-base-950 font-medium text-base-100' : 'text-page-sub'
              }`}
            >
              <Icon size={14} className="hidden sm:block" /> {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-base-800 bg-base-950 p-4 text-base-100 shadow-sm">
          {tab === 'new' &&
            (justSent ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={36} className="mx-auto mb-2 text-teal-500" />
                <p className="font-medium">접수되었습니다.</p>
                <p className="mt-1 text-xs text-base-500">확인 후 답변드리겠습니다. 답변은 "문의 내역"에서 보실 수 있어요.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <button onClick={() => go('tickets')} className="rounded-lg border border-base-700 px-3 py-2 text-xs">
                    문의 내역 보기
                  </button>
                  <button onClick={() => setJustSent(false)} className="rounded-lg border border-base-700 px-3 py-2 text-xs">
                    하나 더 남기기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-base-500">질문, 불편 사항, 개선 요청을 남겨 주시면 확인 후 이 페이지로 답변드립니다.</p>
                <NewTicket
                  code={code}
                  onDone={() => {
                    setJustSent(true)
                    load()
                  }}
                />
              </>
            ))}

          {tab === 'tickets' &&
            (tickets.length === 0 ? (
              <p className="py-8 text-center text-xs text-base-500">남기신 문의가 없어요.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    onClick={() => printElement('print-portal-tickets', `${site.name}_문의내역_${new Date().toLocaleDateString('sv-SE')}`)}
                    className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-base-300"
                  >
                    <Printer size={13} /> PDF 저장
                  </button>
                </div>
                <TicketsPrint id="print-portal-tickets" tickets={[...tickets].reverse()} />
                {tickets.map((t) => (
                  <TicketItem
                    key={t.id}
                    t={t}
                    code={code}
                    onUpdated={(nt) => setState((s) => ({ ...s, data: { ...s.data, tickets: s.data.tickets.map((x) => (x.id === nt.id ? nt : x)) } }))}
                  />
                ))}
              </div>
            ))}

          {tab === 'scope' && (
            <div>
              <div className="no-print mb-3 flex items-center justify-between">
                <p className="text-xs text-base-500">계약된 청소 구역과 항목, 주기입니다. 변경이 필요하시면 "문의 남기기"로 알려 주세요.</p>
                <button onClick={() => printElement('print-scope', `${site.name}_청소범위`)} className="flex shrink-0 items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-base-300">
                  <Printer size={13} /> PDF 저장
                </button>
              </div>
              <div id="print-scope">
                <ScopeView scope={site.scope || []} services={site.services || []} />
              </div>
            </div>
          )}

          {tab === 'reports' &&
            (report ? (
              <div>
                <div className="no-print mb-3 flex items-center justify-between">
                  <button
                    onClick={() => (openedFromList.current ? window.history.back() : setReportMonth(null))}
                    className="flex items-center gap-0.5 text-xs text-base-400"
                  >
                    <ChevronLeft size={14} /> 목록
                  </button>
                  <button
                    onClick={() => printElement('print-portal-report', `${site.name}_${report.month}_월간보고서`)}
                    className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-base-300"
                  >
                    <Printer size={13} /> PDF 저장
                  </button>
                </div>
                <div id="print-portal-report">
                  <MonthlyReportDoc
                    siteName={site.name}
                    month={report.month}
                    report={report}
                    data={collectMonth({ month: report.month, visits, tickets, executions, issues })}
                    serviceReportLink={reportLink}
                    inspectCycleMonths={site.inspectCycleMonths}
                    scope={site.scope || []}
                    vat={site.vat || null}
                  />
                </div>
                <RateReport
                  key={report.id}
                  code={code}
                  report={report}
                  onRated={(clientRating) =>
                    setState((st) => ({ ...st, data: { ...st.data, reports: st.data.reports.map((x) => (x.id === report.id ? { ...x, clientRating } : x)) } }))
                  }
                />
              </div>
            ) : reports.length === 0 ? (
              <p className="py-8 text-center text-xs text-base-500">아직 공개된 보고서가 없어요.</p>
            ) : (
              <div className="space-y-2">
                {reports.map((r) => {
                  const [y, m] = r.month.split('-')
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        openedFromList.current = true
                        setReportMonth(r.month)
                      }} className="flex w-full items-center justify-between rounded-lg border border-base-800 px-3 py-3 text-left hover:border-mist-500">
                      <span className="text-sm font-medium">
                        {y}년 {Number(m)}월 청소 관리 보고서
                      </span>
                      {r.clientRating ? (
                        <span className="shrink-0 text-xs text-mist-500">{'★'.repeat(r.clientRating.score)}</span>
                      ) : (
                        <span className="shrink-0 rounded bg-mist-500/15 px-1.5 py-0.5 text-xs font-medium text-mist-600">평가하기</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
