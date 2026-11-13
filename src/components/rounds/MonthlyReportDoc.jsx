import { ISSUE_STATUS, SCORE_LABEL, stars, VAT_MODES, won, chargeTotals } from '../../lib/rounds'

// 월간 정기청소 보고서 — 회사 양식의 순서(요청사항 → 작업현황 → 제안사항 → 별첨)를 따르되 디자인은 새로
// 흰 종이 기준으로 고정 (화면 테마와 무관, PDF·인쇄 그대로). 휴대폰 화면 조정은 index.css의 .mr-* 참고
const C = {
  navy: '#1D232A',
  gold: '#B9770E',
  goldSoft: '#FBF3E4',
  text: '#20262D',
  sub: '#5E6873',
  mute: '#8C949C',
  line: '#E3E6E9',
  tint: '#F5F6F8'
}

const md = (d) => (d ? `${Number(d.slice(5, 7))}.${String(Number(d.slice(8, 10))).padStart(2, '0')}` : '')
const ymd = (d) => (d ? `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8, 10))}.` : '')

// 청소 범위 → 작업내용 (구역 · 작업, 매일이 아닌 항목은 주기 표시)
export function scopeToWorkLines(scope = []) {
  return scope
    .filter((z) => z.zone || (z.items || []).length)
    .map((z) => {
      const items = (z.items || []).filter((it) => it.task)
      if (!items.length) return `${z.zone} 위생관리`
      return `${z.zone} ${items.map((it) => (it.freq && it.freq !== '매일' ? `${it.task} (${it.freq})` : it.task)).join(', ')}`
    })
}

const lastAdmin = (t) => {
  const m = [...(t.messages || [])].reverse().find((x) => x.from === 'admin' && (x.text || (x.media || []).length))
  return m ? m.text || '조치 사진 전달' : ''
}

const PILL = {
  done: { label: '완료', bg: '#E7F4EE', fg: '#1E7A52' },
  progress: { label: '처리 중', bg: '#FDF1DE', fg: '#A26408' },
  open: { label: '확인 중', bg: '#EEF0F2', fg: '#5E6873' }
}
function Pill({ kind }) {
  const p = PILL[kind] || PILL.open
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, background: p.bg, color: p.fg, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {p.label}
    </span>
  )
}

function Section({ no, title, children, right }) {
  return (
    <section style={{ marginTop: 15, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.05em' }}>{no}</span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.navy }}>{title}</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
        {right}
      </div>
      {children}
    </section>
  )
}

function SubTitle({ children }) {
  return <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: C.sub }}>{children}</p>
}

export default function MonthlyReportDoc({ siteName, month, report, data, serviceReportLink, scope = [], inspectCycleMonths = 1, vat = null }) {
  const [y, m] = month.split('-')
  const { inspections, tickets, executions, nextVisits } = data
  const issues = data.issues || []

  const workLines = report.workContent?.trim()
    ? report.workContent.split('\n').map((l) => l.replace(/^\s*[-·]\s*/, '')).filter(Boolean)
    : scopeToWorkLines(scope)

  // 특이사항 타임라인 — 점검 · 현장 이슈 · 추가 작업 + 직접 적은 메모
  const timeline = [
    ...inspections.map((v) => ({ d: v.date, tag: '점검', text: v.memo ? v.memo.replace(/\n+/g, ' ') : '본사 정기 점검 — 이상 없음' })),
    ...issues.flatMap((x) =>
      (x.items || []).map((it) => ({
        d: x.date,
        tag: '이슈',
        text: `${it.issue}${it.action ? ` → ${it.action}` : ''}`,
        warn: it.status && it.status !== 'done' ? ISSUE_STATUS[it.status] : null
      }))
    ),
    ...executions.map((e) => ({ d: e.date, tag: '작업', text: `${e.serviceName} 작업 완료${(e.before || []).length + (e.after || []).length ? ' · 별첨 사진' : ''}` }))
  ].sort((a, b) => (a.d || '').localeCompare(b.d || ''))
  const notes = report.specialNotes?.trim() ? report.specialNotes.split('\n').map((l) => l.replace(/^\s*[-·]\s*/, '')).filter(Boolean) : []
  const offMonth = !inspections.length && (Number(inspectCycleMonths) || 1) > 1

  const requests = tickets.map((t, i) => ({
    n: i + 1,
    req: t.content || '(사진·영상 첨부 요청)',
    result: lastAdmin(t) || (t.status === 'done' ? '조치 완료' : '확인 후 조치 예정'),
    status: t.status || 'open',
    ids: t.executionIds || []
  }))
  const doneReq = requests.filter((r) => r.status === 'done').length
  const issueCount = issues.reduce((n, x) => n + (x.items || []).length, 0)
  const proposals = (report.proposals || []).filter((p) => p.text || p.price)

  const photos = [
    ...executions.flatMap((e) => [
      ...(e.before || []).map((p) => ({ ...p, d: e.date, cap: e.serviceName, tag: '작업 전' })),
      ...(e.after || []).map((p) => ({ ...p, d: e.date, cap: e.serviceName, tag: '작업 후' }))
    ]),
    ...issues.flatMap((x) => (x.media || []).map((p) => ({ ...p, d: x.date, cap: '현장 이슈', tag: '현장' })))
  ]
  const isVid = (p) => p.kind === 'video' || /regular-media/.test(p.url || '')
  const pics = photos.filter((p) => !isVid(p)).slice(0, 12)
  const vids = photos.filter(isVid)

  // 장비·소모품 청구 (청구 현장 · 내역 있을 때만)
  const charges = vat ? (report.charges || []).filter((c) => c.name && Number(c.qty)) : []
  const ct = chargeTotals(charges, vat || 'none')
  // 섹션 번호는 들어가는 섹션 순서대로
  let secNo = 3
  const nextNo = () => String(++secNo).padStart(2, '0')
  const chargeNo = charges.length ? nextNo() : null
  const hasNext = nextVisits.length > 0 || !!report.nextPlan
  const nextNoLabel = hasNext ? nextNo() : null

  const writtenDate = report.writtenDate || (report.publishedAt || '').slice(0, 10) || new Date().toLocaleDateString('sv-SE')
  const rating = report.clientRating

  const kpis = [
    ['요청사항', `${requests.length}건`, requests.length ? `완료 ${doneReq}` : '접수 없음'],
    ['본사 점검', `${inspections.length}회`, offMonth ? '점검 대상 월 아님' : inspections.length ? '점검 완료' : '기록 없음'],
    ['현장 이슈', `${issueCount}건`, issueCount ? '즉시 대응' : '이슈 없음'],
    rating ? ['고객 만족도', SCORE_LABEL[rating.score], stars(rating.score)] : ['추가 작업', `${executions.length}건`, executions.length ? '별첨 사진' : '없음']
  ]

  const Header = ({ small }) => (
    <header style={{ position: 'relative', borderTop: `4px solid ${C.gold}`, paddingTop: small ? 12 : 14 }}>
      <img className="mr-logo" src="/brand/elc-cleaning-logo.png" alt="ELC cleaning services" style={{ position: 'absolute', right: 0, top: small ? 10 : 16, width: small ? 84 : 104, height: 'auto' }} />
      <p style={{ margin: 0, fontSize: 10.5, letterSpacing: '0.22em', color: C.mute, fontWeight: 600 }}>MONTHLY CLEANING REPORT</p>
      <p className="mr-title" style={{ margin: '4px 0 0', fontSize: small ? 17 : 23, fontWeight: 800, color: C.navy, letterSpacing: '-0.02em' }}>
        {y}년 {Number(m)}월 정기청소 보고서{small ? ' · 별첨' : ''}
      </p>
      <p style={{ margin: '2px 0 0', fontSize: small ? 13 : 15, fontWeight: 600, color: C.gold }}>{siteName}</p>
    </header>
  )

  return (
    <div className="mr-doc" style={{ background: '#fff', color: C.text, fontFamily: "Pretendard, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif", lineHeight: 1.55, fontSize: 12.5 }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 6px 8px' }}>
        <Header />

        {/* 기본 정보 */}
        <div className="mr-meta" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 12, background: C.tint, borderRadius: 10, padding: '8px 4px' }}>
          {[
            ['관리업체', '(주)이엘씨_대치남'],
            ['담당자', report.manager || '-'],
            ['작업자', report.workerNames || '-'],
            ['작성일', ymd(writtenDate)]
          ].map(([k, v], i) => (
            <div key={k} style={{ padding: '0 12px', borderLeft: i ? `1px solid ${C.line}` : 'none' }}>
              <p style={{ margin: 0, fontSize: 10.5, color: C.mute }}>{k}</p>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* 한눈에 보기 */}
        <div className="mr-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
          {kpis.map(([k, v, s]) => (
            <div key={k} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '7px 12px' }}>
              <p style={{ margin: 0, fontSize: 10.5, color: C.mute }}>{k}</p>
              <p style={{ margin: '1px 0 0', fontSize: 17, fontWeight: 800, color: C.navy, letterSpacing: '-0.02em' }}>{v}</p>
              <p style={{ margin: 0, fontSize: 10.5, color: k === '고객 만족도' ? C.gold : C.sub }}>{s}</p>
            </div>
          ))}
        </div>

        <Section no="01" title="요청사항" right={requests.length ? <span style={{ fontSize: 11, color: C.mute }}>완료 {doneReq} / {requests.length}</span> : null}>
          {requests.length === 0 ? (
            <p style={{ margin: 0, padding: '10px 12px', background: C.tint, borderRadius: 8, color: C.sub }}>이번 달 접수된 요청사항이 없습니다.</p>
          ) : (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
              {requests.map((r, i) => (
                <div key={r.n} className="mr-req" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: i ? `1px solid ${C.line}` : 'none', breakInside: 'avoid' }}>
                  <div style={{ padding: '7px 12px', borderRight: `1px solid ${C.line}` }}>
                    <p style={{ margin: 0, fontSize: 10.5, color: C.mute }}>요청 {r.n}</p>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.req}</p>
                  </div>
                  <div style={{ padding: '7px 12px', background: '#FCFCFD' }}>
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10.5, color: C.mute }}>결과</span> <Pill kind={r.status} />
                    </p>
                    <p style={{ margin: 0, whiteSpace: 'pre-line' }}>
                      {r.result}
                      {r.ids.length > 0 && <span style={{ color: C.mute }}> · 별첨 참조</span>}
                      {r.ids.map((id) => (
                        <a key={id} href={serviceReportLink(id)} target="_blank" rel="noreferrer" className="no-print" style={{ marginLeft: 6, color: C.gold, fontWeight: 600 }}>
                          전후 사진 보기 ›
                        </a>
                      ))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section no="02" title="작업현황">
          <SubTitle>작업내용</SubTitle>
          {workLines.length ? (
            <div className="mr-work" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 0, marginBottom: 10 }}>
              {workLines.map((l, i) => (
                <p key={i} style={{ margin: 0, display: 'flex', gap: 6 }}>
                  <span style={{ color: C.gold, fontWeight: 700 }}>✓</span>
                  <span>{l}</span>
                </p>
              ))}
            </div>
          ) : (
            <p style={{ margin: '0 0 12px', color: C.sub }}>계약 범위에 따른 정기 청소</p>
          )}

          <SubTitle>특이사항</SubTitle>
          {timeline.length || notes.length ? (
            <div style={{ marginBottom: 10 }}>
              {timeline.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2px 0', breakInside: 'avoid' }}>
                  <span style={{ flexShrink: 0, width: 40, fontSize: 11, fontWeight: 700, color: C.navy }}>{md(t.d)}</span>
                  <span
                    style={{
                      flexShrink: 0,
                      padding: '0 6px',
                      borderRadius: 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      background: t.tag === '이슈' ? C.goldSoft : C.tint,
                      color: t.tag === '이슈' ? C.gold : C.sub
                    }}
                  >
                    {t.tag}
                  </span>
                  <span>
                    {t.text}
                    {t.warn && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 600, color: '#A26408' }}>· {t.warn}</span>}
                  </span>
                </div>
              ))}
              {notes.map((n, i) => (
                <div key={`n${i}`} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ flexShrink: 0, width: 40 }} />
                  <span style={{ flexShrink: 0, padding: '0 6px', borderRadius: 4, fontSize: 10.5, fontWeight: 600, background: C.tint, color: C.sub }}>메모</span>
                  <span>{n}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: '0 0 12px', color: C.sub }}>{offMonth ? '이번 달은 정기 점검 대상 월이 아니며, 특이사항 없습니다.' : '특이사항 없습니다.'}</p>
          )}

          <SubTitle>총평</SubTitle>
          <p style={{ margin: 0, padding: '8px 14px', background: C.goldSoft, borderLeft: `3px solid ${C.gold}`, borderRadius: '0 8px 8px 0', whiteSpace: 'pre-line' }}>
            {report.summary || '특이사항 없이 정기청소를 진행하고 있습니다.'}
          </p>
        </Section>

        <Section no="03" title="제안사항">
          {proposals.length === 0 ? (
            <p style={{ margin: 0, padding: '10px 12px', background: C.tint, borderRadius: 8, color: C.sub }}>별도의 제안사항이 없습니다.</p>
          ) : (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', background: C.tint, padding: '6px 12px', fontSize: 10.5, color: C.mute }}>
                <span>제안 내용</span>
                <span>금액 안내 (정기청소 업체 할인 적용)</span>
              </div>
              {proposals.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '9px 12px', borderTop: `1px solid ${C.line}` }}>
                  <span style={{ whiteSpace: 'pre-line' }}>{p.text}</span>
                  <span style={{ fontWeight: 700, color: C.navy, whiteSpace: 'nowrap', textAlign: 'right' }}>{p.price || '별도 협의'}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {charges.length > 0 && (
          <Section no={chargeNo} title="장비·소모품 청구 내역" right={<span style={{ fontSize: 11, color: C.mute }}>{VAT_MODES[vat]}</span>}>
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 92px 104px', background: C.tint, padding: '6px 12px', fontSize: 10.5, color: C.mute }}>
                <span>품목</span>
                <span style={{ textAlign: 'right' }}>수량</span>
                <span style={{ textAlign: 'right' }}>단가</span>
                <span style={{ textAlign: 'right' }}>금액</span>
              </div>
              {charges.map((c, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 92px 104px', padding: '6px 12px', borderTop: `1px solid ${C.line}` }}>
                  <span>{c.name}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {Number(c.qty)}
                    {c.unit || ''}
                  </span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap', color: C.sub }}>{won(c.price)}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{won((Number(c.qty) || 0) * (Number(c.price) || 0))}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.line}`, background: '#FCFCFD', padding: '7px 12px', textAlign: 'right' }}>
                {vat !== 'none' && (
                  <span style={{ fontSize: 11, color: C.sub, marginRight: 12 }}>
                    공급가 {won(ct.supply)} · 부가세 {won(ct.tax)}
                  </span>
                )}
                <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>합계 {won(ct.total)}</span>
              </div>
            </div>
            {report.chargeNote && <p style={{ margin: '4px 0 0', fontSize: 11.5, color: C.sub }}>※ {report.chargeNote}</p>}
          </Section>
        )}

        <div className="mr-two" style={{ display: 'grid', gridTemplateColumns: (nextVisits.length > 0 || report.nextPlan) && rating?.comment ? '1fr 1fr' : '1fr', columnGap: 20 }}>
        {(nextVisits.length > 0 || report.nextPlan) && (
          <Section no={nextNoLabel} title="다음 달 일정">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {nextVisits.map((v) => (
                <span key={v.id} style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: '2px 10px', fontSize: 11.5 }}>
                  <b style={{ color: C.navy }}>{md(v.date)}</b> {v.type === 'service' ? v.serviceName : '본사 정기 점검'}
                </span>
              ))}
            </div>
            {report.nextPlan && <p style={{ margin: '6px 0 0', whiteSpace: 'pre-line', color: C.sub }}>{report.nextPlan}</p>}
          </Section>
        )}

        {rating?.comment && (
          <Section no={nextNo()} title="고객 의견">
            <p style={{ margin: 0, padding: '10px 14px', border: `1px solid ${C.line}`, borderRadius: 10 }}>
              <span style={{ color: C.gold, marginRight: 6 }}>{stars(rating.score)}</span>“{rating.comment}”
            </p>
          </Section>
        )}
        </div>

      </div>

      {(pics.length > 0 || vids.length > 0) && (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 6px 8px', breakBefore: 'page', pageBreakBefore: 'always' }}>
          <Header small />
          <div className="mr-photos" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            {pics.map((p, i) => (
              <figure key={p.url + i} style={{ margin: 0, breakInside: 'avoid' }}>
                <div style={{ height: 300, borderRadius: 8, overflow: 'hidden', background: C.tint }}>
                  <img src={p.url} alt={p.cap} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                <figcaption style={{ marginTop: 5, fontSize: 11, color: C.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: C.navy }}>{md(p.d)}</span>
                  <span style={{ padding: '0 6px', borderRadius: 4, background: p.tag === '작업 후' ? '#E7F4EE' : C.tint, color: p.tag === '작업 후' ? '#1E7A52' : C.sub, fontSize: 10.5, fontWeight: 600 }}>{p.tag}</span>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.cap}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {vids.length > 0 && <p style={{ marginTop: 10, fontSize: 11.5, color: C.sub }}>※ 작업 영상 {vids.length}개는 전후 보고서 링크에서 확인하실 수 있습니다.</p>}
          <footer style={{ marginTop: 20, paddingTop: 8, borderTop: `1px solid ${C.line}`, fontSize: 10.5, color: C.mute }}>(주)이엘씨_대치남 · ELC Cleaning Services</footer>
        </div>
      )}
    </div>
  )
}
