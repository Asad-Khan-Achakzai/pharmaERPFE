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
import TableFooter from '@mui/material/TableFooter'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { usersService } from '@/services/users.service'
import { showApiError } from '@/utils/apiErrors'
import {
  displayKpis,
  flattenHierarchy,
  parseOverviewPayload,
  roleShortLabel,
  type MrepKpiSlice,
  type MrepOverviewRow,
  type MrepScopeSummary
} from '@/utils/mrepOverviewUtils'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const pct = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`)

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const COL_COUNT = 13

function KpiCells({ kpi }: { kpi: MrepKpiSlice }) {
  return (
    <>
      <TableCell align='right'>{pct(kpi.coverage?.coveragePercent)}</TableCell>
      <TableCell align='right'>{pct(kpi.planExecution?.visitCompletionPercent)}</TableCell>
      <TableCell align='right'>{pct(kpi.planExecution?.adherencePercent)}</TableCell>
      <TableCell align='right'>{kpi.planExecution?.missed ?? '—'}</TableCell>
      <TableCell align='right'>{pct(kpi.planExecution?.unplannedRatio)}</TableCell>
      <TableCell align='right'>
        <Typography variant='body2' component='span' display='block'>
          {pct(kpi.target?.salesAchievementPercent)}
        </Typography>
        <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
          {kpi.target?.achievedSales != null || kpi.target?.salesTarget != null
            ? `${formatPKR(Number(kpi.target?.achievedSales ?? 0))} / ${formatPKR(Number(kpi.target?.salesTarget ?? 0))}`
            : '—'}
        </Typography>
      </TableCell>
      <TableCell align='right'>{pct(kpi.attendanceScorePercent)}</TableCell>
      <TableCell align='right'>{kpi.ordersInPeriod?.orderCount ?? 0}</TableCell>
      <TableCell align='right'>{kpi.ordersInPeriod?.returnedOrderCount ?? 0}</TableCell>
      <TableCell align='right'>{formatPKR(Number(kpi.totalGrossSalesTp ?? 0))}</TableCell>
    </>
  )
}

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
  const [rows, setRows] = useState<MrepOverviewRow[]>([])
  const [scopeSummary, setScopeSummary] = useState<MrepScopeSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [managerView, setManagerView] = useState<'team' | 'individual'>('team')
  const [tableLayout, setTableLayout] = useState<'flat' | 'hierarchy'>('hierarchy')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())

  const hasManagerRows = useMemo(() => rows.some(r => r.hasTeamRollup), [rows])
  const canUseHierarchy = rows.some(r => r.managerId && rows.some(x => x.repId === r.managerId))

  const displayRows = useMemo(() => {
    if (tableLayout === 'hierarchy' && canUseHierarchy) {
      return flattenHierarchy(rows, collapsedIds)
    }
    return rows.map(r => ({ ...r, depth: 0, hasChildren: false }))
  }, [rows, tableLayout, collapsedIds, canUseHierarchy])

  const toggleCollapsed = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
      const data = parseOverviewPayload(res.data)
      setRows(data.reps)
      setScopeSummary(data.scopeSummary ?? null)
      setCollapsedIds(new Set())
    } catch (e) {
      showApiError(e, 'Could not load performance overview')
      setRows([])
      setScopeSummary(null)
    } finally {
      setLoading(false)
    }
  }, [canSee, month, repId])

  useEffect(() => {
    void load()
  }, [load])

  const footer = scopeSummary

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
            subheader='Managers show team roll-up by default (self plus everyone reporting under them). Use Team / Individual to see a manager’s own field activity. Expand rows in hierarchy view to drill into ASMs and MReps.'
          />
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: 'center' }} flexWrap='wrap' useFlexGap>
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
              {hasManagerRows ? (
                <ToggleButtonGroup
                  exclusive
                  size='small'
                  value={managerView}
                  onChange={(_, v: 'team' | 'individual' | null) => {
                    if (v) setManagerView(v)
                  }}
                  aria-label='Manager metrics view'
                >
                  <ToggleButton value='team'>Team</ToggleButton>
                  <ToggleButton value='individual'>Individual</ToggleButton>
                </ToggleButtonGroup>
              ) : null}
              {canUseHierarchy ? (
                <ToggleButtonGroup
                  exclusive
                  size='small'
                  value={tableLayout}
                  onChange={(_, v: 'flat' | 'hierarchy' | null) => {
                    if (v) setTableLayout(v)
                  }}
                  aria-label='Table layout'
                >
                  <ToggleButton value='hierarchy'>Hierarchy</ToggleButton>
                  <ToggleButton value='flat'>Flat</ToggleButton>
                </ToggleButtonGroup>
              ) : null}
            </Stack>

            {loading ? (
              <Skeleton variant='rounded' height={280} animation='wave' />
            ) : (
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell align='right'>Team size</TableCell>
                      <TableCell align='right'>Coverage</TableCell>
                      <TableCell align='right'>Visit completion</TableCell>
                      <TableCell align='right'>In-sequence</TableCell>
                      <TableCell align='right'>Missed (plan)</TableCell>
                      <TableCell align='right'>Unplanned %</TableCell>
                      <TableCell align='right'>Sales vs target</TableCell>
                      <TableCell align='right'>Attendance</TableCell>
                      <TableCell align='right'>Total orders</TableCell>
                      <TableCell align='right'>Returned orders</TableCell>
                      <TableCell align='right'>Gross sales (TP)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={COL_COUNT}>
                          <Typography variant='body2' color='text.secondary'>
                            No rows for this month or your visibility scope.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      displayRows.map(r => {
                        const kpi = displayKpis(r, managerView)
                        const collapsed = collapsedIds.has(r.repId)
                        return (
                          <TableRow key={r.repId} hover>
                            <TableCell>
                              <Stack direction='row' alignItems='flex-start' spacing={0.5}>
                                {tableLayout === 'hierarchy' && r.hasChildren ? (
                                  <IconButton
                                    size='small'
                                    aria-label={collapsed ? 'Expand' : 'Collapse'}
                                    onClick={() => toggleCollapsed(r.repId)}
                                    sx={{ mt: -0.5, p: 0.25 }}
                                  >
                                    <Typography variant='body2' component='span' sx={{ width: 16, textAlign: 'center' }}>
                                      {collapsed ? '▸' : '▾'}
                                    </Typography>
                                  </IconButton>
                                ) : (
                                  <Box sx={{ width: 28, flexShrink: 0 }} />
                                )}
                                <Box sx={{ pl: r.depth * 2 }}>
                                  <Typography fontWeight={r.depth === 0 ? 700 : 600}>{r.name || '—'}</Typography>
                                  {r.employeeCode ? (
                                    <Typography variant='caption' color='text.secondary' display='block'>
                                      {r.employeeCode}
                                    </Typography>
                                  ) : null}
                                  {r.hasTeamRollup && managerView === 'individual' ? (
                                    <Typography variant='caption' color='primary.main' display='block'>
                                      Individual
                                    </Typography>
                                  ) : r.hasTeamRollup ? (
                                    <Typography variant='caption' color='text.secondary' display='block'>
                                      Team roll-up
                                    </Typography>
                                  ) : null}
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>{roleShortLabel(r.roleCode, r.roleName)}</TableCell>
                            <TableCell align='right'>{r.hasTeamRollup ? (r.teamSize ?? 0) : '—'}</TableCell>
                            <KpiCells kpi={kpi} />
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                  {footer && rows.length > 0 ? (
                    <TableFooter>
                      <TableRow
                        sx={{
                          '& td': {
                            fontWeight: 700,
                            bgcolor: 'action.hover',
                            borderTop: theme => `2px solid ${theme.palette.divider}`
                          }
                        }}
                      >
                        <TableCell colSpan={3}>
                          Scope total
                          {footer.teamSize != null ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {footer.teamSize} people in view
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align='right'>{pct(footer.coverage?.coveragePercent)}</TableCell>
                        <TableCell align='right'>{pct(footer.planExecution?.visitCompletionPercent)}</TableCell>
                        <TableCell align='right'>{pct(footer.planExecution?.adherencePercent)}</TableCell>
                        <TableCell align='right'>{footer.planExecution?.missed ?? '—'}</TableCell>
                        <TableCell align='right'>{pct(footer.planExecution?.unplannedRatio)}</TableCell>
                        <TableCell align='right'>
                          <Typography variant='body2' component='span' display='block'>
                            {pct(footer.target?.salesAchievementPercent)}
                          </Typography>
                          <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
                            {footer.target?.salesTarget != null || footer.target?.achievedSales != null
                              ? `${formatPKR(Number(footer.target?.achievedSales ?? 0))} / ${formatPKR(Number(footer.target?.salesTarget ?? 0))}`
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>{pct(footer.attendanceScorePercent)}</TableCell>
                        <TableCell align='right'>{footer.ordersInPeriod?.orderCount ?? 0}</TableCell>
                        <TableCell align='right'>{footer.ordersInPeriod?.returnedOrderCount ?? 0}</TableCell>
                        <TableCell align='right'>{formatPKR(Number(footer.totalGrossSalesTp ?? 0))}</TableCell>
                      </TableRow>
                    </TableFooter>
                  ) : null}
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
