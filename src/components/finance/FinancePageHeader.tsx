'use client'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { useAccountingUxRole } from '@/hooks/useAccountingUxRole'

type Props = {
  title: string
  subheader?: string
  showAutoHint?: boolean
  showAccountantBanner?: boolean
}

const FinancePageHeader = ({ title, subheader, showAutoHint = false, showAccountantBanner = false }: Props) => {
  const { showTechnicalAccounting } = useAccountingUxRole()

  return (
    <>
      <Typography variant='h5' component='h1' fontWeight={600}>
        {title}
      </Typography>
      {subheader && (
        <Typography variant='body2' color='text.secondary' className='mbs-1 mbe-3'>
          {subheader}
        </Typography>
      )}
      {showAutoHint && !showTechnicalAccounting && (
        <Alert severity='info' className='mbe-4' icon={<i className='tabler-info-circle' />}>
          {ACCOUNTING_UX.autoAccountingHint}
        </Alert>
      )}
      {showAccountantBanner && showTechnicalAccounting && (
        <Alert severity='warning' variant='outlined' className='mbe-4'>
          {ACCOUNTING_UX.accountantOnlyHint}
        </Alert>
      )}
    </>
  )
}

export default FinancePageHeader
