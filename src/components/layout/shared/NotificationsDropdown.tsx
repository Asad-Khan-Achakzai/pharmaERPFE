'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import classnames from 'classnames'
import PerfectScrollbar from 'react-perfect-scrollbar'
import { formatDistanceToNow, parseISO, isValid } from 'date-fns'
import type { ThemeColor } from '@core/types'
import type { CustomAvatarProps } from '@core/components/mui/Avatar'
import CustomAvatar from '@core/components/mui/Avatar'
import themeConfig from '@configs/themeConfig'
import { useSettings } from '@core/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtimeChannel } from '@/realtime/RealtimeProvider'
import { REALTIME_CHANNELS } from '@/realtime/channels'
import { notificationsService, type NotificationItem } from '@/services/notifications.service'
import { normalizeDocs } from '@/utils/apiList'
import { resolveWebHref } from '@/utils/notificationLinks'

const POLL_MS = 60_000
const DROPDOWN_LIMIT = 8

export type NotificationsType = {
  title: string
  subtitle: string
  time: string
  read: boolean
} & (
  | {
      avatarImage?: string
      avatarIcon?: never
      avatarText?: never
      avatarColor?: never
      avatarSkin?: never
    }
  | {
      avatarIcon?: string
      avatarColor?: ThemeColor
      avatarSkin?: CustomAvatarProps['skin']
      avatarImage?: never
      avatarText?: never
    }
  | {
      avatarText?: string
      avatarColor?: ThemeColor
      avatarSkin?: CustomAvatarProps['skin']
      avatarImage?: never
      avatarIcon?: never
    }
)

type KindVisual = {
  avatarIcon: string
  avatarColor: ThemeColor
}

function kindVisual(kind?: string | null): KindVisual {
  switch (kind) {
    case 'ATTENDANCE':
      return { avatarIcon: 'tabler-clock-check', avatarColor: 'info' }
    case 'EXPENSE':
      return { avatarIcon: 'tabler-receipt', avatarColor: 'warning' }
    case 'ANNOUNCEMENT':
      return { avatarIcon: 'tabler-speakerphone', avatarColor: 'primary' }
    case 'WEEKLY_PLAN':
      return { avatarIcon: 'tabler-calendar-event', avatarColor: 'secondary' }
    case 'DEVICE':
      return { avatarIcon: 'tabler-device-mobile', avatarColor: 'error' }
    case 'ORDER':
      return { avatarIcon: 'tabler-shopping-cart', avatarColor: 'success' }
    case 'PLAN':
      return { avatarIcon: 'tabler-map-pin', avatarColor: 'info' }
    case 'DOCTOR_LOCATION':
      return { avatarIcon: 'tabler-map-2', avatarColor: 'warning' }
    default:
      return { avatarIcon: 'tabler-bell', avatarColor: 'primary' }
  }
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    if (!isValid(d)) return ''
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return ''
  }
}

const ScrollWrapper = ({ children, hidden }: { children: ReactNode; hidden: boolean }) => {
  if (hidden) {
    return <div className='overflow-x-hidden bs-full'>{children}</div>
  }

  return (
    <PerfectScrollbar className='bs-full' options={{ wheelPropagation: false, suppressScrollX: true }}>
      {children}
    </PerfectScrollbar>
  )
}

const getAvatar = (params: {
  avatarIcon?: string
  title: string
  avatarColor?: ThemeColor
  avatarSkin?: CustomAvatarProps['skin']
}) => {
  const { avatarIcon, title, avatarColor, avatarSkin } = params

  return (
    <CustomAvatar color={avatarColor} skin={avatarSkin || 'light-static'}>
      {avatarIcon ? <i className={avatarIcon} /> : title.slice(0, 1)}
    </CustomAvatar>
  )
}

const NotificationsDropdown = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const anchorRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const hidden = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const isSmallScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('sm'))
  const { settings } = useSettings()

  const refreshUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      const res = await notificationsService.unreadCount()
      const n = res.data?.data?.count ?? res.data?.count ?? 0
      setUnreadCount(typeof n === 'number' ? n : 0)
    } catch {
      /* ignore */
    }
  }, [user])

  const loadFeed = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const res = await notificationsService.feed({ limit: DROPDOWN_LIMIT })
      setItems(normalizeDocs<NotificationItem>(res.data))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refreshUnread()
    const t = setInterval(() => void refreshUnread(), POLL_MS)
    return () => clearInterval(t)
  }, [refreshUnread])

  const onRealtime = useCallback(
    (event: { type?: string }) => {
      if (event?.type === 'notification.created') {
        void refreshUnread()
        if (open) void loadFeed()
      }
    },
    [refreshUnread, loadFeed, open]
  )
  useRealtimeChannel(REALTIME_CHANNELS.NOTIFICATIONS, onRealtime)

  useEffect(() => {
    if (open) void loadFeed()
  }, [open, loadFeed])

  useEffect(() => {
    const adjustPopoverHeight = () => {
      if (panelRef.current) {
        const availableHeight = window.innerHeight - 100
        panelRef.current.style.height = `${Math.min(availableHeight, 550)}px`
      }
    }

    adjustPopoverHeight()
    window.addEventListener('resize', adjustPopoverHeight)
    return () => window.removeEventListener('resize', adjustPopoverHeight)
  }, [open])

  const handleClose = () => setOpen(false)

  const handleToggle = () => setOpen(prev => !prev)

  const handleReadNotification = async (event: MouseEvent<HTMLElement>, item: NotificationItem) => {
    event.stopPropagation()
    try {
      if (!item.read) {
        await notificationsService.markRead(item._id, 'in_app')
        setItems(prev => prev.map(n => (n._id === item._id ? { ...n, read: true } : n)))
        setUnreadCount(c => Math.max(0, c - 1))
      }
    } catch {
      /* ignore */
    }

    const href = resolveWebHref(item.link, item.kind)
    handleClose()
    if (href) router.push(href)
  }

  const handleRemoveNotification = (event: MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setItems(prev => prev.filter(n => n._id !== id))
  }

  const readAllNotifications = async () => {
    if (markingAll || items.length === 0) return
    setMarkingAll(true)
    try {
      await notificationsService.markAllRead()
      setItems(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false)
    }
  }

  const viewAll = () => {
    handleClose()
    router.push('/notifications')
  }

  if (!user) return null

  const allRead = items.length > 0 && items.every(n => n.read)

  return (
    <>
      <IconButton ref={anchorRef} onClick={handleToggle} className='text-textPrimary' aria-label='Notifications'>
        <Badge
          color='error'
          className='cursor-pointer'
          badgeContent={unreadCount}
          max={99}
          invisible={unreadCount === 0}
          sx={{
            '& .MuiBadge-badge': {
              boxShadow: 'var(--mui-palette-background-paper) 0px 0px 0px 2px'
            }
          }}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <i className='tabler-bell' />
        </Badge>
      </IconButton>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        ref={panelRef}
        anchorEl={anchorRef.current}
        {...(isSmallScreen
          ? {
              className: 'is-full !mbs-3 z-[1] max-bs-[550px] bs-[550px]',
              modifiers: [
                {
                  name: 'preventOverflow',
                  options: {
                    padding: themeConfig.layoutPadding
                  }
                }
              ]
            }
          : { className: 'is-96 !mbs-3 z-[1] max-bs-[550px] bs-[550px]' })}
      >
        {({ TransitionProps, placement }) => (
          <Fade {...TransitionProps} style={{ transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top' }}>
            <Paper className={classnames('bs-full', settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg')}>
              <ClickAwayListener onClickAway={handleClose}>
                <div className='bs-full flex flex-col'>
                  <div className='flex items-center justify-between plb-3.5 pli-4 is-full gap-2'>
                    <Typography variant='h6' className='flex-auto'>
                      Notifications
                    </Typography>
                    {unreadCount > 0 && (
                      <Chip size='small' variant='tonal' color='primary' label={`${unreadCount} New`} />
                    )}
                    {items.length > 0 ? (
                      <Tooltip
                        title='Mark all as read'
                        placement={placement === 'bottom-end' ? 'left' : 'right'}
                        slotProps={{
                          popper: {
                            sx: {
                              '& .MuiTooltip-tooltip': {
                                transformOrigin: 'right center !important'
                              }
                            }
                          }
                        }}
                      >
                        <IconButton
                          size='small'
                          onClick={() => void readAllNotifications()}
                          disabled={markingAll || allRead}
                          className='text-textPrimary'
                        >
                          <i className={allRead ? 'tabler-mail' : 'tabler-mail-opened'} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </div>
                  <Divider />
                  <ScrollWrapper hidden={hidden}>
                    {loading ? (
                      <div className='flex items-center justify-center p-8'>
                        <CircularProgress size={28} />
                      </div>
                    ) : items.length === 0 ? (
                      <div className='flex flex-col items-center justify-center gap-2 p-8'>
                        <i className='tabler-bell-off text-3xl text-textDisabled' />
                        <Typography variant='body2' color='text.secondary'>
                          No notifications yet
                        </Typography>
                      </div>
                    ) : (
                      items.map((item, index) => {
                        const visual = kindVisual(item.kind)

                        return (
                          <div
                            key={item._id}
                            className={classnames('flex plb-3 pli-4 gap-3 cursor-pointer hover:bg-actionHover group', {
                              'border-be': index !== items.length - 1
                            })}
                            onClick={e => void handleReadNotification(e, item)}
                          >
                            {getAvatar({
                              avatarIcon: visual.avatarIcon,
                              title: item.title,
                              avatarColor: visual.avatarColor
                            })}
                            <div className='flex flex-col flex-auto min-is-0'>
                              <Typography variant='body2' className='font-medium mbe-1' color='text.primary'>
                                {item.title}
                              </Typography>
                              {item.body ? (
                                <Typography variant='caption' color='text.secondary' className='mbe-2 line-clamp-2'>
                                  {item.body}
                                </Typography>
                              ) : null}
                              <Typography variant='caption' color='text.disabled'>
                                {formatRelativeTime(item.createdAt)}
                              </Typography>
                            </div>
                            <div className='flex flex-col items-end gap-2'>
                              <Badge
                                variant='dot'
                                color={item.read ? 'secondary' : 'primary'}
                                className={classnames('mbs-1 mie-1', {
                                  'invisible group-hover:visible': item.read
                                })}
                              />
                              <i
                                className='tabler-x text-xl invisible group-hover:visible'
                                onClick={e => handleRemoveNotification(e, item._id)}
                              />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </ScrollWrapper>
                  <Divider />
                  <div className='p-4'>
                    <Button fullWidth variant='contained' size='small' onClick={viewAll}>
                      View All Notifications
                    </Button>
                  </div>
                </div>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default NotificationsDropdown
