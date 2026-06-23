'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { useAuth } from '@/contexts/AuthContext'
import { superAdminService } from '@/services/superAdmin.service'
import { showApiError } from '@/utils/apiErrors'
import { allIanaTimeZones, countryCodeFromLabel, suggestTimeZoneForCountry } from '@/constants/countryTimeZones'

type Company = {
  _id: string
  name: string
  city?: string
  phone?: string
  email?: string
  country?: string
  state?: string
  address?: string
  /** Pakistan FBR National Tax Number — shown on printed invoices. */
  ntnNo?: string
  currency?: string
  timeZone?: string
  isActive?: boolean
  /** When true, new weekly plans inherit approvalRequired and must be submitted before execution. */
  weeklyPlanApprovalRequired?: boolean
  /** When true, field visits must follow planned sequence (company override; env can still force globally). */
  strictVisitSequence?: boolean
  /** Allow additional `coverageTerritoryIds` on users (unioned with primary territory for coverage). */
  mrepMultiTerritory?: boolean
  /** Append DoctorOwnershipEvent rows when doctor territory/rep assignment changes. */
  mrepOwnershipAudit?: boolean
  /** When true, checked-in mobile reps send GPS heartbeats; managers see live tracking on web/mobile. */
  liveTrackingEnabled?: boolean
  /** When true, mobile app registers Expo push tokens and backend sends push for in-app notifications. */
  mobilePushEnabled?: boolean
  /** When true, each field-force rep is bound to one mobile device; switches require admin approval. */
  deviceControlEnabled?: boolean
  /** When true, field rep expenses stay PENDING until a manager approves (mobile + web). */
  expenseApprovalRequired?: boolean
  geoFencingEnabled?: boolean
  geoFenceRadiusMeters?: number
  geoFenceMode?: 'OFF' | 'SOFT' | 'STRICT'
  onboardingEnabled?: boolean
  onboardingStrictValidation?: boolean
  onboardingKillSwitch?: boolean
  onboardingPilotCohort?: string
  /** Super Admin: LEGACY (default) or CHECKIN_POLICY_V2 */
  attendanceSystemMode?: 'LEGACY' | 'CHECKIN_POLICY_V2'
  checkInPolicy?: {
    type?: string
    latitude?: number
    longitude?: number
    radiusMeters?: number
    locationName?: string
  }
  /** Per-company temporary-file retention (days). null = never delete. */
  mediaRetention?: {
    checkinRetentionDays?: number | null
    visitRetentionDays?: number | null
    expenseReceiptRetentionDays?: number | null
  }
  createdAt?: string
}

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function attendancePolicyPayload(form: CompanyFormState): {
  attendanceSystemMode: 'LEGACY' | 'CHECKIN_POLICY_V2'
  checkInPolicy?: {
    type: 'COMPANY_DEFAULT'
    latitude: number
    longitude: number
    radiusMeters: number
    locationName: string
  }
} {
  const out: {
    attendanceSystemMode: 'LEGACY' | 'CHECKIN_POLICY_V2'
    checkInPolicy?: {
      type: 'COMPANY_DEFAULT'
      latitude: number
      longitude: number
      radiusMeters: number
      locationName: string
    }
  } = { attendanceSystemMode: form.attendanceSystemMode }
  if (form.attendanceSystemMode === 'CHECKIN_POLICY_V2') {
    const lat = Number(form.checkInLatitude)
    const lng = Number(form.checkInLongitude)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.checkInPolicy = {
        type: 'COMPANY_DEFAULT',
        latitude: lat,
        longitude: lng,
        radiusMeters: form.checkInRadiusMeters || 150,
        locationName: form.checkInLocationName.trim()
      }
    }
  }
  return out
}

/**
 * Build the mediaRetention payload from form strings. Empty string = "never
 * delete" (null). Otherwise a positive integer number of days.
 */
function mediaRetentionPayload(form: CompanyFormState): {
  mediaRetention: {
    checkinRetentionDays: number | null
    visitRetentionDays: number | null
    expenseReceiptRetentionDays: number | null
  }
} {
  const parse = (v: string): number | null => {
    const t = v.trim()

    if (t === '') return null
    const n = Math.floor(Number(t))

    return Number.isFinite(n) && n > 0 ? n : null
  }

  return {
    mediaRetention: {
      checkinRetentionDays: parse(form.checkinRetentionDays),
      visitRetentionDays: parse(form.visitRetentionDays),
      expenseReceiptRetentionDays: parse(form.expenseReceiptRetentionDays)
    }
  }
}

type GeoFenceMode = 'OFF' | 'SOFT' | 'STRICT'

type CompanyFormState = {
  name: string
  address: string
  city: string
  state: string
  country: string
  phone: string
  ntnNo: string
  email: string
  currency: string
  timeZone: string
  isActive: boolean
  weeklyPlanApprovalRequired: boolean
  strictVisitSequence: boolean
  mrepMultiTerritory: boolean
  mrepOwnershipAudit: boolean
  liveTrackingEnabled: boolean
  mobilePushEnabled: boolean
  deviceControlEnabled: boolean
  expenseApprovalRequired: boolean
  geoFencingEnabled: boolean
  geoFenceRadiusMeters: number
  geoFenceMode: GeoFenceMode
  onboardingEnabled: boolean
  onboardingStrictValidation: boolean
  onboardingKillSwitch: boolean
  onboardingPilotCohort: string
  attendanceSystemMode: 'LEGACY' | 'CHECKIN_POLICY_V2'
  checkInLocationName: string
  checkInLatitude: string
  checkInLongitude: string
  checkInRadiusMeters: number
  /** Retention days as strings ('' = never delete). */
  checkinRetentionDays: string
  visitRetentionDays: string
  expenseReceiptRetentionDays: string
}

const emptyForm: CompanyFormState = {
  name: '',
  address: '',
  city: '',
  state: '',
  country: 'Pakistan',
  phone: '',
  ntnNo: '',
  email: '',
  currency: 'PKR',
  timeZone: '',
  isActive: true,
  weeklyPlanApprovalRequired: false,
  strictVisitSequence: false,
  mrepMultiTerritory: false,
  mrepOwnershipAudit: false,
  liveTrackingEnabled: false,
  mobilePushEnabled: false,
  deviceControlEnabled: false,
  expenseApprovalRequired: false,
  geoFencingEnabled: false,
  geoFenceRadiusMeters: 150,
  geoFenceMode: 'OFF',
  onboardingEnabled: false,
  onboardingStrictValidation: false,
  onboardingKillSwitch: false,
  onboardingPilotCohort: '',
  attendanceSystemMode: 'LEGACY',
  checkInLocationName: '',
  checkInLatitude: '',
  checkInLongitude: '',
  checkInRadiusMeters: 150,
  checkinRetentionDays: '',
  visitRetentionDays: '',
  expenseReceiptRetentionDays: ''
}

/**
 * Retention Policy editor. Per temporary-media type, a day count or empty for
 * "Never delete". Empty = files are kept forever (production-safe default).
 */
const RetentionPolicyFields = ({
  form,
  setForm
}: {
  form: CompanyFormState
  setForm: Dispatch<SetStateAction<CompanyFormState>>
}) => {
  const fields: { key: keyof CompanyFormState; label: string }[] = [
    { key: 'checkinRetentionDays', label: 'Check-in images (days)' },
    { key: 'visitRetentionDays', label: 'Visit images (days)' },
    { key: 'expenseReceiptRetentionDays', label: 'Expense receipts (days)' }
  ]

  return (
    <>
      <Typography variant='subtitle2' sx={{ mt: 3, mb: 0.5 }}>
        Media Retention Policy
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1 }}>
        Temporary files are auto-deleted after the set number of days. Leave a field blank to never delete.
        Permanent media (product/doctor/pharmacy/profile images) is never affected.
      </Typography>
      {fields.map(f => (
        <TextField
          key={String(f.key)}
          label={f.label}
          type='number'
          fullWidth
          margin='normal'
          value={form[f.key] as string}
          onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
          placeholder='Never delete'
          helperText={(form[f.key] as string).trim() === '' ? 'Never delete' : undefined}
          inputProps={{ min: 1, max: 3650 }}
        />
      ))}
    </>
  )
}

const SuperAdminPage = () => {
  const router = useRouter()
  const { switchCompanyContext } = useAuth()
  const [rows, setRows] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CompanyFormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [summaryCompany, setSummaryCompany] = useState<Company | null>(null)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const ianaZones = useMemo(() => allIanaTimeZones(), [])
  const suggestedFromCountry = useMemo(() => {
    const code = countryCodeFromLabel(form.country) || ''
    return (code && suggestTimeZoneForCountry(code)) || ''
  }, [form.country])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await superAdminService.listCompanies({ limit: 100, page: 1 })
      setRows(data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setCreateOpen(true)
  }

  const openEdit = (c: Company) => {
    setEditingId(c._id)
    setForm({
      name: c.name,
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      country: c.country || 'Pakistan',
      phone: c.phone || '',
      ntnNo: c.ntnNo || '',
      email: c.email || '',
      currency: c.currency || 'PKR',
      timeZone: c.timeZone || '',
      isActive: c.isActive !== false,
      weeklyPlanApprovalRequired: c.weeklyPlanApprovalRequired === true,
      strictVisitSequence: c.strictVisitSequence === true,
      mrepMultiTerritory: c.mrepMultiTerritory === true,
      mrepOwnershipAudit: c.mrepOwnershipAudit === true,
      liveTrackingEnabled: c.liveTrackingEnabled === true,
      mobilePushEnabled: c.mobilePushEnabled === true,
      deviceControlEnabled: c.deviceControlEnabled === true,
      expenseApprovalRequired: c.expenseApprovalRequired === true,
      geoFencingEnabled: c.geoFencingEnabled === true,
      geoFenceRadiusMeters: c.geoFenceRadiusMeters ?? 150,
      geoFenceMode: c.geoFenceMode === 'SOFT' || c.geoFenceMode === 'STRICT' ? c.geoFenceMode : 'OFF',
      onboardingEnabled: c.onboardingEnabled === true,
      onboardingStrictValidation: c.onboardingStrictValidation === true,
      onboardingKillSwitch: c.onboardingKillSwitch === true,
      onboardingPilotCohort: c.onboardingPilotCohort || '',
      attendanceSystemMode:
        c.attendanceSystemMode === 'CHECKIN_POLICY_V2' ? 'CHECKIN_POLICY_V2' : 'LEGACY',
      checkInLocationName: c.checkInPolicy?.locationName || '',
      checkInLatitude:
        c.checkInPolicy?.latitude != null ? String(c.checkInPolicy.latitude) : '',
      checkInLongitude:
        c.checkInPolicy?.longitude != null ? String(c.checkInPolicy.longitude) : '',
      checkInRadiusMeters: c.checkInPolicy?.radiusMeters ?? 150,
      checkinRetentionDays:
        c.mediaRetention?.checkinRetentionDays != null ? String(c.mediaRetention.checkinRetentionDays) : '',
      visitRetentionDays:
        c.mediaRetention?.visitRetentionDays != null ? String(c.mediaRetention.visitRetentionDays) : '',
      expenseReceiptRetentionDays:
        c.mediaRetention?.expenseReceiptRetentionDays != null
          ? String(c.mediaRetention.expenseReceiptRetentionDays)
          : ''
    })
    setEditOpen(true)
  }

  const submitCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await superAdminService.createCompany({
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        phone: form.phone,
        ntnNo: form.ntnNo,
        email: form.email.trim() || undefined,
        currency: form.currency,
        timeZone: form.timeZone.trim() || undefined,
        isActive: form.isActive,
        weeklyPlanApprovalRequired: form.weeklyPlanApprovalRequired,
        strictVisitSequence: form.strictVisitSequence,
        mrepMultiTerritory: form.mrepMultiTerritory,
        mrepOwnershipAudit: form.mrepOwnershipAudit,
        liveTrackingEnabled: form.liveTrackingEnabled,
        mobilePushEnabled: form.mobilePushEnabled,
        deviceControlEnabled: form.deviceControlEnabled,
        expenseApprovalRequired: form.expenseApprovalRequired,
        geoFencingEnabled: form.geoFencingEnabled,
        geoFenceRadiusMeters: form.geoFenceRadiusMeters,
        geoFenceMode: form.geoFenceMode,
        onboardingEnabled: form.onboardingEnabled,
        onboardingStrictValidation: form.onboardingStrictValidation,
        onboardingKillSwitch: form.onboardingKillSwitch,
        onboardingPilotCohort: form.onboardingPilotCohort,
        ...attendancePolicyPayload(form),
        ...mediaRetentionPayload(form)
      })
      setCreateOpen(false)
      await load()
    } catch (e) {
      showApiError(e, 'Create failed')
    } finally {
      setSaving(false)
    }
  }

  const submitEdit = async () => {
    if (!editingId || !form.name.trim()) return
    setSaving(true)
    try {
      await superAdminService.updateCompany(editingId, {
        name: form.name,
        address: form.address,
        city: form.city,
        state: form.state,
        country: form.country,
        phone: form.phone,
        ntnNo: form.ntnNo,
        email: form.email.trim() || undefined,
        currency: form.currency,
        timeZone: form.timeZone.trim(),
        isActive: form.isActive,
        weeklyPlanApprovalRequired: form.weeklyPlanApprovalRequired,
        strictVisitSequence: form.strictVisitSequence,
        mrepMultiTerritory: form.mrepMultiTerritory,
        mrepOwnershipAudit: form.mrepOwnershipAudit,
        liveTrackingEnabled: form.liveTrackingEnabled,
        mobilePushEnabled: form.mobilePushEnabled,
        deviceControlEnabled: form.deviceControlEnabled,
        expenseApprovalRequired: form.expenseApprovalRequired,
        geoFencingEnabled: form.geoFencingEnabled,
        geoFenceRadiusMeters: form.geoFenceRadiusMeters,
        geoFenceMode: form.geoFenceMode,
        onboardingEnabled: form.onboardingEnabled,
        onboardingStrictValidation: form.onboardingStrictValidation,
        onboardingKillSwitch: form.onboardingKillSwitch,
        onboardingPilotCohort: form.onboardingPilotCohort,
        ...attendancePolicyPayload(form),
        ...mediaRetentionPayload(form)
      })
      setEditOpen(false)
      await load()
    } catch (e) {
      showApiError(e, 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const openSummary = async (c: Company) => {
    setSummaryCompany(c)
    setSummaryData(null)
    setSummaryOpen(true)
    setSummaryLoading(true)
    try {
      const { data } = await superAdminService.getCompanySummary(c._id)
      setSummaryData(data.data)
    } catch (e) {
      showApiError(e, 'Failed to load summary')
    } finally {
      setSummaryLoading(false)
    }
  }

  const enterCompany = async (c: Company) => {
    try {
      await switchCompanyContext(c._id)
      router.push('/home')
    } catch (e) {
      showApiError(e, 'Could not enter company context')
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Super Admin Dashboard'
            subheader='Manage tenant companies and choose which organization you operate in.'
            action={
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
                Create Company
              </Button>
            }
          />
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-2 items-center'>
              <Chip color='warning' variant='tonal' label='SUPER ADMIN MODE' size='small' />
              <Typography variant='body2' color='text.secondary'>
                Business APIs use your selected company context only — never pass company id from the client for data queries.
              </Typography>
            </div>

            <TableContainer component={Paper} variant='outlined'>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Company</TableCell>
                    <TableCell>City</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton animation='wave' height={36} />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map(row => (
                        <TableRow key={row._id} hover>
                          <TableCell>
                            <Typography fontWeight={600}>{row.name}</Typography>
                            {row.email ? (
                              <Typography variant='caption' color='text.secondary' display='block'>
                                {row.email}
                              </Typography>
                            ) : null}
                            <Stack direction='row' flexWrap='wrap' useFlexGap spacing={0.75} sx={{ mt: 0.75 }}>
                              {row.weeklyPlanApprovalRequired ? (
                                <Chip size='small' label='Weekly plan approval' color='info' variant='outlined' />
                              ) : null}
                              {row.strictVisitSequence ? (
                                <Chip size='small' label='Strict visit sequence' color='warning' variant='outlined' />
                              ) : null}
                              {row.mrepMultiTerritory ? (
                                <Chip size='small' label='Multi-territory' color='success' variant='outlined' />
                              ) : null}
                              {row.mrepOwnershipAudit ? (
                                <Chip size='small' label='Ownership audit' color='secondary' variant='outlined' />
                              ) : null}
                              {row.liveTrackingEnabled ? (
                                <Chip size='small' label='Live tracking' color='primary' variant='outlined' />
                              ) : null}
                              {row.mobilePushEnabled ? (
                                <Chip size='small' label='Mobile push' color='primary' variant='outlined' />
                              ) : null}
                              {row.expenseApprovalRequired ? (
                                <Chip size='small' label='Expense approval' color='warning' variant='outlined' />
                              ) : null}
                              {row.geoFencingEnabled ? (
                                <Chip
                                  size='small'
                                  label={`Geo-fence ${row.geoFenceMode || 'OFF'}`}
                                  color='info'
                                  variant='outlined'
                                />
                              ) : null}
                              {row.onboardingEnabled ? (
                                <Chip size='small' label='Onboarding enabled' color='success' variant='outlined' />
                              ) : null}
                              {row.onboardingKillSwitch ? (
                                <Chip size='small' label='Onboarding kill switch' color='error' variant='outlined' />
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>{row.city || '—'}</TableCell>
                          <TableCell>{row.phone || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              label={row.isActive === false ? 'Inactive' : 'Active'}
                              color={row.isActive === false ? 'default' : 'success'}
                              variant='tonal'
                            />
                          </TableCell>
                          <TableCell>
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleDateString('en-PK', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })
                              : '—'}
                          </TableCell>
                          <TableCell align='right'>
                            <Button size='small' variant='tonal' className='mie-2' onClick={() => enterCompany(row)}>
                              Enter company
                            </Button>
                            <Button size='small' variant='outlined' className='mie-2' onClick={() => openSummary(row)}>
                              View summary
                            </Button>
                            <Button size='small' variant='text' onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!loading && rows.length === 0 ? (
              <Typography color='text.secondary' className='text-center p-4'>
                No companies yet. Create one to get started.
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </Grid>

      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create company</DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            required
            label='Name'
            fullWidth
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Address'
            fullWidth
            multiline
            minRows={2}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='City'
            fullWidth
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='State'
            fullWidth
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Country'
            fullWidth
            value={form.country}
            onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            margin='normal'
          />
          {suggestedFromCountry ? (
            <Typography variant='caption' color='text.secondary' display='block' className='-mt-2 mbe-2'>
              Default IANA from country: <strong>{suggestedFromCountry}</strong> (leave override empty to use this)
            </Typography>
          ) : null}
          <Autocomplete
            options={ianaZones}
            value={form.timeZone.trim() || null}
            onChange={(_, v) => setForm(f => ({ ...f, timeZone: v || '' }))}
            renderInput={params => (
              <TextField {...params} label='IANA timezone override' margin='normal' placeholder='Optional' />
            )}
          />
          <TextField
            label='Phone'
            fullWidth
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Email'
            type='email'
            fullWidth
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='NTN No.'
            fullWidth
            value={form.ntnNo}
            onChange={e => setForm(f => ({ ...f, ntnNo: e.target.value }))}
            margin='normal'
            helperText='National Tax Number (Pakistan FBR) — printed on delivery invoices'
          />
          <TextField
            select
            label='Currency'
            fullWidth
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            margin='normal'
          >
            <MenuItem value='PKR'>PKR</MenuItem>
            <MenuItem value='USD'>USD</MenuItem>
            <MenuItem value='EUR'>EUR</MenuItem>
          </TextField>
          <TextField
            select
            label='Status'
            fullWidth
            value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}
            margin='normal'
          >
            <MenuItem value='true'>Active</MenuItem>
            <MenuItem value='false'>Inactive</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={form.weeklyPlanApprovalRequired}
                onChange={e => setForm(f => ({ ...f, weeklyPlanApprovalRequired: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Require weekly plan approval
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  New plans must be submitted and approved by a manager before they become active. Existing plans are
                  unchanged.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            select
            label='Attendance system mode'
            fullWidth
            value={form.attendanceSystemMode}
            onChange={e =>
              setForm(f => ({
                ...f,
                attendanceSystemMode: e.target.value as 'LEGACY' | 'CHECKIN_POLICY_V2'
              }))
            }
            margin='normal'
            helperText='Legacy keeps current check-in behavior. V2 enables company default + weekly plan check-in policies (informational zone only).'
          >
            <MenuItem value='LEGACY'>Legacy system (current behavior)</MenuItem>
            <MenuItem value='CHECKIN_POLICY_V2'>Check-in policy V2 (new system)</MenuItem>
          </TextField>
          {form.attendanceSystemMode === 'CHECKIN_POLICY_V2' ? (
            <>
              <TextField
                label='Default check-in location name'
                fullWidth
                value={form.checkInLocationName}
                onChange={e => setForm(f => ({ ...f, checkInLocationName: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default latitude'
                fullWidth
                value={form.checkInLatitude}
                onChange={e => setForm(f => ({ ...f, checkInLatitude: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default longitude'
                fullWidth
                value={form.checkInLongitude}
                onChange={e => setForm(f => ({ ...f, checkInLongitude: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default radius (meters)'
                type='number'
                fullWidth
                value={form.checkInRadiusMeters}
                onChange={e =>
                  setForm(f => ({ ...f, checkInRadiusMeters: Number(e.target.value) || 150 }))
                }
                margin='normal'
              />
            </>
          ) : null}
          <FormControlLabel
            control={
              <Switch
                checked={form.strictVisitSequence}
                onChange={e => setForm(f => ({ ...f, strictVisitSequence: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Strict visit sequence
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Reps must complete today’s route in planned order (out-of-order visits are blocked unless an admin
                  edits the plan).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mrepMultiTerritory}
                onChange={e => setForm(f => ({ ...f, mrepMultiTerritory: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Multi-territory users
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Enables optional extra territory nodes per user (`coverageTerritoryIds`), unioned with the primary
                  territory for doctor ownership queries.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mrepOwnershipAudit}
                onChange={e => setForm(f => ({ ...f, mrepOwnershipAudit: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Doctor ownership audit trail
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Records assignment changes (territory / pinned rep) for compliance and handovers.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.liveTrackingEnabled}
                onChange={e => setForm(f => ({ ...f, liveTrackingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Live tracking
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Checked-in field reps send periodic GPS pings on mobile; managers view locations on web and mobile
                  (People &amp; Operations → Team → Live tracking).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mobilePushEnabled}
                onChange={e => setForm(f => ({ ...f, mobilePushEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Mobile push notifications
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, the mobile app registers device tokens and sends push alerts for approvals,
                  expenses, announcements, and late check-ins (requires Expo push credentials on the server).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.deviceControlEnabled}
                onChange={e => setForm(f => ({ ...f, deviceControlEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Device control (single mobile device)
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, each field-force rep is locked to one mobile device. Logins from a different
                  device are blocked until an admin approves a device change (Device Control page). Web logins
                  are never affected.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.expenseApprovalRequired}
                onChange={e => setForm(f => ({ ...f, expenseApprovalRequired: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Expense approval required
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, field rep expenses from mobile and web stay PENDING until a manager approves
                  them and selects the paid-from money account.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.geoFencingEnabled}
                onChange={e => setForm(f => ({ ...f, geoFencingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Visit geo-fencing
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, verified doctors use GPS radius checks on visit completion (SOFT logs warnings, STRICT
                  blocks).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            select
            label='Geo-fence mode'
            fullWidth
            value={form.geoFenceMode}
            onChange={e =>
              setForm(f => ({ ...f, geoFenceMode: e.target.value as GeoFenceMode }))
            }
            margin='normal'
            disabled={!form.geoFencingEnabled}
            helperText='Only applies to doctors with verified locations.'
          >
            <MenuItem value='OFF'>Off</MenuItem>
            <MenuItem value='SOFT'>Soft — allow visit, log outside radius</MenuItem>
            <MenuItem value='STRICT'>Strict — block visit outside radius</MenuItem>
          </TextField>
          <TextField
            label='Geo-fence radius (meters)'
            type='number'
            fullWidth
            value={form.geoFenceRadiusMeters}
            onChange={e => setForm(f => ({ ...f, geoFenceRadiusMeters: Number(e.target.value) || 150 }))}
            margin='normal'
            disabled={!form.geoFencingEnabled}
            inputProps={{ min: 25, max: 5000 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingEnabled}
                onChange={e => setForm(f => ({ ...f, onboardingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label='Enable onboarding module'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingStrictValidation}
                onChange={e => setForm(f => ({ ...f, onboardingStrictValidation: e.target.checked }))}
                color='primary'
              />
            }
            label='Strict onboarding validation'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingKillSwitch}
                onChange={e => setForm(f => ({ ...f, onboardingKillSwitch: e.target.checked }))}
                color='error'
              />
            }
            label='Onboarding kill switch'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            label='Onboarding pilot cohort'
            fullWidth
            value={form.onboardingPilotCohort}
            onChange={e => setForm(f => ({ ...f, onboardingPilotCohort: e.target.value }))}
            margin='normal'
            helperText='Example: cohort-a, wave-2, enterprise-beta'
          />
          <RetentionPolicyFields form={form} setForm={setForm} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submitCreate} disabled={saving || !form.name.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => !saving && setEditOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Edit company</DialogTitle>
        <DialogContent className='flex flex-col gap-4'>
          <TextField
            required
            label='Name'
            fullWidth
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Address'
            fullWidth
            multiline
            minRows={2}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='City'
            fullWidth
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='State'
            fullWidth
            value={form.state}
            onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Country'
            fullWidth
            value={form.country}
            onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            margin='normal'
          />
          {suggestedFromCountry ? (
            <Typography variant='caption' color='text.secondary' display='block' className='-mt-2 mbe-2'>
              Default IANA from country: <strong>{suggestedFromCountry}</strong>
            </Typography>
          ) : null}
          <Autocomplete
            options={ianaZones}
            value={form.timeZone.trim() || null}
            onChange={(_, v) => setForm(f => ({ ...f, timeZone: v || '' }))}
            renderInput={params => (
              <TextField {...params} label='IANA timezone override' margin='normal' placeholder='Optional' />
            )}
          />
          <TextField
            label='Phone'
            fullWidth
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='Email'
            type='email'
            fullWidth
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            margin='normal'
          />
          <TextField
            label='NTN No.'
            fullWidth
            value={form.ntnNo}
            onChange={e => setForm(f => ({ ...f, ntnNo: e.target.value }))}
            margin='normal'
            helperText='National Tax Number (Pakistan FBR) — printed on delivery invoices'
          />
          <TextField
            select
            label='Currency'
            fullWidth
            value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
            margin='normal'
          >
            <MenuItem value='PKR'>PKR</MenuItem>
            <MenuItem value='USD'>USD</MenuItem>
            <MenuItem value='EUR'>EUR</MenuItem>
          </TextField>
          <TextField
            select
            label='Status'
            fullWidth
            value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}
            margin='normal'
          >
            <MenuItem value='true'>Active</MenuItem>
            <MenuItem value='false'>Inactive</MenuItem>
          </TextField>
          <FormControlLabel
            control={
              <Switch
                checked={form.weeklyPlanApprovalRequired}
                onChange={e => setForm(f => ({ ...f, weeklyPlanApprovalRequired: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Require weekly plan approval
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When on, new weekly plans need manager submit/approve. Plans already created keep their current
                  workflow.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            select
            label='Attendance system mode'
            fullWidth
            value={form.attendanceSystemMode}
            onChange={e =>
              setForm(f => ({
                ...f,
                attendanceSystemMode: e.target.value as 'LEGACY' | 'CHECKIN_POLICY_V2'
              }))
            }
            margin='normal'
            helperText='Legacy keeps current check-in behavior. V2 enables company default + weekly plan check-in policies (informational zone only).'
          >
            <MenuItem value='LEGACY'>Legacy system (current behavior)</MenuItem>
            <MenuItem value='CHECKIN_POLICY_V2'>Check-in policy V2 (new system)</MenuItem>
          </TextField>
          {form.attendanceSystemMode === 'CHECKIN_POLICY_V2' ? (
            <>
              <TextField
                label='Default check-in location name'
                fullWidth
                value={form.checkInLocationName}
                onChange={e => setForm(f => ({ ...f, checkInLocationName: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default latitude'
                fullWidth
                value={form.checkInLatitude}
                onChange={e => setForm(f => ({ ...f, checkInLatitude: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default longitude'
                fullWidth
                value={form.checkInLongitude}
                onChange={e => setForm(f => ({ ...f, checkInLongitude: e.target.value }))}
                margin='normal'
              />
              <TextField
                label='Default radius (meters)'
                type='number'
                fullWidth
                value={form.checkInRadiusMeters}
                onChange={e =>
                  setForm(f => ({ ...f, checkInRadiusMeters: Number(e.target.value) || 150 }))
                }
                margin='normal'
              />
            </>
          ) : null}
          <FormControlLabel
            control={
              <Switch
                checked={form.strictVisitSequence}
                onChange={e => setForm(f => ({ ...f, strictVisitSequence: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Strict visit sequence
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Reps must complete today’s route in planned order unless the plan is adjusted.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mrepMultiTerritory}
                onChange={e => setForm(f => ({ ...f, mrepMultiTerritory: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Multi-territory users
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Enables optional extra territory nodes per user; unioned with primary territory for coverage ownership.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mrepOwnershipAudit}
                onChange={e => setForm(f => ({ ...f, mrepOwnershipAudit: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Doctor ownership audit trail
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Records territory / pinned-rep changes on doctors.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.liveTrackingEnabled}
                onChange={e => setForm(f => ({ ...f, liveTrackingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Live tracking
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  Checked-in field reps send periodic GPS pings on mobile; managers view locations on web and mobile
                  (People &amp; Operations → Team → Live tracking).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.mobilePushEnabled}
                onChange={e => setForm(f => ({ ...f, mobilePushEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Mobile push notifications
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, the mobile app registers device tokens and sends push alerts for approvals,
                  expenses, announcements, and late check-ins (requires Expo push credentials on the server).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.deviceControlEnabled}
                onChange={e => setForm(f => ({ ...f, deviceControlEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Device control (single mobile device)
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, each field-force rep is locked to one mobile device. Logins from a different
                  device are blocked until an admin approves a device change (Device Control page). Web logins
                  are never affected.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.expenseApprovalRequired}
                onChange={e => setForm(f => ({ ...f, expenseApprovalRequired: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Expense approval required
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, field rep expenses from mobile and web stay PENDING until a manager approves
                  them and selects the paid-from money account.
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.geoFencingEnabled}
                onChange={e => setForm(f => ({ ...f, geoFencingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label={
              <div>
                <Typography component='span' variant='body2'>
                  Visit geo-fencing
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block'>
                  When enabled, verified doctors use GPS radius checks on visit completion (SOFT logs warnings, STRICT
                  blocks).
                </Typography>
              </div>
            }
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            select
            label='Geo-fence mode'
            fullWidth
            value={form.geoFenceMode}
            onChange={e =>
              setForm(f => ({ ...f, geoFenceMode: e.target.value as GeoFenceMode }))
            }
            margin='normal'
            disabled={!form.geoFencingEnabled}
            helperText='Only applies to doctors with verified locations.'
          >
            <MenuItem value='OFF'>Off</MenuItem>
            <MenuItem value='SOFT'>Soft — allow visit, log outside radius</MenuItem>
            <MenuItem value='STRICT'>Strict — block visit outside radius</MenuItem>
          </TextField>
          <TextField
            label='Geo-fence radius (meters)'
            type='number'
            fullWidth
            value={form.geoFenceRadiusMeters}
            onChange={e => setForm(f => ({ ...f, geoFenceRadiusMeters: Number(e.target.value) || 150 }))}
            margin='normal'
            disabled={!form.geoFencingEnabled}
            inputProps={{ min: 25, max: 5000 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingEnabled}
                onChange={e => setForm(f => ({ ...f, onboardingEnabled: e.target.checked }))}
                color='primary'
              />
            }
            label='Enable onboarding module'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingStrictValidation}
                onChange={e => setForm(f => ({ ...f, onboardingStrictValidation: e.target.checked }))}
                color='primary'
              />
            }
            label='Strict onboarding validation'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.onboardingKillSwitch}
                onChange={e => setForm(f => ({ ...f, onboardingKillSwitch: e.target.checked }))}
                color='error'
              />
            }
            label='Onboarding kill switch'
            sx={{ alignItems: 'flex-start', mr: 0, ml: 0, mt: 1 }}
          />
          <TextField
            label='Onboarding pilot cohort'
            fullWidth
            value={form.onboardingPilotCohort}
            onChange={e => setForm(f => ({ ...f, onboardingPilotCohort: e.target.value }))}
            margin='normal'
          />
          <RetentionPolicyFields form={form} setForm={setForm} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submitEdit} disabled={saving || !form.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Company summary — {summaryCompany?.name}</DialogTitle>
        <DialogContent>
          {summaryLoading ? (
            <Skeleton variant='rounded' height={200} animation='wave' />
          ) : summaryData ? (
            <Grid container spacing={3} className='mbe-2'>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Active users
                    </Typography>
                    <Typography variant='h5'>{summaryData.totalUsers ?? 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Total orders
                    </Typography>
                    <Typography variant='h5'>{summaryData.totalOrders ?? 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Revenue (transactions)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalRevenue ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Payroll (net salary total)
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalPayroll ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant='outlined'>
                  <CardContent>
                    <Typography variant='caption' color='text.secondary'>
                      Expenses
                    </Typography>
                    <Typography variant='h5'>{formatPKR(summaryData.totalExpenses ?? 0)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography color='text.secondary'>No data.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default SuperAdminPage
