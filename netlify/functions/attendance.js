// 기존 daechinam-app이 공개해둔 /api/data 엔드포인트에서 데이터를 가져와
// 대시보드용으로 요약합니다. 원본 데이터는 { workers, sites, records, settings,
// notices, siteReports, supplyRequests, ... } 형태의 JSON 하나(key: "shared")로
// 저장되어 있습니다.
const SOURCE_URL = 'https://daechinam.netlify.app/api/data'
// 어플이 사진·영상을 서빙하는 공개 엔드포인트 — 같은 주소를 그대로 재사용
const MEDIA_BASE = 'https://daechinam.netlify.app/api/photo'

function toKstDateString(iso) {
  if (!iso) return null
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const res = await fetch(SOURCE_URL)
    if (!res.ok) throw new Error(`원본 API 응답 오류 (${res.status})`)
    const data = await res.json()

    const workers = data.workers || []
    const sites = data.sites || []
    const records = data.records || []

    const workerName = Object.fromEntries(workers.map((w) => [w.id, w.name]))
    const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]))

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const normalized = records.map((r) => ({
      id: r.id,
      workerId: r.workerId,
      workerName: workerName[r.workerId] || '알수없음',
      site: r.site || siteName[r.siteId] || '미지정',
      siteId: r.siteId || null,
      date: toKstDateString(r.clockIn) || r.date,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
      ongoing: !r.clockOut,
      outFlag: !!r.outFlag,
      flatPay: r.flatPay ?? null,
      manual: !!r.manual
    }))

    const filtered = normalized.filter((r) => {
      if (!r.date) return true
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      return true
    })

    const byDate = {}
    for (const r of filtered) {
      const d = r.date || '알수없음'
      byDate[d] = byDate[d] || { date: d, checkedIn: 0, checkedOut: 0, ongoing: 0, outFlag: 0 }
      byDate[d].checkedIn += 1
      if (r.clockOut) byDate[d].checkedOut += 1
      if (r.ongoing) byDate[d].ongoing += 1
      if (r.outFlag) byDate[d].outFlag += 1
    }
    const daily = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    const todayOngoing = filtered.filter((r) => r.ongoing)

    // 현장별 최근 30일 근무 횟수 요약
    const bySite = {}
    for (const r of filtered) {
      const key = r.site || '미지정'
      bySite[key] = (bySite[key] || 0) + 1
    }
    const siteBreakdown = Object.entries(bySite)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // 근로자 로스터 (민감정보 제외: wage, code 등은 내려주지 않음)
    const roster = workers.map((w) => ({
      id: w.id,
      name: w.name,
      siteNames: (w.siteIds || []).map((id) => siteName[id]).filter(Boolean),
      isTeamLead: !!w.isTeamLead
    }))

    // 공지사항 — 전체 + 누가 작성했는지·누가 확인했는지까지 포함 (관리 사이트에서 기간·현장별로 필터링)
    const notices = (data.notices || [])
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        siteName: n.siteName || null,
        active: !!n.active,
        createdAt: n.createdAt,
        createdByName: n.createdByName,
        readBy: (n.readBy || []).map((rb) => ({ workerName: rb.workerName, readAt: rb.readAt }))
      }))

    // 현장 리포트(사진/영상/이슈 등록) — 첨부 미디어 주소와 작성자 역할까지 포함
    const siteReports = (data.siteReports || [])
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((r) => {
        const ids = r.photoIds && r.photoIds.length > 0 ? r.photoIds : r.photoId ? [r.photoId] : []
        return {
          id: r.id,
          date: r.date,
          siteName: r.siteName,
          workerName: r.workerName,
          authorRole: r.authorRole || null,
          category: r.category,
          note: r.note,
          kind: r.kind,
          createdAt: r.createdAt,
          mediaUrls: ids.map((id) => `${MEDIA_BASE}?id=${id}`)
        }
      })

    // 비품 요청 현황 — 날짜·구매정보 포함, 전체 내려서 관리 사이트에서 필터링
    const supplyRequests = (data.supplyRequests || [])
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .map((s) => ({
        id: s.id,
        date: s.date,
        siteName: s.siteName,
        workerName: s.workerName,
        itemName: s.itemName,
        qty: s.qty,
        status: s.status,
        note: s.note,
        vendor: s.vendor || null,
        purchaseMethod: s.purchaseMethod || null,
        unitPrice: s.unitPrice ?? null,
        totalPrice: s.totalPrice ?? null,
        createdAt: s.createdAt
      }))
    const pendingSupply = supplyRequests.filter((s) => s.status !== 'delivered')

    return Response.json({
      records: filtered,
      daily,
      total: filtered.length,
      workerCount: workers.length,
      siteCount: sites.length,
      allSiteNames: sites.map((s) => s.name),
      ongoing: todayOngoing,
      siteBreakdown,
      roster,
      notices,
      siteReports,
      supplyRequests,
      pendingSupplyCount: pendingSupply.length
    })
  } catch (err) {
    return Response.json(
      { error: '출퇴근 데이터를 불러오지 못했습니다', detail: String(err) },
      { status: 500 }
    )
  }
}
