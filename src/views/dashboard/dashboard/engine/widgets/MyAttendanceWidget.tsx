'use client'

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
      await attendanceService.checkIn()
      showSuccess('Checked in')
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
    <MyAttendanceCard
      meTodayLoading={d.meTodayLoading}
      meToday={d.meToday}
      checkingIn={checkingIn}
      checkingOut={checkingOut}
      handleCheckIn={handleCheckIn}
      handleCheckOut={handleCheckOut}
      formatPstHm={formatPstHm}
    />
  )
}
