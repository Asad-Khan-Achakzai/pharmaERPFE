import type { Metadata } from 'next'

import LandingNav from '@/views/landing/components/LandingNav'
import Hero from '@/views/landing/components/Hero'
import CapabilityStrip from '@/views/landing/components/CapabilityStrip'
import DayStory from '@/views/landing/components/DayStory'
import LiveMapSection from '@/views/landing/components/LiveMapSection'
import PlanningSection from '@/views/landing/components/PlanningSection'
import AttendanceSection from '@/views/landing/components/AttendanceSection'
import VisitJourney from '@/views/landing/components/VisitJourney'
import OrdersPipeline from '@/views/landing/components/OrdersPipeline'
import AnalyticsSection from '@/views/landing/components/AnalyticsSection'
import PersonasSection from '@/views/landing/components/PersonasSection'
import BeforeAfter from '@/views/landing/components/BeforeAfter'
import PlatformGrid from '@/views/landing/components/PlatformGrid'
import DemoCta from '@/views/landing/components/DemoCta'
import LandingFooter from '@/views/landing/components/LandingFooter'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

const TITLE = 'PharmaERP — Field Force Management for Pharmaceutical Teams'

const DESCRIPTION =
  'Plan doctor visits, track your pharmaceutical field force in real time, capture orders on the spot and see performance the same day. Web command center for managers, offline mobile app for reps.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: '/'
  },
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }]
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'PharmaERP',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/images/landing/og-image.png',
        width: 1024,
        height: 500,
        alt: 'PharmaERP — field force management for pharmaceutical teams'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/landing/og-image.png']
  }
}

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'PharmaERP',
  description: DESCRIPTION,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, Android, iOS',
  url: SITE_URL
}

const LandingPage = () => {
  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <a href='#main-content' className='lp-skip-link'>
        Skip to content
      </a>
      <LandingNav />
      <main id='main-content'>
        <Hero />
        <CapabilityStrip />
        <DayStory />
        <LiveMapSection />
        <PlanningSection />
        <AttendanceSection />
        <VisitJourney />
        <OrdersPipeline />
        <AnalyticsSection />
        <PersonasSection />
        <BeforeAfter />
        <PlatformGrid />
        <DemoCta />
      </main>
      <LandingFooter />
    </>
  )
}

export default LandingPage
