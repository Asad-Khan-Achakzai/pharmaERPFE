import { Suspense } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import DoctorListPage from '@/views/doctors/list/DoctorListPage'

const Page = () => (
  <Suspense
    fallback={
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }
  >
    <DoctorListPage />
  </Suspense>
)
export default Page
