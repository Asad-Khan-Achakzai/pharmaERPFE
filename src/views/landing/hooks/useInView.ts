'use client'

import { useEffect, useRef } from 'react'

/**
 * Sets `data-inview="true"` on the returned element once it enters the viewport.
 * All reveal transitions are pure CSS keyed off that attribute, so this hook is
 * the only JS the scroll-reveal system needs. Fires once, then disconnects.
 */
export function useInView<T extends HTMLElement>(threshold = 0.08, rootMargin = '0px 0px -4% 0px') {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    if (typeof window.IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.setAttribute('data-inview', 'true')

      return
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          el.setAttribute('data-inview', 'true')
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return ref
}

/**
 * Pauses looping CSS animations while the element is off screen by toggling
 * `data-paused`. Saves battery on mobile for the hero / live-map choreography.
 */
export function useLoopPause<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current

    if (!el || typeof window.IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          el.setAttribute('data-paused', entry.isIntersecting ? 'false' : 'true')
        }
      },
      { threshold: 0.05 }
    )

    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  return ref
}
