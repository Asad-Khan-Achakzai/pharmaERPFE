import type { ReactNode } from 'react'

type Props = {
  url?: string
  children: ReactNode
  className?: string
}

/** Decorative browser chrome used to present recreated PharmaERP web UI. */
const BrowserFrame = ({ url = 'app.pharmaerp.com', children, className }: Props) => {
  return (
    <div className={`lp-frame-browser${className ? ` ${className}` : ''}`}>
      <div className='lp-frame-browser__bar' aria-hidden='true'>
        <span className='lp-frame-browser__dots'>
          <i />
          <i />
          <i />
        </span>
        <span className='lp-frame-browser__url'>{url}</span>
        <span className='lp-frame-browser__dots' style={{ visibility: 'hidden' }}>
          <i />
          <i />
          <i />
        </span>
      </div>
      {children}
    </div>
  )
}

export default BrowserFrame
