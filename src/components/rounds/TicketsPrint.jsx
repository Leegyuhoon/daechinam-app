import { TICKET_STATUS, fmtDateTime, ticketMedia } from '../../lib/rounds'

function Attach({ media }) {
  if (!media?.length) return null
  const photos = media.filter((m) => m.kind === 'photo')
  const videos = media.filter((m) => m.kind === 'video').length
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      {photos.slice(0, 4).map((p) => (
        <img key={p.url} src={p.url} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
      ))}
      {photos.length > 4 && <span className="text-base-500">+사진 {photos.length - 4}</span>}
      {videos > 0 && <span className="text-base-500">영상 {videos}개</span>}
    </span>
  )
}

// 문의 내역 PDF용 표 — 화면에는 안 보이고 PDF 저장 때만 나옴 (관리자 · 업체 페이지 공용)
export default function TicketsPrint({ id, tickets, siteName }) {
  return (
    <div id={id} className="print-only text-base-100">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-base-900 text-left">
            <th className="w-20 border border-base-700 px-2 py-1 font-medium">접수일</th>
            {siteName && <th className="w-24 border border-base-700 px-2 py-1 font-medium">현장</th>}
            <th className="w-16 border border-base-700 px-2 py-1 font-medium">구분</th>
            <th className="border border-base-700 px-2 py-1 font-medium">내용</th>
            <th className="border border-base-700 px-2 py-1 font-medium">답변 · 추가 대화</th>
            <th className="w-14 border border-base-700 px-2 py-1 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} style={{ breakInside: 'avoid' }}>
              <td className="border border-base-700 px-2 py-1 align-top">{fmtDateTime(t.createdAt)}</td>
              {siteName && <td className="border border-base-700 px-2 py-1 align-top">{siteName(t.siteId)}</td>}
              <td className="border border-base-700 px-2 py-1 align-top">{t.category}</td>
              <td className="whitespace-pre-line border border-base-700 px-2 py-1 align-top">
                {t.content}
                {t.authorName && <span className="block text-base-500">— {t.authorName}</span>}
                <Attach media={ticketMedia(t)} />
              </td>
              <td className="border border-base-700 px-2 py-1 align-top">
                {(t.messages || []).length === 0
                  ? '-'
                  : t.messages.map((m, i) => (
                      <p key={i} className="mb-1 whitespace-pre-line last:mb-0">
                        <span className="text-base-500">
                          [{m.from === 'admin' ? '답변' : '업체'} {fmtDateTime(m.at)}]
                        </span>{' '}
                        {m.text}
                        {m.executionId && <span className="text-base-500"> (전후 보고서 등록)</span>}
                        <Attach media={m.media} />
                      </p>
                    ))}
              </td>
              <td className="border border-base-700 px-2 py-1 align-top">{TICKET_STATUS[t.status] || '접수'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
