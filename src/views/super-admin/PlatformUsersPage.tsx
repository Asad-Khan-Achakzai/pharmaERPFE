'use client'

import { useCallback, useEffect, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import { superAdminService } from '@/services/superAdmin.service'
import { showApiError } from '@/utils/apiErrors'

type Company = {
  _id: string
  name: string
  city?: string
  isActive?: boolean
}

type PlatformUserRow = {
  _id: string
  name: string
  email: string
  isActive: boolean
  companyCount: number
  lastLoginAt?: string
  userType?: string
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  isActive: true,
  companyIds: [] as string[],
  homeCompanyId: '' as string
}

const PlatformUsersPage = () => {
  const [rows, setRows] = useState<PlatformUserRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'true' | 'false'>('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)

  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadCompanies = useCallback(async () => {
    try {
      const { data } = await superAdminService.listCompanies({ limit: 200, page: 1 })
      setCompanies(data.data || [])
    } catch (e) {
      showApiError(e, 'Failed to load companies')
    }
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: page + 1,
        limit: rowsPerPage
      }
      if (search.trim()) params.search = search.trim()
      if (status === 'true' || status === 'false') params.isActive = status
      const { data } = await superAdminService.listPlatformUsers(params)
      setRows(data.data || [])
      setTotal(data.pagination?.total ?? 0)
    } catch (e) {
      showApiError(e, 'Failed to load platform users')
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, search, status])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setDialogMode('create')
  }

  const openView = (row: PlatformUserRow) => {
    void (async () => {
      setSaving(true)
      try {
        const { data } = await superAdminService.getPlatformUser(row._id)
        const d = data.data
        setEditingId(d._id)
        setForm({
          name: d.name,
          email: d.email,
          password: '',
          isActive: d.isActive !== false,
          companyIds: d.companyIds || [],
          homeCompanyId: d.companyId?._id ? String(d.companyId._id) : d.companyId ? String(d.companyId) : (d.companyIds && d.companyIds[0]) || ''
        })
        setDialogMode('view')
      } catch (e) {
        showApiError(e, 'Failed to load user')
      } finally {
        setSaving(false)
      }
    })()
  }

  const openEdit = (row: PlatformUserRow) => {
    void (async () => {
      setSaving(true)
      try {
        const { data } = await superAdminService.getPlatformUser(row._id)
        const d = data.data
        setEditingId(d._id)
        const h =
          d.companyId && typeof d.companyId === 'object' && (d.companyId as { _id: string })._id
            ? String((d.companyId as { _id: string })._id)
            : d.companyId
              ? String(d.companyId)
              : (d.companyIds && d.companyIds[0]) || ''
        setForm({
          name: d.name,
          email: d.email,
          password: '',
          isActive: d.isActive !== false,
          companyIds: d.companyIds || [],
          homeCompanyId: h
        })
        setDialogMode('edit')
      } catch (e) {
        showApiError(e, 'Failed to load user')
      } finally {
        setSaving(false)
      }
    })()
  }

  const selectedCompanyObjects = (ids: string[]) =>
    companies.filter(c => ids.includes(c._id)).sort((a, b) => ids.indexOf(a._id) - ids.indexOf(b._id))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    if (dialogMode === 'create' && !form.password) return
    if (!form.companyIds.length) return
    setSaving(true)
    try {
      if (dialogMode === 'create') {
        const first = form.companyIds[0]
        await superAdminService.createPlatformUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          isActive: form.isActive,
          companyIds: form.companyIds,
          homeCompanyId: form.homeCompanyId && form.companyIds.includes(form.homeCompanyId) ? form.homeCompanyId : first
        })
      } else if (dialogMode === 'edit' && editingId) {
        const payload: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          isActive: form.isActive,
          companyIds: form.companyIds,
          homeCompanyId: form.homeCompanyId && form.companyIds.includes(form.homeCompanyId) ? form.homeCompanyId : form.companyIds[0]
        }
        if (form.password.trim()) payload.password = form.password
        await superAdminService.updatePlatformUser(editingId, payload)
      }
      setDialogMode(null)
      await loadUsers()
    } catch (e) {
      showApiError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setSaving(true)
    try {
      await superAdminService.deletePlatformUser(deleteId)
      setDeleteId(null)
      await loadUsers()
    } catch (e) {
      showApiError(e, 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const readOnly = dialogMode === 'view'

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Platform user management'
            subheader="Create platform operators (user type PLATFORM), assign companies, and control UserCompanyAccess. The first company in the selection is the user's home for RBAC."
            action={
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
                Create platform user
              </Button>
            }
          />
          <CardContent className='flex flex-col gap-4'>
            <div className='flex flex-wrap gap-2 items-center justify-between'>
              <div className='flex flex-wrap gap-2 items-center flex-1 min-is-0'>
                <TextField
                  size='small'
                  label='Search email'
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className='min-is-[220px]'
                />
                <FormControl size='small' className='min-is-[160px]'>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={status}
                    label='Status'
                    onChange={e => {
                      setStatus(e.target.value as 'all' | 'true' | 'false')
                      setPage(0)
                    }}
                  >
                    <MenuItem value='all'>All</MenuItem>
                    <MenuItem value='true'>Active</MenuItem>
                    <MenuItem value='false'>Inactive</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <Chip color='info' variant='tonal' label='userType: PLATFORM' size='small' />
            </div>

            <TableContainer component={Paper} variant='outlined'>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Assigned companies</TableCell>
                    <TableCell>Last login</TableCell>
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
                          </TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>
                            <Chip
                              size='small'
                              label={row.isActive === false ? 'Inactive' : 'Active'}
                              color={row.isActive === false ? 'default' : 'success'}
                              variant='tonal'
                            />
                          </TableCell>
                          <TableCell>
                            {typeof row.companyCount === 'number' ? (
                              <Chip size='small' variant='outlined' label={`${row.companyCount} companies`} />
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>
                            {row.lastLoginAt
                              ? new Date(row.lastLoginAt).toLocaleString('en-PK', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : '—'}
                          </TableCell>
                          <TableCell align='right'>
                            <Button size='small' variant='text' className='mie-1' onClick={() => openView(row)}>
                              View
                            </Button>
                            <Button size='small' variant='outlined' className='mie-1' onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            <Button
                              size='small'
                              color='error'
                              variant='tonal'
                              onClick={() => setDeleteId(row._id)}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component='div'
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
            {!loading && rows.length === 0 ? (
              <Typography color='text.secondary' className='text-center p-4'>
                No platform users yet.
              </Typography>
            ) : null}
          </CardContent>
        </Card>
      </Grid>

      <Dialog
        open={dialogMode !== null}
        onClose={() => !saving && setDialogMode(null)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' && 'Create platform user'}
          {dialogMode === 'edit' && 'Edit platform user'}
          {dialogMode === 'view' && 'Platform user details'}
        </DialogTitle>
        <DialogContent className='flex flex-col gap-2'>
          <TextField
            required
            label='Full name'
            fullWidth
            margin='normal'
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            InputProps={{ readOnly }}
            disabled={readOnly}
          />
          <TextField
            required
            label='Email'
            type='email'
            fullWidth
            margin='normal'
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            InputProps={{ readOnly }}
            disabled={readOnly}
          />
          {dialogMode === 'create' || dialogMode === 'edit' ? (
            <TextField
              required={dialogMode === 'create'}
              label={dialogMode === 'edit' ? 'New password (leave empty to keep)' : 'Password'}
              type='password'
              fullWidth
              margin='normal'
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete='new-password'
            />
          ) : null}
          <TextField
            select
            label='Status'
            fullWidth
            margin='normal'
            value={form.isActive ? 'true' : 'false'}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))}
            InputProps={{ readOnly }}
            disabled={readOnly}
          >
            <MenuItem value='true'>Active</MenuItem>
            <MenuItem value='false'>Inactive</MenuItem>
          </TextField>
          {readOnly || dialogMode === 'edit' || dialogMode === 'create' ? (
            <Box className='mbs-2'>
              <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                Assigned companies (first = home for role / RBAC; must be active in directory).
              </Typography>
            </Box>
          ) : null}
          <Autocomplete
            multiple
            options={companies}
            getOptionLabel={o => o.name}
            isOptionEqualToValue={(a, b) => a._id === b._id}
            value={selectedCompanyObjects(form.companyIds)}
            onChange={(_, v) => {
              const nextIds = v.map(c => c._id)
              setForm(f => ({
                ...f,
                companyIds: nextIds,
                homeCompanyId: nextIds.includes(f.homeCompanyId) ? f.homeCompanyId : (nextIds[0] || '')
              }))
            }}
            readOnly={readOnly}
            disabled={readOnly}
            renderInput={params => <TextField {...params} label='Companies' margin='normal' placeholder='Search' />}
            renderTags={(value, getTagProps) =>
              value.map((option, i) => (
                <Chip {...getTagProps({ index: i })} key={option._id} size='small' label={i === 0 ? `${option.name} (home)` : option.name} />
              ))
            }
          />
          {form.companyIds.length > 1 && !readOnly ? (
            <TextField
              select
              label='Home company (for role & permissions)'
              fullWidth
              margin='normal'
              value={form.homeCompanyId && form.companyIds.includes(form.homeCompanyId) ? form.homeCompanyId : form.companyIds[0]}
              onChange={e => setForm(f => ({ ...f, homeCompanyId: e.target.value }))}
            >
              {form.companyIds.map(cid => {
                const c = companies.find(x => x._id === cid)
                return (
                  <MenuItem key={cid} value={cid}>
                    {c?.name || cid}
                  </MenuItem>
                )
              })}
            </TextField>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogMode(null)} disabled={saving}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {!readOnly ? (
            <Button
              variant='contained'
              onClick={submit}
              disabled={
                saving ||
                !form.name.trim() ||
                !form.email.trim() ||
                !form.companyIds.length ||
                (dialogMode === 'create' && !form.password)
              }
            >
              Save
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => !saving && setDeleteId(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete platform user?</DialogTitle>
        <DialogContent>
          <Typography color='text.secondary'>
            This will soft-delete the user and revoke all company assignments. Tenant companies and their data are not
            changed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)} disabled={saving}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={confirmDelete} disabled={saving}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  )
}

export default PlatformUsersPage
