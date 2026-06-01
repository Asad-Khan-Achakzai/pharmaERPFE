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
  label: string
  helperText?: string
  required?: boolean
  showBalance?: boolean
}

export const MoneyAccountSelect = ({
  value,
  onChange,
  label,
  helperText,
  required,
  showBalance
}: Props) => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void accountService
      .listMoneyAccounts()
      .then(({ data: r }) => setAccounts(r.data || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }, [])

  const labelFor = (a: Account) => {
    const name = friendlyAccountLabel(a.code, a.name, false)
    if (showBalance) {
      return `${name} — available ₨ ${(a.currentBalance ?? 0).toLocaleString('en-PK')}`
    }
    return name
  }

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
      <MenuItem value=''>Select account</MenuItem>
      {accounts.map(a => (
        <MenuItem key={a._id} value={a._id}>
          {labelFor(a)}
        </MenuItem>
      ))}
    </CustomTextField>
  )
}
