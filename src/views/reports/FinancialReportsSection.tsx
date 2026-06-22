'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormLabel from '@mui/material/FormLabel'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import TablePagination from '@mui/material/TablePagination'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Skeleton from '@mui/material/Skeleton'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { reportsService } from '@/services/reports.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { collectionsService } from '@/services/collections.service'
import { settlementsService } from '@/services/settlements.service'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { MoneyAccountSelect } from '@/components/finance/MoneyAccountSelect'
import FinancialPositionSection from '@/views/reports/FinancialPositionSection'
import TableSkeleton from '@/components/skeletons/TableSkeleton'

let financialReportsCache: {
  distBal: any
  periodData: any
} | null = null

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** YYYY-MM-DD in local time for `<input type="date" />` */
const getLocalDateISO = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const FinancialReportsSection = () => {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(getLocalDateISO)
  const [pharmacyFilter, setPharmacyFilter] = useState('')
  const [distributorFilter, setDistributorFilter] = useState('')
  const [selectedPharmacyFilter, setSelectedPharmacyFilter] = useState<any | null>(null)
  const [selectedDistributorFilter, setSelectedDistributorFilter] = useState<any | null>(null)
  const [collectorType, setCollectorType] = useState('')
  const [settlementDirection, setSettlementDirection] = useState('')

  const [pharmacyBal, setPharmacyBal] = useState<any>(null)
  const [distBal, setDistBal] = useState<any>(financialReportsCache?.distBal ?? null)
  const [periodData, setPeriodData] = useState<any>(financialReportsCache?.periodData ?? null)
  const [loadingDist, setLoadingDist] = useState(!financialReportsCache?.distBal)
  const [loadingPharmacy, setLoadingPharmacy] = useState(true)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [pharmacySearch, setPharmacySearch] = useState('')
  const [debouncedPharmacySearch, setDebouncedPharmacySearch] = useState('')
  const [pharmacyPage, setPharmacyPage] = useState(1)
  const [pharmacyRowsPerPage, setPharmacyRowsPerPage] = useState(25)
  const [pharmacyBalanceOnly, setPharmacyBalanceOnly] = useState(false)
  const [pharmacySortBy, setPharmacySortBy] = useState<
    'receivableFromPharmacy' | 'name' | 'city' | 'advanceOrCreditFromPharmacy' | 'outstanding'
  >('receivableFromPharmacy')
  const [pharmacySortOrder, setPharmacySortOrder] = useState<'asc' | 'desc'>('desc')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailBody, setDetailBody] = useState<any>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [collectionPharmacy, setCollectionPharmacy] = useState<any>(null)
  const [selectedCollectionDistributor, setSelectedCollectionDistributor] = useState<any | null>(null)
  const [collectionForm, setCollectionForm] = useState({
    collectorType: 'DISTRIBUTOR' as 'COMPANY' | 'DISTRIBUTOR',
    distributorId: '',
    amount: 0,
    paymentMethod: 'CASH',
    moneyAccountId: '',
    referenceNumber: '',
    notes: ''
  })
  const [savingCollection, setSavingCollection] = useState(false)
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [settlementDistributor, setSettlementDistributor] = useState<any>(null)
  const [settlementForm, setSettlementForm] = useState({
    direction: 'DISTRIBUTOR_TO_COMPANY' as 'DISTRIBUTOR_TO_COMPANY' | 'COMPANY_TO_DISTRIBUTOR',
    amount: 0,
    paymentMethod: 'CASH',
    moneyAccountId: '',
    referenceNumber: '',
    notes: ''
  })
  const [savingSettlement, setSavingSettlement] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPharmacySearch(pharmacySearch.trim()), 400)
    return () => clearTimeout(t)
  }, [pharmacySearch])

  useEffect(() => {
    setPharmacyPage(1)
  }, [debouncedPharmacySearch, pharmacyBalanceOnly, pharmacyRowsPerPage, pharmacySortBy, pharmacySortOrder])

  const loadDistributors = useCallback(async () => {
    const hasCache = Boolean(financialReportsCache?.distBal)
    if (!hasCache) setLoadingDist(true)
    try {
      const db = await reportsService.distributorBalances()
      const nextDist = db.data.data
      financialReportsCache = {
        distBal: nextDist,
        periodData: financialReportsCache?.periodData ?? null
      }
      setDistBal(nextDist)
    } catch (err) {
      showApiError(err, 'Failed to load distributor balances')
    } finally {
      setLoadingDist(false)
    }
  }, [])

  const loadPharmacyBalances = useCallback(async () => {
    setLoadingPharmacy(true)
    try {
      const pb = await reportsService.pharmacyBalances({
        paginate: 'true',
        page: String(pharmacyPage),
        limit: String(pharmacyRowsPerPage),
        ...(debouncedPharmacySearch ? { search: debouncedPharmacySearch } : {}),
        ...(pharmacyBalanceOnly ? { hasBalanceOnly: 'true' } : {}),
        sortBy: pharmacySortBy,
        sortOrder: pharmacySortOrder
      })
      setPharmacyBal(pb.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load pharmacy balances')
    } finally {
      setLoadingPharmacy(false)
    }
  }, [
    pharmacyPage,
    pharmacyRowsPerPage,
    debouncedPharmacySearch,
    pharmacyBalanceOnly,
    pharmacySortBy,
    pharmacySortOrder
  ])

  useEffect(() => {
    void loadDistributors()
  }, [loadDistributors])

  useEffect(() => {
    void loadPharmacyBalances()
  }, [loadPharmacyBalances])

  const loadPeriod = async () => {
    setLoadingPeriod(true)
    try {
      const params: Record<string, string> = {}
      if (from) params.from = from
      if (to) params.to = to
      if (pharmacyFilter) params.pharmacyId = pharmacyFilter
      if (distributorFilter) params.distributorId = distributorFilter
      if (collectorType) params.collectorType = collectorType
      if (settlementDirection) params.direction = settlementDirection

      const res = await reportsService.financialOverview(params)
      const next = {
        distBal: financialReportsCache?.distBal ?? distBal,
        periodData: res.data.data
      }
      financialReportsCache = next
      setPeriodData(next.periodData)
    } catch (err) {
      showApiError(err, 'Failed to load period report')
    } finally {
      setLoadingPeriod(false)
    }
  }

  const openDistributorDetail = async (id: string) => {
    setDetailOpen(true)
    setLoadingDetail(true)
    setDetailBody(null)
    try {
      const res = await reportsService.distributorBalanceDetail(id)
      setDetailBody(res.data.data)
    } catch (err) {
      showApiError(err, 'Failed to load distributor clearing detail')
    } finally {
      setLoadingDetail(false)
    }
  }

  const openCollectionDialog = (row: any) => {
    setCollectionPharmacy(row)
    setSelectedCollectionDistributor(null)
    setCollectionForm({
      collectorType: 'DISTRIBUTOR',
      distributorId: '',
      amount: Number(row.receivableFromPharmacy) || 0,
      paymentMethod: 'CASH',
      moneyAccountId: '',
      referenceNumber: '',
      notes: ''
    })
    setCollectionOpen(true)
  }

  const closeCollectionDialog = () => {
    if (savingCollection) return
    setCollectionOpen(false)
  }

  const needsCollectionDistributor = collectionForm.collectorType === 'DISTRIBUTOR'
  const isCollectionFormValid =
    Boolean(collectionPharmacy?.pharmacyId) &&
    collectionForm.amount > 0 &&
    Boolean(collectionForm.moneyAccountId) &&
    (!needsCollectionDistributor || collectionForm.distributorId !== '')

  const handleCollectionSubmit = async () => {
    if (!collectionPharmacy?.pharmacyId || collectionForm.amount <= 0) {
      showApiError(null, 'Fill required fields')
      return
    }
    if (needsCollectionDistributor && !collectionForm.distributorId) {
      showApiError(null, 'Select distributor')
      return
    }

    setSavingCollection(true)
    try {
      await collectionsService.create({
        pharmacyId: collectionPharmacy.pharmacyId,
        collectorType: collectionForm.collectorType,
        ...(collectionForm.collectorType === 'DISTRIBUTOR' ? { distributorId: collectionForm.distributorId } : {}),
        amount: collectionForm.amount,
        paymentMethod: collectionForm.paymentMethod,
        moneyAccountId: collectionForm.moneyAccountId,
        referenceNumber: collectionForm.referenceNumber || undefined,
        notes: collectionForm.notes || undefined
      })
      showSuccess('Collection recorded')
      setCollectionOpen(false)
      await Promise.all([loadPharmacyBalances(), loadDistributors(), periodData ? loadPeriod() : Promise.resolve()])
    } catch (err) {
      showApiError(err, 'Failed to record collection')
    } finally {
      setSavingCollection(false)
    }
  }

  const openSettlementDialog = (row: any) => {
    const remittanceDue = Number(row.remittanceDueFromDistributor) || 0
    const commissionPayable = Number(row.commissionPayableByCompanyToDistributor) || 0
    const direction =
      remittanceDue > 0 || commissionPayable <= 0 ? 'DISTRIBUTOR_TO_COMPANY' : 'COMPANY_TO_DISTRIBUTOR'

    setSettlementDistributor(row)
    setSettlementForm({
      direction,
      amount: direction === 'DISTRIBUTOR_TO_COMPANY' ? remittanceDue : commissionPayable,
      paymentMethod: 'CASH',
      moneyAccountId: '',
      referenceNumber: '',
      notes: ''
    })
    setSettlementOpen(true)
  }

  const closeSettlementDialog = () => {
    if (savingSettlement) return
    setSettlementOpen(false)
  }

  const isSettlementFormValid =
    Boolean(settlementDistributor?.distributorId) &&
    settlementForm.amount > 0 &&
    Boolean(settlementForm.moneyAccountId)

  const handleSettlementSubmit = async () => {
    if (!settlementDistributor?.distributorId || settlementForm.amount <= 0) {
      showApiError(null, 'Fill required fields')
      return
    }

    setSavingSettlement(true)
    try {
      await settlementsService.create({
        distributorId: settlementDistributor.distributorId,
        direction: settlementForm.direction,
        amount: settlementForm.amount,
        paymentMethod: settlementForm.paymentMethod,
        moneyAccountId: settlementForm.moneyAccountId,
        referenceNumber: settlementForm.referenceNumber || undefined,
        notes: settlementForm.notes || undefined
      })
      showSuccess('Settlement recorded')
      setSettlementOpen(false)
      await Promise.all([loadDistributors(), periodData ? loadPeriod() : Promise.resolve()])
    } catch (err) {
      showApiError(err, 'Failed to record settlement')
    } finally {
      setSavingSettlement(false)
    }
  }

  const pRows = pharmacyBal?.rows || []
  const pTotals = pharmacyBal?.totals
  const pPagination = pharmacyBal?.pagination
  const dRows = distBal?.rows || []
  const dTotals = distBal?.totals

  const col = periodData?.collections
  const setl = periodData?.settlements
  const cash = periodData?.cashSummary

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12 }}>
        <FinancialPositionSection />
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Typography variant='body2' color='text.secondary' className='mbe-2'>
          Pharmacy columns reflect invoice receivables (deliveries minus collections/returns). Distributor columns
          reflect clearing (commission vs remittance). Use a date range to see collections, settlements, and a cash-style
          summary for that period.
        </Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Current balances (all pharmacies & distributors)' />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, lg: 6 }}>
                {loadingPharmacy ? (
                  <TableSkeleton columns={4} rows={6} />
                ) : (
                  <>
                    <Typography variant='subtitle2' className='mbe-2'>
                      Pharmacy receivables
                    </Typography>
                    {pTotals && (
                      <Typography variant='body2' className='mbe-2'>
                        Total owed by pharmacies (company-wide): <strong>{formatPKR(pTotals.totalReceivable)}</strong> ·
                        Pharmacy credit balance: <strong>{formatPKR(pTotals.totalPharmacyCreditBalance)}</strong>
                      </Typography>
                    )}
                    {pPagination ? (
                      <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                        {pPagination.total === 0
                          ? 'No pharmacies match this filter.'
                          : `Showing ${(pharmacyPage - 1) * pharmacyRowsPerPage + 1}–${Math.min(
                              pharmacyPage * pharmacyRowsPerPage,
                              pPagination.total
                            )} of ${pPagination.total}`}
                      </Typography>
                    ) : null}
                    <div className='flex flex-wrap gap-3 items-end mbe-3'>
                      <CustomTextField
                        label='Search pharmacies'
                        value={pharmacySearch}
                        onChange={e => setPharmacySearch(e.target.value)}
                        placeholder='Name, city, phone'
                        sx={{ minWidth: 200 }}
                      />
                      <CustomTextField
                        select
                        label='Sort by'
                        value={pharmacySortBy}
                        onChange={e =>
                          setPharmacySortBy(
                            e.target.value as
                              | 'receivableFromPharmacy'
                              | 'name'
                              | 'city'
                              | 'advanceOrCreditFromPharmacy'
                              | 'outstanding'
                          )
                        }
                        sx={{ minWidth: 170 }}
                      >
                        <MenuItem value='receivableFromPharmacy'>Amount owed</MenuItem>
                        <MenuItem value='name'>Name</MenuItem>
                        <MenuItem value='city'>City</MenuItem>
                        <MenuItem value='advanceOrCreditFromPharmacy'>Credit / advance</MenuItem>
                        <MenuItem value='outstanding'>Net outstanding</MenuItem>
                      </CustomTextField>
                      <CustomTextField
                        select
                        label='Order'
                        value={pharmacySortOrder}
                        onChange={e => setPharmacySortOrder(e.target.value as 'asc' | 'desc')}
                        sx={{ minWidth: 120 }}
                      >
                        <MenuItem value='desc'>Descending</MenuItem>
                        <MenuItem value='asc'>Ascending</MenuItem>
                      </CustomTextField>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={pharmacyBalanceOnly}
                            onChange={e => setPharmacyBalanceOnly(e.target.checked)}
                          />
                        }
                        label='Non-zero balance only'
                      />
                    </div>
                    <TableContainer component={Paper} variant='outlined'>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Pharmacy</TableCell>
                            <TableCell align='right'>Owed to company</TableCell>
                            <TableCell align='right'>Credit / advance</TableCell>
                            <TableCell width={220} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4}>
                                No pharmacies match your search or filters.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pRows.map((row: any) => (
                              <TableRow hover key={row.pharmacyId}>
                                <TableCell>
                                  {row.name}
                                  <Typography variant='caption' display='block' color='text.secondary'>
                                    {row.city}
                                  </Typography>
                                </TableCell>
                                <TableCell align='right'>{formatPKR(row.receivableFromPharmacy)}</TableCell>
                                <TableCell align='right'>{formatPKR(row.advanceOrCreditFromPharmacy)}</TableCell>
                                <TableCell>
                                  <div className='flex flex-col gap-2 sm:flex-row'>
                                    <Button
                                      size='small'
                                      component={Link}
                                      href={`/reports/financial/pharmacies/${row.pharmacyId}/ledger`}
                                      sx={{ inlineSize: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                                    >
                                      View account
                                    </Button>
                                    <Button
                                      size='small'
                                      variant='outlined'
                                      onClick={() => openCollectionDialog(row)}
                                      sx={{ inlineSize: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                                    >
                                      Add collection
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {pPagination ? (
                      <TablePagination
                        component='div'
                        count={pPagination.total}
                        page={pharmacyPage - 1}
                        onPageChange={(_, p) => setPharmacyPage(p + 1)}
                        rowsPerPage={pharmacyRowsPerPage}
                        onRowsPerPageChange={e => {
                          setPharmacyRowsPerPage(parseInt(e.target.value, 10))
                          setPharmacyPage(1)
                        }}
                        rowsPerPageOptions={[10, 25, 50]}
                      />
                    ) : null}
                  </>
                )}
              </Grid>
              <Grid size={{ xs: 12, lg: 6 }}>
                {loadingDist ? (
                  <TableSkeleton columns={5} rows={6} />
                ) : (
                  <>
                    <Typography variant='subtitle2' className='mbe-2'>
                      Distributor clearing
                    </Typography>
                    {distBal?.helpShort && (
                      <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                        {distBal.helpShort} Clearing net is signed (matches Client Ledger). Return adjustments change
                        clearing net but not remittance / commission unless open collection lines remain.
                      </Typography>
                    )}
                    {dTotals && (
                      <Typography variant='body2' className='mbe-2'>
                        <strong>Remittance due</strong> (distributor collected cash for you):{' '}
                        <strong>{formatPKR(dTotals.sumRemittanceDueFromDistributors ?? 0)}</strong>
                        {' · '}
                        <strong>Commission payable</strong> (you collected; owe distributor on TP):{' '}
                        <strong>{formatPKR(dTotals.sumCommissionPayableByCompanyToDistributors ?? 0)}</strong>
                        {' · '}
                        Ledger net (audit): distributors {formatPKR(dTotals.sumNetOwedByDistributorsToCompany)} · company{' '}
                        {formatPKR(dTotals.sumNetOwedByCompanyToDistributors)}
                      </Typography>
                    )}
                    <TableContainer component={Paper} variant='outlined'>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Distributor</TableCell>
                            <TableCell align='right'>Remittance due</TableCell>
                            <TableCell align='right'>Comm. payable</TableCell>
                            <TableCell align='right'>Clearing net</TableCell>
                            <TableCell width={180} />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5}>
                                No distributors
                              </TableCell>
                            </TableRow>
                          ) : (
                            dRows.map((row: any) => (
                              <TableRow key={row.distributorId}>
                                <TableCell>
                                  {row.name}
                                  <Typography variant='caption' display='block' color='text.secondary'>
                                    {row.city}
                                  </Typography>
                                </TableCell>
                                <TableCell align='right'>{formatPKR(row.remittanceDueFromDistributor ?? 0)}</TableCell>
                                <TableCell align='right'>
                                  {formatPKR(row.commissionPayableByCompanyToDistributor ?? 0)}
                                </TableCell>
                                <TableCell align='right'>
                                  {formatPKR(row.netDistributorOwesCompany ?? 0)}
                                  {row.netDistributorOwesCompany !== 0 ? (
                                    <Typography variant='caption' display='block' color='text.secondary'>
                                      {row.netDistributorOwesCompany > 0 ? 'Distributor owes' : 'Company owes'}
                                    </Typography>
                                  ) : null}
                                </TableCell>
                                <TableCell>
                                  <div className='flex flex-col gap-2 sm:flex-row'>
                                    <Button
                                      size='small'
                                      onClick={() => openDistributorDetail(row.distributorId)}
                                      sx={{ inlineSize: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                                    >
                                      Ledger
                                    </Button>
                                    <Button
                                      size='small'
                                      variant='outlined'
                                      onClick={() => openSettlementDialog(row)}
                                      sx={{ inlineSize: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
                                    >
                                      Add settlement
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Activity in date range' subheader='Collections, settlements, and net movement' />
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-4 items-end'>
              <CustomTextField
                label='From'
                type='date'
                value={from}
                onChange={e => setFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <CustomTextField
                label='To'
                type='date'
                value={to}
                onChange={e => setTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <div className='min-is-[220px] flex-1'>
                <LookupAutocomplete
                  value={selectedPharmacyFilter}
                  onChange={v => {
                    setSelectedPharmacyFilter(v)
                    setPharmacyFilter(v ? String(v._id) : '')
                  }}
                  fetchOptions={search =>
                    pharmaciesService.lookup({ limit: 25, ...(search ? { search } : {}) }).then(r => r.data.data || [])
                  }
                  label='Pharmacy (collections filter)'
                  placeholder='All pharmacies'
                  helperText='Optional — narrow collections by pharmacy'
                  fetchErrorMessage='Failed to load pharmacies'
                />
              </div>
              <div className='min-is-[220px] flex-1'>
                <LookupAutocomplete
                  value={selectedDistributorFilter}
                  onChange={v => {
                    setSelectedDistributorFilter(v)
                    setDistributorFilter(v ? String(v._id) : '')
                  }}
                  fetchOptions={search =>
                    distributorsService
                      .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                      .then(r => r.data.data || [])
                  }
                  label='Distributor (settlements filter)'
                  placeholder='All distributors'
                  helperText='Optional — narrow settlements by distributor'
                  fetchErrorMessage='Failed to load distributors'
                />
              </div>
              <CustomTextField select label='Collector' value={collectorType} onChange={e => setCollectorType(e.target.value)} sx={{ minWidth: 140 }}>
                <MenuItem value=''>Any</MenuItem>
                <MenuItem value='COMPANY'>Company</MenuItem>
                <MenuItem value='DISTRIBUTOR'>Distributor</MenuItem>
              </CustomTextField>
              <CustomTextField select label='Settlement dir.' value={settlementDirection} onChange={e => setSettlementDirection(e.target.value)} sx={{ minWidth: 180 }}>
                <MenuItem value=''>Any</MenuItem>
                <MenuItem value='DISTRIBUTOR_TO_COMPANY'>Distributor → company</MenuItem>
                <MenuItem value='COMPANY_TO_DISTRIBUTOR'>Company → distributor</MenuItem>
              </CustomTextField>
              <Button
                variant='contained'
                onClick={loadPeriod}
                disabled={loadingPeriod || !to}
                startIcon={loadingPeriod ? <CircularProgress size={20} color='inherit' /> : undefined}
              >
                {loadingPeriod ? 'Loading…' : 'Load period report'}
              </Button>
            </div>
            {!to && (
              <Typography variant='caption' color='warning.main'>
                Set a &quot;To&quot; date to load period activity (From is optional — leave empty for all history up to To).
              </Typography>
            )}
            {to && !from && (
              <Typography variant='caption' color='text.secondary'>
                From is empty: activity includes all records through {to}.
              </Typography>
            )}

            {cash && (
              <Paper variant='outlined' className='p-4'>
                <Typography variant='subtitle1' className='mbe-2'>
                  Cash-style summary (period)
                </Typography>
                <Typography>Pharmacy collections: {formatPKR(cash.pharmacyCollectionsTotal)}</Typography>
                <Typography>Settlements in (distributor → company): {formatPKR(cash.settlementsInFromDistributors)}</Typography>
                <Typography>Settlements out (company → distributor): {formatPKR(cash.settlementsOutToDistributors)}</Typography>
                <Typography fontWeight={600} className='mt-2'>
                  Net movement: {formatPKR(cash.netCashStyleMovement)}
                </Typography>
                {cash.notes?.map((n: string, i: number) => (
                  <Typography key={i} variant='caption' display='block' color='text.secondary' className='mts-1'>
                    {n}
                  </Typography>
                ))}
              </Paper>
            )}

            {col && (
              <div>
                <Typography variant='subtitle1' className='mbe-1'>
                  Collections
                </Typography>
                <Typography variant='body2' className='mbe-2'>
                  Total {formatPKR(col.summary?.totalAmount)} ({col.summary?.count} records)
                </Typography>
                <div className='flex flex-wrap gap-2 mbe-2'>
                  {(col.byCollector || []).map((c: any) => (
                    <Chip key={c.collectorType} label={`${c.collectorType}: ${formatPKR(c.total)} (${c.count})`} size='small' variant='outlined' />
                  ))}
                </div>
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Pharmacy</TableCell>
                        <TableCell align='right'>Amount</TableCell>
                        <TableCell align='right'>Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(col.byPharmacy || []).map((x: any) => (
                        <TableRow key={x.pharmacyId}>
                          <TableCell>{x.pharmacyName}</TableCell>
                          <TableCell align='right'>{formatPKR(x.total)}</TableCell>
                          <TableCell align='right'>{x.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            )}

            {setl && (
              <div>
                <Typography variant='subtitle1' className='mbe-1'>
                  Settlements
                </Typography>
                <Typography variant='body2'>
                  Distributor → company: {formatPKR(setl.distributorToCompany?.total)} ({setl.distributorToCompany?.count}{' '}
                  items) · Company → distributor: {formatPKR(setl.companyToDistributor?.total)} (
                  {setl.companyToDistributor?.count} items)
                </Typography>
              </div>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={collectionOpen} onClose={closeCollectionDialog} maxWidth='sm' fullWidth>
        <DialogTitle>Record collection</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-1'>
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2'>{collectionPharmacy?.name}</Typography>
              {collectionPharmacy?.city && (
                <Typography variant='caption' color='text.secondary'>
                  {collectionPharmacy.city}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl>
                <FormLabel>Collection type</FormLabel>
                <RadioGroup
                  row
                  value={collectionForm.collectorType}
                  onChange={e => {
                    const nextCollector = e.target.value as 'COMPANY' | 'DISTRIBUTOR'
                    setSelectedCollectionDistributor(nextCollector === 'COMPANY' ? null : selectedCollectionDistributor)
                    setCollectionForm(p => ({
                      ...p,
                      collectorType: nextCollector,
                      distributorId: nextCollector === 'COMPANY' ? '' : p.distributorId
                    }))
                  }}
                >
                  <FormControlLabel value='COMPANY' control={<Radio />} label='Company' />
                  <FormControlLabel value='DISTRIBUTOR' control={<Radio />} label='Distributor' />
                </RadioGroup>
                <Typography variant='caption' color='text.secondary'>
                  Company means the company collected it. Distributor means the distributor collected it for the company.
                </Typography>
              </FormControl>
            </Grid>
            {needsCollectionDistributor && (
              <Grid size={{ xs: 12 }}>
                <LookupAutocomplete
                  value={selectedCollectionDistributor}
                  onChange={v => {
                    setSelectedCollectionDistributor(v)
                    setCollectionForm(p => ({ ...p, distributorId: v ? String(v._id) : '' }))
                  }}
                  fetchOptions={search =>
                    distributorsService
                      .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                      .then(r => r.data.data || [])
                  }
                  label='Distributor who collected'
                  placeholder='Type to search'
                  helperText='Collection will be applied to this distributor for the selected pharmacy'
                  required
                  fetchErrorMessage='Failed to load distributors'
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Amount (PKR)'
                type='number'
                value={collectionForm.amount}
                onChange={e => setCollectionForm(p => ({ ...p, amount: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MoneyAccountSelect
                required
                label='Deposit to (Cash/Bank account)'
                value={collectionForm.moneyAccountId}
                onChange={id => setCollectionForm(p => ({ ...p, moneyAccountId: id }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                select
                label='Payment method'
                value={collectionForm.paymentMethod}
                onChange={e => setCollectionForm(p => ({ ...p, paymentMethod: e.target.value }))}
              >
                <MenuItem value='CASH'>Cash</MenuItem>
                <MenuItem value='CHEQUE'>Cheque</MenuItem>
                <MenuItem value='BANK_TRANSFER'>Bank transfer</MenuItem>
                <MenuItem value='UPI'>UPI</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Reference number'
                value={collectionForm.referenceNumber}
                onChange={e => setCollectionForm(p => ({ ...p, referenceNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                rows={2}
                value={collectionForm.notes}
                onChange={e => setCollectionForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCollectionDialog} disabled={savingCollection}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleCollectionSubmit}
            disabled={savingCollection || !isCollectionFormValid}
            startIcon={savingCollection ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {savingCollection ? 'Saving...' : 'Record collection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={settlementOpen} onClose={closeSettlementDialog} maxWidth='sm' fullWidth>
        <DialogTitle>Record settlement</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-1'>
            <Grid size={{ xs: 12 }}>
              <Typography variant='subtitle2'>{settlementDistributor?.name}</Typography>
              {settlementDistributor?.city && (
                <Typography variant='caption' color='text.secondary'>
                  {settlementDistributor.city}
                </Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl>
                <FormLabel>Direction</FormLabel>
                <RadioGroup
                  value={settlementForm.direction}
                  onChange={e =>
                    setSettlementForm(p => ({
                      ...p,
                      direction: e.target.value as 'DISTRIBUTOR_TO_COMPANY' | 'COMPANY_TO_DISTRIBUTOR'
                    }))
                  }
                >
                  <FormControlLabel
                    value='DISTRIBUTOR_TO_COMPANY'
                    control={<Radio />}
                    label='Distributor pays company'
                  />
                  <FormControlLabel
                    value='COMPANY_TO_DISTRIBUTOR'
                    control={<Radio />}
                    label='Company pays distributor'
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Amount (PKR)'
                type='number'
                value={settlementForm.amount}
                onChange={e => setSettlementForm(p => ({ ...p, amount: +e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <MoneyAccountSelect
                required
                label={
                  settlementForm.direction === 'DISTRIBUTOR_TO_COMPANY'
                    ? 'Deposit to (Cash/Bank account)'
                    : 'Paid from (Cash/Bank account)'
                }
                helperText={
                  settlementForm.direction === 'DISTRIBUTOR_TO_COMPANY'
                    ? 'Which account received this settlement'
                    : 'Which account this settlement was paid from'
                }
                value={settlementForm.moneyAccountId}
                onChange={id => setSettlementForm(p => ({ ...p, moneyAccountId: id }))}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                select
                fullWidth
                label='Payment method'
                value={settlementForm.paymentMethod}
                onChange={e => setSettlementForm(p => ({ ...p, paymentMethod: e.target.value }))}
              >
                <MenuItem value='CASH'>Cash</MenuItem>
                <MenuItem value='CHEQUE'>Cheque</MenuItem>
                <MenuItem value='BANK_TRANSFER'>Bank transfer</MenuItem>
                <MenuItem value='UPI'>UPI</MenuItem>
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Reference number'
                value={settlementForm.referenceNumber}
                onChange={e => setSettlementForm(p => ({ ...p, referenceNumber: e.target.value }))}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                rows={2}
                value={settlementForm.notes}
                onChange={e => setSettlementForm(p => ({ ...p, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSettlementDialog} disabled={savingSettlement}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={handleSettlementSubmit}
            disabled={savingSettlement || !isSettlementFormValid}
            startIcon={savingSettlement ? <CircularProgress size={20} color='inherit' /> : undefined}
          >
            {savingSettlement ? 'Saving...' : 'Record settlement'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Distributor clearing detail</DialogTitle>
        <DialogContent>
          {loadingDetail ? (
            <div className='p-2'>
              <Skeleton variant='text' width='48%' height={26} animation='wave' />
              <Skeleton variant='text' width='65%' height={22} animation='wave' />
              <Skeleton variant='rounded' width='100%' height={180} animation='wave' />
            </div>
          ) : detailBody ? (
            <div className='flex flex-col gap-2 p-2'>
              <Typography fontWeight={600}>{detailBody.distributor?.name}</Typography>
              {detailBody.obligations && (
                <Paper variant='outlined' className='p-3 mbe-2'>
                  <Typography variant='subtitle2' className='mbe-1'>
                    Business obligations
                  </Typography>
                  <Typography variant='body2'>
                    Remittance due from distributor: {formatPKR(detailBody.obligations.remittanceDueFromDistributor)}
                  </Typography>
                  <Typography variant='body2'>
                    Commission payable to distributor:{' '}
                    {formatPKR(detailBody.obligations.commissionPayableByCompanyToDistributor)}
                  </Typography>
                </Paper>
              )}
              <Typography variant='body2'>
                Clearing net (DR−CR, all types): {formatPKR(detailBody.netDistributorOwesCompany)}
                {detailBody.netDistributorOwesCompany < 0 ? ' — company owes distributor' : ''}
                {detailBody.netDistributorOwesCompany > 0 ? ' — distributor owes company' : ''}
              </Typography>
              {detailBody.clearingHelp && (
                <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                  {detailBody.clearingHelp}
                </Typography>
              )}
              {detailBody.deliverySplit && (
                <Paper variant='outlined' className='p-3 mbe-2'>
                  <Typography variant='subtitle2' className='mbe-1'>
                    Legacy DELIVERY ledger postings
                  </Typography>
                  <Typography variant='body2'>
                    Company share (debit): {formatPKR(detailBody.deliverySplit.companyShareOnDeliveries)}
                  </Typography>
                  <Typography variant='body2'>
                    Distributor commission on TP (credit): {formatPKR(detailBody.deliverySplit.distributorCommissionOnTp)}
                  </Typography>
                  <Typography variant='caption' color='text.secondary' display='block' className='mts-1'>
                    {detailBody.deliverySplit.note}
                  </Typography>
                </Paper>
              )}
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Reference type</TableCell>
                    <TableCell align='right'>Debit</TableCell>
                    <TableCell align='right'>Credit</TableCell>
                    <TableCell align='right'>Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(detailBody.byReferenceType || []).map((r: any) => (
                    <TableRow key={r.referenceType}>
                      <TableCell>{r.referenceType}</TableCell>
                      <TableCell align='right'>{formatPKR(r.debit)}</TableCell>
                      <TableCell align='right'>{formatPKR(r.credit)}</TableCell>
                      <TableCell align='right'>{formatPKR(r.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default FinancialReportsSection
