import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck,
  PlayCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Plus,
  Trash2,
  Settings2,
  UploadCloud,
  Loader2,
  Sparkles,
  Users,
  BadgeCheck,
  BarChart3,
  Pencil,
  X,
  ArrowLeft
} from 'lucide-react'
import { api } from '../lib/api'
import PrintButton from './PrintButton'
import LoadingBar from './LoadingBar'

const emptyCourse = { title: '', description: '', videoUrl: '', passRatio: 80, questions: [], targetIds: [] }
const emptyRosterEntry = { name: '', birth: '', org: '' }

function QuestionEditor({ question, onChange, onRemove }) {
  const setOption = (idx, value) => {
    const options = [...question.options]
    options[idx] = value
    onChange({ ...question, options })
  }
  return (
    <div className="rounded-lg border border-base-800 bg-base-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="focus-ring flex-1 rounded-md border border-base-700 bg-base-950 px-2 py-1.5 text-sm"
          placeholder="문제"
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
        />
        <button onClick={onRemove} className="focus-ring ml-2 text-base-500 hover:text-red-400">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((opt, idx) => (
          <label key={idx} className="flex items-center gap-1.5 text-xs text-base-300">
            <input
              type="radio"
              checked={question.correctIndex === idx}
              onChange={() => onChange({ ...question, correctIndex: idx })}
            />
            <input
              className="focus-ring w-full rounded-md border border-base-700 bg-base-950 px-2 py-1 text-xs"
              placeholder={`보기 ${idx + 1}`}
              value={opt}
              onChange={(e) => setOption(idx, e.target.value)}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function VideoUploader({ videoUrl, onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState('')

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setFileName(file.name)
    setProgress(0)
    setUploading(true)
    try {
      const { url } = await api.uploadSafetyVideo(file, setProgress)
      onUploaded(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="focus-ring flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-base-700 px-3 py-4 text-sm text-base-400 hover:border-mist-500 hover:text-mist-500">
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> 업로드 중… {progress}% ({fileName})
          </>
        ) : (
          <>
            <UploadCloud size={16} /> {videoUrl ? '다른 영상으로 교체' : '영상 파일 업로드 (mp4 권장)'}
          </>
        )}
        <input type="file" accept="video/*" className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {error && <p className="mt-2 text-xs text-amber-500">{error}</p>}
      {videoUrl && !uploading && (
        <video src={videoUrl} controls className="mt-3 aspect-video w-full rounded-lg bg-black" />
      )}
      <p className="mt-2 text-[12px] text-base-500">
        영상은 조각으로 나뉘어 업로드돼요 — 용량이 커도 괜찮지만 시간이 좀 걸릴 수 있어요. AI 자동 문제 생성(음성인식)은 25MB 이하 영상만 지원돼요.
      </p>
    </div>
  )
}

function CourseForm({ initialCourse, onSaved, onCancel }) {
  const [course, setCourse] = useState(initialCourse || emptyCourse)
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  const addQuestion = () =>
    setCourse((c) => ({
      ...c,
      questions: [...c.questions, { id: crypto.randomUUID(), prompt: '', options: ['', '', '', ''], correctIndex: 0 }]
    }))

  const updateQuestion = (id, next) =>
    setCourse((c) => ({ ...c, questions: c.questions.map((q) => (q.id === id ? next : q)) }))

  const removeQuestion = (id) =>
    setCourse((c) => ({ ...c, questions: c.questions.filter((q) => q.id !== id) }))

  const generateWithAI = async () => {
    if (!course.videoUrl) return
    setGenError(null)
    setGenerating(true)
    try {
      const { questions } = await api.generateQuizFromVideo(course.videoUrl, 4)
      setCourse((c) => ({ ...c, questions: [...c.questions, ...questions] }))
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!course.title || !course.videoUrl || course.questions.length === 0) return
    await api.upsertCourse(course)
    onSaved()
  }

  useEffect(() => {
    api.listTrainingRoster().then(({ items }) => setRoster(items)).finally(() => setRosterLoading(false))
  }, [])

  const toggleTarget = (id) => {
    setCourse((c) => {
      const targetIds = c.targetIds || []
      return {
        ...c,
        targetIds: targetIds.includes(id) ? targetIds.filter((t) => t !== id) : [...targetIds, id]
      }
    })
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <p className="mb-3 text-sm font-medium text-base-200">
        {initialCourse ? '안전교육 과정 수정' : '새 안전교육 과정 등록'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="과정명 (예: 고소작업 안전수칙)"
          value={course.title}
          onChange={(e) => setCourse({ ...course, title: e.target.value })}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-base-400">통과 기준</label>
          <input
            type="number"
            min={1}
            max={100}
            className="focus-ring w-20 rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
            value={course.passRatio}
            onChange={(e) => setCourse({ ...course, passRatio: e.target.value })}
          />
          <span className="text-xs text-base-400">점 이상 (100점 만점)</span>
        </div>
      </div>
      <textarea
        className="focus-ring mt-3 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
        placeholder="간단한 설명"
        rows={2}
        value={course.description}
        onChange={(e) => setCourse({ ...course, description: e.target.value })}
      />

      <div className="mt-3">
        <VideoUploader videoUrl={course.videoUrl} onUploaded={(url) => setCourse((c) => ({ ...c, videoUrl: url }))} />
      </div>

      <div className="mt-4 space-y-2">
        {course.questions.length === 0 && course.videoUrl && (
          <button
            onClick={generateWithAI}
            disabled={generating}
            className="focus-ring flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-500 hover:bg-violet-500/15 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" /> 영상 분석 중… (음성인식 + 문제 생성, 시간이 걸려요)
              </>
            ) : (
              <>
                <Sparkles size={15} /> AI로 문제 자동 생성
              </>
            )}
          </button>
        )}
        {genError && <p className="text-xs text-amber-500">{genError}</p>}

        {course.questions.map((q) => (
          <QuestionEditor
            key={q.id}
            question={q}
            onChange={(next) => updateQuestion(q.id, next)}
            onRemove={() => removeQuestion(q.id)}
          />
        ))}
        <button
          onClick={addQuestion}
          className="focus-ring flex items-center gap-1.5 rounded-lg border border-dashed border-base-700 px-3 py-2 text-xs text-base-400 hover:border-mist-500 hover:text-mist-500"
        >
          <Plus size={14} /> 문제 추가
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-base-300">
          <Users size={13} className="text-violet-500" /> 대상자 지정 (선택)
        </p>
        <p className="mb-2 text-[12px] text-base-500">
          체크해두면 아래 "이수 현황"에서 아직 안 들은 사람을 바로 확인할 수 있어요. 아무도 체크 안 하면 전체 응시자만 보여요.
        </p>
        {rosterLoading ? (
          <LoadingBar size="sm" />
        ) : roster.length === 0 ? (
          <p className="text-xs text-base-500">
            등록된 대상자가 없어요. 안전교육 화면의 "대상자 명단"에서 먼저 등록해주세요.
          </p>
        ) : (
          <div className="grid max-h-40 grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-base-700 bg-base-900 p-2 sm:grid-cols-3">
            {roster.map((r) => (
              <label key={r.id} className="flex items-center gap-1.5 text-xs text-base-300">
                <input
                  type="checkbox"
                  checked={(course.targetIds || []).includes(r.id)}
                  onChange={() => toggleTarget(r.id)}
                />
                {r.name}
                {r.org && <span className="text-base-500">({r.org})</span>}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={!course.title || !course.videoUrl || course.questions.length === 0}
          className="focus-ring rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-40"
        >
          {initialCourse ? '수정 저장' : '과정 저장'}
        </button>
        <button onClick={onCancel} className="focus-ring rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300">
          취소
        </button>
      </div>
    </div>
  )
}

function RosterManager() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyRosterEntry)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    api.listTrainingRoster().then(({ items }) => setItems(items)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() || !/^\d{6}$/.test(form.birth.trim())) {
      setError('이름과 생년월일 6자리를 정확히 입력해주세요.')
      return
    }
    try {
      await api.upsertTrainingRosterEntry(form)
      setForm(emptyRosterEntry)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (id) => {
    await api.deleteTrainingRosterEntry(id)
    load()
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-base-200">
        <Users size={15} className="text-violet-500" /> 교육 대상자 명단
      </p>
      <p className="mb-3 text-xs text-base-500">
        여기 등록해두면 근로자가 이름+생년월일로 응시할 때 "확인됨"으로 표시돼요. 등록 안 해도 응시 자체는 누구나 가능해요.
      </p>

      <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="이름"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          inputMode="numeric"
          maxLength={6}
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="생년월일 6자리"
          value={form.birth}
          onChange={(e) => setForm({ ...form, birth: e.target.value.replace(/\D/g, '').slice(0, 6) })}
        />
        <input
          className="focus-ring rounded-lg border border-base-700 bg-base-900 px-3 py-2 text-sm"
          placeholder="소속 (선택)"
          value={form.org}
          onChange={(e) => setForm({ ...form, org: e.target.value })}
        />
        <button
          type="submit"
          className="focus-ring flex items-center justify-center gap-1.5 rounded-lg bg-mist-500 px-3 py-2 text-sm font-medium text-base-950 hover:bg-mist-400"
        >
          <Plus size={14} /> 추가
        </button>
      </form>
      {error && <p className="mb-3 text-xs text-amber-500">{error}</p>}

      {loading ? (
        <LoadingBar size="sm" className="!py-6" />
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-base-500">등록된 대상자가 없어요.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-lg bg-base-900 px-3 py-2 text-sm">
              <span className="text-base-100">
                {it.name} <span className="text-xs text-base-500">({it.birth})</span>
                {it.org && <span className="ml-2 text-xs text-base-400">{it.org}</span>}
              </span>
              <button onClick={() => remove(it.id)} className="focus-ring text-base-500 hover:text-red-500">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResultsPanel({ course, onClose }) {
  const [results, setResults] = useState([])
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listResults(course.id), api.listTrainingRoster()])
      .then(([r, ros]) => {
        setResults(r.results)
        setRoster(ros.items)
      })
      .finally(() => setLoading(false))
  }, [course.id])

  const targetIds = course.targetIds || []
  const targets = roster.filter((r) => targetIds.includes(r.id))
  const passedNames = new Set(results.filter((r) => r.passed).map((r) => r.userName))
  const notCompleted = targets.filter((t) => !passedNames.has(t.name))

  return (
    <div id={`print-safety-${course.id}`} className="rounded-xl border border-base-800 bg-base-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-base-200">{course.title} — 이수 현황</p>
        <div className="no-print flex items-center gap-3">
          <PrintButton
            targetId={`print-safety-${course.id}`}
            title={`안전교육 이수현황_${course.title}_${new Date().toLocaleDateString('sv-SE')}`}
            className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-mist-500"
          />
          <button onClick={onClose} className="focus-ring text-xs text-base-500 hover:text-base-300">
            닫기
          </button>
        </div>
      </div>

      {!loading && targetIds.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-1.5 text-xs font-medium text-amber-500">
            미이수자 ({notCompleted.length}/{targets.length}명)
          </p>
          {notCompleted.length === 0 ? (
            <p className="text-xs text-base-500">지정된 대상자가 모두 이수했어요.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {notCompleted.map((t) => (
                <span key={t.id} className="rounded-full bg-base-900 px-2 py-1 text-xs text-base-300">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingBar size="sm" className="!py-6" />
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-sm text-base-500">아직 응시 기록이 없어요.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-base-800 text-left text-xs text-base-500">
              <th className="py-2 pr-4 font-medium">이름</th>
              <th className="py-2 pr-4 font-medium">점수</th>
              <th className="py-2 pr-4 font-medium">결과</th>
              <th className="py-2 font-medium">일시</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-base-800/60 last:border-0">
                <td className="py-2 pr-4 text-base-100">
                  <span className="flex items-center gap-1">
                    {r.userName}
                    {r.verified && <BadgeCheck size={12} className="text-teal-500" />}
                  </span>
                </td>
                <td className="py-2 pr-4 text-base-300">
                  {r.score}/{r.total}
                </td>
                <td className="py-2 pr-4">
                  <span className={r.passed ? 'text-mist-500' : 'text-amber-500'}>
                    {r.passed ? '이수' : '미이수'}
                  </span>
                </td>
                <td className="py-2 text-xs text-base-500">
                  {r.answeredAt ? new Date(r.answeredAt).toLocaleString('ko-KR') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function QuizRunner({ course, onExit }) {
  const [step, setStep] = useState('video')
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const passRatio = (course.passRatio ?? 80) / 100

  const submit = async () => {
    let score = 0
    course.questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) score += 1
    })
    const total = course.questions.length
    const percent = total > 0 ? Math.round((score / total) * 100) : 0
    const passed = total > 0 && score / total >= passRatio
    const r = { score, total, percent, passed }
    setResult(r)
    setStep('result')
    await api.submitQuizResult({ courseId: course.id, userName: '(관리자 미리보기)', verified: false, score, total, passed })
  }

  return (
    <div className="rounded-xl border border-base-800 bg-base-950 p-4">
      <button onClick={onExit} className="focus-ring mb-4 flex items-center gap-1 text-xs text-base-400 hover:text-base-200">
        <ChevronLeft size={14} /> 목록으로
      </button>

      {step === 'video' && (
        <div>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <video src={course.videoUrl} controls className="h-full w-full" />
          </div>
          <p className="mt-3 text-sm text-base-300">{course.description}</p>
          <button
            onClick={() => setStep('quiz')}
            className="focus-ring mt-4 flex items-center gap-1.5 rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400"
          >
            <PlayCircle size={16} /> 시청 완료, 문제 풀기
          </button>
        </div>
      )}

      {step === 'quiz' && (
        <div className="space-y-4">
          {course.questions.map((q, i) => (
            <div key={q.id}>
              <p className="mb-2 text-sm text-base-100">
                {i + 1}. {q.prompt}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: idx }))}
                    className={`focus-ring rounded-lg border px-3 py-2 text-left text-sm ${
                      answers[q.id] === idx
                        ? 'border-mist-500 bg-mist-500/10 text-mist-500'
                        : 'border-base-700 text-base-300 hover:bg-base-900'
                    }`}
                  >
                    {opt || `보기 ${idx + 1}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submit}
            disabled={Object.keys(answers).length < course.questions.length}
            className="focus-ring rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-40"
          >
            제출하기
          </button>
        </div>
      )}

      {step === 'result' && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          {result.passed ? (
            <CheckCircle2 size={40} className="text-mist-500" />
          ) : (
            <XCircle size={40} className="text-amber-500" />
          )}
          <p className="text-lg font-semibold text-base-100">
            {result.percent}점 ({result.score}/{result.total}) — {result.passed ? '이수 완료' : '재교육 필요'}
          </p>
          <p className="text-sm text-base-400">이건 관리자 미리보기라 실제 이수 기록에는 이름 없이 남아요.</p>
          {!result.passed && (
            <button
              onClick={() => {
                setAnswers({})
                setStep('video')
              }}
              className="focus-ring mt-2 rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300"
            >
              다시 시청하기
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function SafetyTraining() {
  const navigate = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)
  const [resultsCourse, setResultsCourse] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [showRoster, setShowRoster] = useState(false)

  const load = () => {
    setLoading(true)
    api.listCourses().then(({ courses }) => setCourses(courses)).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNewCourse = () => {
    setEditingCourse(null)
    setShowAdmin(true)
  }

  const openEditCourse = (course) => {
    setEditingCourse(course)
    setShowAdmin(true)
  }

  const removeCourse = async (id) => {
    if (!confirm('이 과정을 삭제할까요? 삭제하면 되돌릴 수 없어요.')) return
    await api.deleteCourse(id)
    load()
  }

  if (active) {
    return <QuizRunner course={active} onExit={() => setActive(null)} />
  }

  if (resultsCourse) {
    return <ResultsPanel course={resultsCourse} onClose={() => setResultsCourse(null)} />
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-page-text">안전교육</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(-1)}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <ArrowLeft size={14} /> 뒤로가기
          </button>
          <button
            onClick={() => setShowRoster((v) => !v)}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Users size={14} /> 대상자 명단
          </button>
          <button
            onClick={() => (showAdmin ? setShowAdmin(false) : openNewCourse())}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft px-3 py-1.5 text-xs text-page-sub hover:bg-page-border hover:text-page-text"
          >
            <Settings2 size={14} /> 과정 등록
          </button>
        </div>
      </div>

      {showRoster && (
        <div className="mb-6">
          <RosterManager />
        </div>
      )}

      {showAdmin && (
        <div className="mb-6">
          <CourseForm
            key={editingCourse?.id || 'new'}
            initialCourse={editingCourse}
            onSaved={() => {
              setShowAdmin(false)
              setEditingCourse(null)
              load()
            }}
            onCancel={() => {
              setShowAdmin(false)
              setEditingCourse(null)
            }}
          />
        </div>
      )}

      {loading ? (
        <LoadingBar tone="dark" />
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-base-800 bg-base-950 p-10 text-base-500">
          <ShieldCheck size={28} />
          <p className="text-sm">등록된 안전교육 과정이 없어요.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((c) => (
            <div key={c.id} className="rounded-xl border border-base-800 bg-base-950 p-4 hover:border-mist-500/50">
              <button onClick={() => setActive(c)} className="focus-ring block w-full text-left">
                <div className="mb-2 flex items-center gap-2 text-mist-500">
                  <PlayCircle size={16} />
                  <span className="text-xs">{c.questions.length}문제 · {c.passRatio ?? 80}점 이상 이수</span>
                </div>
                <p className="font-medium text-base-100">{c.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-base-400">{c.description}</p>
              </button>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => setResultsCourse(c)}
                  className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-teal-500"
                >
                  <BarChart3 size={12} className="text-teal-500" /> 이수 현황 보기
                </button>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEditCourse(c)}
                    className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-mist-500"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                  <button
                    onClick={() => removeCourse(c.id)}
                    className="focus-ring flex items-center gap-1 text-xs text-base-500 hover:text-red-500"
                  >
                    <X size={12} /> 삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
