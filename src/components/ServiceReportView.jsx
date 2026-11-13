import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { api } from '../lib/api'
import { fmtDate } from '../lib/rounds'
import { printElement } from './PrintButton'
import { Thumb } from './rounds/Media'
import LoadingBar from './LoadingBar'

// 업체 담당자용 "작업 전후 보고서" — 링크(/service-report?id=...)로만 열람, 관리 UI 없음
export default function ServiceReportView() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const [state, setState] = useState({ loading: true, error: null, report: null })

  useEffect(() => {
    if (!id) return setState({ loading: false, error: '잘못된 링크입니다', report: null })
    api
      .viewServiceReport(id)
      .then((report) => setState({ loading: false, error: null, report }))
      .catch((err) => setState({ loading: false, error: err.message, report: null }))
  }, [id])

  const { loading, error, report: r } = state

  if (loading || error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-bg px-4">
        {loading ? <LoadingBar tone="dark" /> : <p className="text-sm text-page-sub">{error}</p>}
      </div>
    )
  }

  const pairs = Math.max(r.before.length, r.after.length)

  return (
    <div className="min-h-screen bg-page-bg px-3 py-6 sm:px-6">
      <div className="no-print mx-auto mb-3 flex max-w-[210mm] items-center justify-between">
        <p className="text-sm font-semibold text-page-text">(주)이엘씨_대치남</p>
        <button
          onClick={() => printElement('print-service-report', `작업전후보고서_${r.siteName}_${r.serviceName}_${r.date}`)}
          className="focus-ring flex items-center gap-1 rounded-lg border border-base-700 bg-base-950 px-2.5 py-1.5 text-xs text-base-300 hover:bg-base-800"
        >
          <Printer size={13} /> 인쇄/PDF 저장
        </button>
      </div>

      <div id="print-service-report" className="mx-auto max-w-[210mm] rounded-xl border border-base-800 bg-base-950 p-5 text-base-100 shadow-sm">
        <div className="mb-4 border-b border-base-800 pb-3">
          <p className="text-[12px] text-base-500">작업 전후 보고서</p>
          <p className="text-lg font-bold">
            {r.siteName} · {r.serviceName}
          </p>
          {r.fromTicket && <p className="mt-0.5 text-[12px] text-base-500">고객 요청에 따른 조치 보고서입니다.</p>}
        </div>

        <table className="mb-4 w-full border-collapse text-xs">
          <tbody>
            {[
              ['현장', r.siteName],
              ['작업 항목', r.serviceName],
              ['작업일', r.date ? `${r.date} ${fmtDate(r.date).replace(/^[^(]*/, '')}` : ''],
              ['작업자', r.worker],
              ['수행 업체', '(주)이엘씨_대치남']
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <tr key={k}>
                  <td className="w-24 border border-base-700 bg-base-900 px-2 py-1.5 font-medium text-base-300">{k}</td>
                  <td className="border border-base-700 px-2 py-1.5">{v}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {r.note && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-base-300">작업 내용 · 특이사항</p>
            <p className="whitespace-pre-line rounded-lg bg-base-900 px-3 py-2 text-xs text-base-200">{r.note}</p>
          </div>
        )}

        <div className="mb-2 grid grid-cols-2 gap-2 text-center text-xs font-semibold">
          <p className="rounded-md bg-base-900 py-1 text-base-400">작업 전</p>
          <p className="rounded-md bg-mist-500/15 py-1 text-mist-600">작업 후</p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: pairs }, (_, i) => (
            <div key={i} className="grid grid-cols-2 gap-2" style={{ breakInside: 'avoid' }}>
              {[r.before[i], r.after[i]].map((p, j) => (
                <div key={j} className="aspect-[4/3] overflow-hidden rounded-lg bg-base-900">
                  {p ? (
                    <Thumb m={p} controls className="h-full w-full" alt={j === 0 ? '작업 전' : '작업 후'} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[12px] text-base-600">-</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-5 border-t border-base-800 pt-3 text-center text-[12px] text-base-500">
          문의 사항은 담당 매니저에게 연락 주시면 빠르게 조치하겠습니다. — (주)이엘씨_대치남
        </p>
      </div>
    </div>
  )
}
