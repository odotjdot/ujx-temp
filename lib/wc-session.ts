const KEY = 'woo-session'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

export function getSessionToken(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null
    const data = JSON.parse(raw) as { token?: string; createdTime?: number }
    if (!data?.token || !data?.createdTime) return null
    if (Date.now() - data.createdTime > TTL_MS) { localStorage.removeItem(KEY); return null }
    return data.token
  } catch { return null }
}
export function setSessionToken(token: string): void {
  if (typeof localStorage === 'undefined') return
  if (token === 'false' || !token) { localStorage.removeItem(KEY); return }
  localStorage.setItem(KEY, JSON.stringify({ token, createdTime: Date.now() }))
}
export function clearSessionToken(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
}