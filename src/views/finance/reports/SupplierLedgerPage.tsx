'use client'

import { useState, useEffect, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { ledgerService } from '@/services/ledger.service'
import { supplierService } from '@/services/supplier.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import SubLedgerStatementPage, { type SubLedgerStatement } from './SubLedgerStatementPage'

type SupplierStatement = SubLedgerStatement & {
  supplierId: string
  supplierName: string
  supplierCity?: string
}

const SupplierLedgerPage = () => {
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [statement, setStatement] = useState<SupplierStatement | null>(null)

  const fetchData = useCallback(async () => {
    if (!supplierId) {
      setStatement(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { supplierId }
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await ledgerService.supplierStatement(params)
      setStatement(r.data as SupplierStatement)
    } catch (err) {
      showApiError(err, 'Failed to load supplier ledger')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [supplierId, from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <SubLedgerStatementPage
      title={ACCOUNTING_UX.supplierLedger}
      subheader='Payable history for a supplier — purchases increase balance; payments and returns reduce it'
      balanceHint='Positive balance = amount you owe the supplier'
      subjectLabel='Supplier'
      subjectName={statement?.supplierName}
      subjectSecondary={statement?.supplierCity || undefined}
      emptyMessage='Select a supplier to view their ledger'
      loading={loading}
      ready={Boolean(supplierId)}
      statement={statement}
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      runningBalanceLabel='Payable'
      filters={
        <Grid size={{ xs: 12, md: 6 }}>
          <LookupAutocomplete
            value={selectedSupplier}
            onChange={v => {
              setSelectedSupplier(v)
              setSupplierId(v ? String(v._id) : '')
              if (!v) setStatement(null)
            }}
            fetchOptions={search =>
              supplierService.lookup({ limit: '25', isActive: 'true', ...(search ? { search } : {}) }).then(r => r.data.data || [])
            }
            label='Supplier'
            placeholder='Search supplier…'
            required
            fetchErrorMessage='Failed to load suppliers'
          />
        </Grid>
      }
    />
  )
}

export default SupplierLedgerPage
