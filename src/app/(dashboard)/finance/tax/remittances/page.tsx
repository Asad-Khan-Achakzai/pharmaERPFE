import { Suspense } from 'react'
import TaxRemittancesPage from '@/views/finance/tax/TaxRemittancesPage'

const Page = () => (
  <Suspense fallback={null}>
    <TaxRemittancesPage />
  </Suspense>
)

export default Page
