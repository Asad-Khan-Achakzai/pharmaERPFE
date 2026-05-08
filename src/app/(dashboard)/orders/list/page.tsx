import { Suspense } from 'react'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import OrderListPage from '@/views/orders/list/OrderListPage'

const Page = () => (
  <Suspense
    fallback={
      <Box sx={{ p: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }
  >
    <OrderListPage />
  </Suspense>
)
export default Page
