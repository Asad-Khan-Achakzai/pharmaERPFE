'use client'

/**
 * Bulk territory import (Phase 4) — mirrors doctor import: preview → map → commit.
 */

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Switch from '@mui/material/Switch'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CustomTextField from '@core/components/mui/TextField'
import { territoriesService } from '@/services/territories.service'
import { showApiError } from '@/utils/apiErrors'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type ImportField = 'zone' | 'area' | 'brick' | 'brick_code' | 'is_active'

type PreviewResponse = {
  sheets: string[]
  sheet: string
  headers: string[]
  totalRows: number
  mapping: Record<ImportField, string | null>
  sampleRows: Array<{ row: number; zone?: string; area?: string; brick?: string; brick_code?: string | null }>
  fields: ImportField[]
  fieldLabels: Record<ImportField, string>
  requiredFields: ImportField[]
  limits: { maxRows: number; maxFileBytes: number }
}

type CommitResponse = {
  sheet: string
  totalRows: number
  blankRows: number
  zonesCreated: number
  areasCreated: number
  bricksCreated: number
  skipped: number
  failed: number
  errors: Array<{ row: number; status: string; message: string }>
  errorsTruncated: boolean
  fullErrorCount: number
}

type Props = { open: boolean; onClose: () => void; onImported?: () => void }

const STEPS = ['Upload', 'Map columns', 'Result']

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const res = String(reader.result || '')
      const b64 = res.includes(',') ? res.split(',')[1] : res
      resolve(b64)
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TerritoryBulkImportDialog = ({ open, onClose, onImported }: Props) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [base64, setBase64] = useState('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [mapping, setMapping] = useState<Record<ImportField, string | null>>({} as Record<ImportField, string | null>)
  const [skipExisting, setSkipExisting] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const reset = useCallback(() => {
    setStep(0)
    setFile(null)
    setBase64('')
    setPreview(null)
    setMapping({} as Record<ImportField, string | null>)
    setSkipExisting(true)
    setResult(null)
    setPreviewing(false)
    setCommitting(false)
    setDragOver(false)
    if (fileInput.current) fileInput.current.value = ''
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const handleFile = useCallback(async (f: File | null | undefined) => {
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) {
      showApiError({ response: { data: { message: 'Only .xlsx files are supported' } } }, 'Unsupported file type')
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      showApiError(
        { response: { data: { message: `File too large. Max ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.` } } },
        'File too large'
      )
      return
    }
    setPreviewing(true)
    setFile(f)
    try {
      const b64 = await fileToBase64(f)
      setBase64(b64)
      const res = await territoriesService.import.preview({ fileBase64: b64 })
      const payload = res.data?.data as PreviewResponse
      setPreview(payload)
      setMapping({ ...payload.mapping })
      setStep(1)
    } catch (err) {
      showApiError(err, 'Failed to read file')
      setFile(null)
      setBase64('')
    } finally {
      setPreviewing(false)
    }
  }, [])

  const onPickFromInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    void handleFile(f)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    void handleFile(f)
  }

  const fieldLabels = preview?.fieldLabels ?? ({} as Record<ImportField, string>)
  const requiredFields = preview?.requiredFields ?? []
  const isMappingValid = Boolean(mapping.zone && mapping.area && mapping.brick)

  const handleCommit = async () => {
    if (!base64 || !preview) return
    setCommitting(true)
    try {
      const res = await territoriesService.import.commit({
        fileBase64: base64,
        mapping,
        sheet: preview.sheet,
        skipExisting
      })
      setResult(res.data?.data as CommitResponse)
      setStep(2)
      onImported?.()
    } catch (err) {
      showApiError(err, 'Import failed')
    } finally {
      setCommitting(false)
    }
  }

  const onDownloadTemplate = async () => {
    try {
      const res = await territoriesService.import.template()
      downloadBlob(res.data, 'territory-import-template.xlsx')
    } catch (err) {
      showApiError(err, 'Failed to download template')
    }
  }

  const renderSelect = (f: ImportField) => {
    if (!preview) return null
    const required = requiredFields.includes(f)
    const value = mapping[f] ?? ''
    return (
      <CustomTextField
        select
        fullWidth
        required={required}
        label={fieldLabels[f] || f}
        value={value}
        SelectProps={{ displayEmpty: true }}
        onChange={e => {
          const v = e.target.value as string
          setMapping(prev => ({ ...prev, [f]: v ? v : null }))
        }}
      >
        <MenuItem value=''>{required ? '— select column —' : '(skip)'}</MenuItem>
        {preview.headers.map(h => (
          <MenuItem key={h} value={h}>
            {h}
          </MenuItem>
        ))}
      </CustomTextField>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={committing ? undefined : onClose}
      fullWidth
      maxWidth='md'
      fullScreen={isMobile}
      scroll='paper'
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 }, maxHeight: { xs: '100%', sm: '90vh' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <i className='tabler-map-pin' />
        <Box sx={{ flex: 1 }}>
          <Typography variant='h6' fontWeight={600}>
            Import territories
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Zone → Area → Brick rows from Excel
          </Typography>
        </Box>
        <IconButton aria-label='Close' onClick={onClose} disabled={committing} size='small'>
          <i className='tabler-x' />
        </IconButton>
      </DialogTitle>

      <Stepper activeStep={step} alternativeLabel={!isMobile} sx={{ py: 2, borderBottom: 1, borderColor: 'divider' }}>
        {STEPS.map(label => (
          <Step key={label}>
            <StepLabel>{!isMobile ? label : null}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {step === 0 && (
          <Stack spacing={2}>
            <Typography variant='body2' color='text.secondary'>
              Each row defines one brick and its parent zone and area. Existing zone/area names are reused; duplicate
              bricks are skipped when &ldquo;Skip existing&rdquo; is on.
            </Typography>
            <Paper
              variant='outlined'
              role='button'
              tabIndex={0}
              onDragOver={e => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInput.current?.click()}
              sx={{
                p: 4,
                textAlign: 'center',
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: dragOver ? 'primary.main' : 'divider',
                bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                cursor: 'pointer',
                borderRadius: 2
              }}
            >
              <Typography fontWeight={600}>Drop .xlsx here or tap to browse</Typography>
              {file && (
                <Chip sx={{ mt: 1 }} label={`${file.name} · ${formatBytes(file.size)}`} variant='tonal' color='primary' />
              )}
              {previewing && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                </Box>
              )}
              <input
                ref={fileInput}
                type='file'
                accept={ACCEPTED}
                hidden
                onChange={onPickFromInput}
              />
            </Paper>
            <Button variant='outlined' startIcon={<i className='tabler-download' />} onClick={() => void onDownloadTemplate()}>
              Download template
            </Button>
          </Stack>
        )}

        {step === 1 && preview && (
          <Stack spacing={2}>
            <Typography variant='body2' color='text.secondary'>
              Map <strong>Zone</strong>, <strong>Area</strong>, and <strong>Brick</strong> columns. Brick code and Active
              are optional.
            </Typography>
            <Grid container spacing={2}>
              {(['zone', 'area', 'brick', 'brick_code', 'is_active'] as ImportField[]).map(f => (
                <Grid key={f} size={{ xs: 12, sm: 6 }}>
                  {renderSelect(f)}
                </Grid>
              ))}
            </Grid>
            <Divider />
            <Paper variant='outlined' sx={{ p: 2 }}>
              <FormControlLabel
                control={<Switch checked={skipExisting} onChange={e => setSkipExisting(e.target.checked)} />}
                label='Skip existing bricks (same name under the area, or same brick code)'
              />
            </Paper>
            <Typography variant='subtitle2'>Preview (first rows)</Typography>
            <Stack spacing={1}>
              {preview.sampleRows.slice(0, 5).map(r => (
                <Paper key={r.row} variant='outlined' sx={{ p: 1.5 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Row {r.row}
                  </Typography>
                  <Typography variant='body2'>
                    {r.zone} → {r.area} → {r.brick}
                    {r.brick_code ? ` · ${r.brick_code}` : ''}
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Stack>
        )}

        {step === 2 && result && (
          <Stack spacing={2}>
            <Typography variant='subtitle1' fontWeight={600}>
              {result.failed === 0
                ? 'Import completed'
                : `${result.bricksCreated} bricks created · ${result.failed} row(s) failed`}
            </Typography>
            <Stack direction='row' flexWrap='wrap' gap={1}>
              <Chip label={`Zones +${result.zonesCreated}`} size='small' />
              <Chip label={`Areas +${result.areasCreated}`} size='small' />
              <Chip label={`Bricks +${result.bricksCreated}`} size='small' color='primary' />
              <Chip label={`Skipped ${result.skipped}`} size='small' variant='outlined' />
            </Stack>
            {result.errors.length > 0 && (
              <Paper variant='outlined' sx={{ p: 2, maxHeight: 280, overflow: 'auto' }}>
                {result.errors.map((e, i) => (
                  <Typography key={i} variant='body2' sx={{ mb: 1 }}>
                    Row {e.row}: {e.message}
                  </Typography>
                ))}
                {result.errorsTruncated ? (
                  <Typography variant='caption' color='text.secondary'>
                    More failures omitted — check full counts.
                  </Typography>
                ) : null}
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
        {step === 0 && (
          <Button onClick={onClose} disabled={previewing}>
            Cancel
          </Button>
        )}
        {step === 1 && (
          <>
            <Button onClick={() => setStep(0)} disabled={committing}>
              Back
            </Button>
            <Button onClick={onClose} disabled={committing}>
              Cancel
            </Button>
            <Button
              variant='contained'
              disabled={committing || !isMappingValid || !preview?.totalRows}
              onClick={() => void handleCommit()}
              startIcon={committing ? <CircularProgress size={16} color='inherit' /> : <i className='tabler-upload' />}
            >
              {committing ? 'Importing…' : 'Import'}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button onClick={reset}>Import another</Button>
            <Button variant='contained' onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default TerritoryBulkImportDialog
