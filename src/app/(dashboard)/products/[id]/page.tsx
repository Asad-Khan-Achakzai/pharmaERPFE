import ProductDetailPage from '@/views/products/detail/ProductDetailPage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => (
  <ProductDetailPage paramsPromise={params} />
)
export default Page
