'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import CustomTextField from '@core/components/mui/TextField'
import { usersService } from '@/services/users.service'
import { planItemsService, type AssignableUser, type CoVisitAvailabilityRow } from '@/services/planItems.service'

export type CoVisitParticipantOption = AssignableUser

const tierColor = (tier?: string) => {
  if (tier === 'CONFLICT') return 'error'
  if (tier === 'WARNING') return 'warning'
  return 'success'
}

type Props = {
  value: CoVisitParticipantOption[]
  onChange: (next: CoVisitParticipantOption[]) => void
  date: string
  doctorId?: string
  /** Shown in the field label — e.g. "Dr. Ahmed" */
  doctorName?: string
  plannedTime?: string
  disabled?: boolean
  ownerUserId?: string
  excludePlanItemId?: string
}

export default function CoVisitParticipantsField({
  value,
  onChange,
  date,
  doctorId,
  doctorName,
  plannedTime,
  disabled,
  ownerUserId,
  excludePlanItemId
}: Props) {
  const fieldLabel = doctorName
    ? `Co-Visit · ${doctorName}`
    : 'Co-Visit participants'
  const [options, setOptions] = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [availability, setAvailability] = useState<Record<string, CoVisitAvailabilityRow>>({})
  const [availLoading, setAvailLoading] = useState(false)
  const [pendingConflict, setPendingConflict] = useState<AssignableUser | null>(null)
  const listOpenRef = useRef(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(inputValue.trim()), inputValue ? 350 : 0)
    return () => window.clearTimeout(t)
  }, [inputValue])

  useEffect(() => {
    if (!listOpenRef.current && !debouncedSearch) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await usersService.assignable({
          limit: 100,
          ...(ownerUserId ? { forCoVisitOwnerId: ownerUserId } : {}),
          ...(debouncedSearch ? { search: debouncedSearch } : {})
        })
        const rows = (res.data.data || []) as AssignableUser[]
        if (!cancelled) {
          setOptions(rows.filter(u => !ownerUserId || String(u._id) !== String(ownerUserId)))
        }
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, ownerUserId])

  const candidateKey = useMemo(
    () => [...options.map(o => o._id), ...value.map(v => v._id)].sort().join(','),
    [options, value]
  )

  useEffect(() => {
    if (!date || !doctorId) {
      setAvailability({})
      return
    }
    const ids = [...new Set([...options, ...value].map(u => String(u._id)))].filter(Boolean)
    if (!ids.length) return
    let cancelled = false
    ;(async () => {
      setAvailLoading(true)
      try {
        const rows = await planItemsService.checkCoVisitAvailability({
          date,
          doctorId,
          plannedTime,
          candidateUserIds: ids.join(','),
          ...(excludePlanItemId ? { excludePlanItemId } : {})
        })
        if (cancelled) return
        const map: Record<string, CoVisitAvailabilityRow> = {}
        for (const row of rows) map[row.userId] = row
        setAvailability(map)
      } catch {
        if (!cancelled) setAvailability({})
      } finally {
        if (!cancelled) setAvailLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [date, doctorId, plannedTime, candidateKey, excludePlanItemId])

  const addUser = useCallback(
    (user: AssignableUser) => {
      const tier = availability[String(user._id)]?.availabilityTier
      if (tier === 'CONFLICT') {
        setPendingConflict(user)
        return
      }
      const id = String(user._id)
      if (value.some(v => String(v._id) === id)) return
      onChange([...value, user])
    },
    [availability, onChange, value]
  )

  const confirmConflictAdd = () => {
    if (!pendingConflict) return
    const id = String(pendingConflict._id)
    if (!value.some(v => String(v._id) === id)) {
      onChange([...value, pendingConflict])
    }
    setPendingConflict(null)
  }

  return (
    <Box>
      <CustomAutocomplete
        multiple={false}
        options={options}
        value={null}
        inputValue={inputValue}
        onInputChange={(_e, v) => setInputValue(v)}
        onOpen={() => {
          listOpenRef.current = true
        }}
        onClose={() => {
          listOpenRef.current = false
        }}
        getOptionLabel={o => o.name || o.email || String(o._id)}
        loading={loading}
        disabled={disabled || !date || !doctorId}
        onChange={(_e, opt) => {
          if (opt) addUser(opt)
          setInputValue('')
        }}
        renderOption={(props, option) => {
          const row = availability[String(option._id)]
          return (
            <li {...props} key={option._id}>
              <Box className='flex items-center justify-between w-full gap-2'>
                <span>{option.name}</span>
                {row ? (
                  <Chip size='small' color={tierColor(row.availabilityTier) as 'success' | 'warning' | 'error'} label={row.availabilityTier} />
                ) : null}
              </Box>
            </li>
          )
        }}
        renderInput={params => (
          <CustomTextField
            {...params}
            label={fieldLabel}
            placeholder={doctorId ? 'Search team member…' : 'Select a doctor first'}
            helperText={
              availLoading
                ? 'Checking availability…'
                : 'Optional — partners join only this doctor visit, not your whole day'
            }
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {availLoading ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              )
            }}
          />
        )}
      />
      {value.length > 0 ? (
        <Box className='flex flex-wrap gap-1 mbs-2'>
          {value.map(p => {
            const row = availability[String(p._id)]
            return (
              <Chip
                key={p._id}
                label={p.name}
                color={row ? (tierColor(row.availabilityTier) as 'success' | 'warning' | 'error') : 'default'}
                onDelete={disabled ? undefined : () => onChange(value.filter(v => String(v._id) !== String(p._id)))}
              />
            )
          })}
        </Box>
      ) : null}

      <Dialog open={Boolean(pendingConflict)} onClose={() => setPendingConflict(null)}>
        <DialogTitle>Scheduling conflict</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            {pendingConflict?.name} has a conflict for this visit ({availability[String(pendingConflict?._id || '')]?.summary}).
            Add anyway?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingConflict(null)}>Cancel</Button>
          <Button variant='contained' onClick={confirmConflictAdd}>
            Add anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
