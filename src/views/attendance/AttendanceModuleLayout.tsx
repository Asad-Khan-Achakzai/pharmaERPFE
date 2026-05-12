'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'

const tabSx = { minHeight: 44, textTransform: 'none', fontWeight: 600 }

export default function AttendanceModuleLayout({
  children,
  subtitle
}: {
  children: ReactNode
  /** Extra line under title (e.g. company timezone banner from parent) */
  subtitle?: ReactNode
}) {
  const pathname = usePathname()
  const { user, hasPermission } = useAuth()
  const flags = getAttendancePermissionFlags(user, hasPermission)

  const tabs: { href: string; label: string; show: boolean }[] = [
    { href: '/attendance/me', label: 'My day', show: flags.canAccessMe },
    { href: '/attendance/team', label: 'Team attendance', show: flags.canAccessTeam },
    {
      href: '/attendance/governance',
      label: 'Approvals',
      show: flags.canGovernanceRequestQueue
    },
    { href: '/attendance/admin', label: 'Settings', show: flags.canAccessAdmin }
  ]

  const visible = tabs.filter(t => t.show)
  const pathIdx = visible.findIndex(t => pathname === t.href || pathname?.startsWith(t.href + '/'))
  const selectedIndex = pathIdx >= 0 ? pathIdx : 0

  return (
    <Box className='flex flex-col gap-6'>
      <div>
        <Typography variant='h4' sx={{ fontWeight: 700 }}>
          Attendance
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, maxWidth: 720 }}>
          Check in, support your team, and adjust company options when you have access.
        </Typography>
        {subtitle ? <Box sx={{ mt: 1 }}>{subtitle}</Box> : null}
      </div>

      {visible.length > 1 ? (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={selectedIndex} variant='scrollable' scrollButtons='auto' aria-label='Attendance sections'>
            {visible.map(t => (
              <Tab key={t.href} label={t.label} href={t.href} component={Link} sx={tabSx} />
            ))}
          </Tabs>
        </Box>
      ) : null}

      {children}
    </Box>
  )
}
