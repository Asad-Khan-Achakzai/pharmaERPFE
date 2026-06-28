'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import { ledgerService } from '@/services/ledger.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { DoctorLookupAutocomplete, type DoctorLookupOption } from '@/components/lookup/DoctorLookupAutocomplete'
import SubLedgerStatementPage, { type SubLedgerStatement } from './SubLedgerStatementPage'

type ActivityLedgerData = SubLedgerStatement & {
  doctorId?: string | null
  doctorName?: string
}

const ActivityLedgerPage = () => {
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorLookupOption | null>(null)
  const [doctorId, setDoctorId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [statement, setStatement] = useState<ActivityLedgerData | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (doctorId) params.doctorId = doctorId
      if (from) params.from = from
      if (to) params.to = to
      const { data: r } = await ledgerService.activityLedger(params)
      setStatement(r.data as ActivityLedgerData)
    } catch (err) {
      showApiError(err, 'Failed to load activity ledger')
      setStatement(null)
    } finally {
      setLoading(false)
    }
  }, [doctorId, from, to])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <SubLedgerStatementPage
      title={ACCOUNTING_UX.activityLedger}
      subheader='Doctor activity investments paid from cash or bank — running total is cumulative spend'
      balanceHint='Each row is an investment outflow; running total shows cumulative doctor activity spend in the view'
      subjectLabel='Scope'
      subjectName={statement?.doctorName || 'All doctors'}
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
        <>
          <Grid size={{ xs: 12, md: 6 }}>
            <DoctorLookupAutocomplete
              value={selectedDoctor}
              onChange={v => {
                setSelectedDoctor(v)
                setDoctorId(v ? String(v._id) : '')
              }}
              label='Doctor'
              placeholder='All doctors'
              fetchErrorMessage='Failed to load doctors'
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} className='flex items-end'>
            <Button component={Link} href='/doctor-activities/add' variant='outlined' size='small'>
              New doctor activity
            </Button>
          </Grid>
        </>
      }
    />
  )
}

export default ActivityLedgerPage
