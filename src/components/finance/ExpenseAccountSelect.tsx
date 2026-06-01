'use client'

import { useEffect, useState } from 'react'
import MenuItem from '@mui/material/MenuItem'
import CustomTextField from '@core/components/mui/TextField'
import { accountService } from '@/services/account.service'
import type { Account } from '@/types/accounting'
import { friendlyAccountLabel } from '@/constants/accountingUx'

type Props = {
  value: string
  onChange: (id: string) => void
  label?: string
  helperText?: string
  required?: boolean
  accounts?: Account[]
}

export const ExpenseAccountSelect = ({
  value,
  onChange,
  label = 'Expense type',
  helperText = 'What did you spend on?',
  required,
  accounts: accountsProp
}: Props) => {
  const [accounts, setAccounts] = useState<Account[]>(accountsProp || [])
  const [loading, setLoading] = useState(!accountsProp?.length)

  useEffect(() => {
    if (accountsProp?.length) {
      setAccounts(accountsProp)
      setLoading(false)
      return
    }
    void accountService
      .businessView()
      .then(({ data: r }) => setAccounts(r.data?.expenseCategories || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }, [accountsProp])

  return (
    <CustomTextField
      required={required}
      fullWidth
      select
      label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      helperText={helperText}
      disabled={loading}
    >
      <MenuItem value=''>Select expense type</MenuItem>
      {accounts.map(a => (
        <MenuItem key={a._id} value={a._id}>
          {friendlyAccountLabel(a.code, a.name, false)}
        </MenuItem>
      ))}
    </CustomTextField>
  )
}
