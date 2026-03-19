import parse from 'html-react-parser'

const WP_GRAPHQL = 'https://hq.funkmedia.net/ujamaaexpo/graphql'

async function getContactPage() {
  const res = await fetch(WP_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        page(id: "/contact/", idType: URI) {
          title
          postBlockSupportStyles
          editorBlocks(flat: true) {
            __typename
            renderedHtml
            clientId
            parentClientId
          }
        }
      }`,
    }),
    next: { revalidate: 60 },
  })
  const data = await res.json()
  return data?.data?.page
}

async function getThemeCSS() {
  const res = await fetch(
    'https://hq.funkmedia.net/ujamaaexpo/wp-json/fm-styles/v1/theme.css',
    { next: { revalidate: 3600 } }
  )
  const raw = await res.text()
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed : raw
  } catch {
    return raw
  }
}

export default async function ContactPage() {
  const [page, themeCSS] = await Promise.all([getContactPage(), getThemeCSS()])

  if (!page) {
    return <div className="flex items-center justify-center min-h-[60vh]">Page not found</div>
  }

  const blocks = (page.editorBlocks || []).filter((b: any) => !b.parentClientId)

  return (
    <>
      {/* SECURITY: Server-generated CSS from WordPress — no user content */}
      <style id="wp-global-styles">{themeCSS}</style>
      {page.postBlockSupportStyles && (
        <style id="wp-post-styles">{page.postBlockSupportStyles}</style>
      )}

      <div className="wp-site-blocks is-layout-constrained">
        {blocks.map((block: any) => {
          const html = block?.renderedHtml || ''
          if (!html) return null
          return <div key={block.clientId}>{parse(html)}</div>
        })}
      </div>
    </>
  )
}
