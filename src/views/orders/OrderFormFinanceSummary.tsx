'use client'

import { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import type { OrderFinancialTotals } from '@/utils/orderFinancialPreview'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminLike } from '@/utils/roleHelpers'

const HELP_NET_SALES =
  'Revenue after pharmacy discount and distributor commission. This is NOT profit.'
const HELP_ESTIMATED_CASTING =
  'Catalog cost used at order time. May differ from actual inventory cost.'

function InfoTip({ title }: { title: string }) {
  return (
    <Tooltip title={title} arrow leaveTouchDelay={4000}>
      <span className='inline-flex align-middle cursor-help opacity-70' aria-label='More info'>
        <i className='tabler-info-circle size-3.5' />
      </span>
    </Tooltip>
  )
}

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
        <div className='flex flex-wrap gap-x-8 gap-y-2 items-baseline'>
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
          <div>
            <Typography variant='caption' color='text.secondary' className='inline-flex items-center gap-0.5'>
              Gross Sales Value (TP × paid qty)
            </Typography>
            <Typography variant='h6'>{fmt(preview.totalAmount)}</Typography>
          </div>
          {showAdminFinancials && (
            <div>
              <Typography variant='caption' color='text.secondary' className='inline-flex items-center gap-0.5'>
                Net Sales (After Pharmacy Discount & Distributor Commission)
                <InfoTip title={HELP_NET_SALES} />
              </Typography>
              <Typography variant='h6' color='primary.main'>
                {fmt(preview.finalCompanyRevenue)}
              </Typography>
            </div>
          )}
        </div>
        {showAdminFinancials && (
          <>
            <Typography variant='caption' color='text.secondary' className='mts-1 inline-flex items-center gap-0.5 flex-wrap'>
              Estimated Product Cost (Catalog / Casting at Order Time): {fmt(preview.totalCastingCost)}
              <InfoTip title={HELP_ESTIMATED_CASTING} />
            </Typography>
            <Button size='small' className='mts-2' onClick={() => setOpen(!open)}>
              {open ? 'Hide' : 'Show'} pharmacy & distributor impact
            </Button>
            <Collapse in={open}>
              <Divider className='mbs-2 mts-2' />
              <div className='mts-2 flex flex-col gap-1 pbs-2'>
                <Typography variant='body2'>
                  Pharmacy discount: <strong>{fmt(preview.pharmacyDiscountAmount)}</strong>
                </Typography>
                <Typography variant='body2'>
                  Distributor commission (on gross TP): <strong>{fmt(preview.distributorCommissionAmount)}</strong>
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  Commission uses the distributor&apos;s rate on TP; pharmacy discount applies to TP line totals only.
                </Typography>
              </div>
            </Collapse>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default OrderFormFinanceSummary
