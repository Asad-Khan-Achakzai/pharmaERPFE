'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import CustomTextField from '@core/components/mui/TextField'
import { accountService } from '@/services/account.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import type { Account, AccountGroupType } from '@/types/accounting'
import { ACCOUNTING_UX, friendlyAccountLabel } from '@/constants/accountingUx'
import tableStyles from '@core/styles/table.module.css'

const GROUP_COLORS: Record<AccountGroupType, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  ASSET: 'primary',
  LIABILITY: 'error',
  EQUITY: 'secondary',
  INCOME: 'success',
  EXPENSE: 'warning'
}

const flattenTree = (nodes: Account[], depth = 0): { account: Account; depth: number }[] => {
  const out: { account: Account; depth: number }[] = []
  for (const n of nodes) {
    out.push({ account: n, depth })
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1))
  }
  return out
}

/** Full COA tree — accountant / admin only */
const AdvancedAccountsPage = () => {
  const [tree, setTree] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '',
    name: '',
    groupType: 'EXPENSE' as AccountGroupType,
    parentId: '',
    isGroup: false
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: r } = await accountService.tree()
      setTree(r.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load chart of accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const flat = flattenTree(tree)
  const parentOptions = flat.filter(x => x.account.isGroup)

  const handleCreate = async () => {
    setSaving(true)
    try {
      await accountService.create({
        ...form,
        parentId: form.parentId || null
      })
      showSuccess('Account created')
      setOpen(false)
      setForm({ code: '', name: '', groupType: 'EXPENSE', parentId: '', isGroup: false })
      await fetchData()
    } catch (err) {
      showApiError(err, 'Failed to create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={ACCOUNTING_UX.advancedFinancialStructure}
        subheader={ACCOUNTING_UX.accountantOnlyHint}
        action={
          <Stack direction='row' spacing={1}>
            <Button variant='outlined' component={Link} href='/finance/accounts'>
              Business view
            </Button>
            <Button variant='contained' onClick={() => setOpen(true)}>
              Add {ACCOUNTING_UX.usableAccount}
            </Button>
          </Stack>
        }
      />
      <Alert severity='warning' className='mbe-0 mli-6 mri-6'>
        Accountant mode — changes here affect the full chart of accounts and GL posting.
      </Alert>
      <div className='overflow-x-auto pli-6 pbe-6 pbs-4'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Group Type</th>
              <th>Balance</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className='text-center p-6'>
                  <CircularProgress size={32} />
                </td>
              </tr>
            ) : flat.length === 0 ? (
              <tr>
                <td colSpan={5} className='text-center p-6'>
                  No accounts
                </td>
              </tr>
            ) : (
              flat.map(({ account, depth }) => (
                <tr key={account._id}>
                  <td>
                    <Typography component='span' fontWeight={account.isGroup ? 600 : 400} sx={{ pl: depth * 2, display: 'inline-block' }}>
                      {account.code}
                    </Typography>
                  </td>
                  <td>
                    <Stack direction='row' alignItems='center' spacing={1} flexWrap='wrap'>
                      <Typography component='span' fontWeight={account.isGroup ? 600 : 400}>
                        {friendlyAccountLabel(account.code, account.name, true)}
                      </Typography>
                      {account.isGroup && (
                        <Chip label={ACCOUNTING_UX.categoryFolder} size='small' variant='outlined' />
                      )}
                    </Stack>
                  </td>
                  <td>
                    <Chip label={account.groupType} size='small' color={GROUP_COLORS[account.groupType]} variant='tonal' />
                  </td>
                  <td>
                    {!account.isGroup && (
                      <Typography component='span' fontWeight={500}>
                        ₨ {(account.currentBalance ?? 0).toFixed(2)}
                      </Typography>
                    )}
                  </td>
                  <td>
                    <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                      {account.isControlAccount && <Chip label='Control' size='small' color='info' variant='tonal' />}
                      {account.isMoneyAccount && <Chip label='Money' size='small' />}
                      {account.isCash && <Chip label='Cash' size='small' />}
                      {account.isBank && <Chip label='Bank' size='small' />}
                    </Stack>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>New {ACCOUNTING_UX.usableAccount}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} className='pbs-4'>
            <Grid size={{ xs: 6 }}>
              <CustomTextField fullWidth label='Code' value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <CustomTextField
                fullWidth
                select
                label='Group Type'
                value={form.groupType}
                onChange={e => setForm({ ...form, groupType: e.target.value as AccountGroupType })}
              >
                {['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'].map(g => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField fullWidth label='Name' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                select
                label='Parent (optional)'
                value={form.parentId}
                onChange={e => setForm({ ...form, parentId: e.target.value })}
              >
                <MenuItem value=''>None</MenuItem>
                {parentOptions.map(({ account }) => (
                  <MenuItem key={account._id} value={account._id}>
                    {account.code} — {account.name}
                  </MenuItem>
                ))}
              </CustomTextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                select
                label='Account kind'
                value={form.isGroup ? 'yes' : 'no'}
                onChange={e => setForm({ ...form, isGroup: e.target.value === 'yes' })}
              >
                <MenuItem value='no'>{ACCOUNTING_UX.usableAccount}</MenuItem>
                <MenuItem value='yes'>{ACCOUNTING_UX.categoryFolder}</MenuItem>
              </CustomTextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant='contained' disabled={saving || !form.code || !form.name} onClick={() => void handleCreate()}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}

export default AdvancedAccountsPage
