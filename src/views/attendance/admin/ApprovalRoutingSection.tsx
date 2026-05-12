'use client'

import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import CustomTextField from '@core/components/mui/TextField'
import { attendanceService } from '@/services/attendance.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { approvalStepLabel, requestCategoryLabel } from '@/utils/attendanceUi'

type MatrixRow = Record<string, unknown> & {
  _id?: string
  name?: string
  requestCategory?: string
  steps?: Array<{ resolverType: string; depth?: number; requiredPermission?: string }>
  isActive?: boolean
  effectiveFrom?: string
  effectiveTo?: string | null
}

type StepForm = {
  resolverType: 'DIRECT_MANAGER' | 'MANAGER_AT_DEPTH' | 'ADMIN_QUEUE'
  depth: number
  requiredPermission: string
}

type Props = {
  matrices: MatrixRow[]
  onRefresh: () => Promise<void>
}

const REQUEST_CATEGORIES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All request types' },
  { value: 'LATE_ARRIVAL', label: 'Late arrival' },
  { value: 'MISSED_CHECKOUT', label: 'Missing checkout' },
  { value: 'TIME_CORRECTION', label: 'Time correction' },
  { value: 'MANUAL_EXCEPTION', label: 'Attendance exception' }
]

function idKey(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'object' && '_id' in (v as object)) return String((v as { _id: unknown })._id)
  return String(v)
}

function toDatetimeLocalValue(d: string | Date | undefined | null): string {
  if (d == null || d === '') return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function mapApiToStep(s: { resolverType?: string; depth?: number; requiredPermission?: string }): StepForm {
  const resolverType = (s.resolverType || 'DIRECT_MANAGER') as StepForm['resolverType']
  return {
    resolverType,
    depth: typeof s.depth === 'number' && !Number.isNaN(s.depth) ? s.depth : 2,
    requiredPermission: s.requiredPermission ? String(s.requiredPermission) : ''
  }
}

function defaultPairSteps(): StepForm[] {
  return [
    { resolverType: 'DIRECT_MANAGER', depth: 2, requiredPermission: '' },
    { resolverType: 'ADMIN_QUEUE', depth: 2, requiredPermission: '' }
  ]
}

function buildStepsPayload(steps: StepForm[]): Record<string, unknown>[] {
  return steps.map((s, i) => {
    const row: Record<string, unknown> = { order: i, resolverType: s.resolverType }
    if (s.resolverType === 'MANAGER_AT_DEPTH') {
      row.depth = Math.min(20, Math.max(1, Math.floor(Number(s.depth) || 1)))
    }
    const perm = s.requiredPermission.trim()
    if (perm) row.requiredPermission = perm
    return row
  })
}

export default function ApprovalRoutingSection({ matrices, onRefresh }: Props) {
  const sorted = useMemo(() => {
    return [...matrices].sort((a, b) => {
      const ea = new Date(String(a.effectiveFrom || 0)).getTime()
      const eb = new Date(String(b.effectiveFrom || 0)).getTime()
      if (eb !== ea) return eb - ea
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  }, [matrices])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('ALL')
  const [formActive, setFormActive] = useState(true)
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('')
  const [formEffectiveTo, setFormEffectiveTo] = useState('')
  const [steps, setSteps] = useState<StepForm[]>(defaultPairSteps())
  const [busy, setBusy] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setFormName('Approval route')
    setFormCategory('ALL')
    setFormActive(true)
    setFormEffectiveFrom(toDatetimeLocalValue(new Date()))
    setFormEffectiveTo('')
    setSteps(defaultPairSteps())
    setDialogOpen(true)
  }

  const openEdit = (mx: MatrixRow) => {
    setEditingId(idKey(mx._id))
    setFormName(String(mx.name || ''))
    setFormCategory(mx.requestCategory || 'ALL')
    setFormActive(mx.isActive !== false)
    setFormEffectiveFrom(toDatetimeLocalValue(mx.effectiveFrom))
    setFormEffectiveTo(mx.effectiveTo ? toDatetimeLocalValue(mx.effectiveTo) : '')
    const raw = Array.isArray(mx.steps) && mx.steps.length ? mx.steps : defaultPairSteps()
    setSteps(raw.map(mapApiToStep))
    setDialogOpen(true)
  }

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= steps.length) return
    setSteps((prev) => {
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  const validateSteps = (): string | null => {
    if (steps.length < 1) return 'Add at least one approval step.'
    for (const s of steps) {
      if (s.resolverType === 'MANAGER_AT_DEPTH') {
        const d = Math.floor(Number(s.depth))
        if (d < 1 || d > 20) return 'Manager level must be between 1 and 20.'
      }
    }
    return null
  }

  const handleSave = async () => {
    const name = formName.trim().slice(0, 120)
    if (!name) {
      showApiError(new Error('Name required'), 'Enter a name for this route')
      return
    }
    const err = validateSteps()
    if (err) {
      showApiError(new Error(err), err)
      return
    }
    const stepsPayload = buildStepsPayload(steps)
    const effectiveFrom =
      formEffectiveFrom.trim() !== '' ? new Date(formEffectiveFrom).toISOString() : new Date(0).toISOString()
    const effectiveTo =
      formEffectiveTo.trim() !== '' ? new Date(formEffectiveTo).toISOString() : null

    setBusy(true)
    try {
      if (editingId) {
        await attendanceService.updateApprovalMatrix(editingId, {
          name,
          requestCategory: formCategory,
          steps: stepsPayload,
          isActive: formActive,
          effectiveFrom,
          effectiveTo
        })
        showSuccess('Route updated')
      } else {
        await attendanceService.createApprovalMatrix({
          name,
          requestCategory: formCategory,
          steps: stepsPayload,
          isActive: formActive,
          effectiveFrom,
          effectiveTo
        })
        showSuccess('Route created')
      }
      setDialogOpen(false)
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not save route')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await attendanceService.deleteApprovalMatrix(deleteTarget.id)
      showSuccess('Route removed')
      setDeleteTarget(null)
      await onRefresh()
    } catch (e) {
      showApiError(e, 'Could not remove route')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Card variant='outlined' elevation={0}>
        <CardHeader
          title='Who approves requests'
          subheader='Steps run in order. For a given request type the newest effective start date wins when several routes match.'
          action={
            <Button variant='contained' size='small' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
              Add route
            </Button>
          }
        />
        <CardContent>
          <Stack spacing={2}>
            {sorted.length === 0 ? (
              <Typography color='text.secondary'>No routes yet. Use Guided setup or add a route.</Typography>
            ) : (
              sorted.map((mx, cardIdx) => {
                const mid = idKey(mx._id)
                return (
                  <Card key={mid || `matrix-${cardIdx}`} variant='outlined'>
                    <CardContent>
                      <Stack direction='row' flexWrap='wrap' gap={1} justifyContent='space-between' alignItems='flex-start'>
                        <Box>
                          <Stack direction='row' alignItems='center' gap={1} flexWrap='wrap'>
                            <Typography fontWeight={700}>{mx.name}</Typography>
                            {mx.isActive === false ? <Chip size='small' label='Inactive' color='default' variant='outlined' /> : null}
                          </Stack>
                          <Typography variant='caption' color='text.secondary' display='block'>
                            {requestCategoryLabel(String(mx.requestCategory || 'ALL'))}
                            {mx.effectiveFrom
                              ? ` · Effective ${new Date(String(mx.effectiveFrom)).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`
                              : ''}
                          </Typography>
                          <Stack direction='row' flexWrap='wrap' gap={1} className='mts-2'>
                            {(mx.steps || []).map((st, idx) => (
                              <Chip
                                key={idx}
                                label={`Step ${idx + 1}: ${approvalStepLabel(st.resolverType, st.depth)}`}
                                variant='tonal'
                                size='small'
                              />
                            ))}
                          </Stack>
                        </Box>
                        <Stack direction='row' spacing={0}>
                          <IconButton size='small' aria-label='Edit route' onClick={() => openEdit(mx)}>
                            <i className='tabler-edit text-textSecondary' />
                          </IconButton>
                          <IconButton
                            size='small'
                            aria-label='Remove route'
                            onClick={() => setDeleteTarget({ id: mid, name: String(mx.name || 'this route') })}
                          >
                            <i className='tabler-trash text-textSecondary' />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                )
              })
            )}
            <Typography variant='caption' color='text.secondary'>
              Remove duplicates you do not need so the &quot;winning&quot; route is predictable. Operations center lists categories with
              duplicate routes.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => !busy && setDialogOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>{editingId ? 'Edit approval route' : 'New approval route'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} className='mts-4'>
            <CustomTextField
              fullWidth
              label='Name'
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <CustomTextField select fullWidth label='Request type' value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
              {REQUEST_CATEGORIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </CustomTextField>
            <FormControlLabel
              control={<Switch checked={formActive} onChange={(_, v) => setFormActive(v)} />}
              label='Route is active'
            />
            <Stack direction='row' flexWrap='wrap' gap={2}>
              <CustomTextField
                fullWidth
                label='Effective from'
                type='datetime-local'
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: '1 1 240px' }}
              />
              <CustomTextField
                fullWidth
                label='Effective to (optional)'
                type='datetime-local'
                value={formEffectiveTo}
                onChange={(e) => setFormEffectiveTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: '1 1 240px' }}
              />
            </Stack>

            <Typography variant='subtitle2'>Steps</Typography>
            {steps.map((st, idx) => (
              <Card key={idx} variant='outlined'>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Stack spacing={1.5}>
                    <Stack direction='row' alignItems='center' justifyContent='space-between'>
                      <Typography variant='caption' color='text.secondary'>
                        Step {idx + 1}
                      </Typography>
                      <Stack direction='row'>
                        <IconButton size='small' disabled={idx === 0} onClick={() => moveStep(idx, -1)} aria-label='Move step up'>
                          <i className='tabler-chevron-up text-textSecondary' />
                        </IconButton>
                        <IconButton
                          size='small'
                          disabled={idx === steps.length - 1}
                          onClick={() => moveStep(idx, 1)}
                          aria-label='Move step down'
                        >
                          <i className='tabler-chevron-down text-textSecondary' />
                        </IconButton>
                        <IconButton
                          size='small'
                          disabled={steps.length <= 1}
                          onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label='Remove step'
                        >
                          <i className='tabler-x text-textSecondary' />
                        </IconButton>
                      </Stack>
                    </Stack>
                    <CustomTextField
                      select
                      fullWidth
                      label='Resolver'
                      value={st.resolverType}
                      onChange={(e) => {
                        const v = e.target.value as StepForm['resolverType']
                        setSteps((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, resolverType: v } : r))
                        )
                      }}
                    >
                      <MenuItem value='DIRECT_MANAGER'>Direct manager</MenuItem>
                      <MenuItem value='MANAGER_AT_DEPTH'>Manager at hierarchy depth</MenuItem>
                      <MenuItem value='ADMIN_QUEUE'>Company administrator</MenuItem>
                    </CustomTextField>
                    {st.resolverType === 'MANAGER_AT_DEPTH' ? (
                      <CustomTextField
                        fullWidth
                        type='number'
                        label='Hierarchy depth (1–20)'
                        value={st.depth}
                        onChange={(e) =>
                          setSteps((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, depth: Number(e.target.value) || 1 } : r))
                          )
                        }
                        inputProps={{ min: 1, max: 20 }}
                      />
                    ) : null}
                    <CustomTextField
                      fullWidth
                      label='Permission code (optional)'
                      value={st.requiredPermission}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, requiredPermission: e.target.value } : r))
                        )
                      }
                      placeholder='Leave blank for defaults (direct / escalated / admin)'
                      helperText='Defaults match guided setup when empty.'
                    />
                  </Stack>
                </CardContent>
              </Card>
            ))}
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-plus' />}
              onClick={() => setSteps((prev) => [...prev, { resolverType: 'DIRECT_MANAGER', depth: 2, requiredPermission: '' }])}
            >
              Add step
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void handleSave()} disabled={busy}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)}>
        <DialogTitle>Remove route?</DialogTitle>
        <DialogContent>
          <Typography>
            {`Remove approval route "${deleteTarget?.name}"? Existing requests keep their recorded routing; new requests will use the next matching route.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={() => void confirmDelete()} disabled={busy}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
