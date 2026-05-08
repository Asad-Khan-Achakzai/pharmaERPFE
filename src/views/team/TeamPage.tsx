'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import { useAuth } from '@/contexts/AuthContext'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { TableListSearchField, useDebouncedSearch } from '@/components/standard-list-toolbar'
import { usersService } from '@/services/users.service'
import { territoriesService, type Territory } from '@/services/territories.service'
import tableStyles from '@core/styles/table.module.css'

type TeamUser = {
  _id: string
  name: string
  email: string
  isActive: boolean
  employeeCode?: string | null
  roleId?: { _id: string; name: string; code: string } | null
  managerId?: { _id: string; name: string; email: string } | string | null
  territoryId?: { _id: string; name: string; code?: string | null; kind: string } | string | null
}

type AssignableUser = { _id: string; name: string; email: string; role?: string }

const TeamPage = () => {
  const { hasPermission, user: authUser } = useAuth()
  const canManage = hasPermission('team.manage')

  const [data, setData] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const { searchInput, setSearchInput, debouncedSearch, clearSearch } = useDebouncedSearch()

  const [managerDialog, setManagerDialog] = useState<{ user: TeamUser | null; mgr: AssignableUser | null }>({
    user: null,
    mgr: null
  })
  const [territoryDialog, setTerritoryDialog] = useState<{ user: TeamUser | null; territory: Territory | null }>({
    user: null,
    territory: null
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (debouncedSearch) params.search = debouncedSearch
      const res = await usersService.team(params)
      const body = res.data?.data || res.data
      setData((body as { docs?: TeamUser[] })?.docs || [])
    } catch (e) {
      showApiError(e, 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  const fetchAssignableUsers = async (search: string) => {
    const res = await usersService.assignable({ search, limit: 25 })
    return (res.data?.data || []) as AssignableUser[]
  }

  const fetchTerritories = async (search: string) => {
    const res = await territoriesService.lookup({ search, kind: 'BRICK', limit: 25 })
    return (res.data?.data || []) as Territory[]
  }

  const handleSetManager = async () => {
    if (!managerDialog.user) return
    setSaving(true)
    try {
      await usersService.setManager(managerDialog.user._id, managerDialog.mgr?._id || null)
      showSuccess('Manager updated')
      setManagerDialog({ user: null, mgr: null })
      await load()
    } catch (e) {
      showApiError(e, 'Failed to update manager')
    } finally {
      setSaving(false)
    }
  }

  const handleSetTerritory = async () => {
    if (!territoryDialog.user) return
    setSaving(true)
    try {
      await usersService.setTerritory(territoryDialog.user._id, territoryDialog.territory?._id || null)
      showSuccess('Territory updated')
      setTerritoryDialog({ user: null, territory: null })
      await load()
    } catch (e) {
      showApiError(e, 'Failed to update territory')
    } finally {
      setSaving(false)
    }
  }

  const stats = useMemo(() => {
    const active = data.filter(u => u.isActive).length
    return { total: data.length, active, inactive: data.length - active }
  }, [data])

  return (
    <Card>
      <CardHeader
        title='My Team'
        subheader={
          authUser?.name
            ? `Roster from Team API (full company for tenant administrators; otherwise the reporting subtree of ${authUser.name}). Use the manager column to re-parent a user.`
            : undefined
        }
      />
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent='space-between'
          sx={{ mb: 2 }}
        >
          <Stack direction='row' spacing={1.5}>
            <Chip color='primary' variant='tonal' label={`${stats.total} Team members`} />
            <Chip color='success' variant='tonal' label={`${stats.active} Active`} />
            {stats.inactive > 0 && <Chip color='default' variant='tonal' label={`${stats.inactive} Inactive`} />}
          </Stack>
          <TableListSearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={clearSearch}
            placeholder='Search name, email, employee code…'
          />
        </Stack>
        <Box sx={{ overflowX: 'auto' }}>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Manager</th>
                <th>Territory</th>
                <th>Status</th>
                {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className='text-center p-6'>
                    <CircularProgress size={32} />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className='text-center p-6'>
                    <Typography color='text.secondary' sx={{ mb: 1 }}>
                      No direct or indirect reports yet.
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      An admin builds the reporting tree from <strong>Users → User List → Edit</strong> by setting each
                      user&apos;s <em>Reports to (Manager)</em>. Once those are set, this page will show your full
                      subtree.
                    </Typography>
                  </td>
                </tr>
              ) : (
                data.map(u => {
                  const mgr = typeof u.managerId === 'object' && u.managerId ? u.managerId : null
                  const ter = typeof u.territoryId === 'object' && u.territoryId ? u.territoryId : null
                  return (
                    <tr key={u._id}>
                      <td>
                        <Typography fontWeight={500}>{u.name}</Typography>
                        {u.employeeCode && (
                          <Typography variant='caption' color='text.secondary'>
                            {u.employeeCode}
                          </Typography>
                        )}
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <Chip size='small' variant='tonal' label={u.roleId?.name || '-'} />
                      </td>
                      <td>{mgr ? mgr.name : <Typography color='text.disabled'>—</Typography>}</td>
                      <td>
                        {ter ? (
                          <Chip
                            size='small'
                            variant='outlined'
                            label={`${ter.name}${ter.code ? ` (${ter.code})` : ''}`}
                          />
                        ) : (
                          <Typography color='text.disabled'>—</Typography>
                        )}
                      </td>
                      <td>
                        <Chip
                          size='small'
                          variant='tonal'
                          color={u.isActive ? 'success' : 'default'}
                          label={u.isActive ? 'Active' : 'Inactive'}
                        />
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <Tooltip title='Set manager'>
                            <IconButton
                              size='small'
                              onClick={() =>
                                setManagerDialog({
                                  user: u,
                                  mgr: mgr ? { _id: mgr._id, name: mgr.name, email: mgr.email } : null
                                })
                              }
                            >
                              <i className='tabler-user-up text-textSecondary' />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title='Set territory'>
                            <IconButton
                              size='small'
                              onClick={() =>
                                setTerritoryDialog({
                                  user: u,
                                  territory: ter
                                    ? ({
                                        _id: ter._id,
                                        name: ter.name,
                                        code: ter.code,
                                        kind: ter.kind as Territory['kind'],
                                        isActive: true
                                      } as Territory)
                                    : null
                                })
                              }
                            >
                              <i className='tabler-map-pin text-textSecondary' />
                            </IconButton>
                          </Tooltip>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </Box>
      </CardContent>

      <Dialog
        open={!!managerDialog.user}
        onClose={() => (saving ? null : setManagerDialog({ user: null, mgr: null }))}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Set manager for {managerDialog.user?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <LookupAutocomplete<AssignableUser>
                value={managerDialog.mgr}
                onChange={v => setManagerDialog(p => ({ ...p, mgr: v }))}
                fetchOptions={fetchAssignableUsers}
                label='Manager'
                getOptionLabel={u => `${u.name} <${u.email}>`}
                helperText='Leave empty to clear (top of tree).'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManagerDialog({ user: null, mgr: null })} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={handleSetManager} disabled={saving}>
            {saving ? <CircularProgress size={20} color='inherit' /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!territoryDialog.user}
        onClose={() => (saving ? null : setTerritoryDialog({ user: null, territory: null }))}
        maxWidth='xs'
        fullWidth
      >
        <DialogTitle>Set territory for {territoryDialog.user?.name}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} className='pbs-4'>
            <Grid size={{ xs: 12 }}>
              <LookupAutocomplete<Territory>
                value={territoryDialog.territory}
                onChange={v => setTerritoryDialog(p => ({ ...p, territory: v }))}
                fetchOptions={fetchTerritories}
                label='Brick'
                getOptionLabel={t => `${t.name}${t.code ? ` (${t.code})` : ''}`}
                helperText='Reps usually map 1:1 with a Brick. Leave empty to clear.'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTerritoryDialog({ user: null, territory: null })} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={handleSetTerritory} disabled={saving}>
            {saving ? <CircularProgress size={20} color='inherit' /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default TeamPage
