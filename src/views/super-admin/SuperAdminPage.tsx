'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  createdAt?: string
}

const formatPKR = (v: number) =>
  `₨ ${(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const emptyForm = {
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
  mrepOwnershipAudit: false
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
  const [form, setForm] = useState(emptyForm)
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
      mrepOwnershipAudit: c.mrepOwnershipAudit === true
    })
    setEditOpen(true)
  }

  const submitCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await superAdminService.createCompany({
        ...form,
        email: form.email.trim() || undefined,
        timeZone: form.timeZone.trim() || undefined,
        weeklyPlanApprovalRequired: form.weeklyPlanApprovalRequired,
        strictVisitSequence: form.strictVisitSequence,
        mrepMultiTerritory: form.mrepMultiTerritory,
        mrepOwnershipAudit: form.mrepOwnershipAudit
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
        ...form,
        email: form.email.trim() || undefined,
        timeZone: form.timeZone.trim(),
        weeklyPlanApprovalRequired: form.weeklyPlanApprovalRequired,
        strictVisitSequence: form.strictVisitSequence,
        mrepMultiTerritory: form.mrepMultiTerritory,
        mrepOwnershipAudit: form.mrepOwnershipAudit
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
