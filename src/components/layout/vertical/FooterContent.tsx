'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()

  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p className='text-sm text-textSecondary'>
        {`© ${new Date().getFullYear()} PharmaERP`}
        {!isBreakpointReached && <span>{` · Field-force & distribution platform`}</span>}
      </p>
      <div className='flex items-center gap-4'>
        <Link href='/privacy' className='text-sm text-primary'>
          Privacy Policy
        </Link>
      </div>
    </div>
  )
}

export default FooterContent
