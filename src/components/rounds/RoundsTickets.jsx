import { useMemo, useState } from 'react'
import { Plus, Send, Copy, Check, Link2, BellRing, Paperclip, FileImage, ExternalLink } from 'lucide-react'
import { TICKET_CATEGORIES, TICKET_STATUS, TICKET_SOURCES, sourceLabel, ticketMedia, needsReply, fmtDateTime, portalLink, reportLink, todayStr } from '../../lib/rounds'
import { MediaPicker, MediaView } from './Media'
import { Modal, Label, Card, inputCls, btnPrimary, btnGhost } from './ui'
import PrintButton from '../PrintButton'
import TicketsPrint from './TicketsPrint'

const STATUS_CLS = {
  open: 'bg-amber-400/10 text-amber-500',
  progress: 'bg-teal-400/10 text-teal-500',
  done: 'bg-base-800 text-base-400'
}

function useCopy() {
  const [copied, setCopied] = useState(null)
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      prompt('아래 내용을 복사해 주세요', text)
    }
  }
  return [copied, copy]
}

// 내려받는 파일 이름: 현장명_문의_1112-1340
const fileBase = (site, at, kind) => {
  const d = at ? new Date(at) : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${(site?.name || '현장').replace(/\s+/g, '')}_${kind}_${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function TicketModal({ ticket, site, ops, onClose }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState(ticket.status === 'open' ? 'done' : ticket.status)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [asReport, setAsReport] = useState(true) // 조치 첨부가 있으면 전후 보고서로도 등록
  const [madeReport, setMadeReport] = useState(null)

  // 업체가 올린 첨부(처음 문의 + 추가 글) → 작업 전
  const clientMedia = [...ticketMedia(ticket), ...(ticket.messages || []).filter((m) => m.from === 'client').flatMap((m) => m.media || [])]

  const send = async () => {
    if (!text.trim() && !media.length && status === ticket.status) return setError('답변을 입력하거나 상태를 바꿔 주세요.')
    setSending(true)
    setError(null)
    try {
      let executionId = null
      if (asReport && media.length) {
        const summary = (ticket.content || '').replace(/\s+/g, ' ').trim()
        const ex = await ops.save('executions', {
          siteId: ticket.siteId,
          siteName: site?.name || '',
          serviceId: '',
          serviceName: `[${ticket.category}] ${summary.length > 30 ? `${summary.slice(0, 30)}…` : summary || '요청 처리'}`,
          date: todayStr(),
          worker: '',
          note: [`요청 내용: ${ticket.content || '(사진·영상 첨부)'}`, text.trim() && `조치 내용: ${text.trim()}`].filter(Boolean).join('\n'),
          before: clientMedia,
          after: media,
          ticketId: ticket.id
        })
        executionId = ex.id
        setMadeReport(ex)
      } else {
        setMadeReport(null)
      }
      await ops.replyTicket(ticket.id, text.trim(), status, media, executionId)
      setSent(Boolean(text.trim() || media.length))
      setText('')
      setMedia([])
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const msgs = ticket.messages || []

  return (
    <Modal title={`${site?.name || ''} · ${ticket.category}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="rounded-lg bg-base-900 p-3">
          <p className="mb-1 text-[12px] text-base-500">
            {ticket.authorName || '담당자'} · {fmtDateTime(ticket.createdAt)} · {sourceLabel(ticket.source)}
          </p>
          {ticket.content && <p className="whitespace-pre-line text-sm">{ticket.content}</p>}
          <div className="mt-2">
            <MediaView media={ticketMedia(ticket)} name={fileBase(site, ticket.createdAt, '문의')} />
          </div>
        </div>

        {msgs.length > 0 && (
          <div className="space-y-2">
            {msgs.map((m) => (
              <div key={m.id || m.at} className={`flex ${m.from === 'admin' ? 'justify-end' : ''}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'admin' ? 'bg-mist-500/15' : 'bg-base-900'}`}>
                  {m.text && <p className="whitespace-pre-line">{m.text}</p>}
                  {(m.media || []).length > 0 && (
                    <div className="mt-1">
                      <MediaView media={m.media} size="h-16 w-16" name={fileBase(site, m.at, m.from === 'admin' ? '답변' : '업체')} />
                    </div>
                  )}
                  {m.executionId && (
                    <a href={reportLink(m.executionId)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[12px] text-mist-600 hover:underline">
                      <FileImage size={11} /> 전후 보고서 보기 <ExternalLink size={10} />
                    </a>
                  )}
                  <p className="mt-0.5 text-[11px] text-base-500">
                    {m.from === 'admin' ? '우리 답변' : '업체'} · {fmtDateTime(m.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <Label text="답변">
          <textarea
            rows={3}
            className={inputCls}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예: 말씀하신 3층 화장실 휴지 보충 주기를 매일로 변경했습니다. 불편을 드려 죄송합니다."
          />
        </Label>
        <div>
          <p className="mb-1 text-xs text-base-400">조치 사진·영상 (선택)</p>
          <MediaPicker media={media} onChange={setMedia} onBusyChange={setUploading} />
          {media.length > 0 && (
            <label className="mt-2 flex items-start gap-1.5 text-xs text-base-300">
              <input type="checkbox" className="mt-0.5" checked={asReport} onChange={(e) => setAsReport(e.target.checked)} />
              <span>
                전후 보고서로도 등록
                <span className="block text-[12px] text-base-500">
                  업체가 올린 사진·영상 {clientMedia.length}개 → 작업 전, 조치 사진·영상 {media.length}개 → 작업 후. 이달 월간 보고서에도 자동으로 들어가요.
                </span>
              </span>
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-base-900 p-1">
            {Object.entries(TICKET_STATUS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatus(key)}
                className={`focus-ring rounded-md px-2.5 py-1 text-xs ${status === key ? 'bg-base-950 font-medium shadow-sm' : 'text-base-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={send} disabled={sending || uploading} className={`${btnPrimary} ml-auto`}>
            <Send size={14} /> {sending ? '저장 중…' : '답변 등록'}
          </button>
        </div>
        {error && <p className="text-xs text-amber-500">{error}</p>}

        {sent && (
          <div className="flex items-start gap-2 rounded-lg border border-mist-500/40 bg-mist-500/5 p-3">
            <BellRing size={15} className="mt-0.5 shrink-0 text-mist-500" />
            <div>
              <p className="text-xs font-medium">답변이 업체 페이지에 등록됐어요.</p>
              <p className="mt-0.5 text-[12px] text-base-500">업체 페이지에서 알림을 켠 담당자에게는 알림이 바로 전송돼요.</p>
              {madeReport && (
                <p className="mt-1 text-[12px] text-base-400">
                  전후 보고서도 만들어졌어요 —{' '}
                  <a href={reportLink(madeReport.id)} target="_blank" rel="noreferrer" className="text-mist-600 underline">
                    보기
                  </a>{' '}
                  (전후 보고서 탭 · 이달 월간 보고서에 자동 포함)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function NewTicketModal({ sites, ops, onClose }) {
  const [t, setT] = useState({ siteId: '', category: '불편 사항', content: '', authorName: '', source: 'phone' })
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!t.siteId || (!t.content.trim() && !media.length)) return setError('현장과 내용을 입력해주세요.')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await ops.save('tickets', { ...t, content: t.content.trim(), status: 'open', messages: [], media, lastClientAt: now })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="문의 직접 등록 (전화·문자·방문 등으로 받은 내용)" onClose={onClose}>
      <div className="space-y-3">
        <Label text="현장">
          <select className={inputCls} value={t.siteId} onChange={(e) => setT({ ...t, siteId: e.target.value })}>
            <option value="">선택</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <Label text="구분">
            <select className={inputCls} value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Label>
          <Label text="받은 경로">
            <select className={inputCls} value={t.source} onChange={(e) => setT({ ...t, source: e.target.value })}>
              {Object.entries(TICKET_SOURCES)
                .filter(([k]) => k !== 'web')
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </Label>
        </div>
        <Label text="요청한 사람">
          <input className={inputCls} value={t.authorName} onChange={(e) => setT({ ...t, authorName: e.target.value })} placeholder="예: 총무팀 김OO" />
        </Label>
        <Label text="내용">
          <textarea rows={4} className={inputCls} value={t.content} onChange={(e) => setT({ ...t, content: e.target.value })} />
        </Label>
        <div>
          <p className="mb-1 text-xs text-base-400">사진·영상 (선택)</p>
          <MediaPicker media={media} onChange={setMedia} onBusyChange={setUploading} />
        </div>
        {error && <p className="text-xs text-amber-500">{error}</p>}
        <button onClick={save} disabled={saving || uploading} className={btnPrimary}>
          {saving ? '저장 중…' : '등록'}
        </button>
      </div>
    </Modal>
  )
}

export default function RoundsTickets({ data, ops }) {
  const { sites, tickets } = data
  const [filter, setFilter] = useState('reply')
  const [siteFilter, setSiteFilter] = useState('')
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [copied, copy] = useCopy()

  const site = (id) => sites.find((s) => s.id === id)
  const counts = {
    reply: tickets.filter(needsReply).length,
    active: tickets.filter((t) => t.status !== 'done').length,
    all: tickets.length
  }
  const list = useMemo(
    () =>
      tickets
        .filter((t) => (filter === 'reply' ? needsReply(t) : filter === 'active' ? t.status !== 'done' : true))
        .filter((t) => !siteFilter || t.siteId === siteFilter)
        .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')),
    [tickets, filter, siteFilter]
  )
  const opened = tickets.find((t) => t.id === openId)
  const activeSites = sites.filter((s) => s.active !== false).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  const copyPortal = async (s) => {
    const code = await ops.ensureAccessCode(s)
    copy(s.id, portalLink(code))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-page-border bg-page-soft p-1">
          {[
            ['reply', '답변 필요'],
            ['active', '진행 중'],
            ['all', '전체']
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`focus-ring rounded-md px-3 py-1.5 text-xs ${filter === key ? 'bg-base-950 font-medium text-base-100' : 'text-page-sub'}`}
            >
              {label} {counts[key] > 0 && <span className={key === 'reply' ? 'text-amber-500' : ''}>{counts[key]}</span>}
            </button>
          ))}
        </div>
        <select
          className={inputCls + ' !w-auto !border-page-border !bg-page-soft !text-page-text'}
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">전체 현장</option>
          {activeSites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          {list.length > 0 && (
            <PrintButton
              targetId="print-tickets"
              title={`업체 문의내역_${siteFilter ? site(siteFilter)?.name : '전체'}_${new Date().toLocaleDateString('sv-SE')}`}
            />
          )}
          <button onClick={() => setCreating(true)} className={btnPrimary}>
            <Plus size={14} /> 직접 등록
          </button>
        </div>
      </div>
      <TicketsPrint id="print-tickets" tickets={[...list].reverse()} siteName={(id) => site(id)?.name || ''} />

      {list.length === 0 ? (
        <Card>
          <p className="py-8 text-center text-xs text-base-500">{filter === 'reply' ? '답변이 필요한 문의가 없어요 👍' : '문의가 없어요.'}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((t) => (
            <button key={t.id} onClick={() => setOpenId(t.id)} className="focus-ring block w-full text-left">
              <Card className="!p-3 hover:border-mist-500/50">
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="font-medium text-base-200">{site(t.siteId)?.name || '(삭제된 현장)'}</span>
                  <span className="rounded bg-base-900 px-1.5 py-0.5 text-base-400">{t.category}</span>
                  <span className={`rounded px-1.5 py-0.5 ${STATUS_CLS[t.status] || STATUS_CLS.open}`}>{TICKET_STATUS[t.status] || '접수'}</span>
                  {needsReply(t) && <span className="rounded bg-amber-500 px-1.5 py-0.5 font-medium text-white">답변 필요</span>}
                  <span className="ml-auto text-base-500">{fmtDateTime(t.updatedAt || t.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-base-200">{t.content || '(사진·영상만 첨부)'}</p>
                {ticketMedia(t).length > 0 && (
                  <p className="mt-0.5 flex items-center gap-1 text-[12px] text-base-500">
                    <Paperclip size={11} /> 사진 {ticketMedia(t).filter((m) => m.kind === 'photo').length} · 영상 {ticketMedia(t).filter((m) => m.kind === 'video').length}
                  </p>
                )}
                {(t.messages || []).length > 0 && (
                  <p className="mt-1 truncate text-[12px] text-base-500">
                    💬 {t.messages.length}개 메시지 · 마지막: {t.messages[t.messages.length - 1].text || '(사진·영상)'}
                  </p>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}

      <Card>
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 size={14} /> 업체 전용 페이지 링크
        </p>
        <p className="mb-3 text-[12px] text-base-500">
          현장마다 다른 링크예요. 담당자에게 한 번 보내 두면 로그인 없이 문의 남기기 · 답변 확인 · 월간 보고서 열람을 할 수 있어요. 처음 열 때 "알림 받기"를 눌러 두시라고 안내해 주세요.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {activeSites.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-1.5 text-xs">
              <span>{s.name}</span>
              <button onClick={() => copyPortal(s)} className="flex items-center gap-1 text-mist-500 hover:underline">
                {copied === s.id ? <Check size={12} /> : <Copy size={12} />} {copied === s.id ? '복사됨' : '링크 복사'}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {opened && <TicketModal ticket={opened} site={site(opened.siteId)} ops={ops} onClose={() => setOpenId(null)} />}
      {creating && <NewTicketModal sites={activeSites} ops={ops} onClose={() => setCreating(false)} />}
    </div>
  )
}
