'use client'

import { use, useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import CustomTextField from '@core/components/mui/TextField'
import MediaUpload from '@/components/media/MediaUpload'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { productsService } from '@/services/products.service'
import { presentationsService, type PresentationSlide, type ProductPresentation, type PresentationTheme, type PresentationSection, type SlideType, type SectionKey } from '@/services/presentations.service'

type ProductDetail = {
  _id: string
  name: string
  sku?: string | null
  brandId?: { _id: string; name?: string; code?: string | null } | string | null
  composition?: string
  genericName?: string | null
  strength?: string | null
  dosageForm?: string | null
  packSize?: string | null
  manufacturer?: string | null
  taxonomyNodeId?: { _id: string; name?: string; kind?: string } | string | null
  taxonomyPathLabels?: string[]
  description?: string | null
  indications?: string | null
  contraindications?: string | null
  dosageInstructions?: string | null
  sideEffects?: string | null
  storageInstructions?: string | null
  mrp?: number
  tp?: number
  casting?: number
  distributorPrice?: number | null
  isSampleEligible?: boolean
  sampleUnitLabel?: string | null
  imageUrl?: string | null
  isActive?: boolean
  defaultPresentationId?: string | null
}

const SLIDE_ADD_TYPES: SlideType[] = [
  'HERO',
  'PROBLEM',
  'IMAGE',
  'BENEFITS',
  'CLINICAL',
  'MOA',
  'RICH_TEXT',
  'REMINDER',
  'SUMMARY',
  'CTA'
]

const SLIDE_SECTION_DEFAULTS: Partial<Record<SlideType, { key: SectionKey; title: string }>> = {
  PROBLEM: { key: 'PROBLEM', title: 'Problem' },
  HERO: { key: 'OUR_PRODUCT', title: 'Our Product' },
  IMAGE: { key: 'CUSTOM', title: 'Image' },
  BENEFITS: { key: 'KEY_BENEFITS', title: 'Key Benefits' },
  CLINICAL: { key: 'CLINICAL_EVIDENCE', title: 'Clinical Evidence' },
  MOA: { key: 'MOA', title: 'Mechanism' },
  SUMMARY: { key: 'SUMMARY', title: 'Summary' },
  CTA: { key: 'CTA', title: 'Call To Action' },
  REMINDER: { key: 'CUSTOM', title: 'Reminder' },
  RICH_TEXT: { key: 'CUSTOM', title: 'Details' },
  VIDEO: { key: 'CUSTOM', title: 'Video' },
  PDF: { key: 'CUSTOM', title: 'Document' }
}

function newObjectId() {
  const bytes = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 12; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

const THEME_PRESETS: { label: string; theme: PresentationTheme }[] = [
  {
    label: 'Cardio Green',
    theme: { primaryColor: '#0B6E4F', secondaryColor: '#083D77', surfaceStyle: 'brandWash' }
  },
  {
    label: 'Clinical Blue',
    theme: { primaryColor: '#1D4ED8', secondaryColor: '#0F172A', surfaceStyle: 'brandWash' }
  },
  {
    label: 'Warm Teal',
    theme: { primaryColor: '#0F766E', secondaryColor: '#134E4A', surfaceStyle: 'dark' }
  },
  {
    label: 'Light Clean',
    theme: { primaryColor: '#047857', secondaryColor: '#E2E8F0', surfaceStyle: 'light' }
  }
]

const Field = ({ label, value }: { label: string; value?: ReactNode }) => (
  <Grid size={{ xs: 12, sm: 6 }}>
    <Typography variant='body2' color='text.secondary'>
      {label}
    </Typography>
    <Typography fontWeight={500}>{value ?? '—'}</Typography>
  </Grid>
)

const ProductDetailPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const productId = params.id
  const { hasPermission } = useAuth()
  const canViewCost = hasPermission('products.viewCostPrice')
  const canEditProduct = hasPermission('products.edit')
  const canViewPresentations = hasPermission('presentations.view')
  const canEditPresentations = hasPermission('presentations.edit')
  const canPublish = hasPermission('presentations.publish')

  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [assetId, setAssetId] = useState<string | null>(null)
  const [savingMedia, setSavingMedia] = useState(false)

  const [presentations, setPresentations] = useState<ProductPresentation[]>([])
  const [activePresentation, setActivePresentation] = useState<ProductPresentation | null>(null)
  const [slides, setSlides] = useState<PresentationSlide[]>([])
  const [presSections, setPresSections] = useState<PresentationSection[]>([])
  const [presTitle, setPresTitle] = useState('')
  const [presTheme, setPresTheme] = useState<PresentationTheme>({
    primaryColor: '#0B6E4F',
    secondaryColor: '#083D77',
    surfaceStyle: 'brandWash'
  })
  const [presLoading, setPresLoading] = useState(false)
  const [presSaving, setPresSaving] = useState(false)
  const [deletePresOpen, setDeletePresOpen] = useState(false)
  const [deletingPres, setDeletingPres] = useState(false)

  const loadProduct = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productsService.getById(productId)
      setProduct(res.data?.data || res.data)
    } catch (e) {
      showApiError(e, 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [productId])

  const loadPresentations = useCallback(async () => {
    if (!canViewPresentations) return
    setPresLoading(true)
    try {
      const res = await productsService.getPresentations(productId)
      const list = (res.data?.data || []) as ProductPresentation[]
      setPresentations(list)
      const preferred =
        list.find(p => p.isDefault) || list.find(p => p.status === 'PUBLISHED') || list[0] || null
      setActivePresentation(preferred)
      setPresTitle(preferred?.title || '')
      setSlides(preferred?.slides || [])
      setPresSections(preferred?.sections || [])
      setPresTheme(
        preferred?.theme || {
          primaryColor: '#0B6E4F',
          secondaryColor: '#083D77',
          surfaceStyle: 'brandWash'
        }
      )
    } catch (e) {
      showApiError(e, 'Failed to load presentations')
    } finally {
      setPresLoading(false)
    }
  }, [productId, canViewPresentations])

  useEffect(() => {
    void loadProduct()
  }, [loadProduct])

  useEffect(() => {
    if (tab === 4) void loadPresentations()
  }, [tab, loadPresentations])

  const brandName =
    product?.brandId && typeof product.brandId === 'object' ? product.brandId.name : null
  const taxonomyName =
    product?.taxonomyNodeId && typeof product.taxonomyNodeId === 'object'
      ? product.taxonomyNodeId.name
      : null

  const handleSaveMedia = async () => {
    if (!assetId || !canEditProduct) return
    setSavingMedia(true)
    try {
      await productsService.update(productId, { assetId })
      showSuccess('Product image updated')
      setAssetId(null)
      await loadProduct()
    } catch (e) {
      showApiError(e, 'Failed to update image')
    } finally {
      setSavingMedia(false)
    }
  }

  const selectPresentation = (p: ProductPresentation) => {
    setActivePresentation(p)
    setPresTitle(p.title)
    setSlides(p.slides || [])
    setPresSections(p.sections || [])
    setPresTheme(
      p.theme || {
        primaryColor: '#0B6E4F',
        secondaryColor: '#083D77',
        surfaceStyle: 'brandWash'
      }
    )
  }

  const addSlide = (type: SlideType) => {
    const slideId = newObjectId()
    const mapping = SLIDE_SECTION_DEFAULTS[type] || { key: 'CUSTOM' as SectionKey, title: type }
    // Reuse an existing matching section; for CUSTOM (e.g. Image) create a fresh tab each time.
    setPresSections(prev => {
      const reusable =
        mapping.key !== 'CUSTOM'
          ? prev.find(s => s.key === mapping.key)
          : undefined
      const section =
        reusable ||
        ({
          sectionId: newObjectId(),
          key: mapping.key,
          title: mapping.title,
          sortOrder: prev.length,
          isOptional: true,
          slideIds: []
        } as PresentationSection)

      const nextSections = reusable ? prev : [...prev, section]
      setSlides(slidesPrev => [
        ...slidesPrev,
        {
          slideId,
          type,
          title: '',
          body: '',
          sortOrder: slidesPrev.length,
          sectionId: section.sectionId,
          isOfflineEligible: true
        }
      ])
      return nextSections.map(s =>
        String(s.sectionId) === String(section.sectionId)
          ? { ...s, slideIds: [...(s.slideIds || []), slideId] }
          : s
      )
    })
  }

  const updateSlide = (idx: number, patch: Partial<PresentationSlide>) => {
    setSlides(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const removeSlide = (idx: number) => {
    setSlides(prev => {
      const removed = prev[idx]
      if (removed?.slideId) {
        setPresSections(secs =>
          secs
            .map(s => ({
              ...s,
              slideIds: (s.slideIds || []).filter(id => String(id) !== String(removed.slideId))
            }))
            .filter(s => (s.slideIds && s.slideIds.length > 0) || s.key !== 'CUSTOM')
        )
      }
      return prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sortOrder: i }))
    })
  }

  const handleCreatePresentation = async () => {
    if (!canEditPresentations) return
    setPresSaving(true)
    try {
      const res = await productsService.createPresentation(productId, {
        title: `${product?.name || 'Product'} presentation`,
        slides: []
      })
      const created = res.data?.data || res.data
      showSuccess('Presentation created')
      await loadPresentations()
      if (created) selectPresentation(created)
    } catch (e) {
      showApiError(e, 'Failed to create presentation')
    } finally {
      setPresSaving(false)
    }
  }

  const handleSavePresentation = async () => {
    if (!activePresentation || !canEditPresentations) return
    setPresSaving(true)
    try {
      // Heal any slides that still lack a section so they get a top-rail tab.
      let nextSections = [...presSections]
      const healedSlides = slides.map((s, i) => {
        if (s.sectionId) return { ...s, sortOrder: i }
        const mapping = SLIDE_SECTION_DEFAULTS[s.type] || { key: 'CUSTOM' as SectionKey, title: s.type }
        const slideId = s.slideId || newObjectId()
        let section =
          mapping.key !== 'CUSTOM' ? nextSections.find(sec => sec.key === mapping.key) : undefined
        if (!section) {
          section = {
            sectionId: newObjectId(),
            key: mapping.key,
            title: (s.title || '').trim() || mapping.title,
            sortOrder: nextSections.length,
            isOptional: true,
            slideIds: []
          }
          nextSections = [...nextSections, section]
        }
        nextSections = nextSections.map(sec =>
          String(sec.sectionId) === String(section!.sectionId)
            ? { ...sec, slideIds: [...(sec.slideIds || []).filter(id => String(id) !== String(slideId)), slideId] }
            : sec
        )
        return { ...s, slideId, sectionId: section.sectionId, sortOrder: i }
      })

      await presentationsService.update(activePresentation._id, {
        title: presTitle.trim() || activePresentation.title,
        theme: presTheme,
        sections: nextSections.map((sec, i) => ({
          sectionId: sec.sectionId,
          key: sec.key,
          title: sec.title,
          sortOrder: i,
          isOptional: sec.isOptional,
          slideIds: sec.slideIds || []
        })),
        slides: healedSlides.map((s, i) => ({
          slideId: s.slideId,
          type: s.type,
          title: s.title || '',
          body: s.body || '',
          bullets: s.bullets,
          highlight: s.highlight || null,
          sectionId: s.sectionId || null,
          assetId: s.assetId || null,
          sortOrder: i,
          isOfflineEligible: s.isOfflineEligible !== false
        }))
      })
      showSuccess('Presentation saved')
      await loadPresentations()
    } catch (e) {
      showApiError(e, 'Failed to save presentation')
    } finally {
      setPresSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!activePresentation || !canPublish) return
    setPresSaving(true)
    try {
      await presentationsService.publish(activePresentation._id)
      showSuccess('Presentation published')
      await loadPresentations()
    } catch (e) {
      showApiError(e, 'Failed to publish presentation')
    } finally {
      setPresSaving(false)
    }
  }

  const handleDeletePresentation = async () => {
    if (!activePresentation || !canEditPresentations) return
    setDeletingPres(true)
    try {
      await presentationsService.remove(activePresentation._id)
      showSuccess('Presentation deleted')
      setDeletePresOpen(false)
      setActivePresentation(null)
      setSlides([])
      setPresSections([])
      setPresTitle('')
      await loadPresentations()
    } catch (e) {
      showApiError(e, 'Failed to delete presentation')
    } finally {
      setDeletingPres(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!product) {
    return (
      <Card>
        <CardContent>
          <Typography>Product not found.</Typography>
          <Button component={Link} href='/products/list' sx={{ mt: 2 }}>
            Back to list
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader
        title={
          <Stack direction='row' alignItems='center' spacing={2}>
            <Typography variant='h5'>{product.name}</Typography>
            <Chip
              size='small'
              variant='tonal'
              color={product.isActive ? 'success' : 'default'}
              label={product.isActive ? 'Active' : 'Inactive'}
            />
          </Stack>
        }
        subheader={product.sku ? `SKU: ${product.sku}` : undefined}
        action={
          <Stack direction='row' spacing={1}>
            <Button
              component={Link}
              href={`/products/${productId}/present`}
              variant='tonal'
              startIcon={<i className='tabler-presentation' />}
            >
              Preview
            </Button>
            <Button component={Link} href='/products/list' variant='outlined'>
              Back
            </Button>
          </Stack>
        }
      />
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label='Overview' />
        <Tab label='Medical' />
        <Tab label='Commercial' />
        <Tab label='Media' />
        <Tab label='Presentations' />
      </Tabs>
      <CardContent>
        {tab === 0 && (
          <Grid container spacing={3}>
            {product.imageUrl && (
              <Grid size={{ xs: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{ maxWidth: 280, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}
                />
              </Grid>
            )}
            <Field label='Name' value={product.name} />
            <Field label='SKU' value={product.sku} />
            <Field label='Brand' value={brandName} />
            <Field label='Taxonomy' value={taxonomyName || product.taxonomyPathLabels?.join(' › ')} />
            <Field label='Generic name' value={product.genericName} />
            <Field label='Composition' value={product.composition} />
            <Field label='Strength' value={product.strength} />
            <Field label='Dosage form' value={product.dosageForm} />
            <Field label='Pack size' value={product.packSize} />
            <Field label='Manufacturer' value={product.manufacturer} />
          </Grid>
        )}

        {tab === 1 && (
          <Grid container spacing={3}>
            <Field label='Description' value={product.description} />
            <Field label='Indications' value={product.indications} />
            <Field label='Contraindications' value={product.contraindications} />
            <Field label='Dosage instructions' value={product.dosageInstructions} />
            <Field label='Side effects' value={product.sideEffects} />
            <Field label='Storage' value={product.storageInstructions} />
          </Grid>
        )}

        {tab === 2 && (
          <Grid container spacing={3}>
            <Field label='MRP' value={product.mrp != null ? `₨ ${product.mrp.toFixed(2)}` : '—'} />
            <Field label='TP' value={product.tp != null ? `₨ ${product.tp.toFixed(2)}` : '—'} />
            {canViewCost && (
              <Field
                label='Standard Cost'
                value={product.casting != null ? `₨ ${product.casting.toFixed(2)}` : '—'}
              />
            )}
            <Field
              label='Distributor price'
              value={product.distributorPrice != null ? `₨ ${product.distributorPrice.toFixed(2)}` : '—'}
            />
            <Field label='Sample eligible' value={product.isSampleEligible ? 'Yes' : 'No'} />
            <Field label='Sample unit' value={product.sampleUnitLabel} />
          </Grid>
        )}

        {tab === 3 && (
          <Stack spacing={3} maxWidth={480}>
            {product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, objectFit: 'cover' }}
              />
            )}
            {canEditProduct && (
              <>
                <MediaUpload
                  kind='PRODUCT_VISUAL'
                  value={product.imageUrl ?? null}
                  onUploaded={setAssetId}
                  label='Replace product image'
                />
                <Button
                  variant='contained'
                  disabled={!assetId || savingMedia}
                  onClick={handleSaveMedia}
                  startIcon={savingMedia ? <CircularProgress size={18} color='inherit' /> : undefined}
                >
                  Save image
                </Button>
              </>
            )}
          </Stack>
        )}

        {tab === 4 && (
          <Box>
            {!canViewPresentations ? (
              <Typography color='text.secondary'>You do not have permission to view presentations.</Typography>
            ) : presLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={3}>
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap alignItems='center'>
                  {presentations.map(p => (
                    <Chip
                      key={p._id}
                      label={`${p.title} (${p.status})`}
                      color={activePresentation?._id === p._id ? 'primary' : 'default'}
                      variant={activePresentation?._id === p._id ? 'filled' : 'tonal'}
                      onClick={() => selectPresentation(p)}
                      onDelete={
                        canEditPresentations
                          ? e => {
                              e.stopPropagation()
                              selectPresentation(p)
                              setDeletePresOpen(true)
                            }
                          : undefined
                      }
                      deleteIcon={<i className='tabler-trash' style={{ fontSize: 16 }} />}
                    />
                  ))}
                  {canEditPresentations && (
                    <Button
                      size='small'
                      variant='outlined'
                      startIcon={<i className='tabler-plus' />}
                      onClick={handleCreatePresentation}
                      disabled={presSaving}
                    >
                      New presentation
                    </Button>
                  )}
                </Stack>

                {!activePresentation ? (
                  <Typography color='text.secondary'>No presentations yet.</Typography>
                ) : (
                  <>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <CustomTextField
                        fullWidth
                        label='Title'
                        value={presTitle}
                        onChange={e => setPresTitle(e.target.value)}
                        disabled={!canEditPresentations}
                      />
                      <Chip size='small' label={activePresentation.status} />
                      {activePresentation.qualityReport?.score != null && (
                        <Chip
                          size='small'
                          color={
                            (activePresentation.qualityReport.score ?? 0) >= 80
                              ? 'success'
                              : (activePresentation.qualityReport.score ?? 0) >= 60
                                ? 'warning'
                                : 'error'
                          }
                          label={`Quality ${activePresentation.qualityReport.score}%`}
                        />
                      )}
                      {canEditPresentations && (
                        <Button variant='contained' onClick={handleSavePresentation} disabled={presSaving}>
                          Save
                        </Button>
                      )}
                      {canPublish && (
                        <Button variant='tonal' onClick={handlePublish} disabled={presSaving}>
                          Publish
                        </Button>
                      )}
                      {canEditPresentations && (
                        <Button
                          color='error'
                          variant='outlined'
                          onClick={() => setDeletePresOpen(true)}
                          disabled={presSaving || deletingPres}
                          startIcon={<i className='tabler-trash' />}
                        >
                          Delete
                        </Button>
                      )}
                      <Button
                        component={Link}
                        href={`/products/${productId}/present`}
                        variant='outlined'
                      >
                        Preview
                      </Button>
                    </Stack>

                    {!!activePresentation.qualityReport?.checks?.length && (
                      <Stack spacing={0.75}>
                        <Typography variant='subtitle2'>Presentation Quality</Typography>
                        {activePresentation.qualityReport.checks.slice(0, 8).map((c, i) => (
                          <Typography
                            key={`${c.code}-${i}`}
                            variant='body2'
                            color={
                              c.severity === 'ERROR'
                                ? 'error.main'
                                : c.severity === 'WARN'
                                  ? 'warning.main'
                                  : 'text.secondary'
                            }
                          >
                            {c.severity === 'ERROR' ? '✖' : c.severity === 'WARN' ? '⚠' : '✔'} {c.message}
                          </Typography>
                        ))}
                      </Stack>
                    )}

                    {canEditPresentations && (
                      <Stack spacing={1}>
                        <Typography variant='subtitle2'>Theme</Typography>
                        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                          {THEME_PRESETS.map(p => (
                            <Button
                              key={p.label}
                              size='small'
                              variant={
                                presTheme.primaryColor === p.theme.primaryColor ? 'contained' : 'outlined'
                              }
                              onClick={() => setPresTheme(p.theme)}
                              sx={{
                                borderColor: p.theme.primaryColor,
                                ...(presTheme.primaryColor === p.theme.primaryColor
                                  ? { bgcolor: p.theme.primaryColor }
                                  : { color: p.theme.primaryColor })
                              }}
                            >
                              {p.label}
                            </Button>
                          ))}
                        </Stack>
                      </Stack>
                    )}

                    <Divider />

                    {canEditPresentations && (
                      <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                        {SLIDE_ADD_TYPES.map(t => (
                          <Button key={t} size='small' variant='outlined' onClick={() => addSlide(t)}>
                            Add {t}
                          </Button>
                        ))}
                      </Stack>
                    )}

                    <Stack spacing={2}>
                      {slides.length === 0 && (
                        <Typography color='text.secondary'>
                          No slides yet. Start with HERO → BENEFITS → CLINICAL → SUMMARY.
                        </Typography>
                      )}
                      {slides.map((slide, idx) => (
                        <Card key={slide.slideId || idx} variant='outlined'>
                          <CardContent>
                            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 2 }}>
                              <Typography fontWeight={600}>
                                Slide {idx + 1} · {slide.type}
                              </Typography>
                              {canEditPresentations && (
                                <IconButton size='small' onClick={() => removeSlide(idx)}>
                                  <i className='tabler-trash' />
                                </IconButton>
                              )}
                            </Stack>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <CustomTextField
                                  select
                                  fullWidth
                                  label='Type'
                                  value={slide.type}
                                  onChange={e => updateSlide(idx, { type: e.target.value as SlideType })}
                                  disabled={!canEditPresentations}
                                >
                                  {SLIDE_ADD_TYPES.map(t => (
                                    <MenuItem key={t} value={t}>
                                      {t}
                                    </MenuItem>
                                  ))}
                                </CustomTextField>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 8 }}>
                                <CustomTextField
                                  fullWidth
                                  label='Title'
                                  value={slide.title || ''}
                                  onChange={e => updateSlide(idx, { title: e.target.value })}
                                  disabled={!canEditPresentations}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <CustomTextField
                                  fullWidth
                                  label='Highlight (big claim / number)'
                                  value={slide.highlight || ''}
                                  onChange={e => updateSlide(idx, { highlight: e.target.value })}
                                  disabled={!canEditPresentations}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 6 }}>
                                <CustomTextField
                                  fullWidth
                                  label='Bullets (one per line)'
                                  multiline
                                  minRows={2}
                                  value={(slide.bullets || []).join('\n')}
                                  onChange={e =>
                                    updateSlide(idx, {
                                      bullets: e.target.value
                                        .split('\n')
                                        .map(l => l.trim())
                                        .filter(Boolean)
                                    })
                                  }
                                  disabled={!canEditPresentations}
                                />
                              </Grid>
                              <Grid size={{ xs: 12 }}>
                                <CustomTextField
                                  fullWidth
                                  multiline
                                  minRows={2}
                                  label='Body'
                                  value={slide.body || ''}
                                  onChange={e => updateSlide(idx, { body: e.target.value })}
                                  disabled={!canEditPresentations}
                                />
                              </Grid>
                              {(slide.type === 'IMAGE' ||
                                slide.type === 'HERO' ||
                                slide.type === 'PROBLEM') && (
                                <Grid size={{ xs: 12 }}>
                                  <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                                    Slide image (shown when you present)
                                  </Typography>
                                  {canEditPresentations ? (
                                    <MediaUpload
                                      kind='PRESENTATION_SLIDE'
                                      value={slide.media?.url ?? null}
                                      onUploaded={id =>
                                        updateSlide(idx, {
                                          assetId: id,
                                          media: {
                                            ...(slide.media || {}),
                                            assetId: id,
                                            url: slide.media?.url || null
                                          }
                                        })
                                      }
                                      label={
                                        slide.assetId || slide.media?.url
                                          ? 'Replace slide image'
                                          : 'Upload slide image'
                                      }
                                      size={120}
                                    />
                                  ) : slide.media?.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={slide.media.url}
                                      alt=''
                                      style={{
                                        maxWidth: 160,
                                        maxHeight: 120,
                                        borderRadius: 8,
                                        objectFit: 'contain'
                                      }}
                                    />
                                  ) : (
                                    <Typography variant='body2' color='text.secondary'>
                                      No image
                                    </Typography>
                                  )}
                                  {slide.assetId && canEditPresentations && (
                                    <Button
                                      size='small'
                                      color='secondary'
                                      sx={{ mt: 1 }}
                                      onClick={() => updateSlide(idx, { assetId: null, media: null })}
                                    >
                                      Remove image
                                    </Button>
                                  )}
                                </Grid>
                              )}
                            </Grid>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            )}
          </Box>
        )}
      </CardContent>
    </Card>

    <ConfirmDialog
      open={deletePresOpen}
      onClose={() => setDeletePresOpen(false)}
      onConfirm={handleDeletePresentation}
      title='Delete presentation?'
      description={
        activePresentation
          ? `"${activePresentation.title}" will be removed. You can create a new one anytime.`
          : 'This presentation will be removed.'
      }
      confirmText='Yes, Delete'
      loading={deletingPres}
    />
    </>
  )
}

export default ProductDetailPage
