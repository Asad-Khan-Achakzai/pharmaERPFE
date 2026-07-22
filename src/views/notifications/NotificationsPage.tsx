'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { notificationsService, type NotificationItem } from '@/services/notifications.service'
import { normalizeDocs } from '@/utils/apiList'
import { resolveWebHref } from '@/utils/notificationLinks'
import tableStyles from '@core/styles/table.module.css'

const NotificationsPage = () => {
  const router = useRouter()
  const [rows, setRows] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const fetchSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 50 }
      if (kind) params.kind = kind
      const res = await notificationsService.feed(params)
      if (seq !== fetchSeq.current) return
      setRows(normalizeDocs<NotificationItem>(res.data))
    } catch (err) {
      showApiError(err)
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    void load()
  }, [load])

  const openItem = async (item: NotificationItem) => {
    try {
      if (!item.read) await notificationsService.markRead(item._id, 'in_app')
    } catch {
      /* ignore */
    }
    const href = resolveWebHref(item.link, item.kind)
    if (href) router.push(href)
    else void load()
  }

  const markAll = async () => {
    setMarkingAll(true)
    try {
      await notificationsService.markAllRead()
      showSuccess('All notifications marked as read')
      await load()
    } catch (err) {
      showApiError(err)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Notifications'
        subheader='Approvals, outcomes, and company announcements'
        action={
          <div className='flex items-center gap-2'>
            <CustomTextField
              select
              size='small'
              value={kind}
              onChange={e => setKind(e.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value=''>All kinds</MenuItem>
              <MenuItem value='ATTENDANCE'>Attendance</MenuItem>
              <MenuItem value='EXPENSE'>Expense</MenuItem>
              <MenuItem value='WEEKLY_PLAN'>Weekly plan</MenuItem>
              <MenuItem value='DEVICE'>Device</MenuItem>
              <MenuItem value='ANNOUNCEMENT'>Announcement</MenuItem>
              <MenuItem value='PLAN'>Visits</MenuItem>
              <MenuItem value='ORDER'>Orders</MenuItem>
            </CustomTextField>
            <Button variant='outlined' disabled={markingAll} onClick={() => void markAll()}>
              Mark all read
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className='flex justify-center p-8'>
          <CircularProgress size={32} />
        </div>
      ) : rows.length === 0 ? (
        <Typography className='p-6' color='text.secondary'>
          You&apos;re all caught up.
        </Typography>
      ) : (
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Notification</th>
                <th>Kind</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr
                  key={row._id}
                  className='cursor-pointer'
                  onClick={() => void openItem(row)}
                  style={{ opacity: row.read ? 0.75 : 1 }}
                >
                  <td>
                    <Typography fontWeight={row.read ? 400 : 700}>{row.title}</Typography>
                    {row.body ? (
                      <Typography variant='body2' color='text.secondary'>
                        {row.body}
                      </Typography>
                    ) : null}
                  </td>
                  <td>
                    <Chip size='small' label={row.kind || 'GENERAL'} variant='tonal' />
                  </td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.read ? null : <Chip size='small' color='primary' label='New' />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export default NotificationsPage
