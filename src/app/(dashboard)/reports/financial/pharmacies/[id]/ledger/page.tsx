import PharmacyFinancialWorkspacePage from '@/views/reports/PharmacyFinancialWorkspacePage'

const Page = ({ params }: { params: Promise<{ id: string }> }) => (
  <PharmacyFinancialWorkspacePage paramsPromise={params} />
)

export default Page
