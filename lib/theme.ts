export async function getThemeCSS(): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_WORDPRESS_URL
    if (!base) throw new Error('NEXT_PUBLIC_WORDPRESS_URL not set')
    const url = `${base}/wp-json/fm-styles/v1/theme.css`
    const res = await fetch(url, { next: { revalidate: 3600 } })
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
