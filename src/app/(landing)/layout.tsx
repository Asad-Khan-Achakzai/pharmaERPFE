// Public marketing layout — intentionally does NOT mount the MUI theme
// providers or AuthProvider used by the dashboard app, keeping the landing
// bundle tiny and independent of authenticated infrastructure.
import { Inter } from 'next/font/google'

import type { ChildrenType } from '@core/types'

import LandingCursor from '@/views/landing/components/LandingCursor'
import '@/views/landing/landing.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

const LandingLayout = ({ children }: ChildrenType) => {
  return (
    <div className={`${inter.variable} landing-root`}>
      <LandingCursor />
      {children}
    </div>
  )
}

export default LandingLayout
