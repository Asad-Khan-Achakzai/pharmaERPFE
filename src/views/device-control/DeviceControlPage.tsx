'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Skeleton from '@mui/material/Skeleton'
import { format } from 'date-fns'

import {
  deviceControlService,
  type DeviceBindingRow,
  type DeviceChangeRequestRow
} from '@/services/deviceControl.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import tableStyles from '@core/styles/table.module.css'

function fmtDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy HH:mm')
  } catch {
    return '—'
  }
}

function deviceLabel(d: {
  platform?: string | null
  brand?: string | null
  model?: string | null
  osVersion?: string | null
}): string {
  const name = [d.brand, d.model].filter(Boolean).join(' ').trim()
  const os = [d.platform, d.osVersion].filter(Boolean).join(' ').trim()
  if (name && os) return `${name} (${os})`
  return name || os || 'Unknown device'
}

export default function DeviceControlPage() {
  const { user } = useAuth()
  const featureEnabled = user?.tenantCompanyFlags?.deviceControlEnabled === true

  const [tab, setTab] = useState<'requests' | 'bindings'>('requests')

  const [requests, setRequests] = useState<DeviceChangeRequestRow[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)

  const [bindings, setBindings] = useState<DeviceBindingRow[]>([])
  const [bindingsLoading, setBindingsLoading] = useState(true)

  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectRow, setRejectRow] = useState<DeviceChangeRequestRow | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [revokeRow, setRevokeRow] = useState<DeviceBindingRow | null>(null)

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await deviceControlService.listRequests({ status: 'PENDING', limit: 100 })
      setRequests((res.data?.data as DeviceChangeRequestRow[]) || [])
    } catch (e) {
      showApiError(e, 'Failed to load device change requests')
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  const loadBindings = useCallback(async () => {
    setBindingsLoading(true)
    try {
      const res = await deviceControlService.listBindings({ limit: 100 })
      setBindings((res.data?.data as DeviceBindingRow[]) || [])
    } catch (e) {
      showApiError(e, 'Failed to load device bindings')
    } finally {
      setBindingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequests()
    void loadBindings()
  }, [loadRequests, loadBindings])

  const approve = async (row: DeviceChangeRequestRow) => {
    setActingId(row._id)
    try {
      await deviceControlService.approveRequest(row._id)
      showSuccess('Device change approved. The old device has been signed out.')
      await Promise.all([loadRequests(), loadBindings()])
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
      await deviceControlService.rejectRequest(rejectRow._id, { note: rejectNote.trim() || undefined })
      showSuccess('Device change request rejected')
      setRejectRow(null)
      setRejectNote('')
      await loadRequests()
    } catch (e) {
      showApiError(e, 'Reject failed')
    } finally {
      setActingId(null)
    }
  }

  const forceRevoke = async () => {
    if (!revokeRow?.user?._id) return
    setActingId(revokeRow._id)
    try {
      await deviceControlService.forceRevoke(revokeRow.user._id)
      showSuccess('Device revoked. The rep will be bound to the next device they log in from.')
      setRevokeRow(null)
      await Promise.all([loadBindings(), loadRequests()])
    } catch (e) {
      showApiError(e, 'Revoke failed')
    } finally {
      setActingId(null)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Device control'
          subheader='Manage single-device binding for field-force reps: review device change requests and active devices.'
          action={
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-refresh' />}
              onClick={() => {
                void loadRequests()
                void loadBindings()
              }}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {!featureEnabled && (
            <Alert severity='info' sx={{ mb: 3 }}>
              Device control is currently disabled for this company. Reps can log in from any device. A Super
              Admin can enable it from the Companies settings. Existing data below is shown for reference.
            </Alert>
          )}

          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3 }}>
            <Tab value='requests' label='Change requests' />
            <Tab value='bindings' label='Active devices' />
          </Tabs>

          {tab === 'requests' ? (
            requestsLoading ? (
              <Stack spacing={1}>
                {[1, 2, 3].map(n => (
                  <Skeleton key={n} height={56} variant='rounded' />
                ))}
              </Stack>
            ) : requests.length === 0 ? (
              <Typography color='text.secondary'>No pending device change requests.</Typography>
            ) : (
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Rep</th>
                      <th>Requested device</th>
                      <th>Reason</th>
                      <th>Requested at</th>
                      <th align='right'>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(row => (
                      <tr key={row._id}>
                        <td>
                          <Typography fontWeight={600}>{row.userId?.name || 'Unknown'}</Typography>
                          {row.userId?.email ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {row.userId.email}
                            </Typography>
                          ) : null}
                        </td>
                        <td>
                          <Typography variant='body2'>
                            {deviceLabel(row.requestedDevice || { platform: null })}
                          </Typography>
                          <Typography variant='caption' color='text.secondary' display='block'>
                            {row.requestedDeviceId}
                          </Typography>
                        </td>
                        <td>
                          <Typography variant='body2'>{row.reason || '—'}</Typography>
                        </td>
                        <td>
                          <Typography variant='body2'>{fmtDate(row.createdAt)}</Typography>
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
                                setRejectNote('')
                              }}
                            >
                              Reject
                            </Button>
                          </Stack>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : bindingsLoading ? (
            <Stack spacing={1}>
              {[1, 2, 3].map(n => (
                <Skeleton key={n} height={56} variant='rounded' />
              ))}
            </Stack>
          ) : bindings.length === 0 ? (
            <Typography color='text.secondary'>No device bindings yet.</Typography>
          ) : (
            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Bound device</th>
                    <th>Bound</th>
                    <th>Last seen</th>
                    <th align='right'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map(row => (
                    <tr key={row._id}>
                      <td>
                        <Typography fontWeight={600}>{row.user?.name || 'Unknown'}</Typography>
                        {row.user?.email ? (
                          <Typography variant='caption' color='text.secondary' display='block'>
                            {row.user.email}
                          </Typography>
                        ) : null}
                        {row.hasPendingRequest ? (
                          <Chip size='small' color='warning' label='Pending request' variant='tonal' sx={{ mt: 0.5 }} />
                        ) : null}
                      </td>
                      <td>
                        <Typography variant='body2'>{deviceLabel(row)}</Typography>
                        <Typography variant='caption' color='text.secondary' display='block'>
                          {row.deviceId}
                        </Typography>
                      </td>
                      <td>
                        <Typography variant='body2'>{fmtDate(row.boundAt)}</Typography>
                        {row.boundBy ? (
                          <Chip size='small' label={row.boundBy} variant='tonal' sx={{ mt: 0.5 }} />
                        ) : null}
                      </td>
                      <td>
                        <Typography variant='body2'>{fmtDate(row.lastSeenAt)}</Typography>
                      </td>
                      <td align='right'>
                        <Button
                          size='small'
                          variant='outlined'
                          color='error'
                          disabled={actingId === row._id || !row.user?._id}
                          onClick={() => setRevokeRow(row)}
                        >
                          Force revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectRow} onClose={() => setRejectRow(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Reject device change request</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            {rejectRow?.userId?.name
              ? `Reject ${rejectRow.userId.name}'s request. They will stay bound to their current device.`
              : 'Reject this device change request.'}
          </Typography>
          <TextField
            label='Reason (optional)'
            fullWidth
            multiline
            minRows={2}
            value={rejectNote}
            onChange={e => setRejectNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectRow(null)}>Cancel</Button>
          <Button variant='contained' color='error' disabled={!!actingId} onClick={() => void reject()}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!revokeRow} onClose={() => setRevokeRow(null)} maxWidth='sm' fullWidth>
        <DialogTitle>Force revoke device</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary'>
            {revokeRow?.user?.name
              ? `Revoke ${revokeRow.user.name}'s bound device. Any active mobile session is signed out immediately, and they will be bound to the next device they log in from.`
              : 'Revoke this device binding.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeRow(null)}>Cancel</Button>
          <Button variant='contained' color='error' disabled={!!actingId} onClick={() => void forceRevoke()}>
            Force revoke
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
