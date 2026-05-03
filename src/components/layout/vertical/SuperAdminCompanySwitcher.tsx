'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { useAuth } from '@/contexts/AuthContext'
import { superAdminService } from '@/services/superAdmin.service'
import { showApiError } from '@/utils/apiErrors'

type CompanyRow = {
  _id: string
  name: string
  city?: string
}

const SuperAdminCompanySwitcher = () => {
  const { user, switchCompanyContext, needsCompanySelection } = useAuth()
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const show =
    user &&
    (user.userType === 'PLATFORM' || user.role === 'SUPER_ADMIN') &&
    !needsCompanySelection

  const activeId =
    user?.activeCompanyId && typeof user.activeCompanyId === 'object'
      ? String(user.activeCompanyId._id)
      : typeof user?.activeCompanyId === 'string'
        ? user.activeCompanyId
        : ''

  /** PLATFORM: options come from session — synchronous so Select `value` is never orphaned on first paint. */
  const platformCompanies = useMemo((): CompanyRow[] => {
    if (user?.userType !== 'PLATFORM' || !user.allowedCompanies?.length) return []
    return user.allowedCompanies.map(c => ({
      _id: String(c._id),
      name: c.name,
      city: c.city
    }))
  }, [user?.userType, user?.allowedCompanies])

  const load = useCallback(async () => {
    if (platformCompanies.length > 0) {
      setCompanies(platformCompanies)
      return
    }
    setLoading(true)
    try {
      const { data } = await superAdminService.listCompanies({ limit: 100, page: 1 })
      const rows: CompanyRow[] = (data.data || []).map((c: CompanyRow) => ({
        ...c,
        _id: String(c._id)
      }))
      setCompanies(rows)
    } catch (e) {
      showApiError(e, 'Failed to load companies')
    } finally {
      setLoading(false)
    }
  }, [platformCompanies])

  useEffect(() => {
    if (show) void load()
  }, [show, load])

  const effectiveCompanies = useMemo(
    () => (platformCompanies.length > 0 ? platformCompanies : companies),
    [platformCompanies, companies]
  )

  /**
   * MUI Select must not receive a `value` missing from `<MenuItem value>` children.
   * That triggers dev warnings and can corrupt Menu/modal focus + backdrop (full-page dimming).
   */
  const selectValue = useMemo(
    () =>
      activeId && effectiveCompanies.some(c => String(c._id) === String(activeId))
        ? String(activeId)
        : '',
    [activeId, effectiveCompanies]
  )

  const handleChange = useCallback(
    async (companyId: string) => {
      if (!companyId || companyId === activeId) return
      setBusy(true)
      try {
        if (user?.userType === 'PLATFORM') {
          await switchCompanyContext(companyId)
        } else {
          const { data } = await superAdminService.switchCompany(companyId)
          const payload = data.data as { tokens: { accessToken: string; refreshToken: string } }
          localStorage.setItem('accessToken', payload.tokens.accessToken)
          localStorage.setItem('refreshToken', payload.tokens.refreshToken)
          window.location.reload()
        }
      } catch (e) {
        showApiError(e, 'Could not switch company')
      } finally {
        setBusy(false)
      }
    },
    [activeId, user?.userType, switchCompanyContext]
  )

  if (!show) return null

  return (
    <FormControl size='small' sx={{ minWidth: 220 }} disabled={busy || loading}>
      <InputLabel id='sa-company-switch'>Company</InputLabel>
      <Select
        labelId='sa-company-switch'
        label='Company'
        displayEmpty
        value={selectValue}
        onChange={e => void handleChange(String(e.target.value))}
        renderValue={selected => {
          if (selected) {
            const row = effectiveCompanies.find(c => String(c._id) === String(selected))
            return row
              ? `${row.name}${row.city ? ` · ${row.city}` : ''}`
              : selected
          }
          if (activeId && loading) return 'Loading companies…'
          if (activeId && effectiveCompanies.length === 0 && !loading) {
            return 'Companies unavailable — check network or refresh'
          }
          if (activeId) return 'Select company'
          return 'Select company'
        }}
        MenuProps={{
          PaperProps: { sx: { maxHeight: 320 } }
        }}
      >
        {effectiveCompanies.map(c => (
          <MenuItem key={c._id} value={c._id}>
            {c.name}
            {c.city ? ` · ${c.city}` : ''}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default SuperAdminCompanySwitcher
