'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Skeleton from '@mui/material/Skeleton'
import IconButton from '@mui/material/IconButton'
import { format } from 'date-fns'
import {
  doctorLocationSuggestionsService,
  type DoctorLocationSuggestionRow
} from '@/services/doctorLocationSuggestions.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import tableStyles from '@core/styles/table.module.css'

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

function formatCoords(lat?: number | null, lng?: number | null): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '—'
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export default function DoctorLocationReviewPage() {
  const [rows, setRows] = useState<DoctorLocationSuggestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectRow, setRejectRow] = useState<DoctorLocationSuggestionRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await doctorLocationSuggestionsService.list({ status: 'PENDING', limit: 100 })
      setRows((res.data?.data as DoctorLocationSuggestionRow[]) || [])
    } catch (e) {
      showApiError(e, 'Failed to load location suggestions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (row: DoctorLocationSuggestionRow) => {
    setActingId(row._id)
    try {
      await doctorLocationSuggestionsService.approve(row._id)
      showSuccess('Doctor location approved')
      await load()
    } catch (e) {
      showApiError(e, 'Approve failed')
    } finally {
      setActingId(null)
    }
  }

  const reject = async () => {
    if (!rejectRow) return
    setActingId(rejectRow._id)
    try {
      await doctorLocationSuggestionsService.reject(rejectRow._id, {
        rejectionReason: rejectReason.trim() || undefined
      })
      showSuccess('Suggestion rejected')
      setRejectRow(null)
      setRejectReason('')
      await load()
    } catch (e) {
      showApiError(e, 'Reject failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Doctor location review'
          subheader='Approve rep-submitted GPS from visit completion before geo-fencing applies to a doctor.'
          action={
            <Button variant='outlined' size='small' startIcon={<i className='tabler-refresh' />} onClick={() => void load()}>
              Refresh
            </Button>
          }
        />
        <CardContent>
          {loading ? (
            <Stack spacing={1}>
              {[1, 2, 3].map(n => (
                <Skeleton key={n} height={56} variant='rounded' />
              ))}
            </Stack>
          ) : rows.length === 0 ? (
            <Typography color='text.secondary'>No pending doctor location suggestions.</Typography>
          ) : (
            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Submitted by</th>
                    <th>When</th>
                    <th>Suggested location</th>
                    <th>Verified location</th>
                    <th>Delta</th>
                    <th align='right'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const doctor = row.doctorId
                    const submitter = row.submittedByEmployeeId
                    return (
                      <tr key={row._id}>
                        <td>
                          <Typography fontWeight={600}>{doctor?.name || 'Unknown'}</Typography>
                          {doctor?.specialization ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {doctor.specialization}
                            </Typography>
                          ) : null}
                          <Chip size='small' label={doctor?.locationStatus || 'UNVERIFIED'} variant='tonal' sx={{ mt: 0.5 }} />
                        </td>
                        <td>
                          <Typography variant='body2'>{submitter?.name || '—'}</Typography>
                          {submitter?.employeeCode ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {submitter.employeeCode}
                            </Typography>
                          ) : null}
                        </td>
                        <td>
                          <Typography variant='body2'>
                            {row.submittedAt ? format(new Date(row.submittedAt), 'dd MMM yyyy HH:mm') : '—'}
                          </Typography>
                          {row.gpsAccuracy != null ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              ±{Math.round(row.gpsAccuracy)}m
                            </Typography>
                          ) : null}
                        </td>
                        <td>
                          <Typography variant='body2'>{formatCoords(row.latitude, row.longitude)}</Typography>
                          <IconButton
                            component='a'
                            href={mapsUrl(row.latitude, row.longitude)}
                            target='_blank'
                            rel='noopener noreferrer'
                            size='small'
                            aria-label='Open suggested location on map'
                          >
                            <i className='tabler-external-link' />
                          </IconButton>
                        </td>
                        <td>
                          <Typography variant='body2'>
                            {formatCoords(doctor?.latitude, doctor?.longitude)}
                          </Typography>
                          {typeof doctor?.latitude === 'number' && typeof doctor?.longitude === 'number' ? (
                            <IconButton
                              component='a'
                              href={mapsUrl(doctor.latitude, doctor.longitude)}
                              target='_blank'
                              rel='noopener noreferrer'
                              size='small'
                              aria-label='Open verified location on map'
                            >
                              <i className='tabler-external-link' />
                            </IconButton>
                          ) : (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              Not verified yet
                            </Typography>
                          )}
                        </td>
                        <td>
                          {row.distanceFromExistingVerifiedMeters != null
                            ? `${row.distanceFromExistingVerifiedMeters} m`
                            : '—'}
                        </td>
                        <td align='right'>
                          <Stack direction='row' spacing={1} justifyContent='flex-end'>
                            <Button
                              size='small'
                              variant='contained'
                              color='success'
                              disabled={actingId === row._id}
                              onClick={() => void approve(row)}
                            >
                              Approve
                            </Button>
                            <Button
                              size='small'
                              variant='outlined'
                              color='error'
                              disabled={actingId === row._id}
                              onClick={() => {
                                setRejectRow(row)
                                setRejectReason('')
                              }}
                            >
                              Reject
                            </Button>
                          </Stack>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectRow} onClose={() => setRejectRow(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Reject location suggestion</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            {rejectRow?.doctorId?.name
              ? `Reject the suggested location for ${rejectRow.doctorId.name}. The doctor will remain unverified.`
              : 'Reject this location suggestion.'}
          </Typography>
          <TextField
            label='Reason (optional)'
            fullWidth
            multiline
            minRows={2}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectRow(null)}>Cancel</Button>
          <Button variant='contained' color='error' disabled={!!actingId} onClick={() => void reject()}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
