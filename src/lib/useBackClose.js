import { useEffect, useRef } from 'react'

// 팝업이 열려 있는 동안 휴대폰(브라우저) 뒤로 가기를 누르면 페이지 이동 대신 팝업만 닫히게 함
// 팝업이 열릴 때 같은 주소로 기록을 하나 쌓고, 뒤로 가기로 그 기록이 빠지면 onClose 호출
// 팝업 안에서 다른 팝업이 열려도(중첩) 맨 위 것부터 하나씩 닫힘
export default function useBackClose(onClose) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const id = Math.random().toString(36).slice(2)
    const prev = window.history.state || {}
    window.history.pushState({ ...prev, __modals: [...(prev.__modals || []), id] }, '')

    let closedByBack = false
    const onPop = () => {
      const stack = window.history.state?.__modals || []
      if (!stack.includes(id)) {
        closedByBack = true
        onCloseRef.current?.()
      }
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      // 버튼(X·저장 등)으로 닫았으면 쌓아 둔 기록을 되돌림
      if (!closedByBack && (window.history.state?.__modals || []).includes(id)) window.history.back()
    }
  }, [])
}
