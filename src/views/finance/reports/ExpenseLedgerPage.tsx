'use client'

import { useState, useEffect, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import MenuItem from '@mui/material/MenuItem'
import CustomTextField from '@core/components/mui/TextField'
import { ledgerService } from '@/services/ledger.service'
import { accountService } from '@/services/account.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX, friendlyAccountLabel } from '@/constants/accountingUx'
import type { Account } from '@/types/accounting'
import SubLedgerStatementPage, { type SubLedgerStatement } from './SubLedgerStatementPage'

type ExpenseLedgerData = SubLedgerStatement & {
  category?: string | null
  categoryLabel?: string
}

const ExpenseLedgerPage = () => {
  const [expenseAccountId, setExpenseAccountId] = useState('')
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [statement, setStatement] = useState<ExpenseLedgerData | null>(null)

  useEffect(() => {
    void accountService
      .businessView()
      .then(({ data: r }) => setExpenseAccounts(r.data?.expenseCategories || []))
      .catch(() => setExpenseAccounts([]))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (expenseAccountId) params.expenseAccountId = expenseAccountId
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await ledgerService.expenseLedger(params)
      setStatement(r.data as ExpenseLedgerData)
    } catch (err) {
      showApiError(err, 'Failed to load expense ledger')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [expenseAccountId, from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <SubLedgerStatementPage
      title={ACCOUNTING_UX.expenseLedger}
      subheader='Operating expenses recorded in the system — running total is cumulative spend'
      balanceHint='Each row is cash spent; running total shows cumulative expenses in the view'
      subjectLabel='Scope'
      subjectName={statement?.categoryLabel || 'All categories'}
      emptyMessage=''
      loading={loading}
      ready
      statement={statement}
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      runningBalanceLabel='Running total'
      filters={
        <Grid size={{ xs: 12, md: 6 }}>
          <CustomTextField
            fullWidth
            select
            label='Expense account'
            value={expenseAccountId}
            onChange={e => setExpenseAccountId(e.target.value)}
          >
            <MenuItem value=''>All expense accounts</MenuItem>
            {expenseAccounts.map(a => (
              <MenuItem key={a._id} value={a._id}>
                {friendlyAccountLabel(a.code, a.name, false)}
              </MenuItem>
            ))}
          </CustomTextField>
        </Grid>
      }
    />
  )
}

export default ExpenseLedgerPage
