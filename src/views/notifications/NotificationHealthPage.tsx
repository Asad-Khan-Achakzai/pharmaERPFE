'use client'

import { useCallback, useEffect, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import api from '@/services/api'
import { normalizeDocs } from '@/utils/apiList'
import { useAuth } from '@/contexts/AuthContext'
import tableStyles from '@core/styles/table.module.css'

type StatRow = {
  _id: string
  day: string
  kind: string
  created: number
  sent: number
  delivered: number
  failed: number
  opened: number
  read: number
}

const NotificationHealthPage = () => {
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState<StatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [rolling, setRolling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/notifications/analytics/health', { params: { limit: 50 } })
      setRows(normalizeDocs<StatRow>(res.data))
    } catch (err) {
      showApiError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasPermission('admin.access')) void load()
  }, [hasPermission, load])

  if (!hasPermission('admin.access')) {
    return (
      <Typography className='p-6' color='text.secondary'>
        Admin access required.
      </Typography>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Notification health'
        subheader='Daily delivery rollups by kind (UTC)'
        action={
          <Button
            variant='contained'
            disabled={rolling}
            onClick={async () => {
              setRolling(true)
              try {
                await api.post('/notifications/analytics/rollup', null, { params: { days: 7 } })
                showSuccess('Rollup refreshed')
                await load()
              } catch (err) {
                showApiError(err)
              } finally {
                setRolling(false)
              }
            }}
          >
            {rolling ? 'Refreshing…' : 'Refresh 7-day rollup'}
          </Button>
        }
      />
      {loading ? (
        <div className='flex justify-center p-8'>
          <CircularProgress size={32} />
        </div>
      ) : rows.length === 0 ? (
        <Typography className='p-6' color='text.secondary'>
          No rollup data yet. Trigger a refresh or wait for the hourly job.
        </Typography>
      ) : (
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Kind</th>
                <th>Created</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Failed</th>
                <th>Opened</th>
                <th>Read</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r._id}>
                  <td>{r.day}</td>
                  <td>{r.kind}</td>
                  <td>{r.created}</td>
                  <td>{r.sent}</td>
                  <td>{r.delivered}</td>
                  <td>{r.failed}</td>
                  <td>{r.opened}</td>
                  <td>{r.read}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default NotificationHealthPage
