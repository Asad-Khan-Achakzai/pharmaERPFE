import { Suspense } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import RouteHistoryView from '@/views/team/RouteHistoryView'

export default function Page() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      }
    >
      <RouteHistoryView />
    </Suspense>
  )
}
