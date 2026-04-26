'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import AvatarGroup from '@mui/material/AvatarGroup'
import Skeleton from '@mui/material/Skeleton'
import CustomTextField from '@core/components/mui/TextField'
import DialogCloseButton from '@/components/dialogs/DialogCloseButton'
import tableStyles from '@core/styles/table.module.css'
import { useAuth } from '@/contexts/AuthContext'
import { rolesService, type Role } from '@/services/roles.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { ALL_PERMISSIONS, DASHBOARD_VIEW, PERMISSION_GROUPS, labelFor } from '@/constants/permissionGroups'
import { extractPaginatedList } from '@/utils/apiPaginated'

const DEMO_AVATARS = ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', '7.png']

/** Match heights within a row (stretch) and keep a consistent floor across the grid. */
const ROLE_CARD_MIN_PX = 220
const cardShellSx = {
  width: '100%',
  minHeight: ROLE_CARD_MIN_PX,
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
} as const
const cardItemGridSx = { display: 'flex' } as const

const avatarsForCount = (total: number) => {
  const n = Math.min(4, Math.max(0, total))
  return Array.from({ length: n }, (_, i) => DEMO_AVATARS[i % DEMO_AVATARS.length])
}

const ensureDashboard = (perms: string[]) => (perms.includes(DASHBOARD_VIEW) ? perms : [...perms, DASHBOARD_VIEW])

const DEFAULT_ADMIN_CODE = 'DEFAULT_ADMIN'

function isPermLocked(p: string, initial: Role | null): boolean {
  if (p === DASHBOARD_VIEW) return true
  if (initial?.isSystem && initial.code === DEFAULT_ADMIN_CODE && p === 'admin.access') return true
  return false
}

function formatGroupName(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

const RoleFormDialog = ({
  open,
  onClose,
  onSaved,
  initial,
  canManage
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  initial: Role | null
  canManage: boolean
}) => {
  const [name, setName] = useState('')
  const [perms, setPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      if (initial?._id) {
        setPerms([...(initial.permissions ?? [])])
      } else {
        setPerms(ensureDashboard([DASHBOARD_VIEW]))
      }
    }
  }, [open, initial])

  const isSystem = initial?.isSystem
  const toggle = (p: string) => {
    if (isPermLocked(p, initial)) return
    if (!canManage) return
    setPerms(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]))
  }

  const requiredLockedPerms = useMemo(
    () => ALL_PERMISSIONS.filter(p => isPermLocked(p, initial)),
    [initial?._id, initial?.isSystem, initial?.code]
  )

  const toggleablePerms = useMemo(
    () => ALL_PERMISSIONS.filter(p => !isPermLocked(p, initial)),
    [initial?._id, initial?.isSystem, initial?.code]
  )

  const selectedToggleableCount = useMemo(
    () => toggleablePerms.filter(p => perms.includes(p)).length,
    [perms, toggleablePerms]
  )
  const allToggleableSelected = toggleablePerms.length > 0 && selectedToggleableCount === toggleablePerms.length
  const selectAllIndeterminate = selectedToggleableCount > 0 && !allToggleableSelected

  const handleSelectAllCheckbox = () => {
    if (!canManage) return
    if (allToggleableSelected) {
      setPerms([...requiredLockedPerms])
    } else {
      setPerms(prev => [...new Set([...requiredLockedPerms, ...prev, ...toggleablePerms])])
    }
  }

  const save = async () => {
    if (!canManage) return
    if (!name.trim()) return
    setSaving(true)
    try {
      if (initial?._id) {
        await rolesService.update(initial._id, { name: name.trim(), permissions: perms })
        showSuccess('Role updated')
      } else {
        await rolesService.create({ name: name.trim(), permissions: perms })
        showSuccess('Role created')
      }
      onSaved()
      onClose()
    } catch (e) {
      showApiError(e, 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => onClose()

  return (
    <Dialog
      fullWidth
      maxWidth='md'
      scroll='paper'
      open={open}
      onClose={handleClose}
      closeAfterTransition={false}
      sx={{
        '& .MuiDialog-paper': {
          maxHeight: 'min(90vh, 48rem)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }
      }}
    >
      <DialogCloseButton onClick={handleClose} disableRipple>
        <i className='tabler-x' />
      </DialogCloseButton>
      <DialogTitle variant='h4' className='shrink-0 flex flex-col gap-2 text-center sm:pbs-16 sm:pbe-6 sm:pli-16'>
        {initial?._id ? 'Edit Role' : 'Add Role'}
        <Typography component='span' className='flex flex-col text-center'>
          Set Role Permissions
        </Typography>
      </DialogTitle>
      <form
        className='flex min-h-0 flex-1 flex-col overflow-hidden'
        onSubmit={e => {
          e.preventDefault()
          if (canManage) void save()
        }}
      >
        <DialogContent
          className='flex flex-1 min-h-0 flex-col gap-6 overflow-hidden pbs-0 sm:pli-16'
          sx={{ overflow: 'hidden' }}
        >
          <div className='shrink-0 space-y-4'>
            <CustomTextField
              label='Role Name'
              variant='outlined'
              fullWidth
              placeholder='Enter Role Name'
              value={name}
              disabled={!canManage || Boolean(isSystem && initial?._id)}
              onChange={e => setName(e.target.value)}
            />
            {isSystem && (
              <Typography variant='body2' color='text.secondary' className='-mbs-2'>
                System role — name is locked; be careful when changing permissions.
              </Typography>
            )}
          </div>
          <Typography variant='h5' className='min-is-[225px] shrink-0'>
            Role Permissions
          </Typography>
          <div
            className='min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain pbe-0.5 pie-2 sm:pie-3 [scrollbar-gutter:stable]'
          >
            <table className={tableStyles.table}>
              <tbody>
                <tr className='border-bs-0'>
                  <th className='pis-0'>
                    <Typography color='text.primary' className='font-medium whitespace-nowrap grow min-is-[225px]'>
                      Administrator Access
                    </Typography>
                  </th>
                  <th className='text-end! pie-2! sm:pie-3!'>
                    <FormControlLabel
                      className='mie-0 capitalize'
                      control={
                        <Checkbox
                          disabled={!canManage}
                          onChange={handleSelectAllCheckbox}
                          indeterminate={selectAllIndeterminate}
                          checked={allToggleableSelected}
                        />
                      }
                      label='Select All'
                    />
                  </th>
                </tr>
                {Object.entries(PERMISSION_GROUPS).map(([group, list]) => (
                  <tr key={group} className='border-be'>
                    <td className='pis-0'>
                      <Typography
                        className='font-medium whitespace-nowrap grow min-is-[225px] max-md:whitespace-normal'
                        color='text.primary'
                      >
                        {formatGroupName(group)}
                      </Typography>
                    </td>
                    <td className='text-end! pie-2! sm:pie-3! align-top!'>
                      <FormGroup className='flex flex-row justify-end flex-wrap gap-4 sm:gap-6 mbe-1'>
                        {list.map(p => {
                          const locked = isPermLocked(p, initial)
                          return (
                            <FormControlLabel
                              key={p}
                              className='mie-0'
                              control={
                                <Checkbox
                                  id={p}
                                  disabled={!canManage || locked}
                                  checked={perms.includes(p)}
                                  onChange={() => toggle(p)}
                                />
                              }
                              label={labelFor(p)}
                            />
                          )
                        })}
                      </FormGroup>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
        <DialogActions className='shrink-0 justify-center pbs-0 sm:pbe-16 sm:pli-16'>
          {canManage && (
            <Button variant='contained' type='submit' disabled={saving}>
              {saving ? 'Submitting…' : 'Submit'}
            </Button>
          )}
          <Button variant='tonal' type='button' color='secondary' onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

function RoleCardSkeleton() {
  return (
    <Card elevation={1} sx={cardShellSx}>
      <CardContent className='flex flex-col flex-auto gap-4 justify-between'>
        <div className='flex items-center justify-between'>
          <Skeleton variant='text' width={120} height={24} />
          <Skeleton variant='circular' width={40} height={40} />
        </div>
        <div className='flex justify-between items-center grow'>
          <div className='flex flex-col items-start gap-2 w-full max-is-[70%]'>
            <Skeleton variant='text' width='60%' height={32} />
            <Skeleton variant='text' width={80} height={20} />
          </div>
          <Skeleton variant='circular' width={40} height={40} />
        </div>
      </CardContent>
    </Card>
  )
}

const RolesListPage = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('roles.manage')
  const [rows, setRows] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rolesRes = await rolesService.list({ limit: 200 })
      const roleList = extractPaginatedList<Role>(rolesRes)
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('ROLES API RESPONSE', { axiosData: rolesRes.data, roleList })
      }
      setRows(roleList)
    } catch (e) {
      showApiError(e, 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openEdit = (r: Role) => {
    setEditing(r)
    setOpen(true)
  }

  const openAdd = () => {
    setEditing(null)
    setOpen(true)
  }

  const openDeleteConfirm = (e: MouseEvent, r: Role) => {
    e.stopPropagation()
    setDeleteTarget(r)
    setDeleteConfirmOpen(true)
  }

  const performDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await rolesService.remove(deleteTarget._id)
      const body = res.data as { message?: string }
      showSuccess(body?.message || 'Role deleted successfully')
      setDeleteConfirmOpen(false)
      setDeleteTarget(null)
      await load()
    } catch (e: unknown) {
      showApiError(
        e,
        'Role is assigned to users. Reassign users before deleting.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Typography variant='h4' className='mbe-1'>
          Roles List
        </Typography>
        <Typography>
          A role provided access to predefined menus and features so that depending on assigned role an administrator
          can have access to what he need
        </Typography>
      </Grid>
      <Grid size={{ xs: 12 }}>
        {loading ? (
          <Grid container spacing={6}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={i} sx={cardItemGridSx}>
                <RoleCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={6}>
            {rows.map(r => {
              const total = r.userCount ?? 0
              const avatarFiles = avatarsForCount(total)
              const deleteDisabled = r.isSystem || total > 0
              const deleteDisabledReason = r.isSystem
                ? 'System roles cannot be deleted'
                : total > 0
                  ? `Role is assigned to ${total} user(s). Reassign them before you can delete it.`
                  : ''
              return (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={r._id} sx={cardItemGridSx}>
                  <Card elevation={1} sx={cardShellSx}>
                    <CardContent className='flex flex-col flex-auto gap-4 justify-between'>
                      <div className='flex items-center justify-between gap-2'>
                        <Typography className='grow'>{`Total ${total} user${total === 1 ? '' : 's'}`}</Typography>
                        <AvatarGroup total={total}>
                          {avatarFiles.map((img, i) => (
                            <Avatar key={i} alt={r.name} src={`/images/avatars/${img}`} />
                          ))}
                        </AvatarGroup>
                      </div>
                      <div className='flex justify-between items-end gap-2 grow min-bs-0'>
                        <div className='flex flex-col items-start gap-1 min-w-0'>
                          <div className='flex items-center gap-2 flex-wrap'>
                            <Typography variant='h5' className='wrap-break-word'>
                              {r.name}
                            </Typography>
                            {r.isSystem && <Chip size='small' label='System' variant='outlined' />}
                          </div>
                          {canManage && (
                            <div className='flex flex-wrap items-center gap-3 mbs-0.5'>
                              <Typography
                                component='button'
                                type='button'
                                color='primary'
                                onClick={() => openEdit(r)}
                                className='cursor-pointer m-0 p-0 border-none bg-transparent text-start font-inherit shrink-0'
                              >
                                Edit Role
                              </Typography>
                              {deleteDisabled ? (
                                <Tooltip title={deleteDisabledReason} placement='top' arrow>
                                  <span>
                                    <Button
                                      type='button'
                                      size='small'
                                      color='error'
                                      variant='text'
                                      disabled
                                    >
                                      Delete
                                    </Button>
                                  </span>
                                </Tooltip>
                              ) : (
                                <Button
                                  type='button'
                                  size='small'
                                  color='error'
                                  variant='text'
                                  onClick={e => openDeleteConfirm(e, r)}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
            {canManage && (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} sx={cardItemGridSx}>
                <Card
                  elevation={1}
                  className='cursor-pointer'
                  sx={cardShellSx}
                  onClick={openAdd}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openAdd()
                    }
                  }}
                  role='button'
                  tabIndex={0}
                >
                  <Grid container className='flex-1 min-bs-0' sx={{ flexWrap: 'nowrap', minHeight: ROLE_CARD_MIN_PX }}>
                    <Grid size={{ xs: 5 }} className='flex flex-col justify-end' sx={{ minWidth: 0 }}>
                      <div className='flex items-end justify-center w-full is-full pbe-1'>
                        <img
                          alt=''
                          src='/images/illustrations/characters/5.png'
                          className='max-bs-[120px] w-auto object-contain object-bottom'
                        />
                      </div>
                    </Grid>
                    <Grid size={{ xs: 7 }} className='flex flex-col' sx={{ minWidth: 0 }}>
                      <CardContent
                        className='flex flex-col flex-auto justify-center items-end text-right gap-4'
                        sx={{ boxSizing: 'border-box' }}
                      >
                        <Button variant='contained' size='small' onClick={e => { e.stopPropagation(); openAdd() }}>
                          Add Role
                        </Button>
                        <Typography>
                          Add new role, <br />
                          if it doesn&#39;t exist.
                        </Typography>
                      </CardContent>
                    </Grid>
                  </Grid>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </Grid>

      <RoleFormDialog
        open={open}
        onClose={() => { setOpen(false); setEditing(null) }}
        initial={editing}
        onSaved={load}
        canManage={canManage}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteConfirmOpen(false)
            setDeleteTarget(null)
          }
        }}
        onConfirm={() => { void performDelete() }}
        title='Delete role?'
        description={
          deleteTarget
            ? `Are you sure you want to delete “${deleteTarget.name}”? This cannot be undone.`
            : 'Are you sure you want to delete this role? This cannot be undone.'
        }
        confirmText='Delete'
        confirmColor='error'
        icon='tabler-trash'
        loading={deleting}
      />
    </Grid>
  )
}

export default RolesListPage
