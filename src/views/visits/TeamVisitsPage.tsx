'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Autocomplete from '@mui/material/Autocomplete'
import Paper from '@mui/material/Paper'
import { showApiError } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import CustomTextField from '@core/components/mui/TextField'
import { planItemsService } from '@/services/planItems.service'
import { usersService } from '@/services/users.service'
import { coVisitChipLabel, isCoVisitItem, planItemMatchesVisitTab } from '@/utils/coVisitDisplay'
import { parseTodayExecutionResponse } from '@/utils/planExecutionPayload'

type FilterKey = 'pending' | 'visited' | 'missed'

type AssignableUser = { _id: string; name: string }

const statusChip = (status: string): 'default' | 'success' | 'error' | 'warning' => {
  if (status === 'VISITED' || status === 'COMPLETED') return 'success'
  if (status === 'MISSED') return 'error'
  return 'default'
}

function employeeName(it: { employeeId?: { name?: string } | string }): string | null {
  const emp = it.employeeId
  if (emp && typeof emp === 'object' && emp.name?.trim()) return emp.name.trim()
  return null
}

const TeamVisitsPage = () => {
  const { hasPermission } = useAuth()
  const canViewTeam =
    hasPermission('team.view') || hasPermission('team.viewAllReports') || hasPermission('admin.access')
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<FilterKey>('pending')
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState<{ total: number; pending: number; visited: number; missed: number } | null>(
    null
  )
  const [repOptions, setRepOptions] = useState<AssignableUser[]>([])
  const [selectedRep, setSelectedRep] = useState<AssignableUser | null>(null)

  const useTeamRollup = canViewTeam && !selectedRep

  const load = useCallback(async () => {
    if (!canViewTeam) return
    setLoading(true)
    try {
      const params: { date: string; employeeId?: string } = { date }
      if (selectedRep?._id) params.employeeId = selectedRep._id
      const res = useTeamRollup
        ? await planItemsService.listTeamVisits(params)
        : await planItemsService.listToday(params)
      const parsed = parseTodayExecutionResponse(res as { data: { data?: unknown } })
      setItems(parsed?.items ?? [])
      setSummary(
        parsed?.summary
          ? {
              total: parsed.summary.total,
              pending: parsed.summary.pending,
              visited: parsed.summary.visited,
              missed: parsed.summary.missed
            }
          : null
      )
    } catch (e) {
      showApiError(e, 'Failed to load team visits')
      setItems([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [canViewTeam, date, selectedRep, useTeamRollup])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!canViewTeam) return
    void usersService
      .assignable({ scope: 'team', limit: 200 })
      .then(r => {
        const rows = ((r.data as { data?: AssignableUser[] })?.data || []) as AssignableUser[]
        setRepOptions(rows)
      })
      .catch(() => setRepOptions([]))
  }, [canViewTeam])

  const filtered = useMemo(() => items.filter(it => planItemMatchesVisitTab(it, tab)), [items, tab])

  const counts = useMemo(
    () => ({
      pending: items.filter(it => planItemMatchesVisitTab(it, 'pending')).length,
      visited: items.filter(it => planItemMatchesVisitTab(it, 'visited')).length,
      missed: items.filter(it => planItemMatchesVisitTab(it, 'missed')).length
    }),
    [items]
  )

  if (!canViewTeam) {
    return (
      <Grid container spacing={6}>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography color='text.secondary'>
                You need team view permission to see team visits. Use{' '}
                <Link href='/visits/today'>Today&apos;s visits</Link> for your own route.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={
              <div className='flex items-center gap-2'>
                <IconButton component={Link} href='/home' size='small' aria-label='Back'>
                  <i className='tabler-arrow-left' />
                </IconButton>
                <Typography component='span' variant='h5'>
                  Team visits
                </Typography>
              </div>
            }
            subheader={
              useTeamRollup
                ? 'All active, planned, completed, and missed visits for your reporting team'
                : `Visits for ${selectedRep?.name ?? 'selected rep'}`
            }
          />
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} className='mbe-4'>
              <CustomTextField
                type='date'
                label='Business date'
                value={date}
                onChange={e => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                size='small'
                sx={{ minWidth: 200 }}
              />
              <Autocomplete
                size='small'
                sx={{ minWidth: 280, flex: 1 }}
                options={repOptions}
                value={selectedRep}
                onChange={(_e, v) => setSelectedRep(v)}
                getOptionLabel={o => o.name || o._id}
                isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
                renderInput={params => (
                  <CustomTextField {...params} label='Team member' placeholder='All team (summary)' />
                )}
              />
            </Stack>

            {summary ? (
              <Typography variant='caption' color='text.secondary' display='block' className='mbe-3'>
                Planned {summary.total} · Done {summary.visited} · Missed {summary.missed} · Remaining{' '}
                {summary.pending}
              </Typography>
            ) : null}

            <ToggleButtonGroup
              exclusive
              value={tab}
              onChange={(_e, v) => v && setTab(v as FilterKey)}
              size='small'
              className='mbe-4'
            >
              <ToggleButton value='pending'>Planned ({counts.pending})</ToggleButton>
              <ToggleButton value='visited'>Done ({counts.visited})</ToggleButton>
              <ToggleButton value='missed'>Missed ({counts.missed})</ToggleButton>
            </ToggleButtonGroup>

            {loading ? (
              <div className='flex justify-center p-8'>
                <CircularProgress />
              </div>
            ) : filtered.length === 0 ? (
              <Typography color='text.secondary' className='p-6 text-center'>
                No visits in this tab for the selected day.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {filtered.map((it: any) => {
                  const isParticipant = it.coVisitRole === 'PARTICIPANT' || it.isCoVisitParticipantView
                  const rep = employeeName(it)
                  const doctorLabel =
                    it.type === 'DOCTOR_VISIT'
                      ? it.doctorId?.name || 'Doctor'
                      : it.title || 'Activity'
                  const statusLabel = isParticipant ? it.myLifecycleStatus || 'PARTICIPANT' : it.status
                  return (
                    <Paper key={it._id} variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
                      <Stack direction='row' justifyContent='space-between' alignItems='flex-start' flexWrap='wrap' gap={1}>
                        <Box>
                          {useTeamRollup && rep ? (
                            <Typography variant='caption' color='text.secondary' display='block'>
                              {rep}
                            </Typography>
                          ) : null}
                          <Typography variant='subtitle1' fontWeight={700}>
                            {doctorLabel}
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {it.plannedTime || it.doctorId?.specialization || '—'}
                            {it.sequenceOrder ? ` · #${it.sequenceOrder}` : ''}
                          </Typography>
                        </Box>
                        <Stack direction='row' spacing={1} flexWrap='wrap'>
                          {!isParticipant && isCoVisitItem(it) ? (
                            <Chip size='small' color='info' variant='tonal' label={coVisitChipLabel(it)} />
                          ) : null}
                          <Chip
                            size='small'
                            label={statusLabel}
                            color={statusChip(statusLabel)}
                            variant='tonal'
                          />
                        </Stack>
                      </Stack>
                      {it.notes ? (
                        <Typography variant='body2' color='text.secondary' className='mts-2'>
                          {it.notes}
                        </Typography>
                      ) : null}
                    </Paper>
                  )
                })}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default TeamVisitsPage
