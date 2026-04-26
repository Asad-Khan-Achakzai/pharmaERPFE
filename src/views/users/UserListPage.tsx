'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'
import CustomTextField from '@core/components/mui/TextField'
import TablePaginationComponent from '@components/TablePaginationComponent'
import { usersService } from '@/services/users.service'
import { rolesService } from '@/services/roles.service'
import type { Role } from '@/services/roles.service'
import { extractPaginatedList } from '@/utils/apiPaginated'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import tableStyles from '@core/styles/table.module.css'

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
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => { const r = rankItem(row.getValue(columnId), value); addMeta({ itemRank: r }); return r.passed }
const columnHelper = createColumnHelper<User>()

const UserListPage = () => {
  const [data, setData] = useState<User[]>([])
  const [roleOptions, setRoleOptions] = useState<Role[]>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [editItem, setEditItem] = useState<User | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    roleId: '' as string
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewItem, setViewItem] = useState<User | null>(null)

  const isFormValid =
    form.name.trim() !== '' && form.email.trim() !== '' && form.roleId !== '' && (editItem ? true : form.password.trim() !== '')

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('users.create')
  const canEdit = hasPermission('users.edit')
  const canDelete = hasPermission('users.delete')

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

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await usersService.list({ limit: 100 })
      setData(extractPaginatedList<User>(res))
    } catch (err) {
      showApiError(err, 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void loadRoles()
  }, [loadRoles])
  useEffect(() => {
    fetchData()
  }, [])

  const handleOpen = (item?: User) => {
    if (item) {
      setEditItem(item)
      const rid = (item.roleId as Role | undefined)?._id
      setForm({
        name: item.name,
        email: item.email,
        password: '',
        phone: item.phone || '',
        roleId: typeof rid === 'string' ? rid : rid != null ? String(rid) : defaultRepRoleId
      })
    } else {
      setEditItem(null)
      setForm({ name: '', email: '', password: '', phone: '', roleId: defaultRepRoleId })
    }
    setOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId
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

  const openDeleteConfirm = (id: string) => {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await usersService.remove(deleteId)
      showSuccess('User deleted successfully')
      setConfirmOpen(false)
      fetchData()
    } catch (err) {
      showApiError(err, 'Error deleting user')
    } finally {
      setDeleting(false)
    }
  }, [deleteId])

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
    columnHelper.display({ id: 'status', header: 'Status', cell: ({ row }) => <Chip label={row.original.isActive ? 'Active' : 'Inactive'} color={row.original.isActive ? 'success' : 'error'} size='small' variant='tonal' /> }),
    columnHelper.display({ id: 'actions', header: 'Actions', cell: ({ row }) => (
      <div className='flex gap-1'>
        <IconButton size='small' onClick={() => setViewItem(row.original)}><i className='tabler-eye text-textSecondary' /></IconButton>
        {canEdit && <IconButton size='small' onClick={() => handleOpen(row.original)}><i className='tabler-edit text-textSecondary' /></IconButton>}
        {canDelete && <IconButton size='small' onClick={() => openDeleteConfirm(row.original._id)}><i className='tabler-trash text-textSecondary' /></IconButton>}
      </div>
    ) })
  ], [canEdit, canDelete])

  const table = useReactTable({ data, columns, filterFns: { fuzzy: fuzzyFilter }, state: { globalFilter }, globalFilterFn: fuzzyFilter, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() })

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
        <CustomTextField value={globalFilter ?? ''} onChange={e => setGlobalFilter(e.target.value)} placeholder='Search...' />
      </div>
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
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title='Delete User?'
        description='This user will be removed and will no longer be able to log in.'
        confirmText='Yes, Delete'
        loading={deleting}
      />
    </Card>
  )
}
export default UserListPage
