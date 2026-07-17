import type { Metadata } from 'next'

import PrivacyPolicyPage from '@views/privacy/PrivacyPolicyPage'

export const metadata: Metadata = {
  title: 'Privacy Policy | PharmaERP',
  description:
    'Privacy Policy for PharmaERP web and mobile applications. Learn what personal, location, device, attendance, and business data we collect, how it is used, and how to request account deletion.',
  openGraph: {
    title: 'Privacy Policy | PharmaERP',
    description:
      'How PharmaERP collects and uses personal, location, device, and business data across its web and mobile field-force platform.',
    type: 'website',
    url: '/privacy'
  },
  robots: {
    index: true,
    follow: true
  }
}

const PrivacyPage = () => {
  return <PrivacyPolicyPage />
}

export default PrivacyPage
