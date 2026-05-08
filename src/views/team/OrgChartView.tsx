'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { usersService } from '@/services/users.service'
import { reportsService } from '@/services/reports.service'
import { showApiError } from '@/utils/apiErrors'

type TeamUser = {
  _id: string
  name: string
  email: string
  isActive: boolean
  employeeCode?: string | null
  roleId?: { name?: string; code?: string } | null
  managerId?: { _id: string; name: string; email?: string } | string | null
  territoryId?: { _id: string; name: string; code?: string | null; kind: string } | string | null
}

type TreeNode = TeamUser & { children: TreeNode[] }

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function buildForest(users: TeamUser[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  for (const u of users) {
    byId.set(u._id, { ...u, children: [] })
  }
  const roots: TreeNode[] = []
  for (const u of users) {
    const node = byId.get(u._id)!
    const mid =
      u.managerId && typeof u.managerId === 'object' && u.managerId._id ? String(u.managerId._id) : null
    if (mid && byId.has(mid)) {
      byId.get(mid)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sortTree = (n: TreeNode[]) => {
    n.sort((a, b) => a.name.localeCompare(b.name))
    for (const x of n) sortTree(x.children)
  }
  sortTree(roots)
  return roots
}

function OrgNode({
  node,
  depth,
  kpiByRep
}: {
  node: TreeNode
  depth: number
  kpiByRep: Map<string, { coverage: number | null; territoryLabel: string }>
}) {
  const kpi = kpiByRep.get(node._id)
  const ter =
    node.territoryId && typeof node.territoryId === 'object'
      ? `${node.territoryId.name}${node.territoryId.code ? ` (${node.territoryId.code})` : ''}`
      : '—'

  return (
    <Box sx={{ pl: depth * 2.5, py: 0.75, borderLeft: depth ? '2px solid' : 'none', borderColor: 'divider' }}>
      <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
        <Typography fontWeight={depth === 0 ? 700 : 600}>{node.name}</Typography>
        <Chip size='small' variant='tonal' label={node.roleId?.name || 'User'} />
        <Chip size='small' variant='outlined' label={ter} />
        {kpi?.coverage != null ? (
          <Chip size='small' color={kpi.coverage >= 70 ? 'success' : 'warning'} label={`Cov ${kpi.coverage}%`} />
        ) : (
          <Chip size='small' variant='outlined' label='Cov —' />
        )}
        <Button component={Link} href={`/dashboard/manager?repId=${encodeURIComponent(node._id)}`} size='small'>
          Field KPIs
        </Button>
        <Button component={Link} href={`/doctors/list?assignedRepId=${encodeURIComponent(node._id)}`} size='small'>
          Doctors
        </Button>
      </Stack>
      {node.children.map(ch => (
        <OrgNode key={ch._id} node={ch} depth={depth + 1} kpiByRep={kpiByRep} />
      ))}
    </Box>
  )
}

export default function OrgChartView() {
  const { hasPermission } = useAuth()
  const canSee = hasPermission('team.view')
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [month] = useState(ymNow)
  const [kpiByRep, setKpiByRep] = useState<Map<string, { coverage: number | null; territoryLabel: string }>>(
    () => new Map()
  )

  const load = useCallback(async () => {
    if (!canSee) return
    setLoading(true)
    try {
      const [teamRes, monthly] = await Promise.all([
        usersService.team({ includeSelf: true }),
        reportsService.mrepMonthlyOverview({ params: { month } }).catch(() => null)
      ])
      const body = teamRes.data?.data || teamRes.data
      const docs = (body as { docs?: TeamUser[] })?.docs || []
      setUsers(docs)
      const m = new Map<string, { coverage: number | null; territoryLabel: string }>()
      if (monthly) {
        const reps = (monthly.data as any)?.data?.reps ?? (monthly.data as any)?.reps ?? []
        if (Array.isArray(reps)) {
          for (const r of reps) {
            const id = String(r.repId || '')
            if (!id) continue
            m.set(id, {
              coverage: r.coverage?.coveragePercent ?? null,
              territoryLabel: ''
            })
          }
        }
      }
      setKpiByRep(m)
    } catch (e) {
      showApiError(e, 'Failed to load org tree')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [canSee, month])

  useEffect(() => {
    void load()
  }, [load])

  const forest = useMemo(() => buildForest(users), [users])

  if (!canSee) {
    return (
      <Typography color='text.secondary'>You don’t have access to this page.</Typography>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Org chart (reporting tree)'
        subheader='Built from your subtree on /users/team. Coverage % is from Field performance API for the current month.'
      />
      <CardContent>
        {loading ? (
          <Skeleton variant='rounded' height={200} />
        ) : forest.length === 0 ? (
          <Typography color='text.secondary'>No team members in your subtree yet.</Typography>
        ) : (
          forest.map(root => <OrgNode key={root._id} node={root} depth={0} kpiByRep={kpiByRep} />)
        )}
      </CardContent>
    </Card>
  )
}
