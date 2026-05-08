'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'

export type RankRow = {
  repId: string
  name?: string | null
  employeeCode?: string | null
  coveragePercent?: number | null
  visitCompletionPercent?: number | null
  adherencePercent?: number | null
  unplannedRatio?: number | null
  grossRevenue?: number | null
  rank?: number
}

type SortKey = 'coverage' | 'revenue' | 'discipline'

type Props = {
  month: string
  rankings: RankRow[]
  loading?: boolean
}

function sortRows(rows: RankRow[], key: SortKey): RankRow[] {
  const copy = [...rows]
  const score = (r: RankRow) => {
    if (key === 'coverage') return r.coveragePercent ?? -1
    if (key === 'revenue') return r.grossRevenue ?? -1
    return r.adherencePercent ?? r.visitCompletionPercent ?? -1
  }
  copy.sort((a, b) => score(b) - score(a))
  return copy.map((r, i) => ({ ...r, rank: i + 1 }))
}

export function MrepRankingWidget({ month, rankings, loading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('coverage')
  const sorted = useMemo(() => sortRows(rankings, sortKey), [rankings, sortKey])
  const top = sorted.slice(0, 5)
  const bottom = [...sorted].reverse().slice(0, 5)

  const fmtMoney = (n: number | null | undefined) =>
    n == null || Number.isNaN(Number(n))
      ? '—'
      : `₨ ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`

  return (
    <Card variant='outlined'>
      <CardHeader
        title='Rankings'
        subheader={`${month} · Top & bottom 5 (re-sorted in UI)`}
        action={
          <TextField select size='small' label='Sort' value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)} sx={{ minWidth: 140 }}>
            <MenuItem value='coverage'>Coverage</MenuItem>
            <MenuItem value='revenue'>Revenue</MenuItem>
            <MenuItem value='discipline'>Discipline</MenuItem>
          </TextField>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {loading ? (
          <Typography color='text.secondary'>Loading…</Typography>
        ) : rankings.length === 0 ? (
          <Typography color='text.secondary'>No ranking data for this scope.</Typography>
        ) : (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Card variant='outlined' sx={{ flex: 1 }}>
              <CardHeader titleTypographyProps={{ variant: 'subtitle1' }} title='Top 5' />
              <List dense>
                {top.map(r => (
                  <ListItem key={r.repId} disablePadding>
                    <ListItemButton component={Link} href={`/dashboard/manager?repId=${encodeURIComponent(r.repId)}`}>
                      <ListItemText
                        primary={
                          <Stack direction='row' spacing={1} alignItems='center'>
                            <Chip size='small' label={`#${r.rank}`} />
                            <Typography variant='body2' fontWeight={600}>
                              {r.name || '—'}
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <>
                            Cov {r.coveragePercent ?? '—'}% · Rev {fmtMoney(r.grossRevenue)} · Adh{' '}
                            {r.adherencePercent ?? '—'}%
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Card>
            <Card variant='outlined' sx={{ flex: 1 }}>
              <CardHeader titleTypographyProps={{ variant: 'subtitle1' }} title='Bottom 5' />
              <List dense>
                {bottom.map(r => (
                  <ListItem key={`b-${r.repId}`} disablePadding>
                    <ListItemButton component={Link} href={`/dashboard/manager?repId=${encodeURIComponent(r.repId)}`}>
                      <ListItemText
                        primary={
                          <Stack direction='row' spacing={1} alignItems='center'>
                            <Chip size='small' label={`#${r.rank}`} color='warning' variant='outlined' />
                            <Typography variant='body2' fontWeight={600}>
                              {r.name || '—'}
                            </Typography>
                          </Stack>
                        }
                        secondary={
                          <>
                            Cov {r.coveragePercent ?? '—'}% · Rev {fmtMoney(r.grossRevenue)} · Adh{' '}
                            {r.adherencePercent ?? '—'}%
                          </>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Card>
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
