import parse from 'html-react-parser'

const WP_GRAPHQL = 'https://hq.funkmedia.net/ujamaaexpo/graphql'

async function getHomePage() {
  const settingsRes = await fetch(WP_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        allSettings {
          readingSettingsShowOnFront
          readingSettingsPageOnFront
        }
      }`,
    }),
    next: { revalidate: 60 },
  })
  const settings = await settingsRes.json()
  const pageId = settings?.data?.allSettings?.readingSettingsPageOnFront
  if (!pageId) return null

  const pageRes = await fetch(WP_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query GetHome($id: ID!) {
        page(id: $id, idType: DATABASE_ID) {
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
      variables: { id: String(pageId) },
    }),
    next: { revalidate: 60 },
  })
  const page = await pageRes.json()
  return page?.data?.page
}

export default async function HomePage() {
  const page = await getHomePage()

  if (!page) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>Loading...</div>
  }

  const blocks = (page.editorBlocks || []).filter((b: any) => !b.parentClientId)

  return (
    <>
      {/* Per-page block support styles (wp-elements-*, wp-container-*) */}
      {page.postBlockSupportStyles && (
        <style id="wp-post-styles">{page.postBlockSupportStyles}</style>
      )}

      <div className="wp-site-blocks is-layout-constrained">
        {blocks.map((block: any) => {
          const html = block?.renderedHtml || ''
          if (!html) return null
          if (html.includes('wpforms')) return null
          const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          return parse(clean)
        })}
      </div>
    </>
  )
}
