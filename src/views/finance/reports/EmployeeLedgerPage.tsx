'use client'

import { useState, useEffect, useCallback } from 'react'
import Grid from '@mui/material/Grid'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { ledgerService } from '@/services/ledger.service'
import { usersService } from '@/services/users.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import SubLedgerStatementPage, { type SubLedgerStatement } from './SubLedgerStatementPage'

type EmployeeStatement = SubLedgerStatement & {
  employeeId: string
  employeeName: string
  employeeCode?: string | null
}

const EmployeeLedgerPage = () => {
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null)
  const [employeeId, setEmployeeId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [statement, setStatement] = useState<EmployeeStatement | null>(null)

  const fetchData = useCallback(async () => {
    if (!employeeId) {
      setStatement(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { employeeId }
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await ledgerService.employeeStatement(params)
      setStatement(r.data as EmployeeStatement)
    } catch (err) {
      showApiError(err, 'Failed to load employee ledger')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [employeeId, from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <SubLedgerStatementPage
      title={ACCOUNTING_UX.employeeLedger}
      subheader='Expenses attributed to an employee, including salary from paid payroll'
      balanceHint='Running total = cumulative company spend linked to this employee'
      subjectLabel='Employee'
      subjectName={statement?.employeeName}
      subjectSecondary={statement?.employeeCode ? `Code: ${statement.employeeCode}` : undefined}
      emptyMessage='Select an employee to view their ledger'
      loading={loading}
      ready={Boolean(employeeId)}
      statement={statement}
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      runningBalanceLabel='Running total'
      filters={
        <Grid size={{ xs: 12, md: 6 }}>
          <LookupAutocomplete
            value={selectedEmployee}
            onChange={v => {
              setSelectedEmployee(v)
              setEmployeeId(v ? String(v._id) : '')
              if (!v) setStatement(null)
            }}
            fetchOptions={search =>
              usersService.assignable({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
            }
            label='Employee'
            placeholder='Search employee…'
            required
            fetchErrorMessage='Failed to load employees'
          />
        </Grid>
      }
    />
  )
}

export default EmployeeLedgerPage
