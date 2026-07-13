import ProductPresentPage from '@/views/products/detail/ProductPresentPage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => (
  <ProductPresentPage paramsPromise={params} />
)
export default Page
