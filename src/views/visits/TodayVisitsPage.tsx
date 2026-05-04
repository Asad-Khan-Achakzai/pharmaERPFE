'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Switch from '@mui/material/Switch'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Autocomplete from '@mui/material/Autocomplete'
import Paper from '@mui/material/Paper'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { planItemsService } from '@/services/planItems.service'
import { visitsService } from '@/services/visits.service'
import { doctorsService } from '@/services/doctors.service'
import { productsService } from '@/services/products.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import {
  getNextPlanItemId,
  parseTodayExecutionResponse,
  type TodayExecutionPayload,
  type TodayExecutionSummary
} from '@/utils/planExecutionPayload'

type ProductOption = { _id: string; name?: string }

const UNPLANNED_REASONS = [
  { id: 'EMERGENCY', label: 'Emergency' },
  { id: 'AVAILABLE_UNEXPECTEDLY', label: 'Available unexpectedly' },
  { id: 'OTHER', label: 'Other' }
] as const

const statusChip = (status: string): 'default' | 'success' | 'error' | 'warning' => {
  if (status === 'VISITED') return 'success'
  if (status === 'MISSED') return 'error'
  return 'default'
}

const toggleProduct = (list: ProductOption[], p: ProductOption): ProductOption[] => {
  const id = String(p._id)
  const exists = list.some(x => String(x._id) === id)
  if (exists) return list.filter(x => String(x._id) !== id)
  return [...list, p]
}

const TodayVisitsPage = () => {
  const { hasPermission } = useAuth()
  const canMark = hasPermission('weeklyPlans.markVisit')
  const [execution, setExecution] = useState<TodayExecutionPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [markOpen, setMarkOpen] = useState(false)
  const [unplannedOpen, setUnplannedOpen] = useState(false)
  const [activeItem, setActiveItem] = useState<any | null>(null)
  const [notes, setNotes] = useState('')
  const [orderTaken, setOrderTaken] = useState(false)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [markProducts, setMarkProducts] = useState<ProductOption[]>([])
  const [primaryProductId, setPrimaryProductId] = useState('')
  const [samplesQty, setSamplesQty] = useState(0)
  const [followUpDate, setFollowUpDate] = useState('')
  const [outOfOrderReason, setOutOfOrderReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [unplannedDoctor, setUnplannedDoctor] = useState('')
  const [selectedUnplannedDoctor, setSelectedUnplannedDoctor] = useState<any | null>(null)
  const [unplannedReason, setUnplannedReason] = useState<string>('EMERGENCY')
  const [unplannedNotes, setUnplannedNotes] = useState('')
  const [unplannedOrder, setUnplannedOrder] = useState(false)
  const [unplannedProducts, setUnplannedProducts] = useState<ProductOption[]>([])
  const [unplannedPrimary, setUnplannedPrimary] = useState('')
  const [unplannedSamplesQty, setUnplannedSamplesQty] = useState(0)
  const [unplannedFollowUp, setUnplannedFollowUp] = useState('')

  const items = execution?.items ?? []
  const summary: TodayExecutionSummary | null = execution?.summary ?? null
  const dayState = execution?.dayExecutionState ?? null
  const nextItem = (execution?.nextPlanItem ?? null) as any
  const nextPlanItemId = getNextPlanItemId(execution)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listRes = await planItemsService.listToday({ date })
      const parsed = parseTodayExecutionResponse(listRes as { data: { data?: unknown } })
      setExecution(parsed)
    } catch (e) {
      showApiError(e, 'Failed to load plan')
      setExecution(null)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void load()
  }, [load])

  const loadProducts = useCallback(async () => {
    try {
      const r = await productsService.lookup({ limit: 40, isActive: 'true' })
      setProductOptions(((r.data as { data?: ProductOption[] })?.data || []) as ProductOption[])
    } catch {
      setProductOptions([])
    }
  }, [])

  const openMark = (i: any) => {
    setActiveItem(i)
    setNotes('')
    setOrderTaken(false)
    setPrimaryProductId('')
    setSamplesQty(0)
    setFollowUpDate('')
    setOutOfOrderReason('')
    setMarkProducts([])
    void loadProducts()
    setMarkOpen(true)
  }

  const submitMark = async () => {
    if (!activeItem || !execution) return
    const expectedNext = getNextPlanItemId(execution)
    const isOutOfSequence = Boolean(
      expectedNext && activeItem.status === 'PENDING' && String(activeItem._id) !== expectedNext
    )
    if (isOutOfSequence && outOfOrderReason.trim().length < 3) {
      showApiError(null, 'Out-of-sequence visit: add a short reason (3+ characters) or complete the next stop first.')
      return
    }
    setSubmitting(true)
    try {
      const productsDiscussed = markProducts.map(p => String(p._id))
      await planItemsService.markVisit(activeItem._id, {
        notes,
        orderTaken,
        productsDiscussed,
        primaryProductId: primaryProductId || undefined,
        samplesQty: samplesQty > 0 ? samplesQty : undefined,
        followUpDate: followUpDate || undefined,
        outOfOrderReason: isOutOfSequence ? outOfOrderReason.trim() : undefined
      })
      showSuccess('Visit recorded')
      setMarkOpen(false)
      await load()
    } catch (e) {
      showApiError(e, 'Could not record visit')
    } finally {
      setSubmitting(false)
    }
  }

  const submitUnplanned = async () => {
    if (!unplannedDoctor) {
      showApiError(null, 'Select a doctor')
      return
    }
    setSubmitting(true)
    try {
      const productsDiscussed = unplannedProducts.map(p => String(p._id))
      await visitsService.unplanned({
        doctorId: unplannedDoctor,
        unplannedReason,
        notes: unplannedNotes,
        orderTaken: unplannedOrder,
        productsDiscussed,
        primaryProductId: unplannedPrimary || undefined,
        samplesQty: unplannedSamplesQty > 0 ? unplannedSamplesQty : undefined,
        followUpDate: unplannedFollowUp || undefined
      })
      showSuccess('Unplanned visit logged')
      setUnplannedOpen(false)
      setUnplannedDoctor('')
      setSelectedUnplannedDoctor(null)
      setUnplannedReason('EMERGENCY')
      setUnplannedNotes('')
      setUnplannedOrder(false)
      setUnplannedProducts([])
      setUnplannedPrimary('')
      setUnplannedSamplesQty(0)
      setUnplannedFollowUp('')
      await load()
    } catch (e) {
      showApiError(e, 'Failed to log visit')
    } finally {
      setSubmitting(false)
    }
  }

  const preview = execution?.endOfDayPreview

  const quickProducts = useMemo(() => productOptions.slice(0, 18), [productOptions])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-2'>
                <IconButton component={Link} href='/weekly-plans' size='small' aria-label='Back'>
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Today&apos;s route
                </Typography>
              </div>
            }
            action={
              canMark && (
                <Button
                  variant='outlined'
                  onClick={() => {
                    setUnplannedProducts([])
                    setUnplannedPrimary('')
                    setUnplannedSamplesQty(0)
                    setUnplannedFollowUp('')
                    setUnplannedReason('EMERGENCY')
                    void loadProducts()
                    setUnplannedOpen(true)
                  }}
                  sx={{ minHeight: 48 }}
                >
                  + Unplanned
                </Button>
              )
            }
          />
          <CardContent>
            <CustomTextField
              type='date'
              label='Business date'
              value={date}
              onChange={e => setDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              className='mbe-4'
              size='small'
              fullWidth
            />

            {preview && dayState === 'COMPLETED' && (
              <Paper variant='outlined' className='mbe-4' sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant='subtitle2' fontWeight={700} className='mbe-2'>
                  End of day
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Visited {preview.visited} · Missed {preview.missed} · Coverage {preview.coveragePercent}% · Out of
                  sequence {preview.outOfSequenceCount} · Unplanned {preview.unplannedCompletedCount}
                </Typography>
              </Paper>
            )}

            {summary && (
              <Box className='mbe-4'>
                <Stack direction='row' justifyContent='space-between' alignItems='center' className='mbe-1'>
                  <Typography variant='subtitle2' color='text.secondary'>
                    Day progress
                    {dayState ? ` · ${dayState.replace(/_/g, ' ')}` : ''}
                  </Typography>
                  <Typography variant='subtitle2' fontWeight={700}>
                    {summary.progressPercent}%
                  </Typography>
                </Stack>
                <LinearProgress variant='determinate' value={summary.progressPercent} sx={{ height: 10, borderRadius: 1 }} />
                <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                  Planned {summary.total} · Done {summary.visited} · Missed {summary.missed} · Remaining {summary.pending}
                </Typography>
              </Box>
            )}

            {canMark && nextItem && nextItem.status === 'PENDING' && (
              <Button
                fullWidth
                variant='contained'
                color='primary'
                size='large'
                className='mbe-4'
                sx={{ minHeight: 56, fontSize: '1.05rem' }}
                onClick={() => openMark(nextItem)}
              >
                Start visit · #{nextItem.sequenceOrder}{' '}
                {nextItem.type === 'DOCTOR_VISIT' ? nextItem.doctorId?.name || 'Doctor' : nextItem.title}
              </Button>
            )}

            {loading ? (
              <div className='flex justify-center p-8'>
                <CircularProgress />
              </div>
            ) : items.length === 0 ? (
              <Typography color='text.secondary' className='p-6 text-center'>
                No planned activities for this date.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {items.map((it: any) => {
                  const isNext = nextPlanItemId != null && String(it._id) === nextPlanItemId && it.status === 'PENDING'
                  return (
                    <Paper
                      key={it._id}
                      elevation={isNext ? 4 : 1}
                      className='border border-solid p-3 sm:p-4'
                      sx={{
                        borderColor: isNext ? 'primary.main' : 'divider',
                        bgcolor: isNext ? 'action.selected' : 'background.paper'
                      }}
                    >
                      <Stack spacing={1.5}>
                        <Stack direction='row' alignItems='center' justifyContent='space-between' flexWrap='wrap' gap={1}>
                          <Stack direction='row' alignItems='center' gap={1} flexWrap='wrap'>
                            <Typography variant='h5' component='span' fontWeight={800} color={isNext ? 'primary' : 'text.primary'}>
                              #{it.sequenceOrder ?? '—'}
                            </Typography>
                            <Chip size='medium' label={it.status} color={statusChip(it.status)} variant='tonal' />
                            {isNext ? <Chip size='small' label='NEXT' color='primary' /> : null}
                          </Stack>
                          {it.plannedTime ? (
                            <Typography variant='caption' color='text.secondary'>
                              {it.plannedTime}
                            </Typography>
                          ) : null}
                        </Stack>
                        <Typography variant='h6' component='p' className='text-lg'>
                          {it.type === 'DOCTOR_VISIT' ? it.doctorId?.name || 'Doctor visit' : it.title || 'Other task'}
                        </Typography>
                        {it.isUnplanned ? <Chip size='small' label='Unplanned' variant='outlined' /> : null}
                        {canMark && it.status === 'PENDING' ? (
                          <Button
                            fullWidth
                            variant='contained'
                            color='success'
                            size='large'
                            sx={{ minHeight: 52 }}
                            onClick={() => openMark(it)}
                          >
                            Mark visit
                          </Button>
                        ) : null}
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            )}
            <Typography variant='caption' color='text.secondary' display='block' className='mts-4'>
              You must be marked <strong>PRESENT</strong> for this date in attendance to log visits. After a doctor visit,
              you can <Link href='/orders/add'>create an order</Link>.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} fullWidth fullScreen>
        <DialogTitle className='flex items-center justify-between gap-2'>
          <span>Mark visit</span>
          <IconButton aria-label='Close' onClick={() => setMarkOpen(false)} size='small'>
            <i className='tabler-x' />
          </IconButton>
        </DialogTitle>
        <DialogContent className='flex flex-col gap-3 pbs-4'>
          <Typography variant='body2' color='text.secondary'>
            Tap products, set primary, adjust samples — optional notes and follow-up.
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
              Products discussed
            </Typography>
            <Stack direction='row' flexWrap='wrap' gap={1}>
              {quickProducts.map(p => {
                const sel = markProducts.some(x => String(x._id) === String(p._id))
                return (
                  <Chip
                    key={p._id}
                    label={p.name || 'Product'}
                    color={sel ? 'primary' : 'default'}
                    variant={sel ? 'filled' : 'outlined'}
                    onClick={() => {
                      const next = toggleProduct(markProducts, p)
                      setMarkProducts(next)
                      if (primaryProductId && !next.some(x => String(x._id) === primaryProductId)) setPrimaryProductId('')
                    }}
                    sx={{ borderRadius: 2 }}
                  />
                )
              })}
            </Stack>
            <Autocomplete
              multiple
              className='mts-3'
              options={productOptions}
              getOptionLabel={o => o?.name || ''}
              isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
              value={markProducts}
              onChange={(_e, v) => {
                setMarkProducts(v)
                if (primaryProductId && !v.some(x => String(x._id) === primaryProductId)) setPrimaryProductId('')
              }}
              onOpen={() => void loadProducts()}
              renderInput={params => (
                <CustomTextField {...params} label='More products (search)' placeholder='Type to add' size='small' />
              )}
            />
          </Box>
          {markProducts.length > 0 ? (
            <FormControl>
              <FormLabel id='primary-product-label'>Primary product</FormLabel>
              <RadioGroup
                row
                aria-labelledby='primary-product-label'
                name='primaryProduct'
                value={primaryProductId}
                onChange={e => setPrimaryProductId(e.target.value)}
              >
                <FormControlLabel value='' control={<Radio size='small' />} label='None' />
                {markProducts.map(p => (
                  <FormControlLabel
                    key={p._id}
                    value={String(p._id)}
                    control={<Radio size='small' />}
                    label={p.name || 'Product'}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          ) : null}
          <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Typography variant='subtitle2'>Samples</Typography>
            <Stack direction='row' alignItems='center' gap={1}>
              <IconButton
                size='large'
                aria-label='Decrease samples'
                onClick={() => setSamplesQty(q => Math.max(0, q - 1))}
              >
                <i className='tabler-minus' />
              </IconButton>
              <Typography variant='h6' sx={{ minWidth: 28, textAlign: 'center' }}>
                {samplesQty}
              </Typography>
              <IconButton size='large' aria-label='Increase samples' onClick={() => setSamplesQty(q => q + 1)}>
                <i className='tabler-plus' />
              </IconButton>
            </Stack>
          </Stack>
          <CustomTextField
            fullWidth
            label='Notes (optional)'
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder='Quick note…'
            multiline
            minRows={2}
          />
          <CustomTextField
            fullWidth
            type='date'
            label='Follow-up date (optional)'
            value={followUpDate}
            onChange={e => setFollowUpDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={<Switch checked={orderTaken} onChange={e => setOrderTaken(e.target.checked)} />}
            label='Order taken'
          />
          {activeItem &&
          execution &&
          getNextPlanItemId(execution) &&
          String(activeItem._id) !== getNextPlanItemId(execution) &&
          activeItem.status === 'PENDING' ? (
            <>
              <Typography variant='caption' color='warning.main'>
                You are not completing the suggested next stop. A short reason is required when out of sequence.
              </Typography>
              <CustomTextField
                fullWidth
                required
                label='Out-of-sequence reason'
                value={outOfOrderReason}
                onChange={e => setOutOfOrderReason(e.target.value)}
                placeholder='e.g. Doctor was leaving early'
              />
            </>
          ) : null}
        </DialogContent>
        <DialogActions className='pbs-4 p-4'>
          <Button onClick={() => setMarkOpen(false)} sx={{ minHeight: 48 }} fullWidth variant='outlined'>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void submitMark()} disabled={submitting} sx={{ minHeight: 48 }} fullWidth>
            {submitting ? 'Saving…' : 'Save visit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={unplannedOpen} onClose={() => setUnplannedOpen(false)} fullWidth fullScreen>
        <DialogTitle className='flex items-center justify-between gap-2'>
          <span>Unplanned visit</span>
          <IconButton aria-label='Close' onClick={() => setUnplannedOpen(false)} size='small'>
            <i className='tabler-x' />
          </IconButton>
        </DialogTitle>
        <DialogContent className='flex flex-col gap-3 pbs-4'>
          <LookupAutocomplete
            value={selectedUnplannedDoctor}
            onChange={v => {
              setSelectedUnplannedDoctor(v)
              setUnplannedDoctor(v ? String(v._id) : '')
            }}
            fetchOptions={search =>
              doctorsService
                .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                .then(r => r.data.data || [])
            }
            label='Doctor'
            placeholder='Type to search'
            required
            fetchErrorMessage='Failed to load doctors'
          />
          <Typography variant='caption' color='text.secondary'>
            Why is this unplanned?
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            color='primary'
            value={unplannedReason}
            onChange={(_e, v) => v != null && setUnplannedReason(String(v))}
          >
            {UNPLANNED_REASONS.map(r => (
              <ToggleButton key={r.id} value={r.id} sx={{ flex: 1, textTransform: 'none' }}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant='caption' color='text.secondary' display='block' className='mts-2'>
            Products discussed
          </Typography>
          <Stack direction='row' flexWrap='wrap' gap={1}>
            {quickProducts.map(p => {
              const sel = unplannedProducts.some(x => String(x._id) === String(p._id))
              return (
                <Chip
                  key={p._id}
                  label={p.name || 'Product'}
                  color={sel ? 'primary' : 'default'}
                  variant={sel ? 'filled' : 'outlined'}
                  onClick={() => {
                    const next = toggleProduct(unplannedProducts, p)
                    setUnplannedProducts(next)
                    if (unplannedPrimary && !next.some(x => String(x._id) === unplannedPrimary)) setUnplannedPrimary('')
                  }}
                  sx={{ borderRadius: 2 }}
                />
              )
            })}
          </Stack>
          <Autocomplete
            multiple
            options={productOptions}
            getOptionLabel={o => o?.name || ''}
            isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
            value={unplannedProducts}
            onChange={(_e, v) => {
              setUnplannedProducts(v)
              if (unplannedPrimary && !v.some(x => String(x._id) === unplannedPrimary)) setUnplannedPrimary('')
            }}
            onOpen={() => void loadProducts()}
            renderInput={params => (
              <CustomTextField {...params} label='More products (search)' size='small' />
            )}
          />
          {unplannedProducts.length > 0 ? (
            <FormControl>
              <FormLabel id='unplanned-primary-label'>Primary product</FormLabel>
              <RadioGroup
                row
                aria-labelledby='unplanned-primary-label'
                value={unplannedPrimary}
                onChange={e => setUnplannedPrimary(e.target.value)}
              >
                <FormControlLabel value='' control={<Radio size='small' />} label='None' />
                {unplannedProducts.map(p => (
                  <FormControlLabel
                    key={p._id}
                    value={String(p._id)}
                    control={<Radio size='small' />}
                    label={p.name || 'Product'}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          ) : null}
          <Stack direction='row' alignItems='center' justifyContent='space-between'>
            <Typography variant='subtitle2'>Samples</Typography>
            <Stack direction='row' alignItems='center' gap={1}>
              <IconButton
                size='large'
                aria-label='Decrease samples'
                onClick={() => setUnplannedSamplesQty(q => Math.max(0, q - 1))}
              >
                <i className='tabler-minus' />
              </IconButton>
              <Typography variant='h6' sx={{ minWidth: 28, textAlign: 'center' }}>
                {unplannedSamplesQty}
              </Typography>
              <IconButton size='large' aria-label='Increase samples' onClick={() => setUnplannedSamplesQty(q => q + 1)}>
                <i className='tabler-plus' />
              </IconButton>
            </Stack>
          </Stack>
          <CustomTextField
            fullWidth
            multiline
            minRows={2}
            label='Notes (optional)'
            value={unplannedNotes}
            onChange={e => setUnplannedNotes(e.target.value)}
          />
          <CustomTextField
            fullWidth
            type='date'
            label='Follow-up date (optional)'
            value={unplannedFollowUp}
            onChange={e => setUnplannedFollowUp(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={<Switch checked={unplannedOrder} onChange={e => setUnplannedOrder(e.target.checked)} />}
            label='Order taken'
          />
        </DialogContent>
        <DialogActions className='p-4 flex-col sm:flex-row gap-2'>
          <Button onClick={() => setUnplannedOpen(false)} fullWidth variant='outlined'>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void submitUnplanned()} disabled={submitting} fullWidth>
            {submitting ? 'Saving…' : 'Log visit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default TodayVisitsPage
