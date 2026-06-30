import parse from 'html-react-parser'

const ENDPOINT = () => {
  const base = process.env.NEXT_PUBLIC_WORDPRESS_URL
  if (!base) throw new Error('NEXT_PUBLIC_WORDPRESS_URL not set')
  return `${base}/graphql`
}

async function getHomePage() {
  const settingsRes = await fetch(ENDPOINT(), {
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

  const pageRes = await fetch(ENDPOINT(), {
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
    return (
      <div className="wp-site-blocks is-layout-constrained" style={{ padding: '5rem 1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>This site is being set up.</h1>
        <p style={{ color: 'var(--wp--preset--color--bone, #999)', maxWidth: '500px', margin: '0 auto' }}>
          No front page is configured yet. If you&apos;re the admin, set a static front page in WordPress &gt; Settings &gt; Reading.
        </p>
      </div>
    )
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
          // Strip <script> tags from any WP-rendered block content (WP HTML can contain script blocks)
          const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '')
          return parse(clean)
        })}
      </div>
    </>
  )
}
