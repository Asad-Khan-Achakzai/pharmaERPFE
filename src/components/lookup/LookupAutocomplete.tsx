'use client'

import { useState, useEffect, useRef } from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import type { TextFieldProps } from '@mui/material/TextField'
import CustomAutocomplete from '@core/components/mui/Autocomplete'
import CustomTextField from '@core/components/mui/TextField'
import { showApiError } from '@/utils/apiErrors'

export type LookupAutocompleteBase = { _id: string }

export type LookupAutocompleteProps<T extends LookupAutocompleteBase> = {
  value: T | null
  onChange: (value: T | null) => void
  fetchOptions: (search: string) => Promise<T[]>
  label: string
  placeholder?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  fullWidth?: boolean
  fetchErrorMessage?: string
  getOptionLabel?: (option: T) => string
  getOptionKey?: (option: T) => string
  debounceMs?: number
  textFieldProps?: Partial<TextFieldProps>
}

const loadingPopupIcon = (
  <CircularProgress
    size={14}
    thickness={5}
    sx={{
      color: theme =>
        theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.22)',
      '& .MuiCircularProgress-circle': { stroke: 'currentColor' }
    }}
  />
)

export function LookupAutocomplete<T extends LookupAutocompleteBase>({
  value,
  onChange,
  fetchOptions,
  label,
  placeholder = 'Type to search',
  helperText,
  required,
  disabled,
  fullWidth = true,
  fetchErrorMessage = 'Failed to load options',
  getOptionLabel = (o: T) => (o as { name?: string }).name ?? '',
  getOptionKey = (o: T) => String(o?._id ?? ''),
  debounceMs = 350,
  textFieldProps
}: LookupAutocompleteProps<T>) {
  const [options, setOptions] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(() => (value ? getOptionLabel(value) : ''))
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fetchRef = useRef(fetchOptions)
  const labelRef = useRef(getOptionLabel)
  fetchRef.current = fetchOptions
  labelRef.current = getOptionLabel

  useEffect(() => {
    setInputValue(value ? labelRef.current(value) : '')
  }, [value])

  useEffect(() => {
    const delayMs = inputValue === '' ? 0 : debounceMs
    const t = window.setTimeout(() => setDebouncedSearch(inputValue.trim()), delayMs)
    return () => window.clearTimeout(t)
  }, [inputValue, debounceMs])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const rows = await fetchRef.current(debouncedSearch)
        if (!cancelled) setOptions(rows)
      } catch (err) {
        if (!cancelled) showApiError(err, fetchErrorMessage)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  return (
    <CustomAutocomplete<T, false, false, false>
      fullWidth={fullWidth}
      disabled={disabled}
      options={options}
      loading={loading}
      value={value}
      getOptionKey={getOptionKey}
      onChange={(_e, v) => {
        onChange(v)
        if (v) setInputValue(labelRef.current(v))
        else setInputValue('')
      }}
      inputValue={inputValue}
      onInputChange={(_e, newInput, reason) => {
        if (reason === 'reset') return
        setInputValue(newInput)
      }}
      filterOptions={opts => opts}
      getOptionLabel={o => (o ? getOptionLabel(o) : '')}
      isOptionEqualToValue={(a, b) => String(a?._id) === String(b?._id)}
      popupIcon={loading ? loadingPopupIcon : undefined}
      renderInput={params => (
        <CustomTextField
          {...params}
          {...textFieldProps}
          required={required}
          label={label}
          placeholder={placeholder}
          helperText={helperText !== undefined ? helperText : textFieldProps?.helperText}
          inputProps={{
            ...params.inputProps,
            ...((textFieldProps as { inputProps?: typeof params.inputProps })?.inputProps || {}),
            autoComplete: 'off',
            'data-lpignore': 'true',
            'data-1p-ignore': 'true',
            'data-bwignore': 'true'
          }}
          InputProps={{ ...params.InputProps, ...textFieldProps?.InputProps }}
        />
      )}
    />
  )
}
