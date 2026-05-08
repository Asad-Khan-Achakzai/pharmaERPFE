'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha, useTheme } from '@mui/material/styles'
import type { ApexOptions } from 'apexcharts'
import { useAuth } from '@/contexts/AuthContext'
import { territoriesService, type TerritoryNode } from '@/services/territories.service'
import { reportsService } from '@/services/reports.service'
import { showApiError } from '@/utils/apiErrors'
import { applyTerritoryScope } from '@/utils/territoryViewerScope'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'), { ssr: false, loading: () => <Skeleton height={260} variant="rounded" /> })

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export type CompareRow = {
  territoryId: string
  name: string
  code?: string | null
  kind: string
  coveragePercent: number | null
  doctorsTracked: number | null
}

function countByKind(nodes: TerritoryNode[], kind: string): number {
  let c = 0
  for (const n of nodes) {
    if (n.kind === kind) c += 1
    if (n.children?.length) c += countByKind(n.children, kind)
  }
  return c
}

/** Territories that have at least one child (valid parents for territory-compare). */
function collectParentOptions(
  nodes: TerritoryNode[],
  trail: string[] = [],
  acc: { id: string; label: string; kind: string }[] = []
) {
  for (const n of nodes) {
    if (n.children?.length) {
      acc.push({
        id: String(n._id),
        label: [...trail, n.name].join(' › '),
        kind: n.kind
      })
      collectParentOptions(n.children, [...trail, n.name], acc)
    }
  }
  return acc
}

function healthForCoverage(p: number | null): 'healthy' | 'warning' | 'critical' | 'unknown' {
  if (p == null) return 'unknown'
  if (p >= 85) return 'healthy'
  if (p >= 60) return 'warning'
  return 'critical'
}

const HEALTH_PROPS: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  healthy: { label: 'Healthy', color: 'success' },
  warning: { label: 'Warning', color: 'warning' },
  critical: { label: 'Critical', color: 'error' },
  unknown: { label: 'Unknown', color: 'default' }
}

const doctorsUnderTerritoryHref = (territoryId: string) =>
  `/doctors/list?underTerritoryId=${encodeURIComponent(territoryId)}`

const mrepHubForMonthHref = (m: string) => `/dashboard/mrep?month=${encodeURIComponent(m)}`

const territoriesSearchHref = (q: string) => `/territories?search=${encodeURIComponent(q)}`

type KpiAccent = 'primary' | 'info' | 'success' | 'warning' | 'secondary' | 'error'

function IntelligenceKpiCard(props: {
  title: string
  value: string
  hint: string
  iconClass: string
  loading?: boolean
  accent?: KpiAccent
}) {
  const { title, value, hint, iconClass, loading, accent = 'primary' } = props
  const theme = useTheme()
  const main =
    accent === 'primary'
      ? theme.palette.primary.main
      : accent === 'info'
        ? theme.palette.info.main
        : accent === 'success'
          ? theme.palette.success.main
          : accent === 'warning'
            ? theme.palette.warning.main
            : accent === 'error'
              ? theme.palette.error.main
              : theme.palette.secondary.main

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 2,
        boxShadow: 'none',
        borderColor: alpha(main, 0.32),
        bgcolor: alpha(main, theme.palette.mode === 'dark' ? 0.14 : 0.07)
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.25} alignItems="center" textAlign="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(main, 0.2),
              color: main
            }}
          >
            <i className={iconClass} style={{ fontSize: '1.35rem' }} />
          </Box>
          <Box sx={{ minWidth: 0, width: '100%' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={72} height={32} sx={{ mt: 0.5, mx: 'auto' }} />
            ) : (
              <Typography variant="h5" fontWeight={700} sx={{ mt: 0.35, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, lineHeight: 1.4 }}>
              {hint}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

type SortKey = 'name' | 'coveragePercent' | 'doctorsTracked'
type SortDir = 'asc' | 'desc'

function TerritoryExplorerAccordion({ roots, loading }: { roots: TerritoryNode[]; loading: boolean }) {
  if (loading) {
    return <Skeleton variant="rounded" height={200} />
  }
  if (!roots.length) {
    return (
      <Typography color="text.secondary" variant="body2">
        No territories in your scope.
      </Typography>
    )
  }
  return (
    <Stack spacing={0.5}>
      {roots.map(node => (
        <Accordion key={String(node._id)} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<i className="tabler-chevron-down" />}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography fontWeight={600}>{node.name}</Typography>
              <Chip size="small" label={node.kind} variant="tonal" />
              {node.code ? (
                <Typography variant="caption" color="text.secondary">
                  {node.code}
                </Typography>
              ) : null}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {(node.children || []).map(child =>
              child.kind === 'BRICK' ? (
                <Chip key={String(child._id)} size="small" sx={{ m: 0.5 }} variant="outlined" label={child.name} />
              ) : (
                <Box key={String(child._id)} sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {child.name}
                    </Typography>
                    <Chip label={child.kind} size="small" variant="outlined" />
                  </Stack>
                  {(child.children || []).length ? (
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {(child.children || []).map(brick => (
                        <Chip key={String(brick._id)} size="small" variant="outlined" label={brick.name} />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      No sub-territories
                    </Typography>
                  )}
                </Box>
              )
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  )
}

export default function TerritoryAnalyticsPage() {
  const theme = useTheme()
  const isMobileFilters = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true })
  const { user, hasPermission, loading: authLoading } = useAuth()
  const canSee = hasPermission('territories.view')
  const [month, setMonth] = useState(ymNow)
  const [tree, setTree] = useState<TerritoryNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [parentId, setParentId] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareRows, setCompareRows] = useState<CompareRow[]>([])
  const [parentName, setParentName] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState<'coverage' | 'doctors'>('coverage')
  const [sortKey, setSortKey] = useState<SortKey>('coveragePercent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const territoryScope = useMemo(() => applyTerritoryScope(tree, user), [tree, user])
  const { scopedTree, allowedTerritoryIds, scopeUnsafe, mode: scopeMode } = territoryScope

  const parentOptions = useMemo(() => {
    const raw = collectParentOptions(scopedTree)
    return raw.sort((a, b) => a.label.localeCompare(b.label))
  }, [scopedTree])

  const zoneCount = useMemo(() => countByKind(scopedTree, 'ZONE'), [scopedTree])
  const areaCount = useMemo(() => countByKind(scopedTree, 'AREA'), [scopedTree])
  const brickCount = useMemo(() => countByKind(scopedTree, 'BRICK'), [scopedTree])

  const kpiGeoHint = scopeMode === 'full' ? 'Full hierarchy' : 'Your assigned scope'

  const compareStats = useMemo((): {
    avgCov: number | null
    sumDocs: number | null
    underperforming: number
    best: CompareRow | null
    healthCounts: Record<'healthy' | 'warning' | 'critical' | 'unknown', number>
  } => {
    const withCov = compareRows.map(r => r.coveragePercent).filter((x): x is number => x != null && !Number.isNaN(x))
    const avgCov = withCov.length ? Math.round(withCov.reduce((a, b) => a + b, 0) / withCov.length) : null
    const docs = compareRows.map(r => r.doctorsTracked).filter((x): x is number => x != null && !Number.isNaN(x))
    const sumDocs = docs.length ? docs.reduce((a, b) => a + b, 0) : null
    let underperforming = 0
    compareRows.forEach(r => {
      if (r.coveragePercent != null && r.coveragePercent < 60) underperforming += 1
    })
    let best: CompareRow | null = null
    compareRows.forEach(r => {
      if (r.coveragePercent == null) return
      if (!best || (best.coveragePercent ?? -1) < r.coveragePercent) best = r
    })
    const healthCounts = { healthy: 0, warning: 0, critical: 0, unknown: 0 }
    compareRows.forEach(r => {
      healthCounts[healthForCoverage(r.coveragePercent)] += 1
    })
    return { avgCov, sumDocs, underperforming, best, healthCounts }
  }, [compareRows])

  const insights = useMemo(() => {
    const lines: string[] = []
    if (!compareRows.length || compareLoading) return lines
    const lows = [...compareRows].filter(r => r.coveragePercent != null).sort((a, b) => (a.coveragePercent ?? 0) - (b.coveragePercent ?? 0))
    if (lows[0]) {
      lines.push(`Lowest coverage this month: ${lows[0].name} (${lows[0].coveragePercent ?? '—'}%).`)
    }
    const hiDoc = [...compareRows].filter(r => (r.doctorsTracked ?? 0) > 0).sort((a, b) => (b.doctorsTracked ?? 0) - (a.doctorsTracked ?? 0))
    if (hiDoc[0]) {
      lines.push(`Highest doctor load among compared children: ${hiDoc[0].name} (${hiDoc[0].doctorsTracked} doctors).`)
    }
    const crit = compareRows.filter(r => healthForCoverage(r.coveragePercent) === 'critical').length
    if (crit) lines.push(`${crit} child territor${crit === 1 ? 'y' : 'ies'} flagged critical (coverage below 60%).`)
    const unk = compareRows.filter(r => r.coveragePercent == null).length
    if (unk) lines.push(`${unk} row${unk === 1 ? '' : 's'} with no coverage data for this month.`)
    if (!lines.length) lines.push('All compared children have coverage data. Drill into the table for details.')
    return lines
  }, [compareRows, compareLoading])

  useEffect(() => {
    if (!canSee) return
    let cancel = false
    ;(async () => {
      setTreeLoading(true)
      try {
        const res = await territoriesService.tree()
        const roots = (res.data as { data?: { roots?: TerritoryNode[] } })?.data?.roots ??
          (res.data as { roots?: TerritoryNode[] })?.roots ??
          []
        if (!cancel) setTree(Array.isArray(roots) ? roots : [])
      } catch (e) {
        if (!cancel) showApiError(e, 'Failed to load territory tree')
      } finally {
        if (!cancel) setTreeLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [canSee])

  useEffect(() => {
    if (!parentOptions.length) {
      if (parentId) setParentId('')
      return
    }
    if (!parentOptions.some(p => p.id === parentId)) {
      const zoneFirst = parentOptions.find(p => p.kind === 'ZONE')
      setParentId(zoneFirst?.id ?? parentOptions[0].id)
    }
  }, [parentOptions, parentId])

  const loadCompare = useCallback(async () => {
    if (!parentId || !canSee) return
    setCompareLoading(true)
    try {
      const res = await reportsService.mrepTerritoryCompare({ month, parentTerritoryId: parentId })
      const data = (res.data as { data?: { parentName?: string; children?: CompareRow[] } })?.data ?? res.data
      setParentName(typeof data?.parentName === 'string' ? data.parentName : null)
      const rawChildren = data?.children ?? []
      const children = Array.isArray(rawChildren)
        ? rawChildren.filter((r: CompareRow) => allowedTerritoryIds.has(String(r.territoryId)))
        : []
      setCompareRows(children)
    } catch (e) {
      showApiError(e, 'Territory compare failed')
      setCompareRows([])
      setParentName(null)
    } finally {
      setCompareLoading(false)
    }
  }, [month, parentId, canSee, allowedTerritoryIds])

  useEffect(() => {
    void loadCompare()
  }, [loadCompare])

  const barChart = useMemo(() => {
    const rows = [...compareRows].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    const categories = rows.map(r => (r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name))
    const coverageData = rows.map(r => (r.coveragePercent != null ? Math.round(r.coveragePercent * 10) / 10 : 0))
    const doctorsData = rows.map(r => Math.max(0, r.doctorsTracked ?? 0))
    const soft = {
      a: alpha(theme.palette.primary.main, 0.85),
      b: alpha(theme.palette.info.main, 0.85),
      c: alpha(theme.palette.success.main, 0.85),
      d: alpha(theme.palette.warning.main, 0.85)
    }
    const options: ApexOptions = {
      chart: { type: 'bar', toolbar: { show: false }, fontFamily: theme.typography.fontFamily },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '62%', distributed: compareMode === 'coverage' } },
      xaxis: { categories, labels: { rotate: -35, style: { fontSize: '11px' } } },
      yaxis: {
        title: { text: compareMode === 'coverage' ? 'Coverage %' : 'Doctors' },
        max: compareMode === 'coverage' ? 100 : undefined
      },
      dataLabels: { enabled: compareMode === 'coverage', formatter: (v: number) => (compareMode === 'coverage' && v ? `${v}` : '') },
      colors:
        compareMode === 'coverage'
          ? [soft.a, soft.b, soft.c, soft.d]
          : [alpha(theme.palette.primary.main, 0.88)],
      legend: { show: false },
      grid: { strokeDashArray: 4, borderColor: theme.palette.divider },
      tooltip: {
        y: {
          formatter: (v: number) => (compareMode === 'coverage' ? `${v}%` : `${Math.round(v)} doctors`)
        }
      }
    }
    const series =
      compareMode === 'coverage'
        ? [{ name: 'Coverage %', data: coverageData }]
        : [{ name: 'Doctors', data: doctorsData }]
    return { options, series }
  }, [compareRows, compareMode, theme])

  const donutHealth = useMemo(() => {
    const h = compareStats.healthCounts
    const labels = ['Healthy', 'Warning', 'Critical', 'No data']
    const values = [h.healthy, h.warning, h.critical, h.unknown]
    const total = values.reduce((a, b) => a + b, 0)
    if (!total) return null
    const options: ApexOptions = {
      chart: { type: 'donut', fontFamily: theme.typography.fontFamily },
      labels,
      colors: [
        alpha(theme.palette.success.main, 0.78),
        alpha(theme.palette.warning.main, 0.78),
        alpha(theme.palette.error.main, 0.78),
        alpha(theme.palette.grey[500], 0.65)
      ],
      legend: { position: 'bottom', fontSize: '12px' },
      plotOptions: { pie: { donut: { size: '70%' } } },
      dataLabels: { enabled: true },
      stroke: { width: 0 }
    }
    return { options, series: values }
  }, [compareStats.healthCounts, theme])

  const sortedRows = useMemo(() => {
    const rows = [...compareRows]
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (sortKey === 'name') return dir * (a.name || '').localeCompare(b.name || '')
      const av = a[sortKey]
      const bv = b[sortKey]
      const an = av == null || Number.isNaN(av) ? -Infinity : Number(av)
      const bn = bv == null || Number.isNaN(bv) ? -Infinity : Number(bv)
      return dir * (an - bn)
    })
    return rows
  }, [compareRows, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  if (authLoading) {
    return <Skeleton variant="rounded" height={420} sx={{ borderRadius: 2 }} />
  }

  if (!canSee) {
    return <Typography color="text.secondary">You don’t have access to territory analytics.</Typography>
  }

  const showScopedEmpty = scopeUnsafe && !treeLoading

  if (showScopedEmpty) {
    return (
      <Stack spacing={2}>
        <Typography variant="h4" fontWeight={700}>
          Territory intelligence
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 560 }}>
          Your account is missing a territory assignment, role metadata, or anchors that match the company hierarchy. For security, territory data is not shown.
          If this is unexpected, ask an administrator to verify your role and territory fields.
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No scoped territories to display.
          </Typography>
        </Paper>
      </Stack>
    )
  }


  const scopeHint = 'Selected parent · month'
  const bestLabel = compareStats.best ? `${compareStats.best.name} (${compareStats.best.coveragePercent ?? '—'}%)` : '—'

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          py: 2,
          px: { xs: 2, sm: 3 },
          mb: 1,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          backdropFilter: 'blur(8px)'
        }}
      >
        <Stack spacing={2.5} alignItems="center" sx={{ width: '100%' }}>
          <Box sx={{ width: '100%', maxWidth: 720, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700}>
              Territory intelligence
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Coverage, doctor density, and regional performance — same APIs as before (`/territories/tree`, `/reports/mrep/territory-compare`).
            </Typography>
          </Box>

          {isMobileFilters ? (
            <Accordion
              defaultExpanded={false}
              disableGutters
              elevation={0}
              sx={{
                width: '100%',
                maxWidth: 440,
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px !important',
                '&:before': { display: 'none' }
              }}
            >
              <AccordionSummary expandIcon={<i className="tabler-chevron-down" />}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ py: 0.5 }}>
                  <Typography fontWeight={600}>Filters</Typography>
                  <Chip size="small" label={month} variant="outlined" />
                  {parentName ? (
                    <Chip size="small" label={parentName.length > 22 ? `${parentName.slice(0, 21)}…` : parentName} variant="tonal" />
                  ) : null}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Stack spacing={2} alignItems="stretch">
                  <TextField
                    label="Month"
                    type="month"
                    size="small"
                    fullWidth
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    select
                    size="small"
                    fullWidth
                    label="Compare parent"
                    value={parentId}
                    onChange={e => setParentId(e.target.value)}
                  >
                    {parentOptions.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        <Typography variant="body2" noWrap title={p.label}>
                          {p.label} · {p.kind}
                        </Typography>
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => void loadCompare()}
                    disabled={compareLoading}
                    startIcon={<i className="tabler-refresh" />}
                  >
                    Refresh data
                  </Button>
                  {parentName ? (
                    <Typography variant="caption" color="text.secondary">
                      Active parent: <strong>{parentName}</strong>
                    </Typography>
                  ) : null}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  alignItems: 'center',
                  rowGap: 1.5
                }}
              >
                <TextField
                  label="Month"
                  type="month"
                  size="small"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 140, verticalAlign: 'top' }}
                />
                <TextField
                  select
                  size="small"
                  label="Compare parent"
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  sx={{ minWidth: 260, maxWidth: '100%', verticalAlign: 'top' }}
                >
                  {parentOptions.map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      <Typography variant="body2" noWrap title={p.label}>
                        {p.label} · {p.kind}
                      </Typography>
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  onClick={() => void loadCompare()}
                  disabled={compareLoading}
                  startIcon={<i className="tabler-refresh" />}
                  sx={{ flexShrink: 0, height: 40 }}
                >
                  Refresh
                </Button>
              </Box>
              {parentName ? (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block' }}>
                  Compare parent: <strong>{parentName}</strong>
                </Typography>
              ) : null}
            </>
          )}
        </Stack>
      </Paper>

      <Grid container spacing={2} sx={{ justifyContent: 'center' }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Total zones"
              value={String(zoneCount)}
              hint={kpiGeoHint}
              iconClass="tabler-map-pin"
              loading={treeLoading}
              accent="primary"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Total areas"
              value={String(areaCount)}
              hint={kpiGeoHint}
              iconClass="tabler-map"
              loading={treeLoading}
              accent="info"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Total bricks"
              value={String(brickCount)}
              hint={kpiGeoHint}
              iconClass="tabler-layout-grid"
              loading={treeLoading}
              accent="secondary"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Doctors (scope)"
              value={compareStats.sumDocs != null ? String(compareStats.sumDocs) : '—'}
              hint={`Sum of doctorsTracked · ${scopeHint}`}
              iconClass="tabler-stethoscope"
              loading={compareLoading || !parentId}
              accent="success"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Avg coverage"
              value={compareStats.avgCov != null ? `${compareStats.avgCov}%` : '—'}
              hint={`Among compared children · ${scopeHint}`}
              iconClass="tabler-percentage"
              loading={compareLoading || !parentId}
              accent="warning"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Compared children"
              value={String(compareRows.length)}
              hint="Rows from territory-compare"
              iconClass="tabler-arrows-diff"
              loading={compareLoading}
              accent="info"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Underperforming"
              value={String(compareStats.underperforming)}
              hint="Coverage below 60% (in scope)"
              iconClass="tabler-alert-triangle"
              loading={compareLoading}
              accent="error"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <Tooltip title="Rep-level metrics use Command Center / rankings (not in territory-compare payload).">
              <Box component={Link} href={mrepHubForMonthHref(month)} sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <IntelligenceKpiCard
                  title="Rep metrics"
                  value="See hub"
                  hint="Opens command center for this month"
                  iconClass="tabler-users"
                  loading={false}
                  accent="secondary"
                />
              </Box>
            </Tooltip>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <IntelligenceKpiCard
              title="Top coverage"
              value={bestLabel.length > 28 ? `${bestLabel.slice(0, 27)}…` : bestLabel}
              hint={`Best child · ${scopeHint}`}
              iconClass="tabler-trophy"
              loading={compareLoading}
              accent="success"
            />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none' }}>
            <CardHeader
              title="Territory comparison"
              subheader="Direct children of the selected parent — coverage and doctors from the report API."
              titleTypographyProps={{ variant: 'h6', fontWeight: 700 }}
              action={
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={compareMode}
                  onChange={(_, v) => v && setCompareMode(v)}
                >
                  <ToggleButton value="coverage">Coverage</ToggleButton>
                  <ToggleButton value="doctors">Doctor load</ToggleButton>
                </ToggleButtonGroup>
              }
            />
            <CardContent>
              {compareLoading ? (
                <Skeleton variant="rounded" height={280} />
              ) : compareRows.length === 0 ? (
                <Typography color="text.secondary">No child territories or no data for this parent and month.</Typography>
              ) : (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" className="mbe-1">
                      {compareMode === 'coverage' ? 'Coverage by child' : 'Doctor load by child'}
                    </Typography>
                    <AppReactApexCharts type="bar" height={280} options={barChart.options} series={barChart.series} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 5 }}>
                    {donutHealth ? (
                      <>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" className="mbe-1">
                          Health mix (coverage thresholds)
                        </Typography>
                        <AppReactApexCharts type="donut" height={280} options={donutHealth.options} series={donutHealth.series} />
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No rows to chart.
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none', height: '100%' }}>
            <CardHeader title="Insights" subheader="Rule-based, from loaded comparison data only." titleTypographyProps={{ variant: 'h6', fontWeight: 700 }} />
            <CardContent>
              <Stack spacing={1}>
                {insights.map((line, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                    <i className="tabler-point" style={{ marginTop: 6, opacity: 0.6 }} />
                    <Typography variant="body2">{line}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none', height: '100%' }}>
            <CardHeader title="Quick actions" subheader="Contextual links for the selected month and parent." titleTypographyProps={{ variant: 'h6', fontWeight: 700 }} />
            <CardContent>
              <Stack spacing={1}>
                <Button
                  component={Link}
                  href={parentId ? doctorsUnderTerritoryHref(parentId) : '/doctors/list'}
                  variant="outlined"
                  fullWidth
                  startIcon={<i className="tabler-stethoscope" />}
                >
                  Doctors in compare parent
                </Button>
                <Button
                  component={Link}
                  href={mrepHubForMonthHref(month)}
                  variant="outlined"
                  fullWidth
                  startIcon={<i className="tabler-layout-dashboard" />}
                >
                  MRep command center
                </Button>
                <Button component={Link} href="/weekly-plans" variant="outlined" fullWidth startIcon={<i className="tabler-calendar-week" />}>
                  Weekly plans
                </Button>
                <Button
                  component={Link}
                  href={parentName?.trim() ? territoriesSearchHref(parentName) : '/territories'}
                  variant="outlined"
                  fullWidth
                  startIcon={<i className="tabler-map" />}
                >
                  Manage territories
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none' }}>
            <CardHeader
              title="Comparison table"
              subheader="Sortable — same fields as the API."
              titleTypographyProps={{ variant: 'h6', fontWeight: 700 }}
              action={
                <Button
                  component={Link}
                  href={parentName?.trim() ? territoriesSearchHref(parentName) : '/territories'}
                  variant="outlined"
                  size="small"
                >
                  Edit territories
                </Button>
              }
            />
            <CardContent sx={{ pt: 0 }}>
              {compareLoading ? (
                <Skeleton variant="rounded" height={160} />
              ) : !sortedRows.length ? (
                <Typography color="text.secondary">No rows.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sortDirection={sortKey === 'name' ? sortDir : false}>
                          <TableSortLabel active={sortKey === 'name'} direction={sortKey === 'name' ? sortDir : 'asc'} onClick={() => toggleSort('name')}>
                            Territory
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sortDirection={sortKey === 'coveragePercent' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'coveragePercent'}
                            direction={sortKey === 'coveragePercent' ? sortDir : 'desc'}
                            onClick={() => toggleSort('coveragePercent')}
                          >
                            Coverage %
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sortDirection={sortKey === 'doctorsTracked' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'doctorsTracked'}
                            direction={sortKey === 'doctorsTracked' ? sortDir : 'desc'}
                            onClick={() => toggleSort('doctorsTracked')}
                          >
                            Doctors
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Health</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedRows.map(row => {
                        const h = healthForCoverage(row.coveragePercent)
                        const hp = HEALTH_PROPS[h]
                        return (
                          <TableRow key={row.territoryId} hover>
                            <TableCell>
                              <Typography fontWeight={600}>{row.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {row.kind}
                                {row.code ? ` · ${row.code}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Stack alignItems="flex-end" spacing={0.5}>
                                <Typography fontWeight={600}>{row.coveragePercent ?? '—'}{row.coveragePercent != null ? '%' : ''}</Typography>
                                <Box sx={{ width: 72, height: 4, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden' }}>
                                  <Box
                                    sx={{
                                      height: '100%',
                                      width: `${Math.min(100, Math.max(0, row.coveragePercent ?? 0))}%`,
                                      bgcolor: h === 'critical' ? 'error.main' : h === 'warning' ? 'warning.main' : 'success.main'
                                    }}
                                  />
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell align="right">{row.doctorsTracked ?? '—'}</TableCell>
                            <TableCell>
                              <Chip size="small" label={hp.label} color={hp.color} variant={h === 'unknown' ? 'outlined' : 'filled'} />
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                                <Button component={Link} href={mrepHubForMonthHref(month)} size="small" variant="text">
                                  MRep hub
                                </Button>
                                <Button component={Link} href={doctorsUnderTerritoryHref(row.territoryId)} size="small" variant="text">
                                  Doctors
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card variant="outlined" sx={{ borderRadius: 2, boxShadow: 'none' }}>
            <CardHeader
              title="Territory explorer"
              subheader="Hierarchy for your assigned territory scope."
              titleTypographyProps={{ variant: 'h6', fontWeight: 700 }}
            />
            <CardContent
              sx={{
                pt: 0,
                maxHeight: { xs: 340, sm: 400, md: 440 },
                overflow: 'auto'
              }}
            >
              <TerritoryExplorerAccordion roots={scopedTree} loading={treeLoading} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}
