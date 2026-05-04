'use client'

/**
 * Three-step doctor bulk import:
 *   1. Upload .xlsx (drag/drop or picker)        → POST /doctors/import/preview
 *   2. Confirm header → field mapping            → review the first 10 rows
 *   3. Commit & show row-level result            → POST /doctors/import/commit
 *
 * Strictly additive — never touches the single-doctor add/edit flow.
 * Mobile-first: full-screen on small viewports, sticky header + footer,
 * preview/error tables collapse to stacked cards under `sm`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
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
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import CustomTextField from '@core/components/mui/TextField'
import { doctorsService } from '@/services/doctors.service'
import { showApiError } from '@/utils/apiErrors'

const MAX_FILE_BYTES = 8 * 1024 * 1024
const ACCEPTED = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type ImportField =
  | 'name'
  | 'doctorCode'
  | 'specialization'
  | 'qualification'
  | 'designation'
  | 'gender'
  | 'mobileNo'
  | 'phone'
  | 'email'
  | 'zone'
  | 'doctorBrick'
  | 'frequency'
  | 'grade'
  | 'locationName'
  | 'address'
  | 'city'
  | 'pmdcRegistration'
  | 'patientCount'

type PreviewResponse = {
  sheets: string[]
  sheet: string
  headers: string[]
  totalRows: number
  mapping: Record<ImportField, string | null>
  sampleRows: Array<{ row: number } & Partial<Record<ImportField, unknown>>>
  fields: ImportField[]
  fieldLabels: Record<ImportField, string>
  requiredFields: ImportField[]
  limits: { maxRows: number; maxFileBytes: number }
}

type CommitError = {
  row: number | null
  status: string
  field?: string | null
  code?: string
  message: string
  source?: Record<string, unknown> | null
}

type CommitResponse = {
  sheet: string
  totalRows: number
  blankRows: number
  created: number
  skipped: number
  failed: number
  errors: CommitError[]
  errorsTruncated: boolean
  fullErrorCount: number
}

type Props = {
  open: boolean
  onClose: () => void
  onImported?: () => void
}

const STEPS = ['Upload', 'Map columns', 'Result']

/** UI-side grouping of import fields so the mapping screen reads top-to-bottom in priority order. */
const FIELD_GROUPS: Array<{ title: string; fields: ImportField[] }> = [
  { title: 'Identification', fields: ['name', 'doctorCode', 'specialization', 'qualification', 'designation', 'gender'] },
  { title: 'Contact', fields: ['mobileNo', 'phone', 'email'] },
  { title: 'Territory & location', fields: ['zone', 'doctorBrick', 'locationName', 'address', 'city'] },
  { title: 'Extras', fields: ['frequency', 'grade', 'pmdcRegistration', 'patientCount'] }
]

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

const errorReportCsv = (errors: CommitError[]): string => {
  const headers = ['row', 'status', 'field', 'code', 'message']
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.join(',')]
  for (const e of errors) {
    lines.push([e.row ?? '', e.status, e.field || '', e.code || '', e.message].map(escape).join(','))
  }
  return lines.join('\n')
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

const statusChipColor = (status: string): 'error' | 'warning' | 'default' => {
  if (String(status).startsWith('FAILED')) return 'error'
  if (String(status).startsWith('SKIPPED')) return 'warning'
  return 'default'
}

const DoctorBulkImportDialog = ({ open, onClose, onImported }: Props) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [base64, setBase64] = useState<string>('')
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [mapping, setMapping] = useState<Record<ImportField, string | null>>({} as Record<ImportField, string | null>)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
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
    setSkipDuplicates(true)
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
      const res = await doctorsService.import.preview({ fileBase64: b64 })
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

  const onDownloadTemplate = async () => {
    try {
      const res = await doctorsService.import.template()
      downloadBlob(res.data, 'doctor-import-template.xlsx')
    } catch (err) {
      showApiError(err, 'Failed to download template')
    }
  }

  const onDownloadErrors = () => {
    if (!result || !result.errors.length) return
    const csv = errorReportCsv(result.errors)
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'doctor-import-errors.csv')
  }

  const fields: ImportField[] = useMemo(() => preview?.fields ?? [], [preview])
  const fieldLabels = preview?.fieldLabels ?? ({} as Record<ImportField, string>)
  const requiredFields = preview?.requiredFields ?? []
  const isMappingValid = !!mapping?.name

  const mappedCount = useMemo(
    () => Object.values(mapping).filter(v => v && String(v).trim() !== '').length,
    [mapping]
  )

  const handleCommit = async () => {
    if (!base64 || !preview) return
    setCommitting(true)
    try {
      const res = await doctorsService.import.commit({
        fileBase64: base64,
        mapping,
        sheet: preview.sheet,
        skipDuplicates
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

  /* ----------------------------------- Step 1: upload ----------------------------------- */

  const renderUpload = () => (
    <Stack spacing={3}>
      <Box>
        <Typography variant='h5' fontWeight={600} className='mbe-1'>
          Upload an Excel file
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          One doctor per row, first sheet only. We&apos;ll auto-match column headers — you can fine-tune the mapping next.
        </Typography>
      </Box>

      <Paper
        variant='outlined'
        role='button'
        tabIndex={0}
        onDragOver={e => {
          e.preventDefault()
          if (!dragOver) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileInput.current?.click()
          }
        }}
        sx={{
          p: { xs: 4, sm: 6 },
          textAlign: 'center',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderRadius: 2,
          borderColor: dragOver ? 'primary.main' : 'divider',
          backgroundColor: dragOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
          cursor: 'pointer',
          transition: 'all 160ms ease',
          outline: 'none',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: alpha(theme.palette.primary.main, 0.04)
          },
          '&:focus-visible': {
            borderColor: 'primary.main',
            boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`
          }
        }}
      >
        <Box
          sx={{
            width: { xs: 64, sm: 80 },
            height: { xs: 64, sm: 80 },
            mx: 'auto',
            mbe: 2,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main'
          }}
        >
          <i className='tabler-cloud-upload' style={{ fontSize: isMobile ? 32 : 40 }} />
        </Box>
        <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight={600}>
          {dragOver ? 'Drop to upload' : 'Drop your .xlsx here'}
        </Typography>
        <Typography variant='body2' color='text.secondary' className='mts-1'>
          or <strong style={{ color: theme.palette.primary.main }}>tap to browse</strong>
        </Typography>
        <Stack
          direction='row'
          spacing={1}
          justifyContent='center'
          flexWrap='wrap'
          useFlexGap
          className='mts-3'
        >
          <Chip size='small' variant='tonal' label='.xlsx only' />
          <Chip size='small' variant='tonal' label={`Max ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB`} />
          <Chip size='small' variant='tonal' label='Up to 5,000 rows' />
        </Stack>

        {file && (
          <Stack direction='row' spacing={1} justifyContent='center' className='mts-4' useFlexGap flexWrap='wrap'>
            <Chip
              color='primary'
              variant='tonal'
              label={file.name}
              icon={<i className='tabler-file-spreadsheet' />}
            />
            <Chip variant='outlined' label={formatBytes(file.size)} size='small' />
          </Stack>
        )}
        {previewing && (
          <Box className='mts-3'>
            <LinearProgress />
            <Typography variant='caption' color='text.secondary'>
              Parsing file…
            </Typography>
          </Box>
        )}
        <input
          ref={fileInput}
          type='file'
          accept={ACCEPTED}
          hidden
          onChange={onPickFromInput}
          onClick={e => {
            ;(e.target as HTMLInputElement).value = ''
          }}
        />
      </Paper>

      <Paper
        variant='outlined'
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 1.5,
          backgroundColor: alpha(theme.palette.info.main, 0.04),
          borderColor: alpha(theme.palette.info.main, 0.4)
        }}
      >
        <Box sx={{ color: 'info.main', display: { xs: 'none', sm: 'flex' } }}>
          <i className='tabler-info-circle' style={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant='subtitle2' fontWeight={600}>
            New to bulk import?
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            Download our template, drop your data into the sample row, and re-upload.
          </Typography>
        </Box>
        <Button
          variant='outlined'
          color='info'
          startIcon={<i className='tabler-download' />}
          onClick={onDownloadTemplate}
          fullWidth={isMobile}
        >
          Download template
        </Button>
      </Paper>
    </Stack>
  )

  /* ---------------------------------- Step 2: mapping ----------------------------------- */

  const renderMapping = () => {
    if (!preview) return null
    const sample = preview.sampleRows.slice(0, 5)

    const renderSelect = (f: ImportField) => {
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
      <Stack spacing={3}>
        <Box>
          <Typography variant='h5' fontWeight={600} className='mbe-1'>
            Match columns to fields
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            <strong>Doctor Name</strong> is required. Everything else is optional — leave a field on{' '}
            <em>(skip)</em> if you don&apos;t have that data.
          </Typography>
        </Box>

        <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
          <Chip color='primary' variant='tonal' size='small' label={`Sheet: ${preview.sheet}`} />
          <Chip variant='tonal' size='small' label={`${preview.totalRows.toLocaleString()} rows`} />
          <Chip variant='tonal' size='small' color='success' label={`${mappedCount} fields mapped`} />
          {file && (
            <Chip
              variant='outlined'
              size='small'
              icon={<i className='tabler-file-spreadsheet' />}
              label={file.name}
              sx={{ maxWidth: { xs: '100%', sm: 280 } }}
            />
          )}
        </Stack>

        {FIELD_GROUPS.map(group => (
          <Box key={group.title}>
            <Typography variant='overline' color='text.secondary' fontWeight={600}>
              {group.title}
            </Typography>
            <Grid container spacing={2} className='mts-1'>
              {group.fields.map(f => (
                <Grid key={f} size={{ xs: 12, sm: 6 }}>
                  {renderSelect(f)}
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        <Divider />

        <Box>
          <Stack direction='row' alignItems='center' spacing={1} className='mbe-2'>
            <i className='tabler-eye' />
            <Typography variant='subtitle2' fontWeight={600}>
              Preview · first {sample.length} rows
            </Typography>
          </Stack>
          {isMobile ? (
            <Stack spacing={1.5}>
              {sample.map(r => {
                const visibleFields = fields.filter(f => {
                  const v = (r as Record<string, unknown>)[f]
                  return v != null && v !== ''
                })
                return (
                  <Paper key={r.row} variant='outlined' sx={{ p: 1.5 }}>
                    <Stack direction='row' justifyContent='space-between' alignItems='baseline' className='mbe-1'>
                      <Typography variant='subtitle2' fontWeight={600}>
                        {String((r as Record<string, unknown>).name || '—')}
                      </Typography>
                      <Chip label={`Row ${r.row}`} size='small' variant='outlined' />
                    </Stack>
                    {visibleFields.length === 0 ? (
                      <Typography variant='caption' color='text.secondary'>
                        No mapped fields had data on this row.
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {visibleFields
                          .filter(f => f !== 'name')
                          .map(f => (
                            <Stack key={f} direction='row' spacing={1} alignItems='baseline'>
                              <Typography variant='caption' color='text.secondary' sx={{ minWidth: 96 }}>
                                {fieldLabels[f] || f}
                              </Typography>
                              <Typography variant='body2' sx={{ flex: 1, wordBreak: 'break-word' }}>
                                {String((r as Record<string, unknown>)[f])}
                              </Typography>
                            </Stack>
                          ))}
                      </Stack>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          ) : (
            <Paper variant='outlined' sx={{ overflowX: 'auto' }}>
              <Box component='table' sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ backgroundColor: alpha(theme.palette.text.primary, 0.04) }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Row</th>
                    {fields.map(f => (
                      <th key={f} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fieldLabels[f] || f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.map(r => (
                    <tr key={r.row}>
                      <td style={{ padding: '8px 12px', borderTop: `1px solid ${theme.palette.divider}`, whiteSpace: 'nowrap' }}>
                        {r.row}
                      </td>
                      {fields.map(f => {
                        const v = (r as Record<string, unknown>)[f]
                        const text = v == null || v === '' ? '—' : String(v)
                        return (
                          <td
                            key={f}
                            style={{
                              padding: '8px 12px',
                              borderTop: `1px solid ${theme.palette.divider}`,
                              maxWidth: 200,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: text === '—' ? theme.palette.text.secondary : 'inherit'
                            }}
                          >
                            <Tooltip title={text}>
                              <span>{text}</span>
                            </Tooltip>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Paper>
          )}
        </Box>

        <Paper variant='outlined' sx={{ p: 2 }}>
          <FormControlLabel
            control={<Switch checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />}
            label={
              <Box>
                <Typography variant='subtitle2' fontWeight={600}>
                  Skip duplicates
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  Rows that match an existing doctor by code, or by name + mobile, will be skipped.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0, '.MuiFormControlLabel-label': { ml: 1 } }}
          />
        </Paper>
      </Stack>
    )
  }

  /* ----------------------------------- Step 3: result ----------------------------------- */

  const renderResult = () => {
    if (!result) return null
    const insertedPercent = result.totalRows ? Math.round((result.created / result.totalRows) * 100) : 0
    const allOk = result.failed === 0 && result.skipped === 0
    const anyCreated = result.created > 0

    const stats = [
      { label: 'Total', value: result.totalRows, color: 'text.primary', helper: result.blankRows ? `${result.blankRows} blank` : undefined },
      { label: 'Created', value: result.created, color: 'success.main', icon: 'tabler-check' },
      { label: 'Skipped', value: result.skipped, color: 'warning.main', icon: 'tabler-arrow-bounce', helper: 'Duplicates' },
      { label: 'Failed', value: result.failed, color: 'error.main', icon: 'tabler-alert-triangle' }
    ] as const

    return (
      <Stack spacing={3}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            backgroundColor: alpha(
              allOk ? theme.palette.success.main : anyCreated ? theme.palette.warning.main : theme.palette.error.main,
              0.08
            ),
            border: `1px solid ${alpha(
              allOk ? theme.palette.success.main : anyCreated ? theme.palette.warning.main : theme.palette.error.main,
              0.4
            )}`
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              backgroundColor: allOk ? 'success.main' : anyCreated ? 'warning.main' : 'error.main',
              color: 'common.white'
            }}
          >
            <i
              className={
                allOk ? 'tabler-check' : anyCreated ? 'tabler-info-circle' : 'tabler-alert-triangle'
              }
              style={{ fontSize: 22 }}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant='subtitle1' fontWeight={600}>
              {allOk
                ? `${result.created.toLocaleString()} doctors imported`
                : anyCreated
                  ? `${result.created.toLocaleString()} created · ${result.failed + result.skipped} need attention`
                  : 'Nothing was imported'}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Sheet &ldquo;{result.sheet}&rdquo; · {result.totalRows.toLocaleString()} rows processed
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          {stats.map(s => (
            <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
              <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
                <Stack direction='row' spacing={1} alignItems='center' className='mbe-1'>
                  {'icon' in s && s.icon && (
                    <Box sx={{ color: s.color, display: 'flex' }}>
                      <i className={s.icon} style={{ fontSize: 18 }} />
                    </Box>
                  )}
                  <Typography variant='caption' color='text.secondary'>
                    {s.label}
                  </Typography>
                </Stack>
                <Typography variant='h4' fontWeight={700} sx={{ color: s.color, lineHeight: 1.1 }}>
                  {s.value.toLocaleString()}
                </Typography>
                {'helper' in s && s.helper && (
                  <Typography variant='caption' color='text.secondary'>
                    {s.helper}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box>
          <Stack direction='row' alignItems='center' justifyContent='space-between' className='mbe-1'>
            <Typography variant='caption' color='text.secondary'>
              Inserted
            </Typography>
            <Typography variant='caption' fontWeight={600}>
              {insertedPercent}%
            </Typography>
          </Stack>
          <LinearProgress
            variant='determinate'
            value={insertedPercent}
            sx={{ height: 8, borderRadius: 4 }}
            color={allOk ? 'success' : anyCreated ? 'primary' : 'error'}
          />
        </Box>

        {result.errors.length > 0 && (
          <Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent='space-between'
              className='mbe-2'
            >
              <Typography variant='subtitle2' fontWeight={600}>
                Issues ({result.fullErrorCount.toLocaleString()})
              </Typography>
              <Button
                size='small'
                variant='outlined'
                startIcon={<i className='tabler-download' />}
                onClick={onDownloadErrors}
                fullWidth={isMobile}
              >
                Download CSV report
              </Button>
            </Stack>
            {isMobile ? (
              <Stack
                spacing={1}
                sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}
              >
                {result.errors.map((e, i) => (
                  <Paper key={i} variant='outlined' sx={{ p: 1.5 }}>
                    <Stack direction='row' alignItems='center' justifyContent='space-between' className='mbe-1'>
                      <Chip
                        size='small'
                        variant='tonal'
                        color={statusChipColor(e.status)}
                        label={e.status.replace(/_/g, ' ')}
                      />
                      <Typography variant='caption' color='text.secondary'>
                        Row {e.row ?? '—'}
                      </Typography>
                    </Stack>
                    {e.field && (
                      <Typography variant='caption' color='text.secondary'>
                        Field: {e.field}
                      </Typography>
                    )}
                    <Typography variant='body2' sx={{ wordBreak: 'break-word' }}>
                      {e.message}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Paper
                variant='outlined'
                sx={{
                  maxHeight: 360,
                  overflowY: 'auto',
                  borderRadius: 1
                }}
              >
                <Box component='table' sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      backgroundColor: theme.palette.background.paper,
                      boxShadow: `inset 0 -1px 0 ${theme.palette.divider}`
                    }}
                  >
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Row</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Field</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td style={{ padding: '6px 12px', borderTop: `1px solid ${theme.palette.divider}` }}>
                          {e.row ?? '—'}
                        </td>
                        <td style={{ padding: '6px 12px', borderTop: `1px solid ${theme.palette.divider}` }}>
                          <Chip
                            size='small'
                            variant='tonal'
                            color={statusChipColor(e.status)}
                            label={e.status.replace(/_/g, ' ')}
                          />
                        </td>
                        <td
                          style={{
                            padding: '6px 12px',
                            borderTop: `1px solid ${theme.palette.divider}`,
                            color: theme.palette.text.secondary
                          }}
                        >
                          {e.field || '—'}
                        </td>
                        <td style={{ padding: '6px 12px', borderTop: `1px solid ${theme.palette.divider}` }}>
                          {e.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Paper>
            )}
            {result.errorsTruncated && (
              <Typography variant='caption' color='text.secondary' className='mts-1'>
                Showing first {result.errors.length.toLocaleString()} issues. Download the CSV for the full report.
              </Typography>
            )}
          </Box>
        )}
      </Stack>
    )
  }

  /* ------------------------------------- Layout shell ----------------------------------- */

  const titleNode = (
    <Stack direction='row' alignItems='center' spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          color: 'primary.main'
        }}
      >
        <i className='tabler-file-spreadsheet' style={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant='h6' fontWeight={600} sx={{ lineHeight: 1.2 }} noWrap>
          Import doctors
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {step === 0 && 'Step 1 of 3 · Upload'}
          {step === 1 && 'Step 2 of 3 · Map columns'}
          {step === 2 && 'Step 3 of 3 · Result'}
        </Typography>
      </Box>
    </Stack>
  )

  const stepperNode = (
    <Stepper
      activeStep={step}
      alternativeLabel={!isMobile}
      sx={{
        py: 2,
        backgroundColor: alpha(theme.palette.text.primary, 0.02),
        borderBottom: `1px solid ${theme.palette.divider}`,
        '& .MuiStepLabel-label': { mt: { xs: 0, sm: 1 } }
      }}
    >
      {STEPS.map(label => (
        <Step key={label}>
          <StepLabel>{!isMobile ? label : null}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )

  return (
    <Dialog
      open={open}
      onClose={committing ? undefined : onClose}
      fullWidth
      maxWidth='lg'
      fullScreen={isMobile}
      scroll='paper'
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 2 },
          maxHeight: { xs: '100%', sm: '90vh' }
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
          pr: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          position: 'sticky',
          top: 0,
          backgroundColor: 'background.paper',
          zIndex: 1
        }}
      >
        {titleNode}
        <IconButton
          aria-label='Close'
          onClick={onClose}
          disabled={committing}
          edge='end'
          size='small'
        >
          <i className='tabler-x' />
        </IconButton>
      </DialogTitle>

      {stepperNode}

      <DialogContent sx={{ p: { xs: 2, sm: 4 } }}>
        {step === 0 && renderUpload()}
        {step === 1 && renderMapping()}
        {step === 2 && renderResult()}
      </DialogContent>

      <DialogActions
        sx={{
          p: { xs: 2, sm: 3 },
          gap: 1,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          borderTop: `1px solid ${theme.palette.divider}`,
          position: 'sticky',
          bottom: 0,
          backgroundColor: 'background.paper',
          '& > :not(style) ~ :not(style)': { ml: { xs: 0, sm: 1 } }
        }}
      >
        {step === 0 && (
          <Button onClick={onClose} disabled={previewing} fullWidth={isMobile}>
            Cancel
          </Button>
        )}
        {step === 1 && (
          <>
            <Button
              onClick={() => setStep(0)}
              disabled={committing}
              startIcon={<i className='tabler-arrow-left' />}
              fullWidth={isMobile}
            >
              Back
            </Button>
            <Box sx={{ flex: { sm: 1 } }} />
            <Button onClick={onClose} disabled={committing} fullWidth={isMobile}>
              Cancel
            </Button>
            <Button
              variant='contained'
              onClick={() => void handleCommit()}
              disabled={committing || !isMappingValid || preview?.totalRows === 0}
              startIcon={committing ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-upload' />}
              fullWidth={isMobile}
            >
              {committing
                ? 'Importing…'
                : `Import ${(preview?.totalRows ?? 0).toLocaleString()} row${preview?.totalRows === 1 ? '' : 's'}`}
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <Button onClick={reset} startIcon={<i className='tabler-refresh' />} fullWidth={isMobile}>
              Import another file
            </Button>
            <Box sx={{ flex: { sm: 1 } }} />
            <Button variant='contained' onClick={onClose} fullWidth={isMobile}>
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default DoctorBulkImportDialog
