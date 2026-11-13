// 출장 보고서 문서 — 회사 HWP 양식과 같은 배치 (A4 · 흰 바탕 · 검은 글씨, 화면 테마와 무관)
const B = '1px solid #000'
const HEAD_BG = '#d9d9d9'
const cell = { border: B, padding: '7px 10px', fontSize: 13, verticalAlign: 'middle' }
const headCell = { ...cell, background: HEAD_BG, textAlign: 'center', letterSpacing: '0.35em', width: '23%' }

export const daysOf = (s, e) => (s && e && e > s ? Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1 : s ? 1 : 0)
const ymd = (d) => {
  if (!d) return '0000년 00월 00일'
  const [y, m, dd] = d.split('-')
  return `${y}년 ${m}월 ${dd}일`
}
const md = (d) => {
  if (!d) return ''
  const [, m, dd] = d.split('-')
  return `${m}월 ${dd}일`
}
const won = (n) => `${(Number(n) || 0).toLocaleString('ko-KR')}원`

export default function TripReportDoc({ r }) {
  const days = daysOf(r.startDate, r.endDate)
  const members = (r.members || []).filter((m) => m.name || m.role)
  const zones = (r.zones || []).filter((z) => z.name || z.status)
  const schedule = (r.schedule || []).filter((s) => s.text)
  const receipts = (r.receipts || []).filter((x) => x.desc || x.url)
  const total = receipts.reduce((n, x) => n + (Number(x.amount) || 0), 0)
  const [ry, rm, rd] = (r.reportDate || '').split('-')

  return (
    <div style={{ background: '#fff', color: '#000', fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", lineHeight: 1.6 }}>
      {/* 1쪽 — 보고서 */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
          <tbody>
            <tr>
              <td rowSpan={2} style={{ ...cell, width: '18%', textAlign: 'center', padding: 6 }}>
                <img src="/brand/elc-logo.png" alt="ELC CLEANING SERVICE" style={{ width: 70, height: 'auto' }} />
              </td>
              <td rowSpan={2} style={{ ...cell, textAlign: 'center', fontSize: 24, fontWeight: 700, letterSpacing: '0.6em' }}>
                출장보고서
              </td>
              <td rowSpan={2} style={{ ...cell, width: 30, textAlign: 'center', fontSize: 13, padding: 2, lineHeight: 1.8 }}>
                결<br />재
              </td>
              <td style={{ ...cell, width: 70, textAlign: 'center', padding: 3 }}>담당</td>
              <td style={{ ...cell, width: 70, textAlign: 'center', padding: 3 }}>대표</td>
            </tr>
            <tr>
              <td style={{ ...cell, height: 54 }} />
              <td style={{ ...cell, height: 54 }} />
            </tr>
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={headCell}>소속부서</td>
              <td style={{ ...cell, textAlign: 'center', width: '27%' }}>{r.dept}</td>
              <td style={headCell}>출장자</td>
              <td style={{ ...cell, textAlign: 'center' }}>{r.traveler}</td>
            </tr>
            <tr>
              <td style={headCell}>출장장소</td>
              <td colSpan={3} style={{ ...cell, textAlign: 'center' }}>
                {r.place}
              </td>
            </tr>
            <tr>
              <td style={headCell}>출장목적</td>
              <td colSpan={3} style={{ ...cell, textAlign: 'center' }}>
                {r.purpose}
              </td>
            </tr>
            <tr>
              <td style={headCell}>출장기간</td>
              <td colSpan={3} style={{ ...cell, textAlign: 'center' }}>
                {ymd(r.startDate)} 부터 {ymd(r.endDate || r.startDate)} 까지 (총 {String(days).padStart(2, '0')}일)
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ ...cell, background: HEAD_BG, textAlign: 'center', letterSpacing: '0.35em' }}>
                내용
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ ...cell, padding: '12px 14px', verticalAlign: 'top', height: 420 }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, textDecoration: 'underline' }}>※업무 수행 사항※</p>
                {r.overview && <p style={{ margin: '0 0 12px', whiteSpace: 'pre-line' }}>{r.overview}</p>}
                {schedule.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {schedule.map((s, i) => (
                      <p key={i} style={{ margin: 0, whiteSpace: 'pre-line' }}>
                        {s.date ? `${md(s.date)} ` : ''}
                        {s.text}
                      </p>
                    ))}
                  </div>
                )}
                {members.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: 0 }}>&nbsp;* 청소작업을 위한 필요한 출장 인원 총 {members.length}명</p>
                    {members.map((m, i) => (
                      <p key={i} style={{ margin: 0, paddingLeft: 14 }}>
                        - {m.name}
                        {m.role ? ` : ${m.role}` : ''}
                      </p>
                    ))}
                  </div>
                )}
                {zones.length > 0 && (
                  <div>
                    <p style={{ margin: 0 }}>&nbsp;* 청소구역 및 완료 상황</p>
                    {zones.map((z, i) => (
                      <p key={i} style={{ margin: 0, paddingLeft: 14 }}>
                        {i + 1}. {z.name}
                        {z.status ? ` : ${z.status}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ ...cell, background: HEAD_BG, textAlign: 'center', letterSpacing: '0.2em' }}>
                기타 보고사항
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ ...cell, textAlign: 'center', whiteSpace: 'pre-line', padding: '12px 14px' }}>
                {r.otherNotes || '이상 없음.'}
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ textAlign: 'center', margin: '22px 0 26px', fontSize: 14 }}>위와 같이 보고 합니다.</p>
        <p style={{ textAlign: 'center', margin: '0 0 22px', fontSize: 14, wordSpacing: '0.4em' }}>
          {ry || '0000'}년 &nbsp;&nbsp; {rm || '00'}월 &nbsp;&nbsp; {rd || '00'}일
        </p>
        <p style={{ textAlign: 'right', margin: 0, fontSize: 14 }}>
          출 장 자 : &nbsp;&nbsp; {r.traveler} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (인)
        </p>
      </div>

      {/* 2쪽 — 출장 경비 증빙 */}
      {receipts.length > 0 && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: 8, breakBefore: 'page', pageBreakBefore: 'always' }}>
          <p style={{ margin: '24px 0 14px', fontSize: 16, fontWeight: 700 }}>출장 경비 증빙 첨부</p>
          {receipts.map((x, i) => (
            <div key={x.id || i} style={{ marginBottom: 18, breakInside: 'avoid' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13 }}>
                ({i + 1}) {x.desc}
                {x.amount ? ` — ${won(x.amount)}` : ''}
              </p>
              {x.url && <img src={x.url} alt={`영수증 ${i + 1}`} style={{ maxWidth: '100%', maxHeight: 520, border: '1px solid #ccc' }} />}
            </div>
          ))}
          {total > 0 && (
            <p style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, borderTop: B, paddingTop: 8 }}>경비 합계 : {won(total)}</p>
          )}
        </div>
      )}
    </div>
  )
}
