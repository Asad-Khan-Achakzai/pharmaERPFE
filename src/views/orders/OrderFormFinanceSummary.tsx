'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import type { OrderFinancialTotals } from '@/utils/orderFinancialPreview'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminLike } from '@/utils/roleHelpers'
import { FinancialLayerSection } from '@/components/financial/FinancialLayerSection'
import { FinInfoTip } from '@/components/financial/FinInfoTip'
import { FIN_LABELS, FIN_TOOLTIPS } from '@/constants/financialLabels'

const fmt = (n: number) =>
  `₨ ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Props = {
  preview: OrderFinancialTotals | null
}

const OrderFormFinanceSummary = ({ preview }: Props) => {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const showAdminFinancials = isAdminLike(user?.role)

  if (!preview) return null

  return (
    <Card variant='outlined' className='border-primary/20'>
      <CardContent className='pbs-4 pie-4'>
        <Typography variant='subtitle2' color='text.secondary' className='mbe-2'>
          Pricing preview (saved with order)
        </Typography>

        <div className='flex flex-wrap gap-x-8 gap-y-2 items-baseline mbe-3'>
          <div>
            <Typography variant='caption' color='text.secondary'>
              Paid qty (total lines)
            </Typography>
            <Typography variant='h6'>{preview.totalPaidQuantity}</Typography>
          </div>
          <div>
            <Typography variant='caption' color='text.secondary'>
              Bonus qty
            </Typography>
            <Typography variant='h6'>{preview.totalBonusQuantity}</Typography>
          </div>
          <div>
            <Typography variant='caption' color='text.secondary'>
              Total physical qty
            </Typography>
            <Typography variant='h6'>{preview.totalPhysicalQuantity}</Typography>
          </div>
        </div>

        {showAdminFinancials ? (
          <Stack spacing={2}>
            <FinancialLayerSection layer='sales'>
              <Stack spacing={1}>
                <div className='flex flex-wrap justify-between gap-2'>
                  <Typography variant='body2' color='text.secondary' className='inline-flex items-center gap-0.5'>
                    {FIN_LABELS.grossSalesTp} <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                  </Typography>
                  <Typography variant='body2' fontWeight={600}>
                    {fmt(preview.totalAmount)}
                  </Typography>
                </div>
                <div className='flex flex-wrap justify-between gap-2'>
                  <Typography variant='body2' color='text.secondary'>
                    {FIN_LABELS.pharmacyDiscount}
                  </Typography>
                  <Typography variant='body2' fontWeight={600}>
                    {fmt(preview.pharmacyDiscountAmount)}
                  </Typography>
                </div>
                <div className='flex flex-wrap justify-between gap-2'>
                  <Typography variant='body2' color='text.secondary' className='inline-flex items-center gap-0.5'>
                    {FIN_LABELS.netSalesCustomer}
                    <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                  </Typography>
                  <Typography variant='body2' fontWeight={600}>
                    {fmt(preview.amountAfterPharmacyDiscount)}
                  </Typography>
                </div>
                <div className='flex flex-wrap justify-between gap-2'>
                  <Typography variant='body2' color='text.secondary'>
                    {FIN_LABELS.distributorCommission}
                  </Typography>
                  <Typography variant='body2' fontWeight={600}>
                    {fmt(preview.distributorCommissionAmount)}
                  </Typography>
                </div>
                <div className='flex flex-wrap justify-between gap-2'>
                  <Typography variant='body2' color='text.secondary' className='inline-flex items-center gap-0.5'>
                    {FIN_LABELS.netSalesCompany}
                    <FinInfoTip title={FIN_TOOLTIPS.customerVsCompany} />
                  </Typography>
                  <Typography variant='body2' fontWeight={600} color='primary.main'>
                    {fmt(preview.finalCompanyRevenue)}
                  </Typography>
                </div>
              </Stack>
              <Button size='small' className='mts-2' onClick={() => setOpen(!open)}>
                {open ? 'Hide' : 'Show'} pharmacy & distributor detail
              </Button>
              <Collapse in={open}>
                <Divider className='mbs-2 mts-2' />
                <Typography variant='caption' color='text.secondary'>
                  Commission is calculated on {FIN_LABELS.grossSalesTp}; pharmacy discount applies to TP line totals only.
                </Typography>
              </Collapse>
            </FinancialLayerSection>

            <FinancialLayerSection layer='cost'>
              <Typography variant='body2' color='text.secondary' className='inline-flex items-center gap-0.5'>
                {FIN_LABELS.estimatedCostStandard} (paid + bonus units × {FIN_LABELS.standardCostCatalog})
                <FinInfoTip title={FIN_TOOLTIPS.bonusCostVsRevenue} />
              </Typography>
              <Typography variant='h6'>{fmt(preview.totalCastingCost)}</Typography>
            </FinancialLayerSection>
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default OrderFormFinanceSummary
