'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { weeklyPlansService } from '@/services/weeklyPlans.service'
import { showApiError } from '@/utils/apiErrors'
import { MrepExceptionsPanel, type OverviewRep } from '@/components/mrep/MrepExceptionsPanel'
import { MrepRankingWidget, type RankRow } from '@/components/mrep/MrepRankingWidget'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const pct = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? '—' : `${Math.round(Number(v))}%`)

const fmtPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

type MrepOverviewRep = OverviewRep & {
  employeeCode?: string | null
  ordersInPeriod?: { grossRevenue?: number; orderCount?: number }
  planExecution?: OverviewRep['planExecution'] & {
    visitCompletionPercent?: number | null
    planItemsTotal?: number
  }
  coverage?: OverviewRep['coverage'] & { doctorsTracked?: number | null }
}

function trendArrow(current: number | null | undefined, previous: number | null | undefined): string {
  if (current == null || previous == null || Number.isNaN(current) || Number.isNaN(previous)) return '—'
  if (current > previous) return '↑'
  if (current < previous) return '↓'
  return '→'
}

export default function MrepCommandCenterPage() {
  const searchParams = useSearchParams()
  const monthFromUrl = searchParams.get('month')
  const { hasPermission } = useAuth()
  const canSee = useMemo(
    () =>
      hasPermission('weeklyPlans.view') ||
      hasPermission('weeklyPlans.markVisit') ||
      hasPermission('team.viewAllReports') ||
      hasPermission('admin.access'),
    [hasPermission]
  )
  const canSeeApprovals = hasPermission('weeklyPlans.review') || hasPermission('admin.access')

  const [month, setMonth] = useState(ymNow)
  const [loading, setLoading] = useState(true)
  const [overviewReps, setOverviewReps] = useState<MrepOverviewRep[]>([])
  const [deviationReps, setDeviationReps] = useState<
    Array<{ repId: string; name?: string | null; planExecution?: MrepOverviewRep['planExecution'] }>
  >([])
  const [rankings, setRankings] = useState<RankRow[]>([])
  const [trends, setTrends] = useState<{ months?: string[]; points?: { month: string; reps: MrepOverviewRep[] }[] } | null>(
    null
  )
  const [pendingPlans, setPendingPlans] = useState<any[] | null>(null)

  useEffect(() => {
    if (monthFromUrl && /^\d{4}-\d{2}$/.test(monthFromUrl)) {
      setMonth(monthFromUrl)
    }
  }, [monthFromUrl])

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const [ov, dev, rank, tr, pend] = await Promise.all([
        reportsService.mrepMonthlyOverview({ params: { month } }),
        reportsService.mrepDeviationSummary({ month }),
        reportsService.mrepRankings({ month }),
        reportsService.mrepTrends({ months: 3 }),
        canSeeApprovals ? weeklyPlansService.pendingApprovals().catch(() => ({ data: { data: [] } })) : Promise.resolve(null)
      ])

      const reps = (ov.data as any)?.data?.reps ?? (ov.data as any)?.reps ?? []
      setOverviewReps(Array.isArray(reps) ? reps : [])

      const dr = (dev.data as any)?.data?.reps ?? (dev.data as any)?.reps ?? []
      setDeviationReps(Array.isArray(dr) ? dr : [])

      const rk = (rank.data as any)?.data?.rankings ?? (rank.data as any)?.rankings ?? []
      setRankings(Array.isArray(rk) ? rk : [])

      const trd = (tr.data as any)?.data ?? tr.data
      setTrends(trd && typeof trd === 'object' ? trd : null)

      if (pend && (pend as any).data) {
        const raw = (pend as any).data?.data ?? (pend as any).data
        setPendingPlans(Array.isArray(raw) ? raw : [])
      } else {
        setPendingPlans(null)
      }
    } catch (e) {
      showApiError(e, 'Could not load command center')
      setOverviewReps([])
      setDeviationReps([])
      setRankings([])
      setTrends(null)
      setPendingPlans(null)
    } finally {
      setLoading(false)
    }
  }, [canSee, month, canSeeApprovals])

  useEffect(() => {
    void load()
  }, [load])

  const overviewByRepId = useMemo(() => {
    const m = new Map<string, OverviewRep>()
    for (const r of overviewReps) {
      if (r.repId) m.set(String(r.repId), r)
    }
    return m
  }, [overviewReps])

  const kpiStrip = useMemo(() => {
    const n = overviewReps.length
    if (!n) {
      return {
        teamSize: 0,
        avgCoverage: null as number | null,
        avgVisitCompletion: null as number | null,
        totalRevenue: 0,
        avgAdherence: null as number | null
      }
    }
    let covSum = 0
    let covN = 0
    let vcSum = 0
    let vcN = 0
    let adhSum = 0
    let adhN = 0
    let rev = 0
    for (const r of overviewReps) {
      const c = r.coverage?.coveragePercent
      if (c != null) {
        covSum += Number(c)
        covN += 1
      }
      const vc = r.planExecution?.visitCompletionPercent
      if (vc != null) {
        vcSum += Number(vc)
        vcN += 1
      }
      const ad = r.planExecution?.adherencePercent
      if (ad != null) {
        adhSum += Number(ad)
        adhN += 1
      }
      rev += Number(r.ordersInPeriod?.grossRevenue || 0)
    }
    return {
      teamSize: n,
      avgCoverage: covN ? Math.round(covSum / covN) : null,
      avgVisitCompletion: vcN ? Math.round(vcSum / vcN) : null,
      totalRevenue: rev,
      avgAdherence: adhN ? Math.round(adhSum / adhN) : null
    }
  }, [overviewReps])

  const trendByRepPrevMonth = useMemo(() => {
    const m = new Map<string, number | null>()
    const pts = trends?.points
    if (!pts || pts.length < 2) return m
    const prev = pts[pts.length - 2]?.reps
    if (!Array.isArray(prev)) return m
    for (const r of prev) {
      const id = String((r as MrepOverviewRep).repId || '')
      if (!id) continue
      m.set(id, (r as MrepOverviewRep).coverage?.coveragePercent ?? null)
    }
    return m
  }, [trends])

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
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent='space-between'>
          <div>
            <Typography variant='h4'>MRep command center</Typography>
            <Typography variant='body2' color='text.secondary'>
              Team health, exceptions, rankings — all from existing reports.
            </Typography>
          </div>
          <TextField
            label='Month'
            type='month'
            size='small'
            value={month}
            onChange={e => setMonth(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </Grid>

      <Grid size={{ xs: 12 }}>
        {loading ? (
          <Skeleton variant='rounded' height={100} />
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {(
              [
                { label: 'Team size', value: String(kpiStrip.teamSize), link: '/team/tree' },
                { label: 'Avg coverage %', value: pct(kpiStrip.avgCoverage), link: '/doctors/list?scope=team' },
                { label: 'Visit completion %', value: pct(kpiStrip.avgVisitCompletion), link: '/weekly-plans' },
                { label: 'Plan adherence %', value: pct(kpiStrip.avgAdherence), link: '/dashboard/mrep/trends' },
                { label: 'Team revenue', value: fmtPKR(kpiStrip.totalRevenue), link: '/orders/list' }
              ] as const
            ).map(k => (
              <Paper key={k.label} variant='outlined' sx={{ p: 2, flex: 1, minWidth: 0 }}>
                <Typography variant='caption' color='text.secondary'>
                  {k.label}
                </Typography>
                <Typography variant='h6' className='mts-1'>
                  {k.value}
                </Typography>
                <Button component={Link} href={k.link} size='small' sx={{ mt: 1 }}>
                  Drill down
                </Button>
              </Paper>
            ))}
          </Stack>
        )}
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <MrepExceptionsPanel
          month={month}
          overviewByRepId={overviewByRepId}
          deviationReps={deviationReps}
          pendingPlans={pendingPlans}
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <MrepRankingWidget month={month} rankings={rankings} loading={loading} />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardHeader
            title='Team performance'
            subheader='Merge of monthly overview + trend vs prior month in series (coverage_delta)'
            action={
              <Button component={Link} href='/dashboard/manager' variant='outlined' size='small'>
                Classic table view
              </Button>
            }
          />
          <CardContent>
            {loading ? (
              <Skeleton variant='rounded' height={240} />
            ) : (
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rep</TableCell>
                      <TableCell align='right'>Coverage %</TableCell>
                      <TableCell align='right'>Visits vs plan</TableCell>
                      <TableCell align='right'>Revenue</TableCell>
                      <TableCell align='right'>Plan adherence %</TableCell>
                      <TableCell align='center'>Trend</TableCell>
                      <TableCell align='right'>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overviewReps.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Typography color='text.secondary'>No reps in scope for this month.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      overviewReps.map(r => {
                        const prevCov = trendByRepPrevMonth.get(String(r.repId)) ?? null
                        const currCov = r.coverage?.coveragePercent ?? null
                        const pe = r.planExecution
                        const visited = pe?.visited
                        const planTotal = (pe as { planItemsTotal?: number } | undefined)?.planItemsTotal
                        const visitsVsPlan =
                          visited != null && planTotal != null ? `${visited} / ${planTotal}` : '—'
                        return (
                          <TableRow key={r.repId} hover>
                            <TableCell>
                              <Typography fontWeight={600}>{r.name || '—'}</Typography>
                              {r.employeeCode ? (
                                <Typography variant='caption' color='text.secondary' display='block'>
                                  {r.employeeCode}
                                </Typography>
                              ) : null}
                            </TableCell>
                            <TableCell align='right'>{pct(currCov)}</TableCell>
                            <TableCell align='right'>{visitsVsPlan}</TableCell>
                            <TableCell align='right'>{fmtPKR(Number(r.ordersInPeriod?.grossRevenue || 0))}</TableCell>
                            <TableCell align='right'>{pct(r.planExecution?.adherencePercent)}</TableCell>
                            <TableCell align='center'>{trendArrow(currCov, prevCov)}</TableCell>
                            <TableCell align='right'>
                              <Stack direction='row' spacing={0.5} justifyContent='flex-end' flexWrap='wrap'>
                                <Button
                                  component={Link}
                                  href={`/orders/list?medicalRepId=${encodeURIComponent(r.repId)}`}
                                  size='small'
                                >
                                  Orders
                                </Button>
                                <Button
                                  component={Link}
                                  href={`/dashboard/manager?repId=${encodeURIComponent(r.repId)}`}
                                  size='small'
                                >
                                  KPIs
                                </Button>
                                <Button
                                  component={Link}
                                  href={`/doctors/list?assignedRepId=${encodeURIComponent(r.repId)}`}
                                  size='small'
                                >
                                  Doctors
                                </Button>
                                <Button
                                  component={Link}
                                  href={`/weekly-plans?medicalRepId=${encodeURIComponent(r.repId)}`}
                                  size='small'
                                >
                                  Plans
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        )
                      })
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
