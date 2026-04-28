'use client'

import { useState, useCallback, useMemo, type MouseEvent } from 'react'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { attendanceService } from '@/services/attendance.service'
import { isAdminLike } from '@/utils/roleHelpers'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import DashboardAttendanceSection from '@/views/dashboard/DashboardAttendanceSection'
import { useDashboardV3Data } from '../../core/dashboardDataOrchestrator'
import { useDashboardEngineFlags } from '../useDashboardEngineFlags'
import type { TodayBoard, TodayEmployee } from '@/views/dashboard/dashboard.types'
import type { SxProps, Theme } from '@mui/material/styles'

const donutColors = ['#00d4bd', '#ffa1a1', '#826bf8', '#32baff']
const textSecondary = 'var(--mui-palette-text-secondary)'

type Props = { sectionOrderSx?: SxProps<Theme> }

export function AttendanceTeamWidget({ sectionOrderSx }: Props) {
  const d = useDashboardV3Data()
  const { user, hasPermission } = d
  const { isMobile } = useDashboardEngineFlags()
  const showCompanyAttendance = hasPermission('attendance.view')
  /** Align with legacy: show my block for every user who can open the dashboard. */
  const showMyAttendance = true
  const isAdmin = isAdminLike(user?.role)
  if (!user) return null

  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [markAbsentConfirmOpen, setMarkAbsentConfirmOpen] = useState(false)
  const [pendingAbsent, setPendingAbsent] = useState<{ employeeId: string; name: string } | null>(null)
  const [adminAttendanceBusy, setAdminAttendanceBusy] = useState(false)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null)
  const [statusMenuEmployee, setStatusMenuEmployee] = useState<{ employeeId: string; name: string } | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filterStatus, setFilterStatus] = useState('')

  const todayBoard = d.todayBoard
  const meToday = d.meToday
  const teamAttendanceLoading = d.teamAttendanceLoading
  const meTodayLoading = d.meTodayLoading

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

  const openMarkAbsentConfirm = (employeeId: string, name: string) => {
    setPendingAbsent({ employeeId, name })
    setMarkAbsentConfirmOpen(true)
  }

  const closeMarkAbsentConfirm = () => {
    if (adminAttendanceBusy) return
    setMarkAbsentConfirmOpen(false)
    setPendingAbsent(null)
  }

  const openStatusMenu = (e: MouseEvent<HTMLElement>, row: TodayEmployee) => {
    setStatusMenuAnchor(e.currentTarget)
    setStatusMenuEmployee({ employeeId: row.employeeId, name: row.name })
  }

  const closeStatusMenu = () => {
    setStatusMenuAnchor(null)
    setStatusMenuEmployee(null)
  }

  const applyAdminStatusFromMenu = async (status: 'PRESENT' | 'HALF_DAY' | 'LEAVE' | 'ABSENT') => {
    if (!statusMenuEmployee) return
    const { employeeId, name } = statusMenuEmployee
    if (status === 'ABSENT') {
      closeStatusMenu()
      openMarkAbsentConfirm(employeeId, name)
      return
    }
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId, status })
      showSuccess('Attendance updated')
      closeStatusMenu()
      await refetch()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
    }
  }

  const handleConfirmMarkAbsent = async () => {
    if (!pendingAbsent) return
    setAdminAttendanceBusy(true)
    try {
      await attendanceService.adminSetTodayStatus({ employeeId: pendingAbsent.employeeId, status: 'ABSENT' })
      showSuccess('Employee marked absent for today')
      setMarkAbsentConfirmOpen(false)
      setPendingAbsent(null)
      await refetch()
    } catch (err) {
      showApiError(err, 'Could not update attendance')
    } finally {
      setAdminAttendanceBusy(false)
    }
  }

  const tableRows = useMemo(() => {
    if (!todayBoard?.employees?.length) return []
    let list = [...todayBoard.employees]
    if (filterStatus) list = list.filter(e => e.status === filterStatus)
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name)
      return dir * a.status.localeCompare(b.status)
    })
    return list
  }, [todayBoard, sortBy, sortDir, filterStatus])

  const donutOptions: ApexOptions = useMemo(() => {
    const dist = todayBoard?.distribution
    const labels = ['Present', 'Absent', 'Half-Day', 'Leave']
    const series = dist
      ? [dist.Present ?? 0, dist.Absent ?? 0, dist['Half-Day'] ?? 0, dist.Leave ?? 0]
      : [0, 0, 0, 0]
    const total = series.reduce((s, n) => s + n, 0)
    return {
      stroke: { width: 0 },
      labels,
      colors: donutColors,
      dataLabels: { enabled: true, formatter: (val: string) => `${Math.round(parseFloat(val))}%` },
      legend: { fontSize: '13px', position: 'bottom', labels: { colors: textSecondary }, itemMargin: { horizontal: 8 } },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { fontSize: '0.95rem' },
              value: { fontSize: '1rem', color: textSecondary, formatter: (val: string) => `${val}` },
              total: {
                show: true,
                fontSize: '1rem',
                label: 'Total',
                formatter: () => `${total}`,
                color: 'var(--mui-palette-text-primary)'
              }
            }
          }
        }
      },
      chart: { toolbar: { show: false } },
      responsive: [{ breakpoint: 576, options: { chart: { height: 260 }, legend: { position: 'bottom' } } }]
    }
  }, [todayBoard?.distribution])

  const donutSeries = useMemo(() => {
    const dist = todayBoard?.distribution
    if (!dist) return [0, 0, 0, 0]
    return [dist.Present ?? 0, dist.Absent ?? 0, dist['Half-Day'] ?? 0, dist.Leave ?? 0]
  }, [todayBoard?.distribution])

  if (!showCompanyAttendance && !showMyAttendance) return null

  const commonProps = {
    showCompanyAttendance,
    showMyAttendance,
    meTodayLoading,
    meToday,
    checkingIn,
    checkingOut,
    handleCheckIn,
    handleCheckOut,
    teamAttendanceLoading,
    todayBoard: todayBoard as TodayBoard,
    isAdmin,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    filterStatus,
    setFilterStatus,
    tableRows,
    adminAttendanceBusy,
    openStatusMenu,
    donutOptions,
    donutSeries,
    formatPstHm,
    splitMyAttendance: showMyAttendance
  }

  return (
    <>
      {isMobile ? (
        <Grid size={{ xs: 12 }} sx={sectionOrderSx}>
          <Accordion defaultExpanded={false} disableGutters sx={{ borderRadius: 3, border: '1px solid var(--mui-palette-divider)' }}>
            <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
              <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                Attendance
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: { xs: 1, sm: 2 }, py: 2, pt: 1 }}>
              <DashboardAttendanceSection {...commonProps} embedded />
            </AccordionDetails>
          </Accordion>
        </Grid>
      ) : (
        <Grid size={{ xs: 12 }} sx={sectionOrderSx}>
          <DashboardAttendanceSection {...commonProps} />
        </Grid>
      )}

      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={closeStatusMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 200 } } }}
      >
        <MenuItem disabled={adminAttendanceBusy} onClick={() => applyAdminStatusFromMenu('PRESENT')}>
          Mark present
        </MenuItem>
        <MenuItem disabled={adminAttendanceBusy} onClick={() => applyAdminStatusFromMenu('HALF_DAY')}>
          Half-day
        </MenuItem>
        <MenuItem disabled={adminAttendanceBusy} onClick={() => applyAdminStatusFromMenu('LEAVE')}>
          Leave
        </MenuItem>
        <MenuItem
          disabled={adminAttendanceBusy}
          onClick={() => applyAdminStatusFromMenu('ABSENT')}
          sx={{ color: 'warning.main' }}
        >
          Mark absent…
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={markAbsentConfirmOpen}
        onClose={closeMarkAbsentConfirm}
        onConfirm={handleConfirmMarkAbsent}
        title='Mark employee absent?'
        description={
          pendingAbsent
            ? `Mark ${pendingAbsent.name} as absent for today? Their check-in will be removed if it was recorded by mistake.`
            : ''
        }
        confirmText='Yes, mark absent'
        cancelText='Cancel'
        confirmColor='warning'
        icon='tabler-user-x'
        loading={adminAttendanceBusy}
      />
    </>
  )
}
