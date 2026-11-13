const BASE = '/api'

async function request(path, { headers, ...options } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...headers },
    ...options
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${path} 실패 (${res.status}) ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : res.text()
}

// 일회성 현장근무 비밀번호 — 확인되면 localStorage에 저장해두고 매 요청에 같이 보냅니다.
let spotPassword = (typeof localStorage !== 'undefined' && localStorage.getItem('daechinam_spot_pw')) || ''
// 업체 보고 관리자 비밀번호
let clientAdminPassword = (typeof localStorage !== 'undefined' && localStorage.getItem('daechinam_client_admin_pw')) || ''

export const api = {
  // 출퇴근 대시보드 — 기존 attendance 스토어 어댑터 (netlify/functions/attendance.js 참고)
  getAttendanceSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/attendance${qs ? `?${qs}` : ''}`)
  },

  // 재고 현황
  listInventory: () => request('/inventory'),
  upsertInventoryItem: (item) =>
    request('/inventory', { method: 'POST', body: JSON.stringify(item) }),
  deleteInventoryItem: (id) => request(`/inventory?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // 안전교육 — 영상을 여러 조각(청크)으로 나눠 순서대로 업로드 (대용량 지원)
  uploadSafetyVideo: async (file, onProgress) => {
    const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
    const uploadId = crypto.randomUUID()
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(file.size, start + CHUNK_SIZE)
      const chunk = file.slice(start, end)

      const res = await fetch('/api/safety-video-chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-Chunk-Index': String(i)
        },
        body: chunk
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`영상 업로드 실패 (조각 ${i + 1}/${totalChunks}) (${res.status}) ${text}`)
      }
      if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100))
    }

    const finalizeRes = await fetch('/api/safety-video-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        contentType: file.type || 'video/mp4',
        filename: file.name || 'video'
      })
    })
    if (!finalizeRes.ok) {
      const text = await finalizeRes.text().catch(() => '')
      throw new Error(`영상 업로드 마무리 실패 (${finalizeRes.status}) ${text}`)
    }
    return finalizeRes.json() // { id, url }
  },
  listCourses: () => request('/safety-courses'),
  identifyTrainee: async (name, birth) => {
    const res = await fetch('/api/training-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, birth })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) {
      throw new Error(data.error || '확인에 실패했습니다')
    }
    return data // { ok:true, verified, name }
  },
  listTrainingRoster: () => request('/training-roster'),
  upsertTrainingRosterEntry: (entry) =>
    request('/training-roster', { method: 'POST', body: JSON.stringify(entry) }),
  deleteTrainingRosterEntry: (id) =>
    request(`/training-roster?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  generateQuizFromVideo: (videoUrl, questionCount = 4) =>
    request('/safety-generate-quiz', {
      method: 'POST',
      body: JSON.stringify({ videoUrl, questionCount })
    }),
  upsertCourse: (course) =>
    request('/safety-courses', { method: 'POST', body: JSON.stringify(course) }),
  deleteCourse: (id) => request(`/safety-courses?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  submitQuizResult: (result) =>
    request('/safety-results', { method: 'POST', body: JSON.stringify(result) }),
  listResults: (courseId) =>
    request(`/safety-results${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ''}`),

  // 일회성 현장근무 (비밀번호로 보호됨)
  setSpotPassword: (pw) => {
    spotPassword = pw
    if (typeof localStorage !== 'undefined') localStorage.setItem('daechinam_spot_pw', pw)
  },
  clearSpotPassword: () => {
    spotPassword = ''
    if (typeof localStorage !== 'undefined') localStorage.removeItem('daechinam_spot_pw')
  },
  verifySpotPassword: async (pw) => {
    const res = await fetch('/api/spot-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '비밀번호가 올바르지 않습니다')
    spotPassword = pw
    if (typeof localStorage !== 'undefined') localStorage.setItem('daechinam_spot_pw', pw)
    return true
  },
  listSpotJobs: () => request('/spot-jobs', { headers: { 'X-Spot-Password': spotPassword } }),
  upsertSpotJob: (job) =>
    request('/spot-jobs', {
      method: 'POST',
      body: JSON.stringify(job),
      headers: { 'X-Spot-Password': spotPassword }
    }),
  deleteSpotJob: (id) =>
    request(`/spot-jobs?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Spot-Password': spotPassword }
    }),
  uploadSpotMedia: async (file, kind, onProgress) => {
    const CHUNK_SIZE = 4 * 1024 * 1024
    const uploadId = crypto.randomUUID()
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(file.size, start + CHUNK_SIZE)
      const chunk = file.slice(start, end)

      const res = await fetch('/api/spot-media-chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-Chunk-Index': String(i),
          'X-Spot-Password': spotPassword
        },
        body: chunk
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`파일 업로드 실패 (조각 ${i + 1}/${totalChunks}) (${res.status}) ${text}`)
      }
      if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100))
    }

    const finalizeRes = await fetch('/api/spot-media-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Spot-Password': spotPassword },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        contentType: file.type || 'application/octet-stream',
        filename: file.name || 'file',
        kind
      })
    })
    if (!finalizeRes.ok) {
      const text = await finalizeRes.text().catch(() => '')
      throw new Error(`업로드 마무리 실패 (${finalizeRes.status}) ${text}`)
    }
    const data = await finalizeRes.json() // { id, url, kind, filename }
    // <img>/<video> 태그는 커스텀 헤더를 못 보내서, 비밀번호를 링크에 같이 넣어둡니다.
    return { ...data, url: `${data.url}&pw=${encodeURIComponent(spotPassword)}` }
  },

  // 출장 보고서 (일회성 현장 관리 비밀번호 공용)
  listTripReports: () => request('/trip-reports', { headers: { 'X-Spot-Password': spotPassword } }),
  saveTripReport: (report) =>
    request('/trip-reports', {
      method: 'POST',
      body: JSON.stringify(report),
      headers: { 'X-Spot-Password': spotPassword }
    }),
  deleteTripReport: (id) =>
    request(`/trip-reports?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Spot-Password': spotPassword }
    }),
  // 영수증 사진 — 줄여서 올림
  uploadReceipt: async (file) => {
    const blob = await compressImage(file, 2000, 0.85)
    const named = new File([blob], file.name || 'receipt.jpg', { type: blob.type || file.type || 'image/jpeg' })
    return api.uploadSpotMedia(named, 'photo')
  },

  // 업체 보고 — 관리자 CRUD는 관리자 비밀번호로, 각 업체별 열람은 업체마다 다른 비밀번호로 보호
  setClientAdminPassword: (pw) => {
    clientAdminPassword = pw
    if (typeof localStorage !== 'undefined') localStorage.setItem('daechinam_client_admin_pw', pw)
  },
  clearClientAdminPassword: () => {
    clientAdminPassword = ''
    if (typeof localStorage !== 'undefined') localStorage.removeItem('daechinam_client_admin_pw')
  },
  verifyClientAdminPassword: async (pw) => {
    const res = await fetch('/api/client-report-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '비밀번호가 올바르지 않습니다')
    clientAdminPassword = pw
    if (typeof localStorage !== 'undefined') localStorage.setItem('daechinam_client_admin_pw', pw)
    return true
  },

  // 업체(회사) — 상위 개체, 업체명·비밀번호·연동현장은 여기 고정
  listClientCompanies: () =>
    request('/client-companies', { headers: { 'X-Client-Admin-Password': clientAdminPassword } }),
  upsertClientCompany: (item) =>
    request('/client-companies', {
      method: 'POST',
      body: JSON.stringify(item),
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  deleteClientCompany: (id) =>
    request(`/client-companies?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),

  // 업체별 월별 보고 (period: 'YYYY-MM')
  listClientReportPeriods: (companyId) =>
    request(`/client-reports?companyId=${encodeURIComponent(companyId)}`, {
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  upsertClientReportPeriod: (item) =>
    request('/client-reports', {
      method: 'POST',
      body: JSON.stringify(item),
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  deleteClientReportPeriod: (id) =>
    request(`/client-reports?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),

  // 정기현장 순회 관리 (관리자 비밀번호는 업체 보고와 공용)
  hasClientAdminPassword: () => !!clientAdminPassword,
  adminHeaders: () => ({ 'X-Client-Admin-Password': clientAdminPassword }),
  listRegularSiteNames: () => request('/regular-site-names'),
  listRegularOps: () =>
    request('/regular-ops', { headers: { 'X-Client-Admin-Password': clientAdminPassword } }),
  saveRegular: (collection, item) =>
    request('/regular-ops', {
      method: 'POST',
      body: JSON.stringify({ collection, item }),
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  saveRegularMany: (collection, items) =>
    request('/regular-ops', {
      method: 'POST',
      body: JSON.stringify({ collection, items }),
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  deleteRegular: (collection, id) =>
    request(`/regular-ops?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),
  // 사진은 브라우저에서 긴 변 1600px JPEG로 줄인 뒤 올립니다 (저장 용량 절약)
  uploadRegularPhoto: async (file) => {
    const blob = await compressImage(file)
    const res = await fetch('/api/regular-photo', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Client-Admin-Password': clientAdminPassword },
      body: blob
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `사진 업로드 실패 (${res.status})`)
    return data // { id, url }
  },
  replyTicket: (id, text, status, media = [], executionId = null) =>
    request('/regular-ops', {
      method: 'POST',
      body: JSON.stringify({ collection: 'tickets', action: 'reply', id, text, status, media, executionId }),
      headers: { 'X-Client-Admin-Password': clientAdminPassword }
    }),

  // 업체 담당자 페이지 (/client?c=접속코드)
  clientPortalLoad: async (code) => {
    const res = await fetch(`/api/regular-client?c=${encodeURIComponent(code)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '불러오지 못했습니다')
    return data
  },
  clientPortalPost: async (code, payload) => {
    const res = await fetch(`/api/regular-client?c=${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '전송에 실패했습니다')
    return data
  },
  clientPortalPhoto: async (code, file) => {
    const blob = await compressImage(file)
    const res = await fetch('/api/regular-photo', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg', 'X-Client-Code': code },
      body: blob
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '사진 업로드 실패')
    return data
  },

  // 사진·영상 첨부 (관리자는 비밀번호, 업체 페이지는 접속 코드로 확인)
  // 사진은 압축 후 한 번에, 영상은 4MB씩 나눠 올림 → { url, kind }
  uploadAttachment: async (file, { code, onProgress } = {}) => {
    const auth = code ? { 'X-Client-Code': code } : { 'X-Client-Admin-Password': clientAdminPassword }
    if (file.type?.startsWith('image/')) {
      const blob = await compressImage(file)
      const res = await fetch('/api/regular-photo', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg', ...auth },
        body: blob
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || '사진 업로드 실패')
      onProgress?.(100)
      return { url: data.url, kind: 'photo' }
    }
    if (!file.type?.startsWith('video/')) throw new Error('사진 또는 영상 파일만 올릴 수 있어요')
    const MAX = 300 * 1024 * 1024
    if (file.size > MAX) throw new Error('영상은 300MB 이하만 올릴 수 있어요')
    const CHUNK = 4 * 1024 * 1024
    const uploadId = crypto.randomUUID()
    const total = Math.max(1, Math.ceil(file.size / CHUNK))
    for (let i = 0; i < total; i++) {
      const res = await fetch('/api/regular-media-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Upload-Id': uploadId, 'X-Chunk-Index': String(i), ...auth },
        body: file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK))
      })
      if (!res.ok) throw new Error(`영상 업로드 실패 (${i + 1}/${total})`)
      onProgress?.(Math.round(((i + 1) / total) * 100))
    }
    const res = await fetch('/api/regular-media-finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ uploadId, totalChunks: total, size: file.size, chunkSize: CHUNK, contentType: file.type, filename: file.name })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || '영상 업로드 마무리 실패')
    return { url: data.url, kind: 'video' }
  },

  viewServiceReport: async (id) => {
    const res = await fetch(`/api/regular-report-view?id=${encodeURIComponent(id)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '보고서를 불러오지 못했습니다')
    return data.report
  },

  // 업체 담당자용 열람 (companyId + 업체별 비밀번호, period 생략 시 최신월)
  viewClientReport: async (companyId, password, period) => {
    const res = await fetch('/api/client-report-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, password, period })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error || '조회에 실패했습니다')
    return data // { ok:true, companyName, siteName, periods, report }
  }
}

// 사진 압축 — 긴 변 maxSide px, JPEG 품질 quality. 실패하면 원본 그대로 사용
async function compressImage(file, maxSide = 1600, quality = 0.8) {
  try {
    if (!file.type?.startsWith('image/')) return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
