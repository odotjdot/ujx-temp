import { notFound } from 'next/navigation'
import Image from 'next/image'
import parse from 'html-react-parser'
import { wcGraphQL } from '../../../lib/wc-graphql'
import { parseCurrencyToCents, formatCents } from '../../../lib/cart-total'
import AddToCartButton from '../../../components/store/AddToCartButton'

const PRODUCT_QUERY = `query Product($slug: ID!) { product(id: $slug, idType: SLUG) { ... on SimpleProduct { databaseId slug name description price image { sourceUrl altText } stockStatus } } }`

export const revalidate = 60

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await wcGraphQL<{ product: any }>(PRODUCT_QUERY, { slug }, { revalidate: 60 })
  if (!data.product) notFound()
  const p = data.product
  const priceCents = p.price ? parseCurrencyToCents(p.price) : 0
  const safeDescription = (p.description ?? '').replace(/<script[\s\S]*?<\/script>/gi, '')

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '4rem 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
      {p.image?.sourceUrl && <Image src={p.image.sourceUrl} alt={p.image.altText ?? p.name} width={600} height={600} style={{ width: '100%', height: 'auto' }} />}
      <div>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{p.name}</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>{formatCents(priceCents)}</p>
        <div style={{ marginBottom: '2rem' }}>{parse(safeDescription)}</div>
        <AddToCartButton productId={p.databaseId} stockStatus={p.stockStatus} />
      </div>
    </div>
  )
}