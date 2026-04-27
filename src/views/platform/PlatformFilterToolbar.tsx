'use client'

import Autocomplete from '@mui/material/Autocomplete'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'

export type RevenueViewMode = 'total' | 'compare'

type Option = { id: string; label: string }

const PlatformFilterToolbar = ({
  days,
  onDaysChange,
  companyOptions,
  selectedIds,
  onSelectedIds,
  viewMode,
  onViewModeChange
}: {
  days: 7 | 30 | 90
  onDaysChange: (d: 7 | 30 | 90) => void
  companyOptions: Option[]
  selectedIds: string[]
  onSelectedIds: (ids: string[]) => void
  viewMode: RevenueViewMode
  onViewModeChange: (m: RevenueViewMode) => void
}) => {
  const value = companyOptions.filter(o => selectedIds.includes(o.id))

  return (
    <Grid
      container
      spacing={2}
      component='div'
      className='mbe-4 items-end'
      role='search'
      aria-label='Platform dashboard filters'
    >
      <Grid size={{ xs: 12, sm: 6, md: 'auto' }}>
        <Typography id='pl-days-label' variant='caption' color='text.secondary' display='block' className='mbe-1'>
          Date range
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={days}
          onChange={(_e, v) => v != null && onDaysChange(v as 7 | 30 | 90)}
          size='small'
          aria-labelledby='pl-days-label'
        >
          <ToggleButton value={7} aria-label='Last 7 days'>
            7d
          </ToggleButton>
          <ToggleButton value={30} aria-label='Last 30 days'>
            30d
          </ToggleButton>
          <ToggleButton value={90} aria-label='Last 90 days'>
            90d
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 'grow' }} className='min-is-0 min-bs-[60px]'>
        <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
          Companies
        </Typography>
        <Autocomplete
          multiple
          size='small'
          options={companyOptions}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={value}
          onChange={(_e, v) => onSelectedIds(v.length ? v.map(x => x.id) : companyOptions.map(o => o.id))}
          renderInput={params => <TextField {...params} label='' placeholder='All accessible' margin='none' />}
          limitTags={2}
          disabled={!companyOptions.length}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 'auto' }} className='min-is-0 flex flex-col items-stretch sm:items-end'>
        <Typography id='pl-view-label' variant='caption' color='text.secondary' display='block' className='mbe-1'>
          Revenue view
        </Typography>
        <ToggleButtonGroup
          exclusive
          value={viewMode}
          onChange={(_e, v) => v != null && onViewModeChange(v as RevenueViewMode)}
          size='small'
          aria-labelledby='pl-view-label'
          color='primary'
        >
          <ToggleButton value='total' aria-label='Show total revenue only'>
            Total
          </ToggleButton>
          <ToggleButton value='compare' aria-label='Compare companies with total line'>
            Compare
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>
    </Grid>
  )
}

export type { Option as PlatformFilterOption }
export default PlatformFilterToolbar
