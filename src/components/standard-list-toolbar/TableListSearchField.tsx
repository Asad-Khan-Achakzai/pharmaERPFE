'use client'

import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import CustomTextField from '@core/components/mui/TextField'

export type TableListSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
}

/** Matches Order list toolbar — same layout and sizing as Orders. */
export function TableListSearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search…'
}: TableListSearchFieldProps) {
  return (
    <CustomTextField
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{ minWidth: { xs: '100%', sm: 260 }, flex: { sm: '1 1 260px' } }}
      size='small'
      slotProps={{
        input: {
          endAdornment: value ? (
            <InputAdornment position='end' sx={{ mr: 0.5 }}>
              <IconButton size='small' aria-label='Clear search' edge='end' onClick={onClear}>
                <i className='tabler-x text-lg text-textSecondary' />
              </IconButton>
            </InputAdornment>
          ) : null
        }
      }}
    />
  )
}
