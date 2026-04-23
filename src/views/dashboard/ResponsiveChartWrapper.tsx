import type { ReactNode } from 'react'
import Box from '@mui/material/Box'

type ResponsiveChartWrapperProps = {
  children: ReactNode
  minHeight?: number
}

const ResponsiveChartWrapper = ({ children, minHeight = 320 }: ResponsiveChartWrapperProps) => {
  return (
    <Box
      sx={{
        minHeight,
        width: '100%',
        overflowX: 'auto',
        '& .apexcharts-canvas': {
          marginInline: 'auto'
        }
      }}
    >
      {children}
    </Box>
  )
}

export default ResponsiveChartWrapper
