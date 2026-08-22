'use client'

import { useEffect } from 'react'

const CLICKABLE = 'a, button, .lp-btn, .lp-nav__link, .lp-nav__burger'

/** Force the OS pointer to a hand over landing controls.
 *  Some browsers ignore `cursor` on composited descendants (overflow/filter/transform).
 *  Setting it on `html`/`body` is the reliable override. */
const LandingCursor = () => {
  useEffect(() => {
    const root = document.querySelector('.landing-root')
    if (!root) return

    const setHand = () => {
      document.documentElement.style.setProperty('cursor', 'pointer', 'important')
      document.body.style.setProperty('cursor', 'pointer', 'important')
    }

    const clearHand = () => {
      document.documentElement.style.removeProperty('cursor')
      document.body.style.removeProperty('cursor')
    }

    const onMove = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      if (target.closest(CLICKABLE)) setHand()
      else clearHand()
    }

    root.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerleave', clearHand)

    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', clearHand)
      clearHand()
    }
  }, [])

  return null
}

export default LandingCursor
