'use client'

import { forwardRef, useEffect, useState, type ReactNode } from 'react'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { TextFieldProps } from '@mui/material/TextField'
import CustomTextField from '@core/components/mui/TextField'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { usersService } from '@/services/users.service'
import {
  emptyDateUserFilters,
  formatRangeDisplay,
  formatYyyyMmDd,
  parseYyyyMmDd,
  type DateUserFilterState
} from './dateRangeUtils'

export type AssignableUser = { _id: string; name: string; email?: string; role?: string }

type RangeInputProps = TextFieldProps & {
  label: string
  end: Date | number | null
  start: Date | number | null
}

const DateRangeReadonlyInput = forwardRef<HTMLInputElement, RangeInputProps>(
  function DateRangeReadonlyInput({ label, start, end, slotProps, ...rest }, ref) {
    const startD = start != null ? new Date(start) : null
    const endD = end != null ? new Date(end) : null
    const value =
      !startD || Number.isNaN(startD.getTime())
        ? ''
        : !endD || Number.isNaN(endD.getTime())
          ? `${formatRangeDisplay(startD)} – …`
          : `${formatRangeDisplay(startD)} – ${formatRangeDisplay(endD)}`
    return (
      <CustomTextField
        fullWidth
        size='small'
        inputRef={ref}
        {...rest}
        label={label}
        value={value}
        placeholder='Click to choose range'
        slotProps={{ ...slotProps, htmlInput: { readOnly: true, ...slotProps?.htmlInput } }}
      />
    )
  }
)

type PanelProps = {
  title: string
  description: string
  dateSectionLabel?: string
  createdByHelperText: string
  datePickerId: string
  /** Override visible month count. If omitted, uses 1 month below `sm` and 2 from `sm` up (avoids clipping on phones). */
  monthsShown?: number
  appliedFilters: DateUserFilterState
  onAppliedChange: (next: DateUserFilterState) => void
  filterAnchor: HTMLElement | null
  open: boolean
  onClose: () => void
  /** Runs after date/user filters are reset (e.g. reset extra list filters like order status). */
  onClearAllExtras?: () => void
  /** Rendered after the panel description and before the date range (e.g. pharmacy filter). */
  beforeDateSection?: ReactNode
}

export function DateAndCreatedByFilterPanel({
  title,
  description,
  dateSectionLabel = 'Date',
  createdByHelperText,
  datePickerId,
  monthsShown,
  appliedFilters,
  onAppliedChange,
  filterAnchor,
  open,
  onClose,
  onClearAllExtras,
  beforeDateSection
}: PanelProps) {
  const theme = useTheme()
  const isCompactCalendarViewport = useMediaQuery(theme.breakpoints.down('sm'))
  const resolvedMonthsShown = monthsShown ?? (isCompactCalendarViewport ? 1 : 2)
  const [draft, setDraft] = useState<DateUserFilterState>(appliedFilters)
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    if (!open) setCalendarOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    setDraft({ ...appliedFilters })
  }, [open, appliedFilters])

  useEffect(() => {
    if (!filterAnchor) return
    let cancelled = false
    setUsersLoading(true)
    usersService
      .assignable()
      .then(res => {
        const rows = (res.data as { data?: AssignableUser[] })?.data || []
        if (!cancelled) setAssignableUsers(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setAssignableUsers([])
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filterAnchor])

  const selectedUser = draft.createdBy ? assignableUsers.find(u => String(u._id) === draft.createdBy) ?? null : null

  const apply = () => {
    let { from, to, createdBy } = draft
    if (from && to && from > to) {
      ;[from, to] = [to, from]
    }
    onAppliedChange({ from, to, createdBy })
    onClose()
  }

  const clearAll = () => {
    setDraft(emptyDateUserFilters)
    onAppliedChange(emptyDateUserFilters)
    onClearAllExtras?.()
    onClose()
  }

  return (
    <Box sx={{ p: 2.5, pb: 2 }}>
      <Typography variant='subtitle1' sx={{ fontWeight: 700, letterSpacing: '-0.01em', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
        {description}
      </Typography>

      {beforeDateSection ? <Box sx={{ mb: 2 }}>{beforeDateSection}</Box> : null}

      <Typography
        variant='overline'
        sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', display: 'block', mb: 1 }}
      >
        {dateSectionLabel}
      </Typography>
      <Grid container spacing={0} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12 }}>
          <AppReactDatepicker
            selectsRange
            monthsShown={resolvedMonthsShown}
            endDate={parseYyyyMmDd(draft.to) ?? null}
            startDate={parseYyyyMmDd(draft.from) ?? null}
            selected={parseYyyyMmDd(draft.from) ?? null}
            open={calendarOpen}
            onInputClick={() => setCalendarOpen(true)}
            onClickOutside={() => setCalendarOpen(false)}
            onCalendarClose={() => setCalendarOpen(false)}
            shouldCloseOnSelect={false}
            id={datePickerId}
            onChange={dates => {
              if (!dates) {
                setDraft(d => ({ ...d, from: '', to: '' }))
                return
              }
              const [s, e] = dates
              setDraft(d => ({
                ...d,
                from: s ? formatYyyyMmDd(s) : '',
                to: e ? formatYyyyMmDd(e) : ''
              }))
              if (s && e) setCalendarOpen(false)
            }}
            customInput={
              <DateRangeReadonlyInput
                label='Multiple Months'
                end={parseYyyyMmDd(draft.to)}
                start={parseYyyyMmDd(draft.from)}
              />
            }
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      <Typography
        variant='overline'
        sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: '0.08em', display: 'block', mb: 1 }}
      >
        Created by
      </Typography>
      <CustomAutocomplete
        size='small'
        options={assignableUsers}
        loading={usersLoading}
        value={selectedUser}
        onChange={(_e, v) =>
          setDraft(d => ({
            ...d,
            createdBy: v ? String(v._id) : ''
          }))
        }
        getOptionLabel={o => o.name || o.email || String(o._id)}
        isOptionEqualToValue={(a, b) => String(a._id) === String(b._id)}
        renderInput={params => (
          <CustomTextField
            {...params}
            label='User'
            placeholder='Any user'
            inputProps={{
              ...params.inputProps,
              name: 'user-list-filter-created-by',
              autoComplete: 'off',
              'data-lpignore': 'true',
              'data-1p-ignore': 'true',
              'data-bwignore': 'true'
            }}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <>
                  <InputAdornment position='start'>
                    <i className='tabler-user' style={{ opacity: 0.65, fontSize: '1.15rem' }} />
                  </InputAdornment>
                  {params.InputProps.startAdornment}
                </>
              )
            }}
          />
        )}
      />
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1, lineHeight: 1.5 }}>
        {createdByHelperText}
      </Typography>

      <Stack direction='row' spacing={1.5} justifyContent='flex-end' sx={{ mt: 3 }}>
        <Button color='inherit' onClick={clearAll} sx={{ color: 'text.secondary' }}>
          Clear all
        </Button>
        <Button variant='outlined' onClick={onClose}>
          Cancel
        </Button>
        <Button variant='contained' onClick={apply}>
          Apply
        </Button>
      </Stack>
    </Box>
  )
}

export function useDebouncedSearch(delayMs = 350) {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), delayMs)
    return () => window.clearTimeout(t)
  }, [searchInput, delayMs])

  const clearSearch = () => {
    setSearchInput('')
    setDebouncedSearch('')
  }

  return { searchInput, setSearchInput, debouncedSearch, clearSearch }
}
