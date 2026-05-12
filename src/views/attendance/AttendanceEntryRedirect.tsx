'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from '@/contexts/AuthContext'
import { getAttendancePermissionFlags } from '@/views/attendance/attendancePermissions'

/**
 * Smart entry: admin → /attendance/admin, team → /attendance/team, else /attendance/me
 */
export default function AttendanceEntryRedirect() {
  const router = useRouter()
  const { user, hasPermission, loading } = useAuth()

  useEffect(() => {
    if (loading || !user) return
    const flags = getAttendancePermissionFlags(user, hasPermission)
    let target = '/attendance/me'
    if (flags.canAccessAdmin) target = '/attendance/admin'
    else if (flags.canAccessTeam) target = '/attendance/team'
    router.replace(target)
  }, [loading, user, hasPermission, router])

  return (
    <Box className='flex justify-center items-center p-12'>
      <CircularProgress aria-label='Opening attendance' />
    </Box>
  )
}
