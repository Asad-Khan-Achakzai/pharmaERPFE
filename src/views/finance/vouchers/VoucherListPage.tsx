'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { voucherService } from '@/services/voucher.service'
import { showApiError } from '@/utils/apiErrors'
import type { Voucher } from '@/types/accounting'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const VoucherListPage = () => {
  const [data, setData] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: r } = await voucherService.list({ limit: '100' })
      setData(r.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.transactions}
        subheader='All financial transactions — posted automatically from business actions or entered manually'
        action={
          <Button variant='contained' component={Link} href='/finance/vouchers/new'>
            {ACCOUNTING_UX.manualTransactionAdvanced}
          </Button>
        }
      />
      <div className='overflow-x-auto pli-6 pbe-6'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Amount In</th>
              <th>Amount Out</th>
              <th>Status</th>
              <th>Narration</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={6} className='text-center p-6'>
                  No vouchers
                </td>
              </tr>
            ) : (
              data.map((v) => (
                <tr key={v._id}>
                  <td>
                    <Typography fontWeight={500}>{v.voucherNumber}</Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {v.voucherType}
                    </Typography>
                  </td>
                  <td>{new Date(v.date).toLocaleDateString()}</td>
                  <td>₨ {v.totalDebit?.toFixed(2)}</td>
                  <td>₨ {v.totalCredit?.toFixed(2)}</td>
                  <td>
                    <Chip
                      label={v.status}
                      size='small'
                      color={v.status === 'POSTED' ? 'success' : v.status === 'REVERSED' ? 'error' : 'default'}
                      variant='tonal'
                    />
                  </td>
                  <td>{v.narration || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default VoucherListPage
