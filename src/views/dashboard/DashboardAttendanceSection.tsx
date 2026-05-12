'use client'

import { memo, useEffect, useMemo, useState, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import MenuItem from '@mui/material/MenuItem'
import type { ApexOptions } from 'apexcharts'
import CustomTextField from '@core/components/mui/TextField'
import AppReactApexCharts from '@/libs/styles/AppReactApexCharts'
import type { TodayBoard, TodayEmployee } from './dashboard.types'
import MobileCardList from './MobileCardList'
import MyAttendanceCard from './MyAttendanceCard'

const statusDisplay = (s: string) => {
  switch (s) {
    case 'PRESENT':
      return 'Present'
    case 'LATE_CHECKIN_PENDING':
      return 'Late check-in (pending)'
    case 'HALF_DAY':
      return 'Half-Day'
    case 'ABSENT':
      return 'Absent'
    case 'LEAVE':
      return 'Leave'
    case 'NOT_MARKED':
      return 'Not marked'
    default:
      return s
  }
}

const statusChipColor = (s: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
  if (s === 'PRESENT') return 'success'
  if (s === 'LATE_CHECKIN_PENDING') return 'warning'
  if (s === 'HALF_DAY') return 'info'
  if (s === 'LEAVE') return 'default'
  if (s === 'ABSENT' || s === 'NOT_MARKED') return 'error'
  return 'default'
}

const NO_SHIFT_FILTER = '__no_shift__'

const DashboardAttendanceSection = memo(function DashboardAttendanceSection({
  showCompanyAttendance,
  showMyAttendance,
  meTodayLoading,
  meToday,
  checkingIn,
  checkingOut,
  handleCheckIn,
  handleCheckOut,
  teamAttendanceLoading,
  todayBoard,
  isAdmin,
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  filterStatus,
  setFilterStatus,
  adminAttendanceBusy,
  openStatusMenu,
  donutOptions,
  donutSeries,
  formatPstHm,
  embedded = false,
  splitMyAttendance = false
}: {
  showCompanyAttendance: boolean
  showMyAttendance: boolean
  meTodayLoading: boolean
  meToday: any
  checkingIn: boolean
  checkingOut: boolean
  handleCheckIn: () => Promise<void>
  handleCheckOut: () => Promise<void>
  teamAttendanceLoading: boolean
  todayBoard: TodayBoard | null
  isAdmin: boolean
  sortBy: 'name' | 'status'
  setSortBy: (v: 'name' | 'status') => void
  sortDir: 'asc' | 'desc'
  setSortDir: (v: 'asc' | 'desc') => void
  filterStatus: string
  setFilterStatus: (v: string) => void
  adminAttendanceBusy: boolean
  openStatusMenu: (e: MouseEvent<HTMLElement>, row: TodayEmployee) => void
  donutOptions: ApexOptions
  donutSeries: number[]
  formatPstHm: (iso: string | undefined) => string | null
  embedded?: boolean
  /** When true, “My attendance” is rendered in the dashboard hero row; skip it here. */
  splitMyAttendance?: boolean
}) {
  const [shiftFilter, setShiftFilter] = useState('')
  const [teamPage, setTeamPage] = useState(0)
  const [teamRowsPerPage, setTeamRowsPerPage] = useState(10)

  const employees = todayBoard?.employees ?? []

  const scheduleFilterOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const e of employees) {
      const id = e.shiftId?.trim()
      if (!id) continue
      const label = (e.scheduleLabel || e.shiftName || 'Schedule').trim()
      if (!byId.has(id)) byId.set(id, label)
    }
    return Array.from(byId.entries())
      .map(([shiftId, label]) => ({ shiftId, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [employees])

  const hasEmployeesWithoutSchedule = useMemo(
    () => employees.some(e => !e.shiftId),
    [employees]
  )

  const showShiftFilterUi =
    scheduleFilterOptions.length > 0 || hasEmployeesWithoutSchedule

  const filteredRows = useMemo(() => {
    if (!employees.length) return []
    let list = [...employees]
    if (filterStatus) list = list.filter(e => e.status === filterStatus)
    if (shiftFilter === NO_SHIFT_FILTER) {
      list = list.filter(e => !e.shiftId)
    } else if (shiftFilter) {
      list = list.filter(e => e.shiftId === shiftFilter)
    }
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name)
      return dir * a.status.localeCompare(b.status)
    })
    return list
  }, [employees, filterStatus, shiftFilter, sortBy, sortDir])

  useEffect(() => {
    setTeamPage(0)
  }, [filterStatus, sortBy, sortDir, shiftFilter])

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / teamRowsPerPage) - 1)
    if (teamPage > maxPage) setTeamPage(maxPage)
  }, [filteredRows.length, teamRowsPerPage, teamPage])

  const pagedRows = useMemo(() => {
    const start = teamPage * teamRowsPerPage
    return filteredRows.slice(start, start + teamRowsPerPage)
  }, [filteredRows, teamPage, teamRowsPerPage])

  if (!showCompanyAttendance && !showMyAttendance) return null
  const showScheduleCol = employees.some(
    r => Boolean(r.scheduleLabel || r.shiftName)
  )
  const scheduleText = (r: TodayEmployee) =>
    r.scheduleLabel || r.shiftName || '—'
  const content = (
    <Grid container spacing={3}>
        {showMyAttendance && !splitMyAttendance && (
          <Grid size={{ xs: 12 }}>
            <MyAttendanceCard
              meTodayLoading={meTodayLoading}
              meToday={meToday}
              checkingIn={checkingIn}
              checkingOut={checkingOut}
              handleCheckIn={handleCheckIn}
              handleCheckOut={handleCheckOut}
              formatPstHm={formatPstHm}
            />
          </Grid>
        )}
        {showCompanyAttendance && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader
                title='Employees Working Today'
                subheader={
                  teamAttendanceLoading ? (
                    <Box sx={{ pt: 0.5, width: '100%' }} aria-hidden>
                      <Skeleton variant='text' width='58%' height={20} animation='wave' />
                    </Box>
                  ) : todayBoard?.summary ? (
                    <div>
                      <Typography variant='body2' color='text.secondary' component='span' display='block'>
                        {`Total present: ${todayBoard.summary.present} · Staff tracked: ${todayBoard.summary.totalEmployees}`}
                      </Typography>
                      {isAdmin && (
                        <Typography variant='caption' color='text.secondary' display='block' className='mt-1'>
                          As an admin, use <strong>Set status</strong> to mark present, half-day, leave, or absent.
                        </Typography>
                      )}
                    </div>
                  ) : undefined
                }
              />
              <CardContent>
                {teamAttendanceLoading ? (
                  <Box sx={{ width: '100%' }} aria-busy aria-label='Loading team attendance'>
                    <Skeleton variant='rounded' width='42%' height={28} animation='wave' sx={{ mb: 1.5 }} />
                    <Skeleton variant='text' width='88%' animation='wave' />
                    <Skeleton variant='text' width='76%' animation='wave' />
                    <Skeleton variant='text' width='64%' animation='wave' sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      <Skeleton variant='rounded' width={100} height={32} />
                      <Skeleton variant='rounded' width={100} height={32} />
                    </Box>
                  </Box>
                ) : todayBoard?.summary ? (
                  <Grid container spacing={4}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                      <div className='flex flex-wrap gap-4 mbe-4'>
                        <CustomTextField
                          select
                          size='small'
                          label='Sort by'
                          value={sortBy}
                          onChange={e => setSortBy(e.target.value as 'name' | 'status')}
                          sx={{ minWidth: 140 }}
                        >
                          <MenuItem value='name'>Name</MenuItem>
                          <MenuItem value='status'>Status</MenuItem>
                        </CustomTextField>
                        <CustomTextField
                          select
                          size='small'
                          label='Order'
                          value={sortDir}
                          onChange={e => setSortDir(e.target.value as 'asc' | 'desc')}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value='asc'>A → Z</MenuItem>
                          <MenuItem value='desc'>Z → A</MenuItem>
                        </CustomTextField>
                        <CustomTextField
                          select
                          size='small'
                          label='Filter status'
                          value={filterStatus}
                          onChange={e => setFilterStatus(e.target.value)}
                          sx={{ minWidth: 160 }}
                        >
                          <MenuItem value=''>All</MenuItem>
                          <MenuItem value='PRESENT'>Present</MenuItem>
                          <MenuItem value='LATE_CHECKIN_PENDING'>Late check-in (pending)</MenuItem>
                          <MenuItem value='HALF_DAY'>Half-Day</MenuItem>
                          <MenuItem value='ABSENT'>Absent</MenuItem>
                          <MenuItem value='LEAVE'>Leave</MenuItem>
                          <MenuItem value='NOT_MARKED'>Not marked</MenuItem>
                        </CustomTextField>
                        {showShiftFilterUi ? (
                          <CustomTextField
                            select
                            size='small'
                            label='Schedule / shift'
                            value={shiftFilter}
                            onChange={e => setShiftFilter(e.target.value)}
                            sx={{ minWidth: 200 }}
                          >
                            <MenuItem value=''>All schedules</MenuItem>
                            {hasEmployeesWithoutSchedule ? (
                              <MenuItem value={NO_SHIFT_FILTER}>No schedule assigned</MenuItem>
                            ) : null}
                            {scheduleFilterOptions.map(o => (
                              <MenuItem key={o.shiftId} value={o.shiftId}>
                                {o.label}
                              </MenuItem>
                            ))}
                          </CustomTextField>
                        ) : null}
                        {(filterStatus || shiftFilter) && (
                          <Button
                            size='small'
                            variant='text'
                            onClick={() => {
                              setFilterStatus('')
                              setShiftFilter('')
                            }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                      {employees.length > 0 && !showShiftFilterUi ? (
                        <Typography variant='caption' color='text.secondary' display='block' className='mbe-3'>
                          Schedules appear here when attendance policies and shifts are configured under{' '}
                          <strong>Attendance → Settings</strong>.
                        </Typography>
                      ) : null}
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer component={Paper} variant='outlined'>
                          <Table size='small'>
                            <TableHead>
                              <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Status</TableCell>
                                {showScheduleCol ? <TableCell>Schedule</TableCell> : null}
                                <TableCell align='right'>Check-in (PT)</TableCell>
                                <TableCell align='right'>Check-out (PT)</TableCell>
                                {isAdmin && <TableCell align='right'>Actions</TableCell>}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredRows.length === 0 ? (
                                <TableRow>
                                  <TableCell
                                    colSpan={
                                      4 + (showScheduleCol ? 1 : 0) + (isAdmin ? 1 : 0)
                                    }
                                    align='center'
                                  >
                                    <Typography color='text.secondary' variant='body2'>
                                      No rows match the current filters.
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              ) : (
                                pagedRows.map(row => (
                                  <TableRow
                                    key={row.employeeId}
                                    hover
                                    sx={row.hasCheckedOut ? { bgcolor: 'action.hover' } : undefined}
                                  >
                                    <TableCell>
                                      <Typography fontWeight={500}>{row.name}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        size='small'
                                        variant='tonal'
                                        label={statusDisplay(row.status)}
                                        color={statusChipColor(row.status)}
                                      />
                                    </TableCell>
                                    {showScheduleCol ? (
                                      <TableCell>{scheduleText(row)}</TableCell>
                                    ) : null}
                                    <TableCell align='right'>
                                      {row.checkInTime ?? '—'}
                                    </TableCell>
                                    <TableCell align='right'>
                                      {row.checkOutTime ?? '—'}
                                    </TableCell>
                                    {isAdmin && (
                                      <TableCell align='right'>
                                        <Button
                                          size='small'
                                          variant='outlined'
                                          disabled={adminAttendanceBusy}
                                          onClick={e => openStatusMenu(e, row)}
                                          endIcon={<i className='tabler-chevron-down text-base' />}
                                        >
                                          Set status
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        <TablePagination
                          component='div'
                          count={filteredRows.length}
                          page={teamPage}
                          onPageChange={(_, p) => setTeamPage(p)}
                          rowsPerPage={teamRowsPerPage}
                          onRowsPerPageChange={e => {
                            setTeamRowsPerPage(Number(e.target.value))
                            setTeamPage(0)
                          }}
                          rowsPerPageOptions={[5, 10, 25, 50]}
                          showFirstButton
                          showLastButton
                          labelDisplayedRows={({ from, to, count }) =>
                            `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
                          }
                        />
                      </Box>
                      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                        <MobileCardList
                          items={pagedRows.map(row => ({
                            id: row.employeeId,
                            title: row.name,
                            subtitle: [
                              showScheduleCol ? `Schedule: ${scheduleText(row)}` : null,
                              `In: ${row.checkInTime ?? '—'} · Out: ${row.checkOutTime ?? '—'}`
                            ]
                              .filter(Boolean)
                              .join(' · '),
                            value: statusDisplay(row.status),
                            tone: statusChipColor(row.status),
                            action: isAdmin ? (
                              <Button
                                fullWidth
                                size='small'
                                variant='outlined'
                                disabled={adminAttendanceBusy}
                                onClick={e => openStatusMenu(e, row)}
                                endIcon={<i className='tabler-chevron-down text-base' />}
                              >
                                Set status
                              </Button>
                            ) : undefined
                          }))}
                          emptyText='No rows match the current filters.'
                        />
                        <TablePagination
                          component='div'
                          count={filteredRows.length}
                          page={teamPage}
                          onPageChange={(_, p) => setTeamPage(p)}
                          rowsPerPage={teamRowsPerPage}
                          onRowsPerPageChange={e => {
                            setTeamRowsPerPage(Number(e.target.value))
                            setTeamPage(0)
                          }}
                          rowsPerPageOptions={[5, 10, 25]}
                          showFirstButton
                          showLastButton
                          labelDisplayedRows={({ from, to, count }) =>
                            `${from}–${to} of ${count !== -1 ? count : `more than ${to}`}`
                          }
                        />
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                      <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
                        Today&apos;s distribution
                      </Typography>
                      <AppReactApexCharts
                        type='donut'
                        width='100%'
                        height={320}
                        options={donutOptions}
                        series={donutSeries}
                      />
                    </Grid>
                  </Grid>
                ) : (
                  <Typography color='text.secondary' variant='body2' className='p-2'>
                    Team attendance could not be loaded. Try refreshing the page.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
  )
  if (embedded) return content
  return <Grid size={{ xs: 12 }}>{content}</Grid>
})

export default DashboardAttendanceSection
