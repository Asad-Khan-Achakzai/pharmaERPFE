'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import CircularProgress from '@mui/material/CircularProgress'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { formatYyyyMmDd } from '@/utils/dateLocal'
import { usersService } from '@/services/users.service'
import {
  managerFieldDaysService,
  type ManagerFieldDay,
  type ManagerFieldDayRep
} from '@/services/managerFieldDays.service'
import type { AssignableUser } from '@/services/planItems.service'

type DayRow = {
  ymd: string
  label: string
  record: ManagerFieldDay | null
  selected: ManagerFieldDayRep[]
  notes: string
  saving: boolean
}

const toRep = (raw: ManagerFieldDayRep | string): ManagerFieldDayRep =>
  typeof raw === 'object' ? { _id: String(raw._id), name: raw.name } : { _id: String(raw) }

const weekDays = (anchor: Date) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    return { date: d, ymd: formatYyyyMmDd(d), label: format(d, 'EEEE d MMM') }
  })
}

export default function ManagerFieldDaysPage() {
  const { user, hasPermission } = useAuth()
  const canEdit = hasPermission('managerFieldDays.edit')
  const selfId = user?._id ? String(user._id) : ''
  const [anchor, setAnchor] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<AssignableUser[]>([])
  const [rows, setRows] = useState<DayRow[]>([])

  const days = useMemo(() => weekDays(anchor), [anchor])
  const from = days[0]?.ymd
  const to = days[6]?.ymd

  const load = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const [listRes, assignRes] = await Promise.all([
        managerFieldDaysService.list({ from, to }),
        usersService.assignable({ scope: 'team', limit: 100 })
      ])
      const docs = ((listRes.data?.data || []) as ManagerFieldDay[]).filter(Boolean)
      const byYmd = new Map(docs.map(d => [d.dateYmd, d]))
      const team = ((assignRes.data?.data || []) as AssignableUser[]).filter(u => String(u._id) !== selfId)
      setOptions(team)
      setRows(
        days.map(day => {
          const rec = byYmd.get(day.ymd) || null
          return {
            ymd: day.ymd,
            label: day.label,
            record: rec,
            selected: rec ? (rec.medicalRepIds || []).map(toRep) : [],
            notes: rec?.notes || '',
            saving: false
          }
        })
      )
    } catch (e) {
      showApiError(e, 'Failed to load field days')
    } finally {
      setLoading(false)
    }
  }, [from, to, days, selfId])

  useEffect(() => {
    void load()
  }, [load])

  const patchRow = (ymd: string, patch: Partial<DayRow>) => {
    setRows(prev => prev.map(r => (r.ymd === ymd ? { ...r, ...patch } : r)))
  }

  const saveDay = async (ymd: string, selected: ManagerFieldDayRep[], notes: string) => {
    patchRow(ymd, { saving: true, selected, notes })
    try {
      const res = await managerFieldDaysService.upsertMe({
        date: ymd,
        medicalRepIds: selected.map(r => r._id),
        notes
      })
      const saved = (res.data?.data || null) as ManagerFieldDay | null
      patchRow(ymd, {
        saving: false,
        record: saved,
        selected: saved ? (saved.medicalRepIds || []).map(toRep) : selected,
        notes: saved?.notes ?? notes
      })
      showSuccess(selected.length ? 'Field day saved' : 'Field day cleared')
    } catch (e) {
      patchRow(ymd, { saving: false })
      showApiError(e, 'Could not save field day')
    }
  }

  return (
    <Card>
      <CardHeader
        title='Field day with reps'
        subheader='This is the same MR ↔ manager day as Partner on each rep’s weekly plan. Reps who chose you as Partner appear selected here.'
        action={
          <Stack direction='row' spacing={1}>
            <Button variant='tonal' onClick={() => setAnchor(d => addDays(d, -7))}>
              Previous week
            </Button>
            <Button variant='tonal' onClick={() => setAnchor(new Date())}>
              This week
            </Button>
            <Button variant='tonal' onClick={() => setAnchor(d => addDays(d, 7))}>
              Next week
            </Button>
          </Stack>
        }
      />
      <CardContent>
        <Alert severity='info' className='mbe-4'>
          Selecting a rep here sets you as their whole-day Partner (and the reverse). If they
          already have a different Partner, the save is rejected so that Partner is not overwritten.
        </Alert>
        {loading ? (
          <Stack alignItems='center' className='py-8'>
            <CircularProgress />
          </Stack>
        ) : (
          <Stack spacing={3}>
            {rows.map(row => (
              <Paper key={row.ymd} variant='outlined' className='p-4'>
                <Typography variant='subtitle1' fontWeight={600} className='mbe-2'>
                  {row.label}
                </Typography>
                <CustomAutocomplete
                  multiple
                  disabled={!canEdit || row.saving}
                  options={[
                    ...row.selected.filter(s => !options.some(o => String(o._id) === String(s._id))),
                    ...options
                  ]}
                  value={row.selected as AssignableUser[]}
                  isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
                  getOptionLabel={o => o.name || String(o._id)}
                  onChange={(_e, next) => {
                    const selected = (next || []).map(u => ({ _id: String(u._id), name: u.name }))
                    void saveDay(row.ymd, selected, row.notes)
                  }}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index })
                      return <Chip key={key} label={option.name || option._id} size='small' {...tagProps} />
                    })
                  }
                  renderInput={params => (
                    <CustomTextField
                      {...params}
                      label='Reps for this day'
                      placeholder='Search your team…'
                    />
                  )}
                />
                <CustomTextField
                  className='mbs-3'
                  fullWidth
                  multiline
                  minRows={1}
                  disabled={!canEdit || row.saving}
                  label='Notes (optional)'
                  value={row.notes}
                  onChange={e => patchRow(row.ymd, { notes: e.target.value })}
                  onBlur={() => {
                    const ids = row.selected.map(r => r._id).join(',')
                    const savedIds = (row.record?.medicalRepIds || []).map(toRep).map(r => r._id).join(',')
                    if (row.notes !== (row.record?.notes || '') || ids !== savedIds) {
                      void saveDay(row.ymd, row.selected, row.notes)
                    }
                  }}
                />
                {row.saving ? (
                  <Typography variant='caption' color='text.secondary' className='mbs-1'>
                    Saving…
                  </Typography>
                ) : null}
              </Paper>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
