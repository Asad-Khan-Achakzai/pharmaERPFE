'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p className='text-sm text-textSecondary'>{`© ${new Date().getFullYear()} PharmaERP`}</p>
      <div className='flex items-center gap-4'>
        <Link href='/privacy' className='text-sm text-primary'>
          Privacy Policy
        </Link>
      </div>
    </div>
  )
}

export default FooterContent
