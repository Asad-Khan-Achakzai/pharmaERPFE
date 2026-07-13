'use client'

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { productsService } from '@/services/products.service'
import type {
  PresentationSlide,
  ProductPresentation,
  PresentationSection
} from '@/services/presentations.service'
import { showApiError } from '@/utils/apiErrors'
import PresentationSlideView from './PresentationSlideView'

const ProductPresentPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const productId = params.id

  const [loading, setLoading] = useState(true)
  const [productName, setProductName] = useState('')
  const [presentation, setPresentation] = useState<ProductPresentation | null>(null)
  const [slides, setSlides] = useState<PresentationSlide[]>([])
  const [sections, setSections] = useState<PresentationSection[]>([])
  const [index, setIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const [chromeVisible, setChromeVisible] = useState(true)

  const loadGen = useRef(0)

  useEffect(() => {
    const gen = ++loadGen.current
    let cancelled = false

    ;(async () => {
      setLoading(true)
      try {
        const [productRes, defaultRes, listRes] = await Promise.all([
          productsService.getById(productId),
          productsService.getDefaultPresentation(productId).catch(() => null),
          productsService.getPresentations(productId).catch(() => null)
        ])
        if (cancelled || gen !== loadGen.current) return

        const product = productRes.data?.data || productRes.data
        setProductName(product?.name || 'Product')

        let pres: ProductPresentation | null = defaultRes?.data?.data || defaultRes?.data || null
        if (!pres) {
          const list = (listRes?.data?.data || []) as ProductPresentation[]
          pres = list.find(p => p.status === 'PUBLISHED') || list[0] || null
        }
        setPresentation(pres)
        const ordered = [...(pres?.slides || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        setSlides(ordered)
        setSections([...(pres?.sections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
        setIndex(0)
      } catch (e) {
        if (!cancelled && gen === loadGen.current) showApiError(e, 'Failed to load presentation')
      } finally {
        if (!cancelled && gen === loadGen.current) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!chromeVisible) return
    const t = setTimeout(() => setChromeVisible(false), 2500)
    return () => clearTimeout(t)
  }, [chromeVisible, index])

  const go = useCallback(
    (delta: number) => {
      setChromeVisible(true)
      setIndex(i => {
        const next = i + delta
        if (next < 0 || next >= slides.length) return i
        return next
      })
    },
    [slides.length]
  )

  const jumpToSlide = (slideIndex: number) => {
    if (slideIndex < 0 || slideIndex >= slides.length) return
    setIndex(slideIndex)
    setChromeVisible(true)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Escape') {
        window.history.back()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const slide = slides[index]
  const progress = slides.length ? ((index + 1) / slides.length) * 100 : 0
  const theme = presentation?.theme
  const primary = theme?.primaryColor || '#0B6E4F'

  /** One chip per section (first slide), plus a chip for each slide with no section. */
  const railChips = useMemo(() => {
    const bySection = new Map(sections.map(s => [String(s.sectionId), s]))
    const seen = new Set<string>()
    const chips: { key: string; label: string; slideIndex: number; active: boolean }[] = []
    slides.forEach((sl, idx) => {
      const sid = sl.sectionId ? String(sl.sectionId) : null
      if (sid) {
        if (seen.has(sid)) return
        seen.add(sid)
        const sec = bySection.get(sid)
        chips.push({
          key: `sec-${sid}`,
          label: sec?.title || sec?.key || 'Section',
          slideIndex: idx,
          active: String(slide?.sectionId) === sid
        })
      } else {
        chips.push({
          key: `slide-${sl.slideId || idx}`,
          label: (sl.title || '').trim() || (sl.type === 'IMAGE' ? 'Image' : sl.type),
          slideIndex: idx,
          active: index === idx
        })
      }
    })
    return chips
  }, [sections, slides, slide?.sectionId, index])

  if (loading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: '#0b1220',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1400
        }}
      >
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    )
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        bgcolor: '#0b1220'
      }}
      onMouseMove={() => setChromeVisible(true)}
      onTouchStart={e => {
        setChromeVisible(true)
        setTouchStartX(e.changedTouches[0]?.clientX ?? null)
      }}
      onTouchEnd={e => {
        if (touchStartX == null) return
        const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX
        setTouchStartX(null)
        // Ignore tiny movements (taps); only swipe navigates.
        if (Math.abs(dx) < 50) return
        if (dx < 0) go(1)
        else go(-1)
      }}
    >
      <Box sx={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <PresentationSlideView
          productName={productName}
          slide={slide}
          index={index}
          total={slides.length}
          theme={theme}
          sections={sections}
        />

        {/* left/right hit zones — exclude top chrome so section chips don't fight navigation */}
        <Box
          onClick={e => {
            e.stopPropagation()
            go(-1)
          }}
          sx={{ position: 'absolute', top: 100, bottom: 0, left: 0, width: '28%', zIndex: 2, cursor: 'w-resize' }}
        />
        <Box
          onClick={e => {
            e.stopPropagation()
            go(1)
          }}
          sx={{ position: 'absolute', top: 100, bottom: 0, right: 0, width: '28%', zIndex: 2, cursor: 'e-resize' }}
        />

        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            px: 2,
            py: 1.5,
            zIndex: 5,
            opacity: chromeVisible ? 1 : 0,
            transition: 'opacity 250ms ease',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)'
          }}
        >
          <Typography variant='body2' color='#fff'>
            {productName}
            {slides.length ? ` · ${index + 1}/${slides.length}` : ''}
          </Typography>
          <IconButton component={Link} href={`/products/${productId}`} sx={{ color: '#fff' }} size='small'>
            <i className='tabler-x' />
          </IconButton>
        </Stack>

        {railChips.length > 0 && (
          <Stack
            direction='row'
            spacing={1}
            sx={{
              position: 'absolute',
              top: 56,
              left: 16,
              right: 16,
              zIndex: 5,
              overflowX: 'auto',
              pb: 1,
              opacity: chromeVisible ? 1 : 0,
              transition: 'opacity 250ms ease'
            }}
          >
            {railChips.map(chip => (
              <Chip
                key={chip.key}
                label={chip.label}
                size='small'
                onClick={() => jumpToSlide(chip.slideIndex)}
                sx={{
                  bgcolor: chip.active ? primary : 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontWeight: chip.active ? 700 : 500,
                  backdropFilter: 'blur(6px)'
                }}
              />
            ))}
          </Stack>
        )}
      </Box>

      {/* progress */}
      <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.12)' }}>
        <Box
          sx={{
            height: '100%',
            width: `${progress}%`,
            bgcolor: primary,
            transition: 'width 280ms ease'
          }}
        />
      </Box>
    </Box>
  )
}

export default ProductPresentPage
