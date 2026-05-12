'use client'

import Link from 'next/link'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { useCallback, useState } from 'react'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { attendanceService } from '@/services/attendance.service'
import MyAttendanceCard from '@/views/dashboard/MyAttendanceCard'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'

export function MyAttendanceWidget() {
  const d = useDashboardV3Data()
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  const refetch = useCallback(async () => {
    await d.refetch()
  }, [d])

  const formatPstHm = (iso: string | undefined) => {
    if (!iso) return null
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const res = await attendanceService.checkIn()
      const doc = res.data?.data as { lateCheckInApprovalStatus?: string } | undefined
      if (doc?.lateCheckInApprovalStatus === 'PENDING') {
        showSuccess('Check-in sent to your manager for approval')
      } else {
        showSuccess('Checked in')
      }
      await refetch()
    } catch (err) {
      showApiError(err, 'Could not check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    try {
      await attendanceService.checkOut()
      showSuccess('Checked out')
      await refetch()
    } catch (err) {
      showApiError(err, 'Could not check out')
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <Box>
      <MyAttendanceCard
        meTodayLoading={d.meTodayLoading}
        meToday={d.meToday}
        checkingIn={checkingIn}
        checkingOut={checkingOut}
        handleCheckIn={handleCheckIn}
        handleCheckOut={handleCheckOut}
        formatPstHm={formatPstHm}
      />
      <Button component={Link} href='/attendance/me' size='small' variant='text' sx={{ mt: 1, pl: 1 }}>
        Open full workday & history
      </Button>
    </Box>
  )
}
