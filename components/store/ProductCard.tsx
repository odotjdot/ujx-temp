import Image from 'next/image'
import Link from 'next/link'
import { formatCents } from '../../lib/cart-total'

export interface Product { slug: string; name: string; priceCents: number; image: string | null; shortDescription?: string }

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/shop/${product.slug}`} style={{ display: 'block', border: '1px solid #333', padding: '1rem', textDecoration: 'none', color: 'inherit' }}>
      {product.image && (<Image src={product.image} alt={product.name} width={400} height={300} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />)}
      <h3 style={{ marginTop: '0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>{product.name}</h3>
      <p style={{ marginTop: '0.5rem', fontSize: '1rem' }}>{formatCents(product.priceCents)}</p>
    </Link>
  )
}