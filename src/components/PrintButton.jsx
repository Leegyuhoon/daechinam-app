import { Printer } from 'lucide-react'

// 화면의 특정 영역만 PDF로 저장 (브라우저 인쇄 → "PDF로 저장")
// targetId 요소에만 인쇄 스타일을 적용하고, PDF 파일 이름은 title로 지정됨
export function printElement(targetId, title) {
  const el = document.getElementById(targetId)
  if (!el) return
  const prevTitle = document.title
  el.classList.add('print-target')
  if (title) el.setAttribute('data-print-title', title)
  // 대상의 상위 요소들은 남겨 두고(레이아웃 유지) 나머지는 인쇄에서 뺌
  const ancestors = []
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    p.classList.add('print-ancestor')
    ancestors.push(p)
  }
  document.body.classList.add('printing-target')
  if (title) document.title = title
  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    el.classList.remove('print-target')
    ancestors.forEach((p) => p.classList.remove('print-ancestor'))
    el.removeAttribute('data-print-title')
    document.body.classList.remove('printing-target')
    document.title = prevTitle
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    window.print()
    setTimeout(cleanup, 1000)
  }, 50)
}

export default function PrintButton({ targetId, title, label = 'PDF 저장', className = '', small = false }) {
  return (
    <button
      type="button"
      onClick={() => printElement(targetId, title)}
      className={
        className ||
        `no-print focus-ring inline-flex items-center gap-1.5 rounded-lg border border-page-border bg-page-soft text-page-sub hover:text-page-text ${
          small ? 'px-2 py-1 text-[12px]' : 'px-3 py-1.5 text-xs'
        }`
      }
    >
      <Printer size={small ? 12 : 14} /> {label}
    </button>
  )
}
