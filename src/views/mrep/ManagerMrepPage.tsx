'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { usersService } from '@/services/users.service'
import { showApiError } from '@/utils/apiErrors'

type MrepRow = {
  repId: string
  name?: string | null
  email?: string | null
  employeeCode?: string | null
  coverage?: { coveragePercent?: number | null }
  planExecution?: {
    adherencePercent?: number | null
    visitCompletionPercent?: number | null
  }
  target?: { salesAchievementPercent?: number | null }
  attendanceScorePercent?: number | null
  ordersInPeriod?: { orderCount?: number; grossRevenue?: number }
}

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const pct = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`)

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const ManagerMrepPage = () => {
  const searchParams = useSearchParams()
  const { hasPermission } = useAuth()
  const canSee = useMemo(
    () =>
      hasPermission('weeklyPlans.view') ||
      hasPermission('weeklyPlans.markVisit') ||
      hasPermission('team.viewAllReports') ||
      hasPermission('admin.access'),
    [hasPermission]
  )
  const canFilterByRep = hasPermission('team.viewAllReports') || hasPermission('admin.access')

  const [month, setMonth] = useState(ymNow)
  const [repId, setRepId] = useState('')
  const [teamUsers, setTeamUsers] = useState<{ _id: string; name: string }[]>([])
  const [rows, setRows] = useState<MrepRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!canFilterByRep) return
    let cancel = false
    ;(async () => {
      try {
        const res = await usersService.team({ includeSelf: true })
        const body = res.data?.data || res.data
        const docs = (body as { docs?: { _id: string; name: string }[] })?.docs || []
        if (!cancel) setTeamUsers(docs.map(d => ({ _id: d._id, name: d.name })))
      } catch {
        if (!cancel) setTeamUsers([])
      }
    })()
    return () => {
      cancel = true
    }
  }, [canFilterByRep])

  useEffect(() => {
    if (!canFilterByRep) return
    const r = searchParams.get('repId')
    if (r && /^[a-f0-9]{24}$/i.test(r)) setRepId(r)
  }, [searchParams, canFilterByRep])

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const params: Record<string, string> = { month }
      if (repId) params.repId = repId
      const res = await reportsService.mrepMonthlyOverview({ params })
      const data = (res.data as { data?: { reps?: MrepRow[] } })?.data
      setRows(data?.reps || [])
    } catch (e) {
      showApiError(e, 'Could not load performance overview')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canSee, month, repId])

  useEffect(() => {
    void load()
  }, [load])

  if (!canSee) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Typography color='text.secondary'>You don’t have access to this page.</Typography>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Field performance'
            subheader='Coverage vs monthly doctor targets, route discipline, sales targets, and orders for the selected month.'
          />
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }}>
              <TextField
                label='Month'
                type='month'
                value={month}
                onChange={e => setMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size='small'
              />
              {canFilterByRep ? (
                <TextField
                  select
                  label='Representative'
                  value={repId}
                  onChange={e => setRepId(e.target.value)}
                  size='small'
                  sx={{ minWidth: 260 }}
                >
                  <MenuItem value=''>All in scope</MenuItem>
                  {teamUsers.map(u => (
                    <MenuItem key={u._id} value={u._id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>

            {loading ? (
              <Skeleton variant='rounded' height={280} animation='wave' />
            ) : (
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Representative</TableCell>
                      <TableCell align='right'>Coverage</TableCell>
                      <TableCell align='right'>Visit completion</TableCell>
                      <TableCell align='right'>In-sequence</TableCell>
                      <TableCell align='right'>Sales target</TableCell>
                      <TableCell align='right'>Attendance</TableCell>
                      <TableCell align='right'>Orders</TableCell>
                      <TableCell align='right'>Revenue</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <Typography variant='body2' color='text.secondary'>
                            No rows for this month or your visibility scope.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map(r => (
                        <TableRow key={r.repId} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{r.name || '—'}</Typography>
                            {r.employeeCode ? (
                              <Typography variant='caption' color='text.secondary' display='block'>
                                {r.employeeCode}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell align='right'>{pct(r.coverage?.coveragePercent)}</TableCell>
                          <TableCell align='right'>{pct(r.planExecution?.visitCompletionPercent)}</TableCell>
                          <TableCell align='right'>{pct(r.planExecution?.adherencePercent)}</TableCell>
                          <TableCell align='right'>{pct(r.target?.salesAchievementPercent)}</TableCell>
                          <TableCell align='right'>{pct(r.attendanceScorePercent)}</TableCell>
                          <TableCell align='right'>{r.ordersInPeriod?.orderCount ?? 0}</TableCell>
                          <TableCell align='right'>
                            {formatPKR(Number(r.ordersInPeriod?.grossRevenue || 0))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default ManagerMrepPage
