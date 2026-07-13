'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import type { PresentationSlide, PresentationSection, PresentationTheme } from '@/services/presentations.service'

type Props = {
  productName: string
  slide: PresentationSlide | undefined
  index: number
  total: number
  theme?: PresentationTheme | null
  sections?: PresentationSection[]
  visible?: boolean
}

function SlideMediaImage({
  src,
  accent
}: {
  src: string
  accent: string
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [src])

  if (failed) return null

  return (
    <Box
      sx={{
        mt: 4,
        position: 'relative',
        width: '100%',
        maxWidth: 560,
        minHeight: loaded ? undefined : 180,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
      }}
    >
      {!loaded && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pl: 1,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.08)'
          }}
        >
          <CircularProgress size={36} sx={{ color: accent }} />
        </Box>
      )}
      <Box
        component='img'
        src={src}
        alt=''
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true)
          setLoaded(true)
        }}
        sx={{
          maxHeight: 220,
          maxWidth: '100%',
          objectFit: 'contain',
          objectPosition: 'left center',
          filter: 'drop-shadow(0 12px 30px rgba(0,0,0,0.35))',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 220ms ease',
          display: 'block'
        }}
      />
    </Box>
  )
}

function parseBullets(slide?: PresentationSlide): string[] {
  if (!slide) return []
  if (Array.isArray(slide.bullets) && slide.bullets.length) return slide.bullets
  const body = (slide.body || '').trim()
  if (!body) return []
  if (body.includes('\n')) {
    return body
      .split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

export default function PresentationSlideView({
  productName,
  slide,
  index,
  total,
  theme,
  sections,
  visible = true
}: Props) {
  const primary = theme?.primaryColor || '#0B6E4F'
  const secondary = theme?.secondaryColor || '#083D77'
  const surface = theme?.surfaceStyle || 'brandWash'
  const bullets = parseBullets(slide)
  const section = useMemo(() => {
    if (!slide?.sectionId || !sections?.length) return null
    return sections.find(s => String(s.sectionId) === String(slide.sectionId)) || null
  }, [slide?.sectionId, sections])

  const [entered, setEntered] = useState(false)
  useEffect(() => {
    setEntered(false)
    const t = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(t)
  }, [slide?.slideId, index])

  // Keep backgrounds dark enough that white headings always read clearly.
  // Primary is used for accents only — never as a large washed fill behind titles.
  const bgStyle: CSSProperties = {
    background:
      surface === 'light'
        ? `linear-gradient(160deg, #f8fafc 0%, #eef2f7 55%, ${primary}22 100%)`
        : surface === 'dark'
          ? `linear-gradient(160deg, #070b14 0%, #0f172a 55%, ${secondary} 130%)`
          : `linear-gradient(145deg, #060d18 0%, ${secondary} 38%, #0a1628 72%, #071018 100%)`
  }

  const isLight = surface === 'light'
  const headingColor = isLight ? '#0b1220' : '#ffffff'
  const muted = isLight ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.82)'
  const metaColor = isLight ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.7)'
  const cardBg = isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.12)'
  const cardText = isLight ? '#0b1220' : '#ffffff'
  const accent = primary
  const headingShadow = isLight ? 'none' : '0 2px 18px rgba(0,0,0,0.55)'

  if (!slide) {
    return (
      <Box sx={{ ...bgStyle, width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ opacity: 0.6 }}>No slide</Typography>
      </Box>
    )
  }

  const type = slide.type
  const isHero = type === 'IMAGE' || type === 'HERO' || type === 'PROBLEM'
  const isBenefits = type === 'BENEFITS'
  const isClinical = type === 'CLINICAL' || type === 'MOA'
  const isSummary = type === 'SUMMARY' || type === 'CTA'
  const mediaUrl = slide.media?.url || slide.backgroundMedia?.url

  return (
    <Box
      sx={{
        ...bgStyle,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 3, md: 6 },
        py: { xs: 3, md: 4 },
        transition: 'opacity 280ms ease, transform 280ms ease',
        opacity: visible && entered ? 1 : 0,
        transform: visible && entered ? 'translateY(0)' : 'translateY(14px)'
      }}
    >
      {/* ambient orbs */}
      <Box
        sx={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `${accent}33`,
          filter: 'blur(40px)',
          top: -80,
          right: -60,
          pointerEvents: 'none'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: `${secondary}44`,
          filter: 'blur(50px)',
          bottom: -90,
          left: -40,
          pointerEvents: 'none'
        }}
      />

      <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2, zIndex: 1 }}>
        <Typography
          variant='caption'
          sx={{ letterSpacing: 1.2, textTransform: 'uppercase', color: metaColor, fontWeight: 600 }}
        >
          {productName}
          {section ? ` · ${section.title || section.key}` : ''}
        </Typography>
        <Typography variant='caption' sx={{ color: metaColor, fontWeight: 600 }}>
          {index + 1} / {total}
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        {isHero && (
          <Box sx={{ width: '100%', maxWidth: 880, textAlign: 'left' }}>
            <Chip
              label={type === 'PROBLEM' ? 'The Challenge' : 'Featured Product'}
              size='small'
              sx={{
                mb: 2,
                bgcolor: accent,
                color: '#ffffff',
                fontWeight: 700
              }}
            />
            <Typography
              sx={{
                color: headingColor,
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '3.25rem' },
                lineHeight: 1.1,
                mb: 2,
                letterSpacing: '-0.02em',
                textShadow: headingShadow
              }}
            >
              {slide.title || productName}
            </Typography>
            {slide.highlight && (
              <Typography
                sx={{
                  color: isLight ? accent : '#ffffff',
                  fontWeight: 700,
                  fontSize: { xs: '1.25rem', md: '1.75rem' },
                  mb: 2,
                  textShadow: headingShadow
                }}
              >
                {slide.highlight}
              </Typography>
            )}
            <Typography sx={{ color: muted, fontSize: { xs: '1rem', md: '1.25rem' }, maxWidth: 640, lineHeight: 1.55 }}>
              {slide.body}
            </Typography>
            {mediaUrl && <SlideMediaImage src={mediaUrl} accent={accent} />}
          </Box>
        )}

        {isBenefits && (
          <Box sx={{ width: '100%', maxWidth: 960 }}>
            <Typography
              sx={{
                color: headingColor,
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                mb: 3,
                textShadow: headingShadow
              }}
            >
              {slide.title || 'Key Benefits'}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2
              }}
            >
              {(bullets.length ? bullets : [slide.body].filter(Boolean)).map((b, i) => (
                <Box
                  key={i}
                  sx={{
                    bgcolor: cardBg,
                    borderRadius: 3,
                    p: 2.5,
                    border: `1px solid ${accent}66`,
                    backdropFilter: 'blur(8px)',
                    transition: 'transform 300ms ease, opacity 300ms ease',
                    transitionDelay: `${i * 70}ms`,
                    opacity: entered ? 1 : 0,
                    transform: entered ? 'translateY(0)' : 'translateY(12px)',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 1.5
                  }}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: accent,
                      flexShrink: 0,
                      mt: '0.45em'
                    }}
                  />
                  <Typography sx={{ color: cardText, fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.45 }}>
                    {b}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {isClinical && (
          <Box
            sx={{
              width: '100%',
              maxWidth: 820,
              bgcolor: cardBg,
              borderRadius: 4,
              p: { xs: 3, md: 5 },
              borderLeft: `6px solid ${accent}`,
              backdropFilter: 'blur(10px)'
            }}
          >
            <Typography variant='overline' sx={{ color: accent, fontWeight: 700 }}>
              Clinical Evidence
            </Typography>
            <Typography
              sx={{ color: cardText, fontWeight: 800, fontSize: { xs: '1.5rem', md: '2rem' }, mb: 2 }}
            >
              {slide.title || 'Evidence'}
            </Typography>
            {slide.highlight && (
              <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: accent, mb: 2 }}>
                {slide.highlight}
              </Typography>
            )}
            <Typography sx={{ color: muted, fontSize: '1.1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {slide.body}
            </Typography>
          </Box>
        )}

        {isSummary && (
          <Box sx={{ width: '100%', maxWidth: 860, textAlign: 'center' }}>
            <Typography
              sx={{
                color: headingColor,
                fontWeight: 800,
                fontSize: { xs: '2rem', md: '2.75rem' },
                mb: 3,
                textShadow: headingShadow
              }}
            >
              {slide.title || (type === 'CTA' ? 'Next Step' : 'Summary')}
            </Typography>
            <Stack spacing={1.5} alignItems='center'>
              {(bullets.length ? bullets : [slide.body].filter(Boolean)).map((b, i) => (
                <Box
                  key={i}
                  sx={{
                    px: 3,
                    py: 1.5,
                    borderRadius: 999,
                    bgcolor: cardBg,
                    border: `1px solid ${accent}66`,
                    minWidth: { xs: '100%', md: 420 },
                    opacity: entered ? 1 : 0,
                    transform: entered ? 'scale(1)' : 'scale(0.96)',
                    transition: `all 280ms ease ${i * 80}ms`
                  }}
                >
                  <Typography sx={{ color: cardText, fontWeight: 600 }}>{b}</Typography>
                </Box>
              ))}
            </Stack>
            {type === 'CTA' && (
              <Box
                sx={{
                  mt: 4,
                  display: 'inline-block',
                  px: 4,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: accent,
                  color: '#fff',
                  fontWeight: 700,
                  boxShadow: `0 10px 30px ${accent}66`
                }}
              >
                {slide.highlight || 'Ask for a starter pack today'}
              </Box>
            )}
          </Box>
        )}

        {!isHero && !isBenefits && !isClinical && !isSummary && (
          <Box sx={{ width: '100%', maxWidth: 760, textAlign: 'center' }}>
            <Typography variant='overline' sx={{ color: metaColor, letterSpacing: 1.4 }}>
              {type}
            </Typography>
            <Typography
              sx={{
                color: headingColor,
                fontWeight: 800,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
                mb: 2,
                textShadow: headingShadow
              }}
            >
              {slide.title || 'Slide'}
            </Typography>
            {slide.highlight && (
              <Typography sx={{ color: accent, fontWeight: 700, fontSize: '1.5rem', mb: 2 }}>
                {slide.highlight}
              </Typography>
            )}
            {bullets.length ? (
              <Stack spacing={1.25} alignItems='flex-start' sx={{ maxWidth: 560, mx: 'auto', width: '100%' }}>
                {bullets.map((b, i) => (
                  <Box
                    key={i}
                    sx={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 1.25, width: '100%' }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: accent,
                        flexShrink: 0,
                        mt: '0.5em'
                      }}
                    />
                    <Typography sx={{ color: muted, fontSize: '1.1rem', lineHeight: 1.5 }}>{b}</Typography>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ color: muted, fontSize: '1.15rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {slide.body}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
