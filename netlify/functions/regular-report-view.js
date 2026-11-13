import { getStore } from '@netlify/blobs'

// GET /api/regular-report-view?id=<서비스 실행 id>
// 업체 담당자에게 링크로 보내는 "작업 전후 보고서" — 로그인 없이, 추측할 수 없는 id로만 열람
export default async (req) => {
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ ok: false, error: '잘못된 링크입니다' }, { status: 400 })

  try {
    const store = getStore('regular-ops')
    const [executions, sites] = await Promise.all([
      store.get('executions', { type: 'json' }).catch(() => null),
      store.get('sites', { type: 'json' }).catch(() => null)
    ])
    const ex = (executions || []).find((x) => x.id === id)
    if (!ex) return Response.json({ ok: false, error: '보고서를 찾을 수 없습니다' }, { status: 404 })
    const site = (sites || []).find((s) => s.id === ex.siteId)

    return Response.json({
      ok: true,
      report: {
        siteName: site?.name || ex.siteName || '',
        serviceName: ex.serviceName || '',
        date: ex.date || '',
        worker: ex.worker || '',
        note: ex.note || '',
        fromTicket: !!ex.ticketId,
        before: (ex.before || []).map((p) => ({ url: p.url, kind: p.kind || 'photo', caption: p.caption || '' })),
        after: (ex.after || []).map((p) => ({ url: p.url, kind: p.kind || 'photo', caption: p.caption || '' }))
      }
    })
  } catch (err) {
    return Response.json({ ok: false, error: '조회 실패', detail: String(err) }, { status: 500 })
  }
}
