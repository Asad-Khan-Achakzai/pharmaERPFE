'use client'

import { forwardRef, useEffect, useState, type Ref } from 'react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { SxProps, Theme } from '@mui/material/styles'
import type { TextFieldProps } from '@mui/material/TextField'
import CustomTextField from '@core/components/mui/TextField'
import AppReactDatepicker from '@/libs/styles/AppReactDatepicker'
import { formatRangeDisplay, formatYyyyMmDd, parseYyyyMmDd } from './dateRangeUtils'

type RangeInputProps = TextFieldProps & {
  label: string
  end: Date | number | null
  start: Date | number | null
}

export const DateRangeReadonlyInput = forwardRef<HTMLInputElement, RangeInputProps>(
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

export type DateRangePickerFieldProps = {
  id: string
  label?: string
  from: string
  to: string
  onChange: (next: { from: string; to: string }) => void
  monthsShown?: number
  sx?: SxProps<Theme>
  inputRef?: Ref<HTMLInputElement>
}

/** Inline range calendar + readonly text field (same UX as list filter panels). */
export function DateRangePickerField({
  id,
  label = 'Date range',
  from,
  to,
  onChange,
  monthsShown,
  sx
}: DateRangePickerFieldProps) {
  const theme = useTheme()
  const isCompactCalendarViewport = useMediaQuery(theme.breakpoints.down('sm'))
  const resolvedMonthsShown = monthsShown ?? (isCompactCalendarViewport ? 1 : 2)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(from)
  const [draftTo, setDraftTo] = useState(to)

  useEffect(() => {
    setDraftFrom(from)
    setDraftTo(to)
  }, [from, to])

  return (
    <AppReactDatepicker
      selectsRange
      monthsShown={resolvedMonthsShown}
      endDate={parseYyyyMmDd(draftTo) ?? null}
      startDate={parseYyyyMmDd(draftFrom) ?? null}
      selected={parseYyyyMmDd(draftFrom) ?? null}
      open={calendarOpen}
      onInputClick={() => setCalendarOpen(true)}
      onClickOutside={() => setCalendarOpen(false)}
      onCalendarClose={() => setCalendarOpen(false)}
      shouldCloseOnSelect={false}
      id={id}
      // Escapes scrollable Dialog/Popover overflow without forcing overflow:visible on the host.
      popperProps={{ strategy: 'fixed' }}
      onChange={dates => {
        if (!dates) {
          setDraftFrom('')
          setDraftTo('')
          onChange({ from: '', to: '' })
          return
        }
        const [s, e] = dates
        const nextFrom = s ? formatYyyyMmDd(s) : ''
        const nextTo = e ? formatYyyyMmDd(e) : ''
        setDraftFrom(nextFrom)
        setDraftTo(nextTo)
        onChange({ from: nextFrom, to: nextTo })
        if (s && e) setCalendarOpen(false)
      }}
      customInput={
        <DateRangeReadonlyInput
          label={label}
          end={parseYyyyMmDd(draftTo)}
          start={parseYyyyMmDd(draftFrom)}
          sx={sx}
        />
      }
    />
  )
}
