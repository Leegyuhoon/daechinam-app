// 불러오는 동안 보여 주는 골드 막대 — 접속 인트로 화면과 같은 모양
// tone: 'dark'(남색 바탕 위) | 'light'(흰 카드 안), size: 'md' | 'sm'
export default function LoadingBar({ tone = 'light', size = 'md', className = '' }) {
  const track = tone === 'dark' ? '#343C45' : '#E7EBED'
  const box = size === 'sm' ? 'py-2' : 'py-14'
  const width = size === 'sm' ? 'w-20' : 'w-28'
  return (
    <div className={`flex justify-center ${box} ${className}`} role="status" aria-label="불러오는 중">
      <div className={`h-[3px] ${width} overflow-hidden rounded-full`} style={{ background: track }}>
        <div className="loading-bar h-full rounded-full" style={{ background: '#EB9E18' }} />
      </div>
    </div>
  )
}
