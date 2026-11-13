import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Lock, Building2, Printer } from 'lucide-react'
import { api } from '../lib/api'

function KVTable({ rows }) {
  const visible = rows.filter(([, v]) => v)
  if (visible.length === 0) return <p className="text-[12px] text-base-500">입력된 내용이 없어요.</p>
  return (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {visible.map(([label, value]) => (
          <tr key={label}>
            <td className="border border-base-700 bg-base-900 px-2 py-1 font-medium text-base-300">{label}</td>
            <td className="border border-base-700 px-2 py-1 text-base-100">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RowsTable({ columns, rows }) {
  const visible = (rows || []).filter((r) => r.some((c) => c))
  if (visible.length === 0) return <p className="text-[12px] text-base-500">입력된 내용이 없어요.</p>
  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} className="border border-base-700 bg-base-900 px-2 py-1 text-left font-medium text-base-300">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visible.map((row, i) => (
          <tr key={i}>
            {row.map((cell, ci) => (
              <td key={ci} className="border border-base-700 px-2 py-1 text-base-100">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Block({ title, children }) {
  return (
    <div className="break-inside-avoid rounded-lg border border-base-800 bg-base-950 p-3">
      <p className="mb-1.5 text-xs font-semibold text-base-100">{title}</p>
      {children}
    </div>
  )
}

export default function ClientReportView() {
  const [params] = useSearchParams()
  const companyId = params.get('id')
  const [pw, setPw] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)
  const [data, setData] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!companyId) {
      setError('링크가 올바르지 않아요. 전달받은 링크로 다시 접속해주세요.')
      return
    }
    setChecking(true)
    try {
      const res = await api.viewClientReport(companyId, pw)
      setData(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const switchPeriod = async (period) => {
    try {
      const res = await api.viewClientReport(companyId, pw, period)
      setData(res)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-900 px-4">
        <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-base-800 bg-base-950 p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-mist-500/15 text-mist-500">
              <Lock size={16} />
            </div>
            <p className="text-sm font-semibold text-base-100">업체 보고 조회</p>
          </div>
          <p className="mb-4 text-xs text-base-400">전달받으신 비밀번호를 입력해주세요.</p>
          <input
            type="password"
            autoFocus
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
          <button
            type="submit"
            disabled={checking}
            className="focus-ring mt-3 w-full rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
          >
            {checking ? '확인 중…' : '확인하기'}
          </button>
        </form>
      </div>
    )
  }

  const r = data.report
  if (!r) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-900 px-4">
        <p className="text-sm text-base-400">아직 등록된 보고가 없어요.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-900 px-4 py-8">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist-500/15 text-mist-500">
            <Building2 size={16} />
          </div>
          <p className="text-sm font-semibold text-base-100">{data.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="focus-ring rounded-lg border border-base-700 bg-base-950 px-2 py-1.5 text-xs"
            value={r.period}
            onChange={(e) => switchPeriod(e.target.value)}
          >
            {data.periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="focus-ring flex items-center gap-1 rounded-lg border border-base-700 bg-base-950 px-2.5 py-1.5 text-xs text-base-300 hover:bg-base-800"
          >
            <Printer size={13} /> 인쇄/저장
          </button>
        </div>
      </div>

      <div className="print-area mx-auto max-w-[210mm] rounded-xl border border-base-800 bg-base-950 p-5 text-base-100 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-base-800 pb-3">
          <div>
            <p className="text-base font-bold">{data.companyName} 서비스 보고</p>
            <p className="text-xs text-base-400">{r.period} 기준</p>
          </div>
          {data.siteName && <p className="text-xs text-base-400">현장: {data.siteName}</p>}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Block title="서비스 품질지표(KPI) 목표">
            <KVTable
              rows={[
                ['청결도', r.kpi.cleanliness],
                ['민원처리 SLA', r.kpi.complaintSLA],
                ['작업누락·재작업 발생률', r.kpi.reworkRate],
                ['긴급대응 처리시간', r.kpi.emergencyResponse]
              ]}
            />
          </Block>

          <Block title="유형별 대응 처리시간">
            <KVTable
              rows={[
                ['청소미흡 — 현장확인', r.responseTimes.minorConfirm],
                ['청소미흡 — 조치', r.responseTimes.minorAction],
                ['고객민원 — 현장확인', r.responseTimes.complaintConfirm],
                ['고객민원 — 조치', r.responseTimes.complaintAction],
                ['긴급오염 — 초동조치', r.responseTimes.emergencyInitial],
                ['긴급오염 — 본조치', r.responseTimes.emergencyFull]
              ]}
            />
          </Block>

          <Block title="정기 운영 리뷰">
            <KVTable
              rows={[
                ['월간 운영리뷰', r.reviewMeetings.monthly],
                ['분기 경영리뷰', r.reviewMeetings.quarterly]
              ]}
            />
          </Block>

          <Block title="이슈 등급별 에스컬레이션">
            <KVTable
              rows={[
                ['경미', r.escalation.minor],
                ['중대', r.escalation.major],
                ['긴급', r.escalation.critical]
              ]}
            />
          </Block>

          <Block title="관리 현황 (인력 배치)">
            <RowsTable columns={['구분', '인원', '근무시간']} rows={r.staffing} />
          </Block>

          <Block title="장비·소모품 비용">
            <RowsTable columns={['품목', '규격', '비용']} rows={r.equipmentCost} />
          </Block>

          {r.companyOverview && (
            <Block title="회사 개요·수행실적">
              <p className="whitespace-pre-line text-[12px] text-base-200">{r.companyOverview}</p>
            </Block>
          )}

          {r.safetyPolicy && (
            <Block title="안전보건·보안 정책">
              <p className="whitespace-pre-line text-[12px] text-base-200">{r.safetyPolicy}</p>
            </Block>
          )}

          {r.differentiation && (
            <Block title="차별화 방안·부가서비스">
              <p className="whitespace-pre-line text-[12px] text-base-200">{r.differentiation}</p>
            </Block>
          )}
        </div>
      </div>
    </div>
  )
}
