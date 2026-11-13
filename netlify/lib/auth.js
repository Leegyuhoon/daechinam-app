import { getStore } from '@netlify/blobs'

// 관리자(업체 보고 비밀번호) 또는 업체 접속 코드로 확인
const ADMIN_PASSWORD = process.env.CLIENT_REPORT_ADMIN_PASSWORD

export const isAdmin = (req) => !ADMIN_PASSWORD || req.headers.get('x-client-admin-password') === ADMIN_PASSWORD

export async function clientSite(req) {
  const code = req.headers.get('x-client-code')
  if (!code) return null
  const sites = (await getStore('regular-ops').get('sites', { type: 'json' }).catch(() => null)) || []
  return sites.find((s) => s.accessCode === code && s.active !== false) || null
}

export async function canUpload(req) {
  return isAdmin(req) || !!(await clientSite(req))
}
