import { wcGraphQL } from '../../lib/wc-graphql'
import { ProductCard, type Product } from '../../components/store/ProductCard'
import { parseCurrencyToCents } from '../../lib/cart-total'

const PRODUCTS_QUERY = `query ShopProducts($first: Int!) { products(first: $first, where: { status: "publish" }) { nodes { ... on SimpleProduct { slug name price shortDescription image { sourceUrl altText } } } } }`

export const revalidate = 60

export default async function ShopPage() {
  let products: Product[] = []
  try {
    const data = await wcGraphQL<{ products: { nodes: any[] } }>(PRODUCTS_QUERY, { first: 50 }, { revalidate: 60 })
    products = data.products.nodes.filter(Boolean).map((n: any) => ({
      slug: n.slug, name: n.name,
      priceCents: n.price ? parseCurrencyToCents(n.price) : 0,
      image: n.image?.sourceUrl ?? null, shortDescription: n.shortDescription ?? '',
    }))
  } catch (err) { console.error('[shop] failed to load products:', err) }

  return (
    <div className="wp-site-blocks is-layout-constrained" style={{ padding: '5rem 1.5rem' }}>
      <h1 style={{ fontSize: '2.5rem', textTransform: 'uppercase', marginBottom: '2rem' }}>Shop</h1>
      {products.length === 0 ? <p>No products available right now. Check back soon.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {products.map(p => <ProductCard key={p.slug} product={p} />)}
        </div>
      )}
    </div>
  )
}