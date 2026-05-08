'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { doctorsService } from '@/services/doctors.service'
import { reportsService } from '@/services/reports.service'
import { ordersService } from '@/services/orders.service'
import { showApiError } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fmtDay = (d: string | Date | null | undefined) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString()
  } catch {
    return '—'
  }
}

const daysSince = (d: string | Date | null | undefined): number | null => {
  if (!d) return null
  try {
    const t = new Date(d).getTime()
    if (Number.isNaN(t)) return null
    return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}

type CoverageRow = {
  actualVisits?: number
  target?: number | null
  lastVisitedAt?: string | null
  band?: string
  coverageStatus?: string
  ownershipKind?: string
  ownershipLabel?: string
}

/** MRep ownership + visit/sales/risk blocks on doctor detail (existing reports + list sampling only). */
export function DoctorOwnershipPanel({
  doctorId,
  active
}: {
  doctorId: string | null
  active: boolean
}) {
  const { user } = useAuth()
  const flags = user?.tenantCompanyFlags
  const month = useMemo(() => ymNow(), [])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<any>(null)
  const [covRow, setCovRow] = useState<CoverageRow | null>(null)
  const [orderStats, setOrderStats] = useState({ count: 0, revenue: 0 })
  const [auditPreview, setAuditPreview] = useState<any[] | null>(null)

  const load = useCallback(async () => {
    if (!doctorId || !active) return
    setLoading(true)
    setDetail(null)
    setCovRow(null)
    setOrderStats({ count: 0, revenue: 0 })
    setAuditPreview(null)
    try {
      const [dRes, ordRes] = await Promise.all([
        doctorsService.getById(doctorId),
        ordersService.list({ limit: '250' }).catch(() => null)
      ])
      const d = (dRes.data as any)?.data ?? dRes.data
      setDetail(d)

      const assignedRaw = d?.assignedRepId
      const assignedId =
        assignedRaw && typeof assignedRaw === 'object' ? (assignedRaw as { _id?: string })._id : assignedRaw

      const territoryRaw = d?.territoryId
      const territoryId =
        territoryRaw && typeof territoryRaw === 'object' ? (territoryRaw as { _id?: string })._id : territoryRaw

      let row: CoverageRow | null = null
      if (assignedId) {
        const cov = await reportsService.mrepDoctorCoverage({ month, repId: String(assignedId) })
        const doctors =
          (cov.data as any)?.data?.doctors ?? (cov.data as any)?.doctors ?? []
        if (Array.isArray(doctors)) {
          row = doctors.find((x: any) => String(x.doctorId) === String(doctorId)) ?? null
        }
      } else if (territoryId) {
        const tCov = await reportsService.mrepTerritoryCoverage({ month, territoryId: String(territoryId) })
        const doctors =
          (tCov.data as any)?.data?.doctors ?? (tCov.data as any)?.doctors ?? []
        if (Array.isArray(doctors)) {
          row = doctors.find((x: any) => String(x.doctorId) === String(doctorId)) ?? null
        }
      }
      setCovRow(row)

      if (ordRes?.data) {
        const docs = (ordRes.data as any)?.data ?? []
        const mine = Array.isArray(docs)
          ? docs.filter((o: any) => {
              const docId = o.doctorId && (typeof o.doctorId === 'object' ? o.doctorId._id : o.doctorId)
              return docId && String(docId) === String(doctorId)
            })
          : []
        const rev = mine.reduce((s: number, o: any) => s + (Number(o.totalOrderedAmount) || 0), 0)
        setOrderStats({ count: mine.length, revenue: rev })
      }

      if (flags?.mrepOwnershipAudit) {
        const h = await doctorsService.ownershipHistory(doctorId, { limit: 5 }).catch(() => null)
        if (h?.data) {
          const rows = (h.data as any)?.data ?? h.data
          setAuditPreview(Array.isArray(rows) ? rows : [])
        }
      }
    } catch (e) {
      showApiError(e, 'Could not load MRep intelligence for this doctor')
    } finally {
      setLoading(false)
    }
  }, [doctorId, active, month, flags?.mrepOwnershipAudit])

  useEffect(() => {
    void load()
  }, [load])

  const ownershipKind = useMemo(() => {
    if (!detail) return '—'
    if (detail.assignedRepId) return 'Assigned'
    if (detail.territoryId) return 'Territory-based'
    return 'Unassigned'
  }, [detail])

  const assignedName =
    detail?.assignedRepId && typeof detail.assignedRepId === 'object'
      ? String((detail.assignedRepId as { name?: string }).name ?? '—')
      : detail?.assignedRepId
        ? String(detail.assignedRepId)
        : '—'

  const territoryLabel =
    detail?.territoryId && typeof detail.territoryId === 'object'
      ? String((detail.territoryId as { name?: string }).name ?? '—')
      : detail?.territoryId
        ? String(detail.territoryId)
        : '—'

  const multiTerritoryNote = flags?.mrepMultiTerritory
    ? 'Multi-territory mode is on — confirm brick assignments when interpreting ownership.'
    : null

  const lastVisit = covRow?.lastVisitedAt
  const visitsMonth = covRow?.actualVisits
  const since = daysSince(lastVisit)
  const riskNoVisit =
    since != null && since > 14 ? `No visit recorded in ${since} days (rolling, from last visit in ${month}).` : null
  const below =
    covRow?.band === 'red' || (covRow?.coverageStatus && String(covRow.coverageStatus).toLowerCase().includes('below'))
      ? 'Below monthly visit target trajectory for this month (coverage band / status).'
      : null

  if (!active || !doctorId) return null

  return (
    <>
      <Grid size={{ xs: 12 }}>
        <Divider className='mbs-2 mbe-4' />
        <Typography variant='overline' color='text.secondary'>
          MRep intelligence ({month})
        </Typography>
      </Grid>

      {loading ? (
        <Grid size={{ xs: 12 }} className='flex justify-center p-4'>
          <CircularProgress size={28} />
        </Grid>
      ) : (
        <>
          <Grid size={{ xs: 12 }}>
            <Typography variant='subtitle2' className='mbe-2'>
              Ownership
            </Typography>
            <Stack spacing={1}>
              <Typography variant='body2'>
                <Typography component='span' color='text.secondary'>
                  Assigned rep:{' '}
                </Typography>
                {assignedName}
              </Typography>
              <Typography variant='body2'>
                <Typography component='span' color='text.secondary'>
                  Territory (brick linkage):{' '}
                </Typography>
                {territoryLabel}
              </Typography>
              <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
                <Typography variant='body2' color='text.secondary'>
                  Ownership type:
                </Typography>
                <Chip size='small' variant='tonal' label={ownershipKind} />
                {covRow?.ownershipLabel ? (
                  <Chip size='small' variant='outlined' label={covRow.ownershipLabel} />
                ) : null}
              </Stack>
              {multiTerritoryNote ? (
                <Typography variant='caption' color='text.secondary'>
                  {multiTerritoryNote}
                </Typography>
              ) : null}
              {flags?.mrepOwnershipAudit && auditPreview && auditPreview.length > 0 ? (
                <Typography variant='caption' color='text.secondary'>
                  Recent ownership events: {auditPreview.length} loaded (latest first in API).
                </Typography>
              ) : null}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='mbe-2'>
              Visit history (month)
            </Typography>
            <Typography variant='body2'>Last visit date: {fmtDay(lastVisit)}</Typography>
            <Typography variant='body2'>Total visits ({month}): {visitsMonth != null ? visitsMonth : '—'}</Typography>
            {covRow?.target != null ? (
              <Typography variant='body2' color='text.secondary'>
                Monthly target (doctor record): {covRow.target}
              </Typography>
            ) : null}
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant='subtitle2' className='mbe-2'>
              Sales (orders list sample)
            </Typography>
            <Typography variant='body2'>Orders linked (first 250 list page): {orderStats.count}</Typography>
            <Typography variant='body2'>Revenue (same sample): ₨ {orderStats.revenue.toLocaleString('en-PK')}</Typography>
            <Button component={Link} href='/orders/list' size='small' variant='text' className='mts-1 p-0'>
              Open orders
            </Button>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Typography variant='subtitle2' className='mbe-2'>
              Risk indicators
            </Typography>
            <Stack spacing={0.5}>
              {riskNoVisit ? (
                <Typography variant='body2' color='warning.main'>
                  {riskNoVisit}
                </Typography>
              ) : (
                <Typography variant='body2' color='text.secondary'>
                  No “stale visit” warning (or no last visit on record for this month slice).
                </Typography>
              )}
              {below ? (
                <Typography variant='body2' color='error.main'>
                  {below}
                </Typography>
              ) : null}
            </Stack>
          </Grid>
        </>
      )}
    </>
  )
}
