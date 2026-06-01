import { redirect } from 'next/navigation'

/** Legacy hub removed — send users to money accounts. */
export default function Page() {
  redirect('/finance/money-accounts')
}
