'use client'

import { useEffect, useRef } from 'react'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Animates a number from 0 to `target` with rAF + ease-out once the element
 * scrolls into view. Mutates `textContent` directly — zero React re-renders
 * during the animation.
 *
 * Callers render the final value as initial content so SSR, no-JS, and
 * reduced-motion all show the completed number. The count-down to 0 happens
 * only at the moment the animation actually starts (not on mount), so there
 * is no hydration flash.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(target: number, durationMs = 1400) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current

    if (!el) return

    const reduced =
      typeof window.IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      el.textContent = String(target)

      return
    }

    let raf = 0
    let started = false

    const run = () => {
      el.textContent = '0'
      const start = performance.now()

      const tick = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1)

        el.textContent = String(Math.round(easeOutCubic(progress) * target))

        if (progress < 1) raf = requestAnimationFrame(tick)
      }

      raf = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting) && !started) {
          started = true
          run()
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      el.textContent = String(target)
    }
  }, [target, durationMs])

  return ref
}
