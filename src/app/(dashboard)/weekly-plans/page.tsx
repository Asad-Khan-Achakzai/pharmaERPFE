import { Suspense } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import WeeklyPlansPage from '@/views/weeklyPlans/WeeklyPlansPage'

const Page = () => (
  <Suspense
    fallback={
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }
  >
    <WeeklyPlansPage />
  </Suspense>
)
export default Page
