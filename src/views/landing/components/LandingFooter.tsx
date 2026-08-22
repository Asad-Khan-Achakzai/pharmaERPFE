import Link from 'next/link'

import { PLAY_STORE_ARIA_LABEL, PLAY_STORE_LABEL, PLAY_STORE_URL } from '../playStore'

const LandingFooter = () => {
  return (
    <footer className='lp-footer'>
      <div className='lp-container'>
        <div className='lp-footer__grid'>
          <div className='lp-footer__brand'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src='/brand/logo-dark.svg' alt='PharmaERP' width={170} height={30} />
            <p>
              The command center for pharmaceutical field operations — planning, live tracking, visits, orders and
              accounting in one platform.
            </p>
          </div>

          <nav className='lp-footer__col' aria-label='Product'>
            <h3>Product</h3>
            <ul>
              <li>
                <a href='#how-it-works'>How it works</a>
              </li>
              <li>
                <a href='#product'>Live field visibility</a>
              </li>
              <li>
                <a href='#platform'>Platform</a>
              </li>
            </ul>
          </nav>

          <nav className='lp-footer__col' aria-label='Get started'>
            <h3>Get started</h3>
            <ul>
              <li>
                <a href='#contact'>Book a demo</a>
              </li>
              <li>
                <Link href='/login'>Sign in</Link>
              </li>
            </ul>
          </nav>

          <div className='lp-footer__col'>
            <h3>Contact</h3>
            <ul>
              <li>
                <a href='mailto:asad.khan.achakzie@gmail.com'>asad.khan.achakzie@gmail.com</a>
              </li>
              <li>
                <a href='tel:+923118491079'>0311 8491079</a>
              </li>
            </ul>
          </div>

          <nav className='lp-footer__col' aria-label='Mobile App'>
            <h3>Mobile App</h3>
            <ul>
              <li>
                <a href={PLAY_STORE_URL} target='_blank' rel='noopener noreferrer' aria-label={PLAY_STORE_ARIA_LABEL}>
                  {PLAY_STORE_LABEL} →
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className='lp-footer__bottom'>
          <span>© {new Date().getFullYear()} PharmaERP. All rights reserved.</span>
          <Link href='/privacy'>Privacy Policy</Link>
        </div>
      </div>
    </footer>
  )
}

export default LandingFooter
