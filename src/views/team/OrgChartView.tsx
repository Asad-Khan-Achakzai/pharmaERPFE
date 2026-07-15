'use client'

/**
 * Organization Intelligence Dashboard (/team/tree).
 *
 * Permissions:
 * - Page requires team.view (managers: reporting subtree; tenant-wide admins: full company).
 * - team.viewAllReports does not widen /users/team scope.
 * - KPI overlay needs weeklyPlans.view | team.viewAllReports | admin.access; otherwise KPIs are hidden.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { TableListSearchField, useDebouncedSearch } from '@/components/standard-list-toolbar'
import { useAuth } from '@/contexts/AuthContext'
import { reportsService } from '@/services/reports.service'
import { usersService } from '@/services/users.service'
import type { OrgFilters, OrgKpi, OrgRoleFilter, TeamTreeNode, TeamUser } from '@/types/team'
import { showApiError } from '@/utils/apiErrors'
import { parseOverviewPayload, roleShortLabel } from '@/utils/mrepOverviewUtils'
import {
  ancestorsToExpandForMatches,
  buildOrgCsv,
  buildTeamForest,
  collectExpandableIds,
  collectMatchIds,
  computeOrgInsights,
  computeOrgSummary,
  defaultCollapsedIds,
  downloadCsv,
  filterForest,
  findNodePath,
  flattenForest,
  highlightMatch,
  initials,
  managersWithReports,
  territoryLabelForUser,
  uniqueTerritories
} from '@/utils/teamForest'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EMPTY_FILTERS: OrgFilters = {
  roleCode: '',
  coverageBand: '',
  territoryId: '',
  managerId: ''
}

function roleChipColor(code?: string | null): 'primary' | 'secondary' | 'default' | 'info' {
  if (code === 'DEFAULT_ADMIN') return 'primary'
  if (code === 'DEFAULT_RM') return 'secondary'
  if (code === 'DEFAULT_ASM') return 'info'
  return 'default'
}

function nameWeight(code?: string | null, depth?: number): number {
  if (code === 'DEFAULT_ADMIN' || depth === 0) return 700
  if (code === 'DEFAULT_RM') return 650
  if (code === 'DEFAULT_ASM') return 600
  return 500
}

function nameSize(code?: string | null, depth?: number): string {
  if (code === 'DEFAULT_ADMIN' || depth === 0) return '0.975rem'
  if (code === 'DEFAULT_RM') return '0.9375rem'
  return '0.875rem'
}

function HighlightedText({ text, term }: { text: string; term: string }) {
  const { parts } = highlightMatch(text, term)
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <Box
            key={i}
            component='mark'
            sx={{ bgcolor: 'warning.light', color: 'inherit', px: 0.25, borderRadius: 0.5 }}
          >
            {p.text}
          </Box>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  )
}

function SkeletonTree() {
  return (
    <Stack spacing={1.25}>
      <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mb: 1 }}>
        {[120, 100, 110, 90, 100].map((w, i) => (
          <Skeleton key={i} variant='rounded' width={w} height={28} />
        ))}
      </Stack>
      {[0, 1, 1, 2, 2, 1].map((depth, i) => (
        <Skeleton
          key={i}
          variant='rounded'
          height={44}
          sx={{ ml: depth * 3, maxWidth: 520 - depth * 40 }}
        />
      ))}
    </Stack>
  )
}

type OrgNodeProps = {
  node: TeamTreeNode
  depth: number
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  kpiByRep: Map<string, OrgKpi>
  kpiAvailable: boolean
  searchTerm: string
  matchIds: Set<string>
  highlightUserId: string | null
  canWeeklyPlans: boolean
  canOrders: boolean
  canLive: boolean
  canVisitsTeam: boolean
}

const OrgNode = memo(function OrgNode({
  node,
  depth,
  collapsedIds,
  onToggle,
  kpiByRep,
  kpiAvailable,
  searchTerm,
  matchIds,
  highlightUserId,
  canWeeklyPlans,
  canOrders,
  canLive,
  canVisitsTeam
}: OrgNodeProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const hasChildren = node.children.length > 0
  const collapsed = hasChildren && collapsedIds.has(node._id)
  const kpi = kpiByRep.get(node._id)
  const roleCode = node.roleId?.code || ''
  const ter = territoryLabelForUser(node)
  const isMatch = matchIds.has(node._id)
  const isFocus = highlightUserId === node._id

  const openMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
  }
  const closeMenu = () => setMenuAnchor(null)

  return (
    <Box
      id={`org-node-${node._id}`}
      sx={{
        pl: depth ? 2.5 : 0,
        borderLeft: depth ? '2px solid' : 'none',
        borderColor: depth === 0 ? 'transparent' : roleCode === 'DEFAULT_RM' ? 'secondary.main' : 'divider',
        opacity: node.isActive ? 1 : 0.7
      }}
    >
      <Stack
        direction='row'
        spacing={1}
        alignItems='flex-start'
        sx={{
          py: 0.75,
          px: 1,
          borderRadius: 1,
          bgcolor: isFocus ? 'action.selected' : isMatch && searchTerm ? 'action.hover' : 'transparent',
          outline: isFocus ? '2px solid' : 'none',
          outlineColor: 'primary.main',
          '&:hover': { bgcolor: 'action.hover' },
          transition: 'background-color 0.2s'
        }}
      >
        <IconButton
          size='small'
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          disabled={!hasChildren}
          onClick={() => hasChildren && onToggle(node._id)}
          sx={{ visibility: hasChildren ? 'visible' : 'hidden', mt: 0.25, minWidth: 40, minHeight: 40 }}
        >
          <i className={`tabler-chevron-${collapsed ? 'right' : 'down'} text-lg`} />
        </IconButton>

        <Avatar
          sx={{
            width: depth === 0 ? 36 : 32,
            height: depth === 0 ? 36 : 32,
            fontSize: '0.75rem',
            bgcolor: roleChipColor(roleCode) === 'default' ? 'action.selected' : `${roleChipColor(roleCode)}.main`,
            mt: 0.25
          }}
        >
          {initials(node.name)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
            <Typography
              component='span'
              fontWeight={nameWeight(roleCode, depth)}
              sx={{ fontSize: nameSize(roleCode, depth) }}
            >
              <HighlightedText text={node.name} term={searchTerm} />
            </Typography>
            <Chip
              size='small'
              variant='tonal'
              color={roleChipColor(roleCode)}
              label={roleShortLabel(roleCode, node.roleId?.name)}
            />
            {!node.isActive ? <Chip size='small' label='Inactive' variant='outlined' /> : null}
          </Stack>

          <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap sx={{ mt: 0.5 }}>
            {node.employeeCode ? (
              <Typography variant='caption' color='text.secondary'>
                <HighlightedText text={node.employeeCode} term={searchTerm} />
              </Typography>
            ) : null}
            <Chip
              size='small'
              variant='outlined'
              label={<HighlightedText text={ter} term={searchTerm} />}
              sx={{ maxWidth: { xs: '100%', sm: 280 }, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />

            {kpiAvailable && kpi?.coverage != null ? (
              <Tooltip title={kpi.isManager ? 'Team roll-up coverage' : 'Individual coverage'}>
                <Chip
                  size='small'
                  color={kpi.coverage >= 70 ? 'success' : 'warning'}
                  label={`Cov ${kpi.coverage}%${kpi.isManager ? ' · team' : ''}`}
                />
              </Tooltip>
            ) : null}
            {kpiAvailable && kpi?.adherence != null ? (
              <Chip size='small' variant='outlined' label={`Plan ${kpi.adherence}%`} />
            ) : null}
            {kpiAvailable && kpi?.adherence == null && kpi?.salesAchievement != null ? (
              <Chip size='small' variant='outlined' label={`Sales ${kpi.salesAchievement}%`} />
            ) : null}

            {collapsed && hasChildren ? (
              <>
                <Chip size='small' variant='tonal' label={`${node.branchStats.directReports} direct`} />
                <Chip size='small' variant='tonal' label={`${node.branchStats.subtreeSize} team`} />
                {node.branchStats.mrepCount > 0 ? (
                  <Chip size='small' variant='tonal' label={`${node.branchStats.mrepCount} MRep`} />
                ) : null}
              </>
            ) : null}
            {!collapsed && kpi?.isManager && kpi.teamSize != null ? (
              <Chip size='small' variant='outlined' label={`Team ${kpi.teamSize}`} />
            ) : null}
          </Stack>
        </Box>

        <IconButton size='small' aria-label='Actions' onClick={openMenu} sx={{ minWidth: 40, minHeight: 40 }}>
          <i className='tabler-dots-vertical text-lg' />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
          <MenuItem
            component={Link}
            href={`/dashboard/manager?repId=${encodeURIComponent(node._id)}`}
            onClick={closeMenu}
          >
            Field performance
          </MenuItem>
          <MenuItem
            component={Link}
            href={`/doctors/list?assignedRepId=${encodeURIComponent(node._id)}`}
            onClick={closeMenu}
          >
            Doctors
          </MenuItem>
          {canWeeklyPlans ? (
            <MenuItem
              component={Link}
              href={`/weekly-plans?medicalRepId=${encodeURIComponent(node._id)}`}
              onClick={closeMenu}
            >
              Weekly plans
            </MenuItem>
          ) : null}
          {canOrders ? (
            <MenuItem
              component={Link}
              href={`/orders/list?medicalRepId=${encodeURIComponent(node._id)}`}
              onClick={closeMenu}
            >
              Orders / sales
            </MenuItem>
          ) : null}
          {canLive ? (
            <MenuItem component={Link} href='/team/live' onClick={closeMenu}>
              Live tracking
            </MenuItem>
          ) : null}
          {canVisitsTeam ? (
            <MenuItem component={Link} href='/visits/team' onClick={closeMenu}>
              Team visits
            </MenuItem>
          ) : null}
        </Menu>
      </Stack>

      {hasChildren && !collapsed
        ? node.children.map(ch => (
            <OrgNode
              key={ch._id}
              node={ch}
              depth={depth + 1}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              kpiByRep={kpiByRep}
              kpiAvailable={kpiAvailable}
              searchTerm={searchTerm}
              matchIds={matchIds}
              highlightUserId={highlightUserId}
              canWeeklyPlans={canWeeklyPlans}
              canOrders={canOrders}
              canLive={canLive}
              canVisitsTeam={canVisitsTeam}
            />
          ))
        : null}
    </Box>
  )
})

export default function OrgChartView() {
  const { hasPermission } = useAuth()
  const searchParams = useSearchParams()
  const canSee = hasPermission('team.view')
  const canUsersView = hasPermission('users.view')
  const canWeeklyPlans = hasPermission('weeklyPlans.view')
  const canOrders = hasPermission('team.viewAllReports') || hasPermission('admin.access')
  const canLive =
    hasPermission('admin.access') ||
    hasPermission('team.view') ||
    hasPermission('team.viewAllReports') ||
    hasPermission('attendance.viewTeam')
  const canVisitsTeam =
    hasPermission('team.view') || hasPermission('team.viewAllReports') || hasPermission('admin.access')

  const deepUser = searchParams.get('user')
  const monthFromUrl = searchParams.get('month')

  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(() => {
    if (monthFromUrl && /^\d{4}-\d{2}$/.test(monthFromUrl)) return monthFromUrl
    return ymNow()
  })
  const [kpiByRep, setKpiByRep] = useState<Map<string, OrgKpi>>(() => new Map())
  const [kpiAvailable, setKpiAvailable] = useState(false)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const [filters, setFilters] = useState<OrgFilters>(EMPTY_FILTERS)
  const [highlightUserId, setHighlightUserId] = useState<string | null>(null)
  const deepLinkDone = useRef<string | null>(null)

  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const [teamRes, monthly] = await Promise.all([
        usersService.team({ includeSelf: true, includeInactive }),
        reportsService.mrepMonthlyOverview({ params: { month } }).catch(() => null)
      ])
      const body = teamRes.data?.data || teamRes.data
      const docs = (body as { docs?: TeamUser[] })?.docs || []
      setUsers(docs)

      const m = new Map<string, OrgKpi>()
      if (monthly) {
        const payload = parseOverviewPayload(monthly.data)
        for (const r of payload.reps) {
          const id = String(r.repId || '')
          if (!id) continue
          m.set(id, {
            coverage: r.coverage?.coveragePercent ?? null,
            teamSize: r.hasTeamRollup ? (r.teamSize ?? 0) : null,
            isManager: Boolean(r.hasTeamRollup),
            adherence: r.planExecution?.adherencePercent ?? null,
            salesAchievement: r.target?.salesAchievementPercent ?? null
          })
        }
        setKpiAvailable(true)
      } else {
        setKpiAvailable(false)
      }
      setKpiByRep(m)
    } catch (e) {
      showApiError(e, 'Failed to load organization')
      setUsers([])
      setKpiAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [canSee, month, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  const forest = useMemo(() => buildTeamForest(users), [users])

  // Reset collapse defaults when roster identity changes (after deep-link expand on first paint)
  const rosterKey = useMemo(() => users.map(u => u._id).join(','), [users])
  useEffect(() => {
    if (!users.length) {
      setCollapsedIds(new Set())
      deepLinkDone.current = null
      return
    }
    const nextForest = buildTeamForest(users)
    let collapsed = defaultCollapsedIds(nextForest, 1)
    const focusId = deepUser
    if (focusId) {
      const path = findNodePath(nextForest, focusId)
      if (path) {
        collapsed = new Set(collapsed)
        for (const id of path.slice(0, -1)) collapsed.delete(id)
      }
    }
    setCollapsedIds(collapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on roster change
  }, [rosterKey])

  const filteredForest = useMemo(
    () => filterForest(forest, debouncedSearch, filters, kpiByRep),
    [forest, debouncedSearch, filters, kpiByRep]
  )

  const matchIds = useMemo(() => {
    const hasQuery =
      Boolean(debouncedSearch.trim()) ||
      Boolean(filters.roleCode) ||
      Boolean(filters.coverageBand) ||
      Boolean(filters.territoryId) ||
      Boolean(filters.managerId)
    if (!hasQuery) return new Set<string>()
    return collectMatchIds(forest, debouncedSearch, filters, kpiByRep)
  }, [forest, debouncedSearch, filters, kpiByRep])

  // Auto-expand ancestors of search/filter matches
  useEffect(() => {
    const toExpand = ancestorsToExpandForMatches(forest, debouncedSearch, filters, kpiByRep)
    if (!toExpand.size) return
    setCollapsedIds(prev => {
      const next = new Set(prev)
      for (const id of toExpand) next.delete(id)
      return next
    })
  }, [forest, debouncedSearch, filters, kpiByRep])

  // Deep link ?user=
  useEffect(() => {
    if (!deepUser || loading || !forest.length) return
    if (deepLinkDone.current === deepUser) return
    const path = findNodePath(forest, deepUser)
    if (!path) return
    deepLinkDone.current = deepUser
    setCollapsedIds(prev => {
      const next = new Set(prev)
      for (const id of path.slice(0, -1)) next.delete(id)
      return next
    })
    setHighlightUserId(deepUser)
    requestAnimationFrame(() => {
      document.getElementById(`org-node-${deepUser}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const t = window.setTimeout(() => setHighlightUserId(null), 3000)
    return () => window.clearTimeout(t)
  }, [deepUser, loading, forest])

  const summary = useMemo(() => computeOrgSummary(users, kpiByRep, kpiAvailable), [users, kpiByRep, kpiAvailable])
  const insights = useMemo(() => computeOrgInsights(forest), [forest])
  const territories = useMemo(() => uniqueTerritories(users), [users])
  const managerOptions = useMemo(() => managersWithReports(forest), [forest])

  const hasActiveFilters =
    Boolean(debouncedSearch.trim()) ||
    Boolean(filters.roleCode) ||
    Boolean(filters.coverageBand) ||
    Boolean(filters.territoryId) ||
    Boolean(filters.managerId) ||
    includeInactive

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    clearSearch()
  }

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = () => setCollapsedIds(new Set())
  const collapseAll = () => setCollapsedIds(new Set(collectExpandableIds(forest)))

  const exportCsv = () => {
    const csv = buildOrgCsv(filteredForest, kpiByRep, kpiAvailable)
    downloadCsv(`org-hierarchy-${month}.csv`, csv)
  }

  const visibleCount = useMemo(() => flattenForest(filteredForest).length, [filteredForest])

  if (!canSee) {
    return (
      <Card>
        <CardContent>
          <Stack alignItems='center' spacing={2} sx={{ py: 6, px: 2, textAlign: 'center' }}>
            <Box sx={{ fontSize: 40, color: 'text.disabled' }}>
              <i className='tabler-lock' />
            </Box>
            <Typography variant='h6'>Access denied</Typography>
            <Typography color='text.secondary' maxWidth={420}>
              You need the <strong>team.view</strong> permission to open the organization hierarchy.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Organization'
        subheader='Who reports to whom in your scope. Coverage uses Field performance for the selected month.'
        action={
          <Stack direction='row' spacing={0.5} alignItems='center'>
            <Tooltip title='Export CSV'>
              <span>
                <IconButton
                  aria-label='Export CSV'
                  onClick={exportCsv}
                  disabled={loading || filteredForest.length === 0}
                >
                  <i className='tabler-download text-xl' />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title='Refresh'>
              <IconButton aria-label='Refresh' onClick={() => void load()} disabled={loading}>
                <i className='tabler-refresh text-xl' />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <CardContent>
        {loading ? (
          <SkeletonTree />
        ) : (
          <>
            {/* Summary strip */}
            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap sx={{ mb: 2 }}>
              <Chip color='primary' variant='tonal' label={`${summary.total} Employees`} />
              <Chip variant='tonal' label={`${summary.managers} Managers`} />
              <Chip variant='tonal' label={`${summary.mreps} MReps`} />
              <Chip color='success' variant='tonal' label={`${summary.active} Active`} />
              {summary.inactive > 0 ? (
                <Chip variant='tonal' label={`${summary.inactive} Inactive`} />
              ) : null}
              {kpiAvailable && summary.avgCoverage != null ? (
                <Chip
                  color={summary.avgCoverage >= 70 ? 'success' : 'warning'}
                  variant='tonal'
                  label={`Avg cov ${summary.avgCoverage}%`}
                />
              ) : null}
              <Chip variant='outlined' label={`${summary.territoryCount} Territories`} />
            </Stack>

            {!kpiAvailable ? (
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1.5 }}>
                KPIs unavailable for your permissions or this month — hierarchy still shown.
              </Typography>
            ) : null}

            {/* Light analytics */}
            {insights.largestTeamName ? (
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 2 }}>
                Largest team: {insights.largestTeamName} ({insights.largestTeamSize})
                {insights.avgSpanOfControl != null ? ` · Avg span ${insights.avgSpanOfControl}` : ''}
                {insights.maxDepth > 0 ? ` · Depth ${insights.maxDepth}` : ''}
              </Typography>
            ) : null}

            {/* Toolbar */}
            <Stack spacing={2} sx={{ mb: 2 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                alignItems={{ md: 'center' }}
                flexWrap='wrap'
                useFlexGap
              >
                <TableListSearchField
                  value={searchInput}
                  onChange={setSearchInput}
                  onClear={clearSearch}
                  placeholder='Search name, code, email, role, territory…'
                />
                <TextField
                  label='Month'
                  type='month'
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size='small'
                  sx={{ minWidth: 160 }}
                />
                <Button size='small' variant='tonal' onClick={expandAll}>
                  Expand all
                </Button>
                <Button size='small' variant='tonal' onClick={collapseAll}>
                  Collapse all
                </Button>
                <FormControlLabel
                  control={
                    <Switch
                      size='small'
                      checked={includeInactive}
                      onChange={e => setIncludeInactive(e.target.checked)}
                    />
                  }
                  label='Show inactive'
                />
              </Stack>

              <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap alignItems='center'>
                <TextField
                  select
                  label='Role'
                  size='small'
                  value={filters.roleCode}
                  onChange={e => setFilters(f => ({ ...f, roleCode: e.target.value as OrgRoleFilter }))}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value=''>All roles</MenuItem>
                  <MenuItem value='DEFAULT_ADMIN'>Admin</MenuItem>
                  <MenuItem value='DEFAULT_RM'>RM</MenuItem>
                  <MenuItem value='DEFAULT_ASM'>ASM</MenuItem>
                  <MenuItem value='DEFAULT_MEDICAL_REP'>MRep</MenuItem>
                </TextField>
                <TextField
                  select
                  label='Coverage'
                  size='small'
                  value={filters.coverageBand}
                  onChange={e =>
                    setFilters(f => ({
                      ...f,
                      coverageBand: e.target.value as OrgFilters['coverageBand']
                    }))
                  }
                  sx={{ minWidth: 140 }}
                  disabled={!kpiAvailable}
                >
                  <MenuItem value=''>All coverage</MenuItem>
                  <MenuItem value='healthy'>Healthy (≥70%)</MenuItem>
                  <MenuItem value='watch'>Watch (&lt;70%)</MenuItem>
                  <MenuItem value='unknown'>Unknown</MenuItem>
                </TextField>
                <TextField
                  select
                  label='Territory'
                  size='small'
                  value={filters.territoryId}
                  onChange={e => setFilters(f => ({ ...f, territoryId: e.target.value }))}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value=''>All territories</MenuItem>
                  {territories.map(t => (
                    <MenuItem key={t._id} value={t._id}>
                      {t.name}
                      {t.code ? ` (${t.code})` : ''}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label='Manager'
                  size='small'
                  value={filters.managerId}
                  onChange={e => setFilters(f => ({ ...f, managerId: e.target.value }))}
                  sx={{ minWidth: 180 }}
                >
                  <MenuItem value=''>All managers</MenuItem>
                  {managerOptions.map(m => (
                    <MenuItem key={m._id} value={m._id}>
                      {m.name}
                    </MenuItem>
                  ))}
                </TextField>
                {hasActiveFilters && (debouncedSearch || filters.roleCode || filters.coverageBand || filters.territoryId || filters.managerId) ? (
                  <Button size='small' onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            {/* Tree / empty states */}
            {users.length === 0 ? (
              <Stack alignItems='center' spacing={1.5} sx={{ py: 5, textAlign: 'center' }}>
                <Box sx={{ fontSize: 36, color: 'text.disabled' }}>
                  <i className='tabler-hierarchy-2' />
                </Box>
                <Typography variant='h6'>Reporting hierarchy not configured</Typography>
                <Typography color='text.secondary' maxWidth={480}>
                  No direct or indirect reports yet. An admin builds the tree from{' '}
                  <strong>Users → User List → Edit</strong> by setting each user&apos;s{' '}
                  <em>Reports to (Manager)</em>.
                </Typography>
                {canUsersView ? (
                  <Button component={Link} href='/users/list' variant='contained' size='small'>
                    Open User List
                  </Button>
                ) : null}
              </Stack>
            ) : filteredForest.length === 0 ? (
              <Stack alignItems='center' spacing={1.5} sx={{ py: 5, textAlign: 'center' }}>
                <Typography variant='h6'>No people match</Typography>
                <Typography color='text.secondary' maxWidth={420}>
                  {debouncedSearch
                    ? 'No matches for your search. Try another name, code, or territory.'
                    : 'Current filters hide everyone in your scope.'}
                </Typography>
                <Button size='small' variant='tonal' onClick={clearFilters}>
                  Clear search & filters
                </Button>
              </Stack>
            ) : (
              <>
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                  Showing {visibleCount} of {users.length}
                </Typography>
                {filteredForest.map(root => (
                  <OrgNode
                    key={root._id}
                    node={root}
                    depth={0}
                    collapsedIds={collapsedIds}
                    onToggle={toggleCollapsed}
                    kpiByRep={kpiByRep}
                    kpiAvailable={kpiAvailable}
                    searchTerm={debouncedSearch}
                    matchIds={matchIds}
                    highlightUserId={highlightUserId}
                    canWeeklyPlans={canWeeklyPlans}
                    canOrders={canOrders}
                    canLive={canLive}
                    canVisitsTeam={canVisitsTeam}
                  />
                ))}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
