import { Suspense } from 'react'
import TaxRemittancesPage from '@/views/finance/tax/TaxRemittancesPage'

/** Legacy path — UI renamed to Tax Remittances. */
const Page = () => (
  <Suspense fallback={null}>
    <TaxRemittancesPage />
  </Suspense>
)

export default Page
