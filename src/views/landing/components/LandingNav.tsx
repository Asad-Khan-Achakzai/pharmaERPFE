'use client'

import { useEffect, useRef, useState } from 'react'

import Link from 'next/link'

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#product', label: 'Product' },
  { href: '#platform', label: 'Platform' },
  { href: '#contact', label: 'Contact' }
]

const LandingNav = () => {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ticking = false

    const onScroll = () => {
      if (ticking) return

      ticking = true

      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8)
        ticking = false
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return

    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKey)

    // Move focus into the sheet for keyboard users.
    sheetRef.current?.querySelector<HTMLElement>('a')?.focus()

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const closeMenu = () => setOpen(false)

  return (
    <header className='lp-nav' data-scrolled={scrolled || open ? 'true' : 'false'}>
      <div className='lp-container'>
        <nav className='lp-nav__inner' aria-label='Main'>
          <Link href='/' className='lp-nav__logo' aria-label='PharmaERP home'>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src='/brand/logo-horizontal.svg' alt='PharmaERP' width={170} height={30} />
          </Link>

          <div className='lp-nav__links'>
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className='lp-nav__link'>
                {link.label}
              </a>
            ))}
          </div>

          <div className='lp-nav__actions'>
            <Link href='/login' className='lp-btn lp-btn--ghost cursor-pointer' style={{ cursor: 'pointer' }}>
              Sign in
            </Link>
            <a href='#contact' className='lp-btn lp-btn--primary cursor-pointer' style={{ cursor: 'pointer' }}>
              Book a Demo
            </a>
            <button
              type='button'
              className='lp-nav__burger'
              aria-expanded={open}
              aria-controls='lp-mobile-menu'
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen(value => !value)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </nav>
      </div>

      <div id='lp-mobile-menu' ref={sheetRef} className='lp-nav__sheet' data-open={open ? 'true' : 'false'}>
        <div className='lp-nav__sheet-links'>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} onClick={closeMenu} tabIndex={open ? 0 : -1}>
              {link.label}
            </a>
          ))}
        </div>
        <div className='lp-nav__sheet-actions'>
          <Link href='/login' className='lp-btn lp-btn--secondary' onClick={closeMenu} tabIndex={open ? 0 : -1}>
            Sign in
          </Link>
          <a href='#contact' className='lp-btn lp-btn--primary' onClick={closeMenu} tabIndex={open ? 0 : -1}>
            Book a Demo
          </a>
        </div>
      </div>
    </header>
  )
}

export default LandingNav
