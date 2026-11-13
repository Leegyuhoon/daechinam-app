import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Share } from 'lucide-react'
import { pushStatus, enablePush, disablePush } from '../lib/push'

// 알림 켜기 버튼 — variant 'admin'(관리 사이트 상단) | 'client'(업체 페이지 안내 카드)
export default function PushToggle({ role, code, headers, variant = 'admin' }) {
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = () => pushStatus().then(setStatus).catch(() => setStatus('unsupported'))
  useEffect(() => {
    refresh()
  }, [])

  const turnOn = async () => {
    setBusy(true)
    setError(null)
    try {
      await enablePush({ role, code, headers })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      refresh()
    }
  }
  const turnOff = async () => {
    setBusy(true)
    await disablePush().catch(() => {})
    setBusy(false)
    refresh()
  }

  if (status === 'loading' || status === 'unsupported') return null

  if (variant === 'admin') {
    if (status === 'ios-needs-home') return null
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={status === 'on' ? turnOff : turnOn}
          disabled={busy || status === 'denied'}
          title={status === 'denied' ? '브라우저 설정에서 이 사이트 알림이 차단되어 있어요' : ''}
          className={`focus-ring flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
            status === 'on' ? 'border-mist-500/50 text-mist-400' : 'border-page-border text-page-sub hover:text-page-text'
          }`}
        >
          {status === 'on' ? <BellRing size={13} /> : status === 'denied' ? <BellOff size={13} /> : <Bell size={13} />}
          {busy ? '설정 중…' : status === 'on' ? '새 문의 알림 켜짐' : status === 'denied' ? '알림 차단됨' : '새 문의 알림 켜기'}
        </button>
        {error && <p className="mt-1 max-w-xs text-right text-[12px] text-amber-400">{error}</p>}
      </div>
    )
  }

  // 업체 페이지
  return (
    <div className="no-print mb-4 rounded-xl border border-page-border bg-page-soft px-3 py-2.5 text-xs text-page-text">
      {status === 'ios-needs-home' ? (
        <div className="flex items-start gap-2">
          <Share size={15} className="mt-0.5 shrink-0 text-mist-400" />
          <p className="text-page-sub">
            <span className="font-medium text-page-text">답변 알림을 받으시려면</span> 사파리 아래쪽 <b>공유 버튼</b> → <b>홈 화면에 추가</b> 후, 홈 화면의 "대치남 고객센터" 아이콘으로 열어 주세요.
          </p>
        </div>
      ) : status === 'on' ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-page-sub">
            <BellRing size={14} className="text-mist-400" /> 답변이 등록되면 이 기기로 알려 드려요.
          </span>
          <button onClick={turnOff} disabled={busy} className="shrink-0 text-[12px] text-page-sub underline">
            알림 끄기
          </button>
        </div>
      ) : status === 'denied' ? (
        <p className="flex items-center gap-1.5 text-page-sub">
          <BellOff size={14} /> 알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-page-sub">
            <Bell size={14} className="text-mist-400" /> 문의 답변과 월간 보고서를 알림으로 받아 보세요.
          </span>
          <button onClick={turnOn} disabled={busy} className="shrink-0 rounded-lg bg-mist-500 px-3 py-1.5 font-medium text-base-950 disabled:opacity-50">
            {busy ? '설정 중…' : '알림 받기'}
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-[12px] text-amber-400">{error}</p>}
    </div>
  )
}
