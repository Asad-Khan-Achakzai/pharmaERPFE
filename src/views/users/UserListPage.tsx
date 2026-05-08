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
import Box from '@mui/material/Box'
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
import type { Territory } from '@/services/territories.service'
import { extractPaginatedList } from '@/utils/apiPaginated'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import type { TerritoryCoveragePreview } from '@/components/territories/TerritoryTreePicker'
import { UserFormCoverageSection } from '@/views/users/UserFormCoverageSection'
import {
  allowedManagerRoleCodesForSubordinate,
  managerMatchesRmParent
} from '@/utils/userManagerOptions'
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

type ManagerRef =
  | { _id: string; name: string; email: string; roleId?: { code?: string; name?: string } | string | null }
  | string
  | null

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
  /** MRep hierarchy fields (Phase 4 — extra territories require company flag). */
  employeeCode?: string | null
  managerId?: ManagerRef
  territoryId?: TerritoryRef
  coverageTerritoryIds?: Territory[] | string[] | null
}

type ManagerLookup = {
  _id: string
  name: string
  email: string
  role?: string
  roleCode?: string | null
  roleName?: string | null
  isAdminCapable?: boolean
}

type TerritoryAssignmentType = 'single_brick' | 'multi_brick' | 'entire_area' | 'entire_zone'

type TerritoryCoverageSummary = {
  assignmentType: string
  assignmentTypeKey?: string
  brickCount: number
  previewBricks: { _id: string; name: string; code?: string | null }[]
}

function allowedAssignmentTypes(roleCode: string): TerritoryAssignmentType[] {
  if (roleCode === 'DEFAULT_MEDICAL_REP') return ['single_brick', 'multi_brick', 'entire_area']
  if (roleCode === 'DEFAULT_ASM') return ['multi_brick', 'entire_area', 'entire_zone']
  return ['single_brick', 'multi_brick', 'entire_area', 'entire_zone']
}

function defaultAssignmentForRole(roleCode: string): TerritoryAssignmentType {
  if (roleCode === 'DEFAULT_ASM') return 'entire_area'
  if (roleCode === 'DEFAULT_MEDICAL_REP') return 'single_brick'
  return 'entire_area'
}

function inferAssignmentFromUser(item: User): TerritoryAssignmentType {
  const ter = typeof item.territoryId === 'object' && item.territoryId ? item.territoryId : null
  const cov = Array.isArray(item.coverageTerritoryIds) ? item.coverageTerritoryIds : []
  const covObjs = cov.filter((c): c is Territory => typeof c === 'object' && c != null && 'kind' in c)
  const covLen = covObjs.length
  if (ter?.kind === 'ZONE' && covLen === 0) return 'entire_zone'
  if (ter?.kind === 'AREA' && covLen === 0) return 'entire_area'
  if (ter?.kind === 'BRICK' && covLen === 0) return 'single_brick'
  if (ter?.kind === 'BRICK' && covLen > 0) return 'multi_brick'
  if (ter?.kind === 'AREA' && covLen > 0) return 'entire_area'
  if (ter?.kind === 'ZONE' && covLen > 0) return 'entire_zone'
  return 'single_brick'
}

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
  const [territoryAssignmentType, setTerritoryAssignmentType] = useState<TerritoryAssignmentType>('single_brick')
  const [multiBricks, setMultiBricks] = useState<Territory[]>([])
  const [primaryBrickId, setPrimaryBrickId] = useState<string | null>(null)
  const [legacyNonBrickCoverage, setLegacyNonBrickCoverage] = useState<Territory[]>([])
  const [territoryBulkPreview, setTerritoryBulkPreview] = useState<TerritoryCoveragePreview | null>(null)
  const [territorySaveConfirmOpen, setTerritorySaveConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [statusNextActive, setStatusNextActive] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [viewItem, setViewItem] = useState<User | null>(null)
  const [viewDetail, setViewDetail] = useState<(User & { territoryCoverageSummary?: TerritoryCoverageSummary }) | null>(
    null
  )
  const [viewDetailLoading, setViewDetailLoading] = useState(false)

  const { hasPermission, user: authUser } = useAuth()
  const canCreate = hasPermission('users.create')
  const canEdit = hasPermission('users.edit')
  const canDelete = hasPermission('users.delete')
  const canToggleStatus = canEdit || canDelete

  const isFormValid =
    form.name.trim() !== '' && form.email.trim() !== '' && form.roleId !== '' && (editItem ? true : form.password.trim() !== '')

  const prevRoleIdRef = useRef<string | null>(null)
  const activeFilterCount = countDateUserFilters(appliedFilters)
  const filterOpen = Boolean(filterAnchor)

  const defaultRepRoleId = useMemo(
    () => roleOptions.find(r => r.code === 'DEFAULT_MEDICAL_REP')?._id || roleOptions[0]?._id || '',
    [roleOptions]
  )

  const selectedRoleCode = useMemo(
    () => roleOptions.find(r => String(r._id) === String(form.roleId))?.code || '',
    [roleOptions, form.roleId]
  )

  const assignmentOptions = useMemo(() => allowedAssignmentTypes(selectedRoleCode), [selectedRoleCode])

  const coverageHydrationKey = useMemo(() => (open ? (editItem?._id ?? 'new') : ''), [open, editItem?._id])

  useEffect(() => {
    if (!open) {
      prevRoleIdRef.current = null
      return
    }
    const cur = form.roleId
    if (prevRoleIdRef.current === null) {
      prevRoleIdRef.current = cur
      return
    }
    if (prevRoleIdRef.current !== cur) {
      prevRoleIdRef.current = cur
      const rc = roleOptions.find(r => String(r._id) === String(cur))?.code || ''
      const opts = allowedAssignmentTypes(rc)
      const def = defaultAssignmentForRole(rc)
      setTerritoryAssignmentType(opts.includes(def) ? def : opts[0] ?? 'entire_area')
      setFormTerritory(null)
      setMultiBricks([])
      setPrimaryBrickId(null)
      setLegacyNonBrickCoverage([])
    }
  }, [open, form.roleId, roleOptions])

  const territoryBulkConfirmText = useMemo(() => {
    if (!formTerritory || (formTerritory.kind !== 'AREA' && formTerritory.kind !== 'ZONE')) return ''
    const kindLabel = formTerritory.kind === 'AREA' ? 'Area' : 'Zone'
    const n = territoryBulkPreview?.brickCount ?? 0
    const samples =
      territoryBulkPreview?.sampleBrickNames?.filter(Boolean).slice(0, 5).join(', ') || '—'
    const extraBricks =
      territoryAssignmentType === 'entire_area' || territoryAssignmentType === 'entire_zone'
        ? multiBricks.length
        : 0
    const extraPhrase =
      extraBricks > 0
        ? ` You are also adding ${extraBricks} additional brick${extraBricks === 1 ? '' : 's'} (unioned with the hierarchy; overlaps count once).`
        : ''
    return `${formTerritory.name} (${kindLabel}) — ${n} brick${n === 1 ? '' : 's'} from hierarchy under this anchor (examples: ${samples}).${extraPhrase} Doctor and order coverage will be recalculated from the expanded footprint.`
  }, [formTerritory, territoryBulkPreview, territoryAssignmentType, multiBricks.length])

  const onTerritoryCoveragePreview = useCallback((p: TerritoryCoveragePreview | null) => {
    setTerritoryBulkPreview(p)
  }, [])

  const handleAssignmentTypeChange = (next: TerritoryAssignmentType) => {
    setTerritoryAssignmentType(next)
    setFormTerritory(null)
    setMultiBricks([])
    setPrimaryBrickId(null)
    setLegacyNonBrickCoverage([])
  }

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
      const mRole =
        mgr && typeof mgr === 'object' && mgr.roleId && typeof mgr.roleId === 'object' && mgr.roleId !== null
          ? mgr.roleId
          : null
      setFormManager(
        mgr
          ? {
              _id: mgr._id,
              name: mgr.name,
              email: mgr.email,
              roleCode: mRole?.code ?? null,
              roleName: mRole?.name ?? null
            }
          : null
      )
      const ter = typeof item.territoryId === 'object' && item.territoryId ? item.territoryId : null
      const itemRoleCode = (item.roleId as Role | undefined)?.code || ''
      const opts = allowedAssignmentTypes(itemRoleCode)

      const toTerritory = (x: {
        _id: string
        name: string
        code?: string | null
        kind: Territory['kind']
      }): Territory => ({
        _id: x._id,
        name: x.name,
        code: x.code ?? undefined,
        kind: x.kind,
        isActive: true
      })

      const covRaw = Array.isArray(item.coverageTerritoryIds) ? item.coverageTerritoryIds : []
      const brickPick: Territory[] = []
      const nonBrick: Territory[] = []
      for (const c of covRaw) {
        if (!c || typeof c !== 'object' || !('_id' in c) || !('kind' in c)) continue
        const ct = c as Territory
        if (ct.kind === 'BRICK') brickPick.push(toTerritory(ct))
        else nonBrick.push(toTerritory(ct))
      }
      if (ter?.kind === 'BRICK') {
        brickPick.unshift(toTerritory(ter))
      }
      const seen = new Set<string>()
      const uniqueBricks = brickPick.filter(b => {
        const id = String(b._id)
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      setLegacyNonBrickCoverage(nonBrick)

      let inferred = inferAssignmentFromUser(item)
      if (!opts.includes(inferred)) inferred = opts[0] ?? 'single_brick'
      setTerritoryAssignmentType(inferred)

      const primary =
        ter?.kind === 'BRICK' && ter._id
          ? String(ter._id)
          : uniqueBricks[0]?._id
            ? String(uniqueBricks[0]._id)
            : null
      setPrimaryBrickId(inferred === 'multi_brick' ? primary : null)

      if (inferred === 'multi_brick') {
        setMultiBricks(uniqueBricks)
        setFormTerritory(null)
      } else {
        if (inferred === 'entire_area' || inferred === 'entire_zone') {
          setMultiBricks(ter?.kind === 'BRICK' ? [] : uniqueBricks)
        } else {
          setMultiBricks([])
        }
        const terOk =
          ter &&
          ((inferred === 'single_brick' && ter.kind === 'BRICK') ||
            (inferred === 'entire_area' && ter.kind === 'AREA') ||
            (inferred === 'entire_zone' && ter.kind === 'ZONE'))
        setFormTerritory(
          terOk
            ? ({
                _id: ter._id,
                name: ter.name,
                code: ter.code,
                kind: ter.kind,
                isActive: true
              } as Territory)
            : null
        )
      }
    } else {
      setEditItem(null)
      setForm({ name: '', email: '', password: '', phone: '', roleId: defaultRepRoleId, employeeCode: '' })
      setFormManager(null)
      setFormTerritory(null)
      setLegacyNonBrickCoverage([])
      setMultiBricks([])
      setPrimaryBrickId(null)
      const rc = roleOptions.find(r => String(r._id) === String(defaultRepRoleId))?.code || ''
      const o = allowedAssignmentTypes(rc)
      const def = defaultAssignmentForRole(rc)
      setTerritoryAssignmentType(o.includes(def) ? def : o[0] ?? 'single_brick')
    }
    setTerritoryBulkPreview(null)
    setTerritorySaveConfirmOpen(false)
    setOpen(true)
  }

  const fetchManagerOptions = async (search: string) => {
    const res = await usersService.assignable({ search, limit: 100 })
    const list = (res.data?.data || []) as ManagerLookup[]
    const exclude = editItem?._id
    let filtered = exclude ? list.filter(u => u._id !== exclude) : list
    const allowed = allowedManagerRoleCodesForSubordinate(selectedRoleCode)
    if (allowed !== null) {
      if (allowed.length === 0) filtered = []
      else if (selectedRoleCode === 'DEFAULT_RM') {
        filtered = filtered.filter(u => managerMatchesRmParent(u, allowed))
      } else {
        filtered = filtered.filter(u => Boolean(u.roleCode && allowed.includes(u.roleCode)))
      }
    }
    return filtered
  }

  /** Role-driven hierarchy: drop an invalid manager when the ladder role changes. */
  useEffect(() => {
    if (!open) return
    const allowed = allowedManagerRoleCodesForSubordinate(selectedRoleCode)
    if (allowed === null) return
    if (!formManager) return
    if (allowed.length === 0) {
      setFormManager(null)
      return
    }
    if (selectedRoleCode === 'DEFAULT_RM') {
      if (!managerMatchesRmParent(formManager, allowed)) setFormManager(null)
    } else if (!formManager.roleCode || !allowed.includes(formManager.roleCode)) {
      setFormManager(null)
    }
  }, [selectedRoleCode, open, formManager])

  useEffect(() => {
    if (!viewItem) {
      setViewDetail(null)
      return
    }
    let cancel = false
    setViewDetailLoading(true)
    usersService
      .getById(viewItem._id)
      .then(res => {
        const payload = res.data as {
          data?: User & { territoryCoverageSummary?: TerritoryCoverageSummary }
        }
        if (!cancel) setViewDetail(payload?.data ?? null)
      })
      .catch(() => {
        if (!cancel) setViewDetail(null)
      })
      .finally(() => {
        if (!cancel) setViewDetailLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [viewItem])

  const runSave = async () => {
    if (!assignmentOptions.includes(territoryAssignmentType)) {
      showApiError(new Error('This territory assignment type is not allowed for this role.'), 'Territory')
      return
    }

    let territoryId: string | null = null
    let coverageTerritoryIds: string[] = []

    if (territoryAssignmentType === 'multi_brick') {
      if (multiBricks.length === 0) {
        showApiError(new Error('Select at least one brick for custom multi-brick assignment.'), 'Territory')
        return
      }
      const pid =
        primaryBrickId && multiBricks.some(b => String(b._id) === String(primaryBrickId))
          ? String(primaryBrickId)
          : String(multiBricks[0]._id)
      territoryId = pid
      const extraBricks = multiBricks.map(b => String(b._id)).filter(id => id !== pid)
      const legacyIds = legacyNonBrickCoverage.map(t => String(t._id))
      const merged = [...extraBricks, ...legacyIds]
      const seen = new Set<string>()
      coverageTerritoryIds = merged.filter(id => {
        if (id === pid) return false
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
    } else {
      territoryId = formTerritory?._id ? String(formTerritory._id) : null
      const brickExtras =
        territoryAssignmentType === 'single_brick' ? [] : multiBricks.map(b => String(b._id))
      const legacyIds = legacyNonBrickCoverage.map(t => String(t._id))
      const merged = [...brickExtras, ...legacyIds]
      const seen = new Set<string>()
      coverageTerritoryIds = merged.filter(id => {
        if (territoryId && id === territoryId) return false
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
    }

    if (territoryAssignmentType === 'single_brick') {
      if (!formTerritory || formTerritory.kind !== 'BRICK') {
        showApiError(new Error('Select a brick for single-brick assignment.'), 'Territory')
        return
      }
    }
    if (territoryAssignmentType === 'entire_area') {
      if (!formTerritory || formTerritory.kind !== 'AREA') {
        showApiError(new Error('Select an area for entire-area assignment.'), 'Territory')
        return
      }
    }
    if (territoryAssignmentType === 'entire_zone') {
      if (!formTerritory || formTerritory.kind !== 'ZONE') {
        showApiError(new Error('Select a zone for entire-zone assignment.'), 'Territory')
        return
      }
    }

    setSaving(true)
    try {
      const isCompanyAdminRole = selectedRoleCode === 'DEFAULT_ADMIN'
      const effectiveManager = isCompanyAdminRole ? null : formManager
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId,
        employeeCode: form.employeeCode.trim() || null,
        managerId: effectiveManager?._id || null,
        territoryId,
        coverageTerritoryIds
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
      setSaving(false)
    }
  }

  const handleSave = () => {
    const t = formTerritory
    if (
      territoryAssignmentType !== 'multi_brick' &&
      t &&
      (t.kind === 'AREA' || t.kind === 'ZONE')
    ) {
      setTerritorySaveConfirmOpen(true)
      return
    }
    void runSave()
  }

  const handleConfirmTerritoryBulkSave = () => {
    setTerritorySaveConfirmOpen(false)
    void runSave()
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
            placeholder='Search users (name, phone, …)'
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

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='lg' fullWidth scroll='paper'>
        <DialogTitle>{editItem ? 'Edit User' : 'Add User'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pbs-4'>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Name'
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                inputProps={{ autoComplete: 'name', name: 'user_form_name' }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CustomTextField
                required
                fullWidth
                label='Email'
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                disabled={!!editItem}
                inputProps={{
                  id: 'user_form_email',
                  name: 'user_form_email',
                  autoComplete: editItem ? 'off' : 'email',
                  'data-lpignore': editItem ? 'true' : undefined
                }}
              />
            </Grid>
            {!editItem && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField
                  required
                  fullWidth
                  label='Password'
                  type='password'
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  inputProps={{ autoComplete: 'new-password', name: 'user_form_password' }}
                />
              </Grid>
            )}
            {editItem && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField
                  fullWidth
                  label='New password'
                  type='password'
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  helperText='Leave empty to keep current'
                  inputProps={{ autoComplete: 'new-password', name: 'user_form_new_password' }}
                />
              </Grid>
            )}
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
                key={`manager-${selectedRoleCode || 'any'}`}
                value={formManager}
                onChange={setFormManager}
                fetchOptions={fetchManagerOptions}
                label='Reports to (Manager)'
                disabled={selectedRoleCode === 'DEFAULT_ADMIN'}
                getOptionLabel={u =>
                  `${u.name} <${u.email}>${u.roleName ? ` · ${u.roleName}` : ''}`
                }
                helperText={
                  selectedRoleCode === 'DEFAULT_ADMIN'
                    ? 'Company administrators are top of the tenant hierarchy; manager is not used.'
                    : 'Search active users. The list is filtered by your role (MR→ASM, ASM→RM, RM→Admin).'
                }
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <UserFormCoverageSection
                dialogOpen={open}
                hydrationKey={coverageHydrationKey}
                assignmentOptions={assignmentOptions}
                strategy={territoryAssignmentType}
                onStrategyChange={handleAssignmentTypeChange}
                formTerritory={formTerritory}
                onFormTerritoryChange={setFormTerritory}
                multiBricks={multiBricks}
                primaryBrickId={primaryBrickId}
                onMultiBricksCommit={({ bricks, primaryId }) => {
                  setMultiBricks(bricks)
                  setPrimaryBrickId(primaryId)
                }}
                onExtrasBricksChange={bricks => {
                  setMultiBricks(bricks)
                  setPrimaryBrickId(null)
                }}
                hierarchyPreview={territoryBulkPreview}
                onHierarchyPreviewChange={onTerritoryCoveragePreview}
                legacyNonBrickWarning={legacyNonBrickCoverage.length > 0}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant='contained' onClick={handleSave} disabled={saving || !isFormValid} startIcon={saving ? <CircularProgress size={20} color='inherit' /> : undefined}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!viewItem} onClose={() => { setViewItem(null); setViewDetail(null) }} maxWidth='sm' fullWidth>
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
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary' className='mbe-1'>Territory assignment</Typography>
                {viewDetailLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <>
                    <Typography variant='body2' fontWeight={600}>
                      {viewDetail?.territoryCoverageSummary?.assignmentType || '—'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block' className='mte-1'>
                      Primary anchor:{' '}
                      {typeof viewItem.territoryId === 'object' && viewItem.territoryId
                        ? `${viewItem.territoryId.name} (${viewItem.territoryId.kind})`
                        : '—'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' display='block'>
                      Effective brick count:{' '}
                      <strong>{viewDetail?.territoryCoverageSummary?.brickCount ?? '—'}</strong>
                    </Typography>
                    {viewDetail?.territoryCoverageSummary?.previewBricks?.length ? (
                      <Box className='mte-2'>
                        <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                          Covered bricks (sample)
                        </Typography>
                        <div className='flex flex-wrap gap-1'>
                          {viewDetail.territoryCoverageSummary.previewBricks.map(b => (
                            <Chip
                              key={String(b._id)}
                              size='small'
                              variant='outlined'
                              label={b.code ? `${b.name} (${b.code})` : b.name}
                            />
                          ))}
                        </div>
                      </Box>
                    ) : null}
                  </>
                )}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary' className='mbe-1'>
                  Stored coverage territories
                </Typography>
                <Typography variant='caption' color='text.secondary' display='block' className='mbe-1'>
                  Unioned with primary expansion for effective footprint (may include legacy nodes).
                </Typography>
                {Array.isArray(viewItem.coverageTerritoryIds) && viewItem.coverageTerritoryIds.length ? (
                  <div className='flex flex-wrap gap-1'>
                    {viewItem.coverageTerritoryIds.map((t, i) =>
                      typeof t === 'object' && t && '_id' in t ? (
                        <Chip
                          key={(t as Territory)._id || i}
                          size='small'
                          variant='outlined'
                          label={`${(t as Territory).name}${(t as Territory).code ? ` (${(t as Territory).code})` : ''} · ${(t as Territory).kind}`}
                        />
                      ) : (
                        <Chip key={i} size='small' variant='outlined' label={String(t)} />
                      )
                    )}
                  </div>
                ) : (
                  <Typography variant='body2'>None</Typography>
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
        open={territorySaveConfirmOpen}
        onClose={() => !saving && setTerritorySaveConfirmOpen(false)}
        onConfirm={() => { void handleConfirmTerritoryBulkSave() }}
        title='Confirm territory coverage'
        description={territoryBulkConfirmText || 'Assign this area or zone as the coverage anchor?'}
        confirmText='Save'
        confirmColor='primary'
        icon='tabler-map-pin'
        loading={saving}
      />

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
