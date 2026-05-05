'use client'
import { useState, useEffect, useMemo, useCallback, useRef, type MouseEvent } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { usersService } from '@/services/users.service'
import { rolesService } from '@/services/roles.service'
import type { Role } from '@/services/roles.service'
import { territoriesService, type Territory } from '@/services/territories.service'
import { extractPaginatedList } from '@/utils/apiPaginated'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import tableStyles from '@core/styles/table.module.css'
import {
  TableListSearchField,
  TableListFilterIconButton,
  ListFilterPopover,
  DateAndCreatedByFilterPanel,
  useDebouncedSearch,
  emptyDateUserFilters,
  countDateUserFilters,
  appendDateUserParams,
  type DateUserFilterState
} from '@/components/standard-list-toolbar'

type ManagerRef = { _id: string; name: string; email: string } | string | null

type TerritoryRef =
  | { _id: string; name: string; code?: string | null; kind: 'ZONE' | 'AREA' | 'BRICK' }
  | string
  | null

type User = {
  _id: string
  name: string
  email: string
  role: string
  roleId?: Role | null
  phone: string
  permissions: string[]
  isActive: boolean
  lastLoginAt?: string | null
  /** MRep hierarchy fields (Phase 0). */
  employeeCode?: string | null
  managerId?: ManagerRef
  territoryId?: TerritoryRef
}

type ManagerLookup = { _id: string; name: string; email: string; role?: string }

const columnHelper = createColumnHelper<User>()

const UserListPage = () => {
  const [data, setData] = useState<User[]>([])
  const [roleOptions, setRoleOptions] = useState<Role[]>([])
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()
  const [appliedFilters, setAppliedFilters] = useState<DateUserFilterState>(emptyDateUserFilters)
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null)
  const fetchSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<User | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    roleId: '' as string,
    employeeCode: ''
  })
  const [formManager, setFormManager] = useState<ManagerLookup | null>(null)
  const [formTerritory, setFormTerritory] = useState<Territory | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [statusNextActive, setStatusNextActive] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [viewItem, setViewItem] = useState<User | null>(null)

  const isFormValid =
    form.name.trim() !== '' && form.email.trim() !== '' && form.roleId !== '' && (editItem ? true : form.password.trim() !== '')

  const filterOpen = Boolean(filterAnchor)
  const activeFilterCount = countDateUserFilters(appliedFilters)

  const { hasPermission, user: authUser } = useAuth()
  const canCreate = hasPermission('users.create')
  const canEdit = hasPermission('users.edit')
  const canDelete = hasPermission('users.delete')
  const canToggleStatus = canEdit || canDelete

  const defaultRepRoleId = useMemo(
    () => roleOptions.find(r => r.code === 'DEFAULT_MEDICAL_REP')?._id || roleOptions[0]?._id || '',
    [roleOptions]
  )

  const loadRoles = useCallback(async () => {
    try {
      const res = await rolesService.list({ limit: 200 })
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('ROLES (user form) API RESPONSE', { axiosData: res.data, list: extractPaginatedList<Role>(res) })
      }
      setRoleOptions(extractPaginatedList<Role>(res))
    } catch {
      setRoleOptions([])
    }
  }, [])

  const fetchData = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '100' }
      appendDateUserParams(params, appliedFilters, debouncedSearch)
      const res = await usersService.list(params)
      if (seq !== fetchSeq.current) return
      setData(extractPaginatedList<User>(res))
    } catch (err) {
      if (seq === fetchSeq.current) showApiError(err, 'Failed to load users')
    } finally {
      if (seq === fetchSeq.current) setLoading(false)
    }
  }, [appliedFilters, debouncedSearch])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])
  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleOpen = (item?: User) => {
    if (item) {
      setEditItem(item)
      const rid = (item.roleId as Role | undefined)?._id
      setForm({
        name: item.name,
        email: item.email,
        password: '',
        phone: item.phone || '',
        roleId: typeof rid === 'string' ? rid : rid != null ? String(rid) : defaultRepRoleId,
        employeeCode: item.employeeCode || ''
      })
      const mgr = typeof item.managerId === 'object' && item.managerId ? item.managerId : null
      setFormManager(mgr ? { _id: mgr._id, name: mgr.name, email: mgr.email } : null)
      const ter = typeof item.territoryId === 'object' && item.territoryId ? item.territoryId : null
      setFormTerritory(
        ter
          ? ({
              _id: ter._id,
              name: ter.name,
              code: ter.code,
              kind: ter.kind,
              isActive: true
            } as Territory)
          : null
      )
    } else {
      setEditItem(null)
      setForm({ name: '', email: '', password: '', phone: '', roleId: defaultRepRoleId, employeeCode: '' })
      setFormManager(null)
      setFormTerritory(null)
    }
    setOpen(true)
  }

  const fetchManagerOptions = async (search: string) => {
    const res = await usersService.assignable({ search, limit: 25 })
    const list = (res.data?.data || []) as ManagerLookup[]
    return editItem ? list.filter(u => u._id !== editItem._id) : list
  }

  const fetchTerritoryOptions = async (search: string) => {
    const res = await territoriesService.lookup({ search, kind: 'BRICK', limit: 25 })
    return (res.data?.data || []) as Territory[]
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId,
        employeeCode: form.employeeCode.trim() || null,
        managerId: formManager?._id || null,
        territoryId: formTerritory?._id || null
      }
      if (editItem) {
        if (form.password?.trim()) payload.password = form.password
        else delete (payload as { password?: string }).password
        await usersService.update(editItem._id, payload)
        showSuccess('User updated')
      } else {
        payload.password = form.password
        await usersService.create(payload)
        showSuccess('User created')
      }
      setOpen(false)
      fetchData()
    } catch (e: any) {
      showApiError(e, 'Error saving user')
    } finally {
      setSaving(false) }
  }

  const openStatusConfirm = (u: User, nextActive: boolean) => {
    setStatusTarget(u)
    setStatusNextActive(nextActive)
    setStatusConfirmOpen(true)
  }

  const handleConfirmStatus = async () => {
    if (!statusTarget) return
    setStatusLoading(true)
    try {
      const res = await usersService.setStatus(statusTarget._id, statusNextActive)
      const body = res.data as { message?: string }
      showSuccess(body?.message || (statusNextActive ? 'User activated successfully' : 'User deactivated successfully'))
      setStatusConfirmOpen(false)
      setStatusTarget(null)
      await fetchData()
    } catch (err) {
      showApiError(err, 'Failed to update user status')
    } finally {
      setStatusLoading(false)
    }
  }

  const columns = useMemo<ColumnDef<User, any>[]>(() => [
    columnHelper.accessor('name', { header: 'Name', cell: ({ row }) => <Typography fontWeight={500}>{row.original.name}</Typography> }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.display({
      id: 'roleName',
      header: 'Role',
      cell: ({ row }) => {
        const o = row.original
        const label = o.roleId?.name ?? o.role
        return (
        <Chip
          label={label}
          color={
            o.role === 'ADMIN'
              ? 'primary'
              : o.role === 'SUPER_ADMIN'
                ? 'secondary'
                : 'default'
          }
          size='small'
          variant='tonal'
        />
        )
      }
    }),
    columnHelper.display({
      id: 'manager',
      header: 'Manager',
      cell: ({ row }) => {
        const mgr = row.original.managerId
        if (mgr && typeof mgr === 'object') return <Typography variant='body2'>{mgr.name}</Typography>
        return <Typography variant='body2' color='text.disabled'>—</Typography>
      }
    }),
    columnHelper.display({
      id: 'territory',
      header: 'Territory',
      cell: ({ row }) => {
        const ter = row.original.territoryId
        if (ter && typeof ter === 'object') {
          return (
            <Chip
              size='small'
              variant='outlined'
              label={`${ter.name}${ter.code ? ` (${ter.code})` : ''}`}
            />
          )
        }
        return <Typography variant='body2' color='text.disabled'>—</Typography>
      }
    }),
    columnHelper.display({ id: 'status', header: 'Status', cell: ({ row }) => <Chip label={row.original.isActive ? 'Active' : 'Inactive'} color={row.original.isActive ? 'success' : 'error'} size='small' variant='tonal' /> }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const u = row.original
        const isSelf = authUser?._id === u._id
        const canChangeStatus = canToggleStatus && !isSelf
        return (
          <div className='flex gap-0.5 items-center flex-wrap'>
            <IconButton size='small' onClick={() => setViewItem(u)}><i className='tabler-eye text-textSecondary' /></IconButton>
            {canEdit && <IconButton size='small' onClick={() => handleOpen(u)}><i className='tabler-edit text-textSecondary' /></IconButton>}
            {canChangeStatus && u.isActive && (
              <Tooltip title='Deactivate user (sign-in blocked).'>
                <span>
                  <IconButton
                    size='small'
                    onClick={() => openStatusConfirm(u, false)}
                    color='error'
                    aria-label='Deactivate user'
                  >
                    <i className='tabler-user-x text-textSecondary' />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {canChangeStatus && !u.isActive && (
              <Tooltip title='Reactivate user (can sign in again).'>
                <span>
                  <IconButton
                    size='small'
                    onClick={() => openStatusConfirm(u, true)}
                    color='primary'
                    aria-label='Activate user'
                  >
                    <i className='tabler-user-check text-textSecondary' />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            {canToggleStatus && isSelf && (
              <Tooltip title="You can’t change your own active status.">
                <span>
                  <IconButton size='small' disabled>
                    <i className='tabler-lock text-textSecondary' />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </div>
        )
      }
    })
  ], [canEdit, canToggleStatus, authUser?._id])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  })

  const openFilterPopover = (e: MouseEvent<HTMLElement>) => setFilterAnchor(e.currentTarget)
  const closeFilterPopover = () => setFilterAnchor(null)

  return (
    <Card>
      <CardHeader
        title='Users'
        action={
          <div className='flex flex-wrap gap-2'>
            <Button component={Link} href='/users/roles' size='small' variant='outlined' startIcon={<i className='tabler-shield' />}>
              Roles
            </Button>
            {canCreate && (
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => handleOpen()}>
                Add User
              </Button>
            )}
          </div>
        }
      />
      <div className='flex flex-wrap items-center justify-between gap-4 pli-6 pbe-4'>
        <Stack direction='row' spacing={1.5} alignItems='center' flexWrap='wrap' useFlexGap sx={{ flex: 1, minWidth: 0 }}>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search name, email, phone…'
          />
          <TableListFilterIconButton activeFilterCount={activeFilterCount} onClick={openFilterPopover} />
        </Stack>
      </div>

      <ListFilterPopover open={filterOpen} anchorEl={filterAnchor} onClose={closeFilterPopover}>
        <DateAndCreatedByFilterPanel
          title='Filter users'
          description='Narrow the list by account creation time and who created the user (when recorded).'
          dateSectionLabel='Created date'
          createdByHelperText='Matches the teammate who created the user account, when available.'
          datePickerId='user-list-date-range-picker-months'
          appliedFilters={appliedFilters}
          onAppliedChange={setAppliedFilters}
          filterAnchor={filterAnchor}
          open={filterOpen}
          onClose={closeFilterPopover}
        />
      </ListFilterPopover>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>{table.getHeaderGroups().map(hg => <tr key={hg.id}>{hg.headers.map(h => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
          <tbody>{loading ? <tr><td colSpan={columns.length} className='text-center p-6'><CircularProgress size={32} /></td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className='text-center p-6'>No users</td></tr> : table.getRowModel().rows.map(row => <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <TablePaginationComponent table={table as any} />

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>{editItem ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Name' value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Email' value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!!editItem} /></Grid>
            {!editItem && <Grid size={{ xs: 12, sm: 6 }}><CustomTextField required fullWidth label='Password' type='password' value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} /></Grid>}
            {editItem && <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='New password' type='password' value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} helperText='Leave empty to keep current' /></Grid>}
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                select
                fullWidth
                label='Role'
                value={form.roleId}
                onChange={e => setForm(p => ({ ...p, roleId: e.target.value }))}
                helperText='Permissions come from the role. Manage roles in Roles.'>
                {roleOptions.map(r => (
                  <MenuItem key={r._id} value={r._id}>
                    {r.name}
                    {r.isSystem ? ' (system)' : ''}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Phone' value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                fullWidth
                label='Employee code'
                value={form.employeeCode}
                onChange={e => setForm(p => ({ ...p, employeeCode: e.target.value }))}
                helperText='Optional HR identifier (e.g. EMP-1023).'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete<ManagerLookup>
                value={formManager}
                onChange={setFormManager}
                fetchOptions={fetchManagerOptions}
                label='Reports to (Manager)'
                getOptionLabel={u => `${u.name} <${u.email}>`}
                helperText='Optional. Build the reporting tree by setting each user’s manager.'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <LookupAutocomplete<Territory>
                value={formTerritory}
                onChange={setFormTerritory}
                fetchOptions={fetchTerritoryOptions}
                label='Territory (Brick)'
                getOptionLabel={t => `${t.name}${t.code ? ` (${t.code})` : ''}`}
                helperText='Reps usually map 1:1 with a Brick. Managers can be left blank or set to their primary brick.'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => setViewItem(null)} maxWidth='sm' fullWidth>
        <DialogTitle>User Details</DialogTitle>
        <DialogContent>
          {viewItem && (
            <Grid container spacing={3} className='pbs-4'>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Name</Typography><Typography fontWeight={500}>{viewItem.name}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Email</Typography><Typography>{viewItem.email}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Role</Typography><Chip label={viewItem.roleId?.name ?? viewItem.role} color={viewItem.role === 'ADMIN' ? 'primary' : viewItem.role === 'SUPER_ADMIN' ? 'secondary' : 'default'} size='small' variant='tonal' /></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Status</Typography><Chip label={viewItem.isActive ? 'Active' : 'Inactive'} color={viewItem.isActive ? 'success' : 'error'} size='small' variant='tonal' /></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Phone</Typography><Typography>{viewItem.phone || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Employee code</Typography><Typography>{viewItem.employeeCode || '-'}</Typography></Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>Manager</Typography>
                <Typography>
                  {typeof viewItem.managerId === 'object' && viewItem.managerId
                    ? viewItem.managerId.name
                    : '-'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant='body2' color='text.secondary'>Territory</Typography>
                {typeof viewItem.territoryId === 'object' && viewItem.territoryId ? (
                  <Chip
                    size='small'
                    variant='outlined'
                    label={`${viewItem.territoryId.name}${viewItem.territoryId.code ? ` (${viewItem.territoryId.code})` : ''}`}
                  />
                ) : (
                  <Typography>-</Typography>
                )}
              </Grid>
              <Grid size={{ xs: 6 }}><Typography variant='body2' color='text.secondary'>Last Login</Typography><Typography>{viewItem.lastLoginAt ? new Date(viewItem.lastLoginAt).toLocaleString() : '-'}</Typography></Grid>
              {viewItem.permissions && viewItem.permissions.length > 0 && (
                <Grid size={{ xs: 12 }}><Typography variant='body2' color='text.secondary' className='mbe-1'>Permissions</Typography><div className='flex flex-wrap gap-1'>{viewItem.permissions.map(p => <Chip key={p} label={p} size='small' variant='tonal' />)}</div></Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewItem(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={statusConfirmOpen}
        onClose={() => { if (!statusLoading) { setStatusConfirmOpen(false); setStatusTarget(null) } }}
        onConfirm={() => { void handleConfirmStatus() }}
        title={statusNextActive ? 'Activate user?' : 'Deactivate user?'}
        description={
          statusNextActive
            ? 'This user will be able to sign in again (subject to their role).'
            : 'This user will be deactivated and will no longer be able to sign in. Historical data and references are kept.'
        }
        confirmText={statusNextActive ? 'Activate' : 'Deactivate'}
        confirmColor={statusNextActive ? 'primary' : 'error'}
        icon={statusNextActive ? 'tabler-user-check' : 'tabler-user-x'}
        loading={statusLoading}
      />
    </Card>
  )
}
export default UserListPage
