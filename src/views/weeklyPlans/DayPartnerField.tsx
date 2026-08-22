'use client'

import { useEffect, useRef, useState } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import CustomTextField from '@core/components/mui/TextField'
import { usersService } from '@/services/users.service'
import type { AssignableUser } from '@/services/planItems.service'
import type { DayPartnerRef } from './planCpDays'

type Props = {
  value: DayPartnerRef | null
  /** null → clear the day partner. */
  onChange: (next: DayPartnerRef | null) => void
  ownerUserId?: string
  disabled?: boolean
  label?: string
}

/**
 * Single-select day-level accompanying partner. The chosen colleague is
 * inherited by every pending visit of that day unless a visit's partners were
 * overridden individually.
 */
export default function DayPartnerField({ value, onChange, ownerUserId, disabled, label }: Props) {
  const [options, setOptions] = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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

  const selected: AssignableUser | null = value
    ? ({ _id: String(value._id), name: value.name || 'Selected partner' } as AssignableUser)
    : null

  return (
    <CustomAutocomplete
      size='small'
      sx={{ minWidth: 220 }}
      options={options}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_e, v) => setInputValue(v)}
      onOpen={() => {
        listOpenRef.current = true
      }}
      onClose={() => {
        listOpenRef.current = false
      }}
      isOptionEqualToValue={(o, v) => String(o._id) === String(v._id)}
      getOptionLabel={o => o.name || o.email || String(o._id)}
      loading={loading}
      disabled={disabled}
      onChange={(_e, opt) =>
        onChange(opt ? { _id: String(opt._id), name: opt.name || undefined } : null)
      }
      renderInput={params => (
        <CustomTextField
          {...params}
          label={label ?? 'Day partner'}
          placeholder='Whole-day partner…'
          helperText='Choosing a manager also lists you on their Field Day for this date.'
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            )
          }}
        />
      )}
    />
  )
}
