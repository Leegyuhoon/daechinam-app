import { useEffect, useState } from 'react'
import { ShieldCheck, PlayCircle, CheckCircle2, XCircle, ChevronLeft, BadgeCheck } from 'lucide-react'
import { api } from '../lib/api'
import LoadingBar from './LoadingBar'

const AUTH_KEY = 'daechinam_training_auth' // { name, verified }

function QuizRunner({ course, auth, onExit }) {
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
    setResult({ score, total, percent, passed })
    setStep('result')
    await api.submitQuizResult({
      courseId: course.id,
      userName: auth.name,
      verified: auth.verified,
      score,
      total,
      passed
    })
  }

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={onExit} className="focus-ring mb-4 flex items-center gap-1 text-sm text-base-400 hover:text-base-200">
        <ChevronLeft size={16} /> 과정 목록으로
      </button>

      <div className="rounded-xl border border-base-800 bg-base-950 p-5 shadow-sm">
        <p className="mb-1 flex items-center gap-1 text-xs text-base-500">
          {auth.name}님
          {auth.verified && (
            <span className="flex items-center gap-0.5 text-mist-500">
              <BadgeCheck size={12} /> 확인됨
            </span>
          )}
        </p>
        <h1 className="mb-4 text-lg font-semibold text-base-100">{course.title}</h1>

        {step === 'video' && (
          <div>
            <div className="aspect-video overflow-hidden rounded-lg bg-black">
              <video src={course.videoUrl} controls className="h-full w-full" />
            </div>
            <p className="mt-3 text-sm text-base-400">{course.description}</p>
            <button
              onClick={() => setStep('quiz')}
              className="focus-ring mt-4 flex items-center gap-1.5 rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400"
            >
              <PlayCircle size={16} /> 시청 완료, 문제 풀기
            </button>
          </div>
        )}

        {step === 'quiz' && (
          <div className="space-y-5">
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
              className="focus-ring w-full rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-40"
            >
              제출하기
            </button>
          </div>
        )}

        {step === 'result' && result && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {result.passed ? (
              <CheckCircle2 size={44} className="text-mist-500" />
            ) : (
              <XCircle size={44} className="text-amber-500" />
            )}
            <p className="text-xl font-semibold text-base-100">
              {result.percent}점 ({result.score}/{result.total})
            </p>
            <p className="text-sm text-base-400">
              {result.passed
                ? '이수 완료! 수고하셨습니다.'
                : `${course.passRatio ?? 80}점 이상이어야 이수 처리돼요. 다시 시청해주세요.`}
            </p>
            {result.passed ? (
              <button
                onClick={onExit}
                className="focus-ring mt-2 rounded-lg border border-base-700 px-4 py-2 text-sm text-base-300"
              >
                과정 목록으로
              </button>
            ) : (
              <button
                onClick={() => {
                  setAnswers({})
                  setStep('video')
                }}
                className="focus-ring mt-2 rounded-lg bg-mist-500 px-4 py-2 text-sm font-medium text-base-950 hover:bg-mist-400"
              >
                다시 시청하기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AuthGate({ onAuthed }) {
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !/^\d{6}$/.test(birth.trim())) {
      setError('이름과 생년월일 6자리(예: 900101)를 정확히 입력해주세요.')
      return
    }
    setChecking(true)
    try {
      const res = await api.identifyTrainee(name, birth)
      const auth = { name: res.name, verified: res.verified }
      localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
      onAuthed(auth)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-base-800 bg-base-950 p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-base-100">(주)이엘씨_대치남</p>
          <p className="text-xs text-base-400">안전교육</p>
        </div>

        <label className="mb-1.5 block text-sm text-base-300">이름</label>
        <input
          autoFocus
          className="focus-ring mb-3 w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm"
          placeholder="홍길동"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mb-1.5 block text-sm text-base-300">생년월일 (6자리)</label>
        <input
          inputMode="numeric"
          maxLength={6}
          className="focus-ring w-full rounded-lg border border-base-700 bg-base-900 px-3 py-2.5 text-sm"
          placeholder="예: 900101"
          value={birth}
          onChange={(e) => setBirth(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <p className="mt-1.5 text-[12px] text-base-500">소속 회사와 상관없이 누구나 입력하고 바로 응시할 수 있어요.</p>

        {error && <p className="mt-3 text-xs text-amber-500">{error}</p>}

        <button
          type="submit"
          disabled={checking}
          className="focus-ring mt-4 w-full rounded-lg bg-mist-500 px-4 py-2.5 text-sm font-medium text-base-950 hover:bg-mist-400 disabled:opacity-50"
        >
          {checking ? '확인 중…' : '시작하기'}
        </button>
      </form>
    </div>
  )
}

export default function Training() {
  const [auth, setAuth] = useState(null)
  const [checkedStorage, setCheckedStorage] = useState(false)
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY)
    if (saved) {
      try {
        setAuth(JSON.parse(saved))
      } catch {
        localStorage.removeItem(AUTH_KEY)
      }
    }
    setCheckedStorage(true)
  }, [])

  useEffect(() => {
    api.listCourses().then(({ courses }) => setCourses(courses)).finally(() => setLoading(false))
  }, [])

  if (!checkedStorage) return null

  if (!auth) {
    return <AuthGate onAuthed={setAuth} />
  }

  if (active) {
    return (
      <div className="min-h-screen bg-base-900 px-4 py-8">
        <QuizRunner course={active} auth={auth} onExit={() => setActive(null)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-900 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-base-100">
            (주)이엘씨_대치남 안전교육
          </p>
          <p className="flex items-center gap-1 text-xs text-base-400">
            {auth.name}님, 반갑습니다.
            {auth.verified && (
              <span className="flex items-center gap-0.5 text-mist-500">
                <BadgeCheck size={12} /> 확인됨
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <LoadingBar />
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-base-800 bg-base-950 p-10 text-base-500">
            <ShieldCheck size={28} />
            <p className="text-sm">등록된 안전교육 과정이 없어요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => setActive(c)}
                className="focus-ring w-full rounded-xl border border-base-800 bg-base-950 p-4 text-left shadow-sm hover:border-mist-500/50"
              >
                <div className="mb-1.5 flex items-center gap-2 text-mist-500">
                  <PlayCircle size={16} />
                  <span className="text-xs">
                    {c.questions.length}문제 · {c.passRatio ?? 80}점 이상 이수
                  </span>
                </div>
                <p className="font-medium text-base-100">{c.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-base-400">{c.description}</p>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            localStorage.removeItem(AUTH_KEY)
            setAuth(null)
          }}
          className="focus-ring mt-6 text-xs text-base-500 hover:text-base-300"
        >
          다른 사람으로 다시 시작
        </button>
      </div>
    </div>
  )
}
