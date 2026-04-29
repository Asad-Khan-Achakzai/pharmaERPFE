'use client'

import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import { alpha, useTheme } from '@mui/material/styles'

type Props = {
  activeFilterCount: number
  onClick: (e: React.MouseEvent<HTMLElement>) => void
  ariaLabel?: string
}

/** Same badge + bordered filter control as Orders list. */
export function TableListFilterIconButton({
  activeFilterCount,
  onClick,
  ariaLabel = 'Open filters'
}: Props) {
  const theme = useTheme()
  return (
    <Badge
      color='primary'
      badgeContent={activeFilterCount || undefined}
      invisible={activeFilterCount === 0}
      overlap='circular'
      sx={{ '& .MuiBadge-badge': { fontWeight: 700 } }}
    >
      <IconButton
        color={activeFilterCount ? 'primary' : 'default'}
        onClick={onClick}
        aria-label={ariaLabel}
        size='medium'
        sx={{
          border: '1px solid',
          borderColor: activeFilterCount ? 'primary.main' : 'divider',
          borderRadius: 1,
          bgcolor: activeFilterCount ? alpha(theme.palette.primary.main, 0.1) : 'background.paper'
        }}
      >
        <i className='tabler-filter' />
      </IconButton>
    </Badge>
  )
}
