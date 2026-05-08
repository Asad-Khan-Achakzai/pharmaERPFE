'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { territoriesService, type TerritoryNode } from '@/services/territories.service'
import { reportsService } from '@/services/reports.service'
import { showApiError } from '@/utils/apiErrors'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function TerritoryTreeLines({ nodes, depth = 0 }: { nodes: TerritoryNode[]; depth?: number }) {
  return (
    <Stack component='ul' sx={{ pl: depth * 2, m: 0, listStyle: 'none' }}>
      {nodes.map(n => (
        <li key={n._id}>
          <Typography variant='body2'>
            <strong>{n.name}</strong> · {n.kind}
            {n.code ? ` (${n.code})` : ''}
          </Typography>
          {n.children?.length ? <TerritoryTreeLines nodes={n.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </Stack>
  )
}

function collectByKind(nodes: TerritoryNode[], kind: string, acc: TerritoryNode[] = []) {
  for (const n of nodes) {
    if (n.kind === kind) acc.push(n)
    if (n.children?.length) collectByKind(n.children, kind, acc)
  }
  return acc
}

export default function TerritoryAnalyticsPage() {
  const { hasPermission } = useAuth()
  const canSee = hasPermission('territories.view')
  const [month, setMonth] = useState(ymNow)
  const [tree, setTree] = useState<TerritoryNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [parentId, setParentId] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareRows, setCompareRows] = useState<
    Array<{
      territoryId: string
      name: string
      code?: string | null
      kind: string
      coveragePercent: number | null
      doctorsTracked: number | null
    }>
  >([])

  const zones = useMemo(() => collectByKind(tree, 'ZONE'), [tree])

  useEffect(() => {
    if (!canSee) return
    let cancel = false
    ;(async () => {
      setTreeLoading(true)
      try {
        const res = await territoriesService.tree()
        const roots = (res.data as any)?.data?.roots ?? (res.data as any)?.roots ?? []
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
    if (zones.length && !parentId) {
      setParentId(zones[0]._id)
    }
  }, [zones, parentId])

  const loadCompare = useCallback(async () => {
    if (!parentId || !canSee) return
    setCompareLoading(true)
    try {
      const res = await reportsService.mrepTerritoryCompare({ month, parentTerritoryId: parentId })
      const data = (res.data as any)?.data ?? res.data
      const children = data?.children ?? []
      setCompareRows(Array.isArray(children) ? children : [])
    } catch (e) {
      showApiError(e, 'Territory compare failed')
      setCompareRows([])
    } finally {
      setCompareLoading(false)
    }
  }, [month, parentId, canSee])

  useEffect(() => {
    void loadCompare()
  }, [loadCompare])

  if (!canSee) {
    return <Typography color='text.secondary'>You don’t have access to territory analytics.</Typography>
  }

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4'>Territory intelligence</Typography>
        <Typography variant='body2' color='text.secondary'>
          Geographic tree and brick/area comparison from existing reports (no new metrics).
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 5 }}>
        <Card variant='outlined'>
          <CardHeader title='Territory structure' />
          <CardContent>
            {treeLoading ? <Skeleton height={180} /> : <TerritoryTreeLines nodes={tree} />}
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 7 }}>
        <Card variant='outlined'>
          <CardHeader
            title='Compare children'
            subheader='Uses /reports/mrep/territory-compare — KPIs match API payload.'
            action={
              <TextField
                select
                size='small'
                label='Parent (usually Zone)'
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                sx={{ minWidth: 220 }}
              >
                {zones.map(z => (
                  <MenuItem key={z._id} value={z._id}>
                    {z.name} ({z.kind})
                  </MenuItem>
                ))}
              </TextField>
            }
          />
          <CardContent>
            <Stack direction='row' spacing={2} sx={{ mb: 2 }}>
              <TextField
                label='Month'
                type='month'
                size='small'
                value={month}
                onChange={e => setMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button variant='outlined' onClick={() => void loadCompare()} disabled={compareLoading}>
                Refresh
              </Button>
              <Button component={Link} href='/territories' variant='text'>
                Edit territories
              </Button>
            </Stack>
            {compareLoading ? (
              <Skeleton height={120} />
            ) : compareRows.length === 0 ? (
              <Typography color='text.secondary'>No child territories or no data.</Typography>
            ) : (
              <Stack spacing={1.5}>
                {compareRows.map(row => (
                  <Paper key={row.territoryId} variant='outlined' sx={{ p: 2 }}>
                    <Stack direction='row' justifyContent='space-between' alignItems='center' flexWrap='wrap' useFlexGap>
                      <div>
                        <Typography fontWeight={700}>
                          {row.name} · {row.kind}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Doctors tracked: {row.doctorsTracked ?? '—'}
                        </Typography>
                      </div>
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Typography variant='h6'>{row.coveragePercent ?? '—'}%</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          coverage
                        </Typography>
                        <Button
                          size='small'
                          component={Link}
                          href='/dashboard/mrep'
                        >
                          Command center
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}
