'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import TablePagination from '@mui/material/TablePagination'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import CustomTextField from '@core/components/mui/TextField'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError } from '@/utils/apiErrors'
import {
  collectionsService,
  type OutstandingGroupBy
} from '@/services/collections.service'
import { useDebouncedSearch } from '@/components/standard-list-toolbar'
import tableStyles from '@core/styles/table.module.css'

const formatPKR = (v: number | null | undefined) =>
  `PKR ${Number(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

type OutstandingRow = {
  key: string
  label: string
  outstanding: number
  invoiceCount: number
  pharmacyCount?: number
  medicalRepCount?: number
  medicalRepId?: string | null
  pharmacyId?: string | null
  areaId?: string | null
  zoneId?: string | null
  meta?: Record<string, unknown>
}

type Totals = {
  outstanding: number
  pharmacyCount: number
  invoiceCount: number
  medicalRepCount: number
}

type ViewerTier = 'mr' | 'asm' | 'rm' | 'admin'

function resolveViewerTier(user: ReturnType<typeof useAuth>['user'], hasPermission: (p: string) => boolean): ViewerTier {
  const code = user?.resolvedRole?.code || ''
  if (hasPermission('admin.access') || code === 'DEFAULT_ADMIN' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    return 'admin'
  }
  if (code === 'DEFAULT_RM') return 'rm'
  if (code === 'DEFAULT_ASM' || hasPermission('team.viewAllReports')) return 'asm'
  return 'mr'
}

function defaultGroupBy(tier: ViewerTier): OutstandingGroupBy {
  if (tier === 'rm') return 'area'
  if (tier === 'asm') return 'medicalRep'
  return 'pharmacy'
}

function groupByOptions(tier: ViewerTier): { value: OutstandingGroupBy; label: string }[] {
  if (tier === 'admin') {
    return [
      { value: 'zone', label: 'By zone' },
      { value: 'area', label: 'By area' },
      { value: 'medicalRep', label: 'By medical rep' },
      { value: 'pharmacy', label: 'By pharmacy' }
    ]
  }
  if (tier === 'rm') {
    return [
      { value: 'area', label: 'By area' },
      { value: 'medicalRep', label: 'By medical rep' },
      { value: 'pharmacy', label: 'By pharmacy' }
    ]
  }
  if (tier === 'asm') {
    return [
      { value: 'medicalRep', label: 'By medical rep' },
      { value: 'pharmacy', label: 'By pharmacy' }
    ]
  }
  return [{ value: 'pharmacy', label: 'By pharmacy' }]
}

function totalLabel(tier: ViewerTier) {
  if (tier === 'admin') return 'Organization outstanding'
  if (tier === 'rm') return 'Zone / team outstanding'
  if (tier === 'asm') return 'Team outstanding'
  return 'My outstanding'
}

const OutstandingCollectionsPage = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, hasPermission } = useAuth()
  const canCreate = hasPermission('payments.create')
  const tier = useMemo(() => resolveViewerTier(user, hasPermission), [user, hasPermission])

  const medicalRepId = searchParams.get('medicalRepId') || ''
  const areaId = searchParams.get('areaId') || ''
  const zoneId = searchParams.get('zoneId') || ''
  const groupByParam = searchParams.get('groupBy') as OutstandingGroupBy | null

  const [groupBy, setGroupBy] = useState<OutstandingGroupBy>(
    groupByParam && ['pharmacy', 'medicalRep', 'area', 'zone'].includes(groupByParam)
      ? groupByParam
      : defaultGroupBy(tier)
  )
  const { searchInput, setSearchInput, debouncedSearch } = useDebouncedSearch()
  const [rows, setRows] = useState<OutstandingRow[]>([])
  const [totals, setTotals] = useState<Totals>({
    outstanding: 0,
    pharmacyCount: 0,
    invoiceCount: 0,
    medicalRepCount: 0
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const fetchSeq = useRef(0)

  useEffect(() => {
    if (!groupByParam) setGroupBy(defaultGroupBy(tier))
  }, [tier, groupByParam])

  const updateQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      Object.entries(patch).forEach(([k, v]) => {
        if (v == null || v === '') next.delete(k)
        else next.set(k, v)
      })
      const qs = next.toString()
      router.push(qs ? `/payments/outstanding?${qs}` : '/payments/outstanding')
    },
    [router, searchParams]
  )

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const { data: res } = await collectionsService.outstanding({
        groupBy,
        search: debouncedSearch || undefined,
        medicalRepId: medicalRepId || undefined,
        areaId: areaId || undefined,
        zoneId: zoneId || undefined,
        page: page + 1,
        limit: rowsPerPage,
        sortBy: 'outstanding',
        sortOrder: 'desc'
      })
      if (seq !== fetchSeq.current) return
      const payload = res.data
      setRows(payload.rows || [])
      setTotals(
        payload.totals || {
          outstanding: 0,
          pharmacyCount: 0,
          invoiceCount: 0,
          medicalRepCount: 0
        }
      )
      setTotalRows(payload.pagination?.total || 0)
    } catch (e) {
      if (seq !== fetchSeq.current) return
      showApiError(e, 'Failed to load outstanding collections')
      setRows([])
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [groupBy, debouncedSearch, medicalRepId, areaId, zoneId, page, rowsPerPage])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const options = groupByOptions(tier)

  const onRowClick = (row: OutstandingRow) => {
    if (groupBy === 'pharmacy' && row.pharmacyId) {
      const q = medicalRepId ? `?medicalRepId=${encodeURIComponent(medicalRepId)}` : ''
      router.push(`/payments/outstanding/pharmacies/${row.pharmacyId}${q}`)
      return
    }
    if (groupBy === 'medicalRep' && row.medicalRepId) {
      updateQuery({
        medicalRepId: String(row.medicalRepId),
        groupBy: 'pharmacy',
        areaId: areaId || null,
        zoneId: zoneId || null
      })
      setGroupBy('pharmacy')
      setPage(0)
      return
    }
    if (groupBy === 'area' && row.areaId) {
      updateQuery({
        areaId: String(row.areaId),
        groupBy: 'medicalRep',
        medicalRepId: null,
        zoneId: zoneId || null
      })
      setGroupBy('medicalRep')
      setPage(0)
      return
    }
    if (groupBy === 'zone' && row.zoneId) {
      updateQuery({
        zoneId: String(row.zoneId),
        groupBy: 'area',
        areaId: null,
        medicalRepId: null
      })
      setGroupBy('area')
      setPage(0)
    }
  }

  const clearFilters = () => {
    setGroupBy(defaultGroupBy(tier))
    setPage(0)
    setSearchInput('')
    router.push('/payments/outstanding')
  }

  const hasDrillFilters = Boolean(medicalRepId || areaId || zoneId)

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title='Outstanding Collections'
          subheader='Track open receivables by order medical representative assignment'
          action={
            canCreate ? (
              <Button variant='contained' onClick={() => router.push('/payments/add')}>
                Record Collection
              </Button>
            ) : null
          }
        />
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} mb={2}>
            <Box flex={1}>
              <Typography variant='overline' color='text.secondary'>
                {totalLabel(tier)}
              </Typography>
              <Typography variant='h4'>{loading ? '…' : formatPKR(totals.outstanding)}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {totals.pharmacyCount} pharmacies · {totals.invoiceCount} invoices · {totals.medicalRepCount} reps
              </Typography>
            </Box>
            <CustomTextField
              select
              label='Group by'
              value={groupBy}
              onChange={e => {
                const next = e.target.value as OutstandingGroupBy
                setGroupBy(next)
                setPage(0)
                updateQuery({ groupBy: next })
              }}
              sx={{ minWidth: 200 }}
            >
              {options.map(o => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </CustomTextField>
            <CustomTextField
              label='Search'
              value={searchInput}
              onChange={e => {
                setSearchInput(e.target.value)
                setPage(0)
              }}
              sx={{ minWidth: 220 }}
            />
          </Stack>

          {hasDrillFilters ? (
            <Stack direction='row' spacing={1} alignItems='center' mb={2} flexWrap='wrap' useFlexGap>
              <Breadcrumbs>
                <Link component='button' underline='hover' color='inherit' onClick={clearFilters}>
                  All
                </Link>
                {zoneId ? <Typography color='text.primary'>Zone</Typography> : null}
                {areaId ? <Typography color='text.primary'>Area</Typography> : null}
                {medicalRepId ? <Typography color='text.primary'>Medical rep</Typography> : null}
              </Breadcrumbs>
              <Button size='small' onClick={clearFilters}>
                Clear filters
              </Button>
            </Stack>
          ) : null}

          <Typography variant='caption' color='text.secondary' display='block' mb={2}>
            Amounts are open FIFO balances on invoices for orders assigned to medical reps in your scope. A pharmacy may
            show only your portion when other reps also have open invoices there.
          </Typography>

          {loading ? (
            <Stack alignItems='center' py={6}>
              <CircularProgress />
            </Stack>
          ) : rows.length === 0 ? (
            <Typography color='text.secondary' py={4}>
              No outstanding collections in scope.
            </Typography>
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>{groupBy === 'pharmacy' ? 'Pharmacy' : groupBy === 'medicalRep' ? 'Medical rep' : groupBy === 'area' ? 'Area' : 'Zone'}</th>
                      <th style={{ textAlign: 'right' }}>Outstanding</th>
                      <th style={{ textAlign: 'right' }}>Invoices</th>
                      {groupBy !== 'pharmacy' ? <th style={{ textAlign: 'right' }}>Pharmacies</th> : null}
                      {groupBy === 'pharmacy' || groupBy === 'area' || groupBy === 'zone' ? (
                        <th style={{ textAlign: 'right' }}>Reps</th>
                      ) : null}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr
                        key={row.key}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onRowClick(row)}
                      >
                        <td>
                          <Typography fontWeight={600}>{row.label}</Typography>
                          {groupBy === 'pharmacy' && row.meta?.city ? (
                            <Typography variant='caption' color='text.secondary'>
                              {String(row.meta.city)}
                            </Typography>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Chip size='small' color='warning' label={formatPKR(row.outstanding)} />
                        </td>
                        <td style={{ textAlign: 'right' }}>{row.invoiceCount}</td>
                        {groupBy !== 'pharmacy' ? (
                          <td style={{ textAlign: 'right' }}>{row.pharmacyCount ?? 0}</td>
                        ) : null}
                        {groupBy === 'pharmacy' || groupBy === 'area' || groupBy === 'zone' ? (
                          <td style={{ textAlign: 'right' }}>{row.medicalRepCount ?? 0}</td>
                        ) : null}
                        <td style={{ textAlign: 'right' }}>
                          <Button size='small' onClick={e => { e.stopPropagation(); onRowClick(row) }}>
                            Open
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                component='div'
                count={totalRows}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={e => {
                  setRowsPerPage(parseInt(e.target.value, 10))
                  setPage(0)
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
          )}
        </CardContent>
      </Card>
    </Stack>
  )
}

export default OutstandingCollectionsPage
