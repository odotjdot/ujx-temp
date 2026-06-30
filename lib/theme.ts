const THEME_CSS_URL = 'https://hq.funkmedia.net/ujamaaexpo/wp-json/fm-styles/v1/theme.css'

export async function getThemeCSS(): Promise<string> {
  try {
    const res = await fetch(THEME_CSS_URL, { next: { revalidate: 3600 } })
    if (!res.ok) {
      console.error('[theme] theme.css fetch failed:', res.status)
      return ''
    }
    const raw = await res.text()
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'string' ? parsed : raw
    } catch {
      return raw
    }
  } catch (err) {
    console.error('[theme] theme.css fetch threw:', err)
    return ''
  }
}
