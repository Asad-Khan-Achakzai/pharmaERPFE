'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { notificationsService } from '@/services/notifications.service'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeChannel } from '@/realtime/RealtimeProvider'
import { REALTIME_CHANNELS } from '@/realtime/channels'

const POLL_MS = 60_000

const NotificationsBell = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0)
      return
    }
    try {
      const res = await notificationsService.unreadCount()
      const n = res.data?.data?.count ?? res.data?.count ?? 0
      setCount(typeof n === 'number' ? n : 0)
    } catch {
      /* ignore */
    }
  }, [user])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  const onRealtime = useCallback(
    (event: { type?: string }) => {
      if (event?.type === 'notification.created') void refresh()
    },
    [refresh]
  )
  useRealtimeChannel(REALTIME_CHANNELS.NOTIFICATIONS, onRealtime)

  if (!user) return null

  return (
    <Tooltip title='Notifications'>
      <IconButton color='inherit' onClick={() => router.push('/notifications')} aria-label='Notifications'>
        <Badge badgeContent={count} color='error' max={99}>
          <i className='tabler-bell' />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}

export default NotificationsBell
