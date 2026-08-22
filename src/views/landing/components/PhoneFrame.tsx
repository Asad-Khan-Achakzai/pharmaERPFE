import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

/** Decorative phone chrome used to present recreated PharmaERP mobile UI. */
const PhoneFrame = ({ children, className }: Props) => {
  return (
    <div className={`lp-phone${className ? ` ${className}` : ''}`}>
      <div className='lp-phone__screen'>
        <div className='lp-phone__notch' aria-hidden='true' />
        {children}
      </div>
    </div>
  )
}

export default PhoneFrame
