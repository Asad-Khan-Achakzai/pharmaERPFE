'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { voucherService } from '@/services/voucher.service'
import { showApiError } from '@/utils/apiErrors'
import type { Voucher } from '@/types/accounting'
import { ACCOUNTING_UX, VOUCHER_SOURCE_LABELS } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const VoucherListPage = () => {
  const searchParams = useSearchParams()
  const sourceFilter = searchParams.get('sourceModule') || ''
  const [data, setData] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      if (sourceFilter) params.sourceModule = sourceFilter
      const { data: r } = await voucherService.list(params)
      setData(r.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const subheader = sourceFilter
    ? `Showing ${VOUCHER_SOURCE_LABELS[sourceFilter] || sourceFilter} entries only`
    : 'All financial transactions — posted automatically from business actions or entered manually'

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.transactions}
        subheader={subheader}
        action={
          <Stack direction='row' spacing={1}>
            {sourceFilter ? (
              <Button variant='outlined' component={Link} href='/finance/vouchers' size='small'>
                Show all
              </Button>
            ) : null}
            <Button variant='contained' component={Link} href='/finance/vouchers/new'>
              {ACCOUNTING_UX.manualTransactionAdvanced}
            </Button>
          </Stack>
        }
      />
      <div className='overflow-x-auto pli-6 pbe-6'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Reference</th>
              <th>Source</th>
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
                <td colSpan={7} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className='text-center p-6'>
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
                  <td>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={v.sourceModule ? VOUCHER_SOURCE_LABELS[v.sourceModule] || v.sourceModule : '—'}
                    />
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
