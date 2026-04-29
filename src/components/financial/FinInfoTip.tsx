'use client'

import Tooltip from '@mui/material/Tooltip'

export function FinInfoTip({ title }: { title: string }) {
  return (
    <Tooltip title={title} arrow leaveTouchDelay={5000}>
      <span className='inline-flex align-middle cursor-help opacity-70' aria-label='More info'>
        <i className='tabler-info-circle size-3.5' />
      </span>
    </Tooltip>
  )
}
