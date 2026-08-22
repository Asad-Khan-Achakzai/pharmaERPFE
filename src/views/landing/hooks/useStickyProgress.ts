'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Drives the "A day with PharmaERP" sticky storytelling section.
 *
 * Deterministic scroll mapping (replaces IntersectionObserver ratio selection,
 * which oscillated at step boundaries and restarted the panel crossfade).
 *
 * - One passive, rAF-throttled scroll listener.
 * - Step offsets cached; re-measured on resize and container size changes.
 * - The step whose vertical band contains the viewport center is the candidate.
 * - Adjacent switches require ~15% of the incoming step's height past the
 *   boundary (hysteresis) so the index cannot flicker.
 * - Jumps of more than one step (fast scroll) commit immediately.
 * - React state changes only when the active index actually changes.
 * - No-op below the desktop breakpoint (sticky stage is hidden; mobile uses
 *   per-step reveals instead).
 */
export function useStickyProgress(stepCount: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeStep, setActiveStep] = useState(0)
  const activeRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current

    if (!container) return

    const steps = Array.from(container.querySelectorAll<HTMLElement>('[data-step-index]'))

    if (steps.length === 0) return

    const desktop = window.matchMedia('(min-width: 992px)')

    let bands: { top: number; height: number }[] = []
    let boundaries: number[] = []
    let raf = 0

    const measure = () => {
      const scrollY = window.scrollY

      bands = steps.map(el => {
        const rect = el.getBoundingClientRect()

        return { top: rect.top + scrollY, height: Math.max(rect.height, 1) }
      })

      boundaries = []

      for (let i = 0; i < bands.length - 1; i++) {
        const bottom = bands[i].top + bands[i].height

        boundaries.push((bottom + bands[i + 1].top) / 2)
      }
    }

    const commit = (index: number) => {
      if (index === activeRef.current) return

      activeRef.current = index
      setActiveStep(index)
    }

    const pick = () => {
      if (!desktop.matches || bands.length === 0) return

      const center = window.scrollY + window.innerHeight / 2
      const current = activeRef.current

      let candidate = 0

      while (candidate < boundaries.length && center > boundaries[candidate]) candidate++

      if (candidate === current) return

      // Fast scroll past multiple steps: land on the true candidate immediately
      // so the UI never lags a full step behind. Adjacent switches keep hysteresis.
      if (Math.abs(candidate - current) > 1) {
        commit(candidate)

        return
      }

      const crossed = candidate > current ? boundaries[candidate - 1] : boundaries[candidate]
      const traveled = candidate > current ? center - crossed : crossed - center
      const threshold = 0.15 * (bands[candidate]?.height ?? 120)

      if (traveled < threshold) return

      commit(candidate)
    }

    const onScroll = () => {
      if (raf) return

      raf = requestAnimationFrame(() => {
        raf = 0
        pick()
      })
    }

    const remeasure = () => {
      measure()
      pick()
    }

    measure()
    pick()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', remeasure)
    desktop.addEventListener('change', remeasure)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measure()
            pick()
          })
        : null

    resizeObserver?.observe(container)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', remeasure)
      desktop.removeEventListener('change', remeasure)
      resizeObserver?.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [stepCount])

  return { containerRef, activeStep }
}
