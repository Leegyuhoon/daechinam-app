import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Lock,
  Plus,
  Trash2,
  Pencil,
  X,
  Copy,
  Check,
  Building2,
  ChevronDown,
  ChevronRight,
  Target,
  Timer,
  Users,
  TriangleAlert,
  ListChecks,
  Wrench
} from 'lucide-react'
import { api } from '../lib/api'
import LoadingBar from './LoadingBar'

const emptyCompany = () => ({ companyName: '', password: '', siteName: '' })

const emptyPeriodReport = (companyId) => ({
  companyId,
  period: new Date().toISOString().slice(0, 7),
  kpi: { cleanliness: '', complaintSLA: '', reworkRate: '', emergencyResponse: '' },
  responseTimes: {
    minorConfirm: '',
    minorAction: '',
    complaintConfirm: '',
    complaintAction: '',
    emergencyInitial: '',
    emergencyFull: ''
  },
  reviewMeetings: { monthly: '', quarterly: '' },
  escalation: { minor: '', major: '', critical: '' },
  companyOverview: '',
  staffing: [['', '', '']],
  safetyPolicy: '',
  differentiation: '',
  equipmentCost: [['', '', '']]
})

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
          <p className="text-sm font-semibold text-base-100">업체 보고 관리</p>
        </div>
        <p className="mb-4 text-xs text-base-400">업체별 보고를 만들고 관리하려면 비밀번호가 필요해요.</p>
        <input
          type="password"
          autoFocus
          className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm"
          placeholder="관리자 비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="focus-ring mt-3 w-full rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {checking ? '확인 중…' : '들어가기'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-base-400">{label}</span>
      <input
        className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function FormGroup({ icon: Icon, title, children }) {
  return (
    <div className="rounded-lg border border-base-800 bg-base-900 p-3">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-base-300">
        <Icon size={13} className="text-mist-500" /> {title}
      </p>
      {children}
    </div>
  )
}

function RowsEditor({ columns, rows, onChange }) {
  const update = (ri, ci, value) => {
    const next = rows.map((r) => [...r])
    next[ri][ci] = value
    onChange(next)
  }
  const addRow = () => onChange([...rows, columns.map(() => '')])
  const removeRow = (ri) => onChange(rows.filter((_, i) => i !== ri))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="border border-base-700 bg-base-950 p-1.5 text-left text-base-300">
                  {c}
                </th>
              ))}
              <th className="w-6 border border-base-700 p-1"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {columns.map((_, ci) => (
                  <td key={ci} className="border border-base-700 p-1">
                    <input
                      value={row[ci] || ''}
                      onChange={(e) => update(ri, ci, e.target.value)}
                      className="focus-ring w-full rounded bg-base-950 px-1.5 py-1 text-xs"
                    />
                  </td>
                ))}
                <td className="border border-base-700 p-1 text-center">
                  <button onClick={() => removeRow(ri)} className="text-base-500 hover:text-red-500">
                    <Trash2 size={11} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="focus-ring mt-1.5 flex items-center gap-1 text-[12px] text-base-400 hover:text-mist-500"
      >
        <Plus size={11} /> 행 추가
      </button>
    </div>
  )
}

function CompanyForm({ initialCompany, onSaved, onCancel }) {
  const [company, setCompany] = useState(initialCompany || emptyCompany())
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setError(null)
    if (!company.companyName.trim() || !company.password.trim()) {
      setError('업체명과 비밀번호를 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      await api.upsertClientCompany(company)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <p className="mb-3 text-sm font-medium text-base-200">
        {initialCompany ? '업체 정보 수정' : '새 업체 등록'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="업체명 (예: 메트라이프 본사)"
          value={company.companyName}
          onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
        />
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="이 업체 담당자에게 알려줄 비밀번호"
          value={company.password}
          onChange={(e) => setCompany({ ...company, password: e.target.value })}
        />
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm sm:col-span-2"
          placeholder="현장명 (보고서에 표시, 선택)"
          value={company.siteName}
          onChange={(e) => setCompany({ ...company, siteName: e.target.value })}
        />
      </div>
      {error && <p className="mt-3 text-xs text-amber-500">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="focus-ring rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {saving ? '저장 중…' : initialCompany ? '수정 저장' : '등록'}
        </button>
        <button onClick={onCancel} className="focus-ring rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300">
          취소
        </button>
      </div>
    </div>
  )
}

function PeriodForm({ companyId, initialReport, onSaved, onCancel }) {
  const [report, setReport] = useState(initialReport || emptyPeriodReport(companyId))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const setKpi = (key, value) => setReport((r) => ({ ...r, kpi: { ...r.kpi, [key]: value } }))
  const setRt = (key, value) => setReport((r) => ({ ...r, responseTimes: { ...r.responseTimes, [key]: value } }))
  const setRm = (key, value) => setReport((r) => ({ ...r, reviewMeetings: { ...r.reviewMeetings, [key]: value } }))
  const setEsc = (key, value) => setReport((r) => ({ ...r, escalation: { ...r.escalation, [key]: value } }))

  const save = async () => {
    setError(null)
    if (!report.period) {
      setError('기간(년-월)을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      await api.upsertClientReportPeriod(report)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <p className="mb-3 text-sm font-medium text-base-200">
        {initialReport ? '월별 보고 수정' : '새 월별 보고 등록'}
      </p>

      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-base-400">기간</span>
        <input
          type="month"
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          value={report.period}
          onChange={(e) => setReport({ ...report, period: e.target.value })}
        />
      </label>

      <div className="space-y-3">
        <FormGroup icon={Target} title="서비스 품질지표(KPI) 목표">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="청결도" value={report.kpi.cleanliness} onChange={(v) => setKpi('cleanliness', v)} placeholder="예: 90% 이상" />
            <Field label="민원처리 SLA" value={report.kpi.complaintSLA} onChange={(v) => setKpi('complaintSLA', v)} placeholder="예: 95% 이상" />
            <Field label="작업누락·재작업 발생률" value={report.kpi.reworkRate} onChange={(v) => setKpi('reworkRate', v)} placeholder="예: 3% 이하" />
            <Field label="긴급대응 처리시간" value={report.kpi.emergencyResponse} onChange={(v) => setKpi('emergencyResponse', v)} placeholder="예: 5분 이내 100%" />
          </div>
        </FormGroup>

        <FormGroup icon={Timer} title="유형별 대응 처리시간">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="청소 미흡 — 현장확인" value={report.responseTimes.minorConfirm} onChange={(v) => setRt('minorConfirm', v)} placeholder="예: 30분 이내" />
            <Field label="청소 미흡 — 조치" value={report.responseTimes.minorAction} onChange={(v) => setRt('minorAction', v)} placeholder="예: 1시간 이내" />
            <Field label="고객 민원 — 현장확인" value={report.responseTimes.complaintConfirm} onChange={(v) => setRt('complaintConfirm', v)} placeholder="예: 10분 이내" />
            <Field label="고객 민원 — 조치" value={report.responseTimes.complaintAction} onChange={(v) => setRt('complaintAction', v)} placeholder="예: 1시간 이내" />
            <Field label="긴급 오염 — 초동조치" value={report.responseTimes.emergencyInitial} onChange={(v) => setRt('emergencyInitial', v)} placeholder="예: 5분 이내" />
            <Field label="긴급 오염 — 본조치" value={report.responseTimes.emergencyFull} onChange={(v) => setRt('emergencyFull', v)} placeholder="예: 2시간 이내" />
          </div>
        </FormGroup>

        <FormGroup icon={Users} title="정기 운영 리뷰">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="월간 운영리뷰 참석자" value={report.reviewMeetings.monthly} onChange={(v) => setRm('monthly', v)} placeholder="예: 현장소장 ↔ 회사 시설관리 담당자" />
            <Field label="분기 경영리뷰 참석자" value={report.reviewMeetings.quarterly} onChange={(v) => setRm('quarterly', v)} placeholder="예: 본사 운영관리 임원 ↔ 회사 책임자" />
          </div>
        </FormGroup>

        <FormGroup icon={TriangleAlert} title="이슈 등급별 에스컬레이션">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="경미" value={report.escalation.minor} onChange={(v) => setEsc('minor', v)} placeholder="예: 현장책임자 자체 처리" />
            <Field label="중대" value={report.escalation.major} onChange={(v) => setEsc('major', v)} placeholder="예: 현장→본사(2시간 이내)" />
            <Field label="긴급" value={report.escalation.critical} onChange={(v) => setEsc('critical', v)} placeholder="예: 현장→본사→고객사(즉시)" />
          </div>
        </FormGroup>

        <FormGroup icon={Building2} title="회사 개요·수행실적">
          <textarea
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-sm"
            rows={3}
            placeholder="예: 2018년 법인 설립, 메트라이프 본사 3년째 수행 중, 아이파크 등 5년 이상 장기 수행 경험"
            value={report.companyOverview}
            onChange={(e) => setReport({ ...report, companyOverview: e.target.value })}
          />
        </FormGroup>

        <FormGroup icon={Users} title="관리 현황 (인력 배치)">
          <RowsEditor
            columns={['구분', '인원', '근무시간']}
            rows={report.staffing}
            onChange={(rows) => setReport({ ...report, staffing: rows })}
          />
        </FormGroup>

        <FormGroup icon={TriangleAlert} title="안전보건·보안 정책">
          <textarea
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-sm"
            rows={3}
            placeholder="예: MSDS 비치·관리, 보호구 착용 의무화, 출입증 상시 패용, 개인정보 처리방침 고지"
            value={report.safetyPolicy}
            onChange={(e) => setReport({ ...report, safetyPolicy: e.target.value })}
          />
        </FormGroup>

        <FormGroup icon={Target} title="차별화 방안·부가서비스">
          <textarea
            className="focus-ring w-full rounded-lg border border-base-700 bg-base-950 px-3 py-2 text-sm"
            rows={3}
            placeholder="예: 카펫 변색 방지 프로세스, 저소음 HEPA 필터 장비, 실내 공기질 측정"
            value={report.differentiation}
            onChange={(e) => setReport({ ...report, differentiation: e.target.value })}
          />
        </FormGroup>

        <FormGroup icon={Wrench} title="장비·소모품 비용">
          <RowsEditor
            columns={['품목', '규격', '비용']}
            rows={report.equipmentCost}
            onChange={(rows) => setReport({ ...report, equipmentCost: rows })}
          />
        </FormGroup>
      </div>

      {error && <p className="mt-3 text-xs text-amber-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="focus-ring rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {saving ? '저장 중…' : initialReport ? '수정 저장' : '등록'}
        </button>
        <button onClick={onCancel} className="focus-ring rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300">
          취소
        </button>
      </div>
    </div>
  )
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시
    }
  }
  return (
    <button
      onClick={copy}
      className="focus-ring flex items-center gap-1 rounded-full border border-base-800 px-2 py-1 text-[12px] text-base-400 hover:bg-base-800"
    >
      {copied ? <Check size={11} className="text-mist-500" /> : <Copy size={11} />}
      {copied ? '복사됨' : '링크 복사'}
    </button>
  )
}

function CompanyRow({ company, onEditCompany, onRemoveCompany }) {
  const [expanded, setExpanded] = useState(false)
  const [periods, setPeriods] = useState([])
  const [loading, setLoading] = useState(false)
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState(null)
  const [openPeriodId, setOpenPeriodId] = useState(null)

  const loadPeriods = () => {
    setLoading(true)
    api
      .listClientReportPeriods(company.id)
      .then(({ items }) => setPeriods(items))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (expanded) loadPeriods()
  }, [expanded])

  const link = `${window.location.origin}/client-report?id=${company.id}`

  const removePeriod = async (id) => {
    if (!confirm('이 월 보고를 삭제할까요?')) return
    await api.deleteClientReportPeriod(id)
    loadPeriods()
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="focus-ring flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown size={16} className="shrink-0 text-base-500" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-base-500" />
          )}
          <div>
            <p className="font-medium text-base-100">{company.companyName}</p>
            <p className="text-xs text-base-400">{company.siteName ? `현장: ${company.siteName}` : ''}</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-base-800 p-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-base-900 px-3 py-2">
            <span className="truncate text-xs text-base-400">{link}</span>
            <CopyLinkButton url={link} />
          </div>
          <p className="mb-3 text-xs text-base-500">
            비밀번호: <span className="font-medium text-base-300">{company.password}</span> — 이 링크와 비밀번호를 업체 담당자에게 전달하세요.
          </p>

          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => onEditCompany(company)}
              className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-mist-500"
            >
              <Pencil size={12} /> 업체정보 수정
            </button>
            <button
              onClick={() => onRemoveCompany(company.id)}
              className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-red-500"
            >
              <X size={12} /> 업체 삭제
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-base-300">월별 보고</p>
            <button
              onClick={() => {
                setEditingPeriod(null)
                setShowPeriodForm(true)
              }}
              className="focus-ring flex items-center gap-1 rounded-full border border-base-800 px-2 py-1 text-[12px] text-base-400 hover:bg-base-800"
            >
              <Plus size={11} /> 이번달 보고 등록
            </button>
          </div>

          {showPeriodForm && (
            <div className="mb-3">
              <PeriodForm
                key={editingPeriod?.id || 'new'}
                companyId={company.id}
                initialReport={editingPeriod}
                onSaved={() => {
                  setShowPeriodForm(false)
                  setEditingPeriod(null)
                  loadPeriods()
                }}
                onCancel={() => {
                  setShowPeriodForm(false)
                  setEditingPeriod(null)
                }}
              />
            </div>
          )}

          {loading ? (
            <LoadingBar size="sm" />
          ) : periods.length === 0 ? (
            <p className="text-xs text-base-500">등록된 월별 보고가 없어요.</p>
          ) : (
            <div className="space-y-1.5">
              {periods.map((p) => {
                const isOpen = openPeriodId === p.id
                return (
                  <div key={p.id} className="rounded-lg border border-base-800 bg-base-900">
                    <button
                      onClick={() => setOpenPeriodId(isOpen ? null : p.id)}
                      className="focus-ring flex w-full items-center justify-between px-3 py-2 text-left"
                    >
                      <span className="text-xs font-medium text-base-200">{p.period}</span>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingPeriod(p)
                            setShowPeriodForm(true)
                          }}
                          className="cursor-pointer text-[12px] text-base-500 hover:text-mist-500"
                        >
                          수정
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            removePeriod(p.id)
                          }}
                          className="cursor-pointer text-[12px] text-base-500 hover:text-red-500"
                        >
                          삭제
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ClientReports() {
  const navigate = useNavigate()
  const [unlocked, setUnlocked] = useState(false)
  const [checkingStored, setCheckingStored] = useState(true)
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCompanyForm, setShowCompanyForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)

  const load = () => {
    setLoading(true)
    api.listClientCompanies().then(({ items }) => setCompanies(items)).finally(() => setLoading(false))
  }

  useEffect(() => {
    const stored = localStorage.getItem('daechinam_client_admin_pw')
    if (stored) {
      api
        .verifyClientAdminPassword(stored)
        .then(() => setUnlocked(true))
        .catch(() => {})
        .finally(() => setCheckingStored(false))
    } else {
      setCheckingStored(false)
    }
  }, [])

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked])

  const removeCompany = async (id) => {
    if (!confirm('이 업체와 모든 월별 보고를 삭제할까요? 되돌릴 수 없어요.')) return
    await api.deleteClientCompany(id)
    load()
  }

  const openNewCompany = () => {
    setEditingCompany(null)
    setShowCompanyForm(true)
  }

  if (checkingStored) return null
  if (!unlocked) return <PasswordGate onOk={() => setUnlocked(true)} />

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-page-text">업체 보고</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <ArrowLeft size={14} /> 뒤로가기
          </button>
          <button
            onClick={() => (showCompanyForm ? setShowCompanyForm(false) : openNewCompany())}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Plus size={14} /> 업체 추가
          </button>
          <button
            onClick={() => {
              api.clearClientAdminPassword()
              setUnlocked(false)
            }}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Lock size={14} />
          </button>
        </div>
      </div>

      {showCompanyForm && (
        <div className="mb-6">
          <CompanyForm
            key={editingCompany?.id || 'new'}
            initialCompany={editingCompany}
            onSaved={() => {
              setShowCompanyForm(false)
              setEditingCompany(null)
              load()
            }}
            onCancel={() => {
              setShowCompanyForm(false)
              setEditingCompany(null)
            }}
          />
        </div>
      )}

      {loading ? (
        <LoadingBar tone="dark" />
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-base-800 bg-base-950 p-10 text-base-500">
          <Building2 size={28} />
          <p className="text-sm">등록된 업체가 없어요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((c) => (
            <CompanyRow
              key={c.id}
              company={c}
              onEditCompany={(company) => {
                setEditingCompany(company)
                setShowCompanyForm(true)
              }}
              onRemoveCompany={removeCompany}
            />
          ))}
        </div>
      )}
    </div>
  )
}
