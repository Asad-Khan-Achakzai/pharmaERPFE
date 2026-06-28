'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { accountService } from '@/services/account.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { useAccountingUxRole } from '@/hooks/useAccountingUxRole'
import { useAuth } from '@/contexts/AuthContext'
import { SimpleAccountCreateDialog } from '@/components/finance/SimpleAccountCreateDialog'
import { MoneyAccountEditDialog } from '@/components/finance/MoneyAccountEditDialog'
import ConfirmDialog from '@/components/dialogs/ConfirmDialog'
import { moneyAccountTypeLabel } from '@/constants/simpleAccountTypes'
import type { Account } from '@/types/accounting'
import type { SimpleAccountTypeId } from '@/constants/simpleAccountTypes'

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`

const MoneyAccountsPage = () => {
  const { hasPermission } = useAuth()
  const { canCreateSimpleAccount, canCreateMoneyAccountOnly, canAccessAdvancedAccounting } = useAccountingUxRole()
  const canVoucherEntry = hasPermission('vouchers.transfer')
  const canManage = hasPermission('accounts.manage')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<SimpleAccountTypeId | undefined>()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuAccount, setMenuAccount] = useState<Account | null>(null)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [toggleAccount, setToggleAccount] = useState<Account | null>(null)
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: r } = await accountService.listMoneyAccounts({ includeInactive: showInactive })
      setAccounts(r.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load money accounts')
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openCreate = (type?: SimpleAccountTypeId) => {
    setCreateType(type)
    setCreateOpen(true)
  }

  const openMenu = (e: React.MouseEvent<HTMLElement>, account: Account) => {
    setMenuAnchor(e.currentTarget)
    setMenuAccount(account)
  }

  const closeMenu = () => {
    setMenuAnchor(null)
    setMenuAccount(null)
  }

  const handleToggleActive = async () => {
    if (!toggleAccount) return
    setActionLoading(true)
    try {
      await accountService.update(toggleAccount._id, { isActive: !toggleAccount.isActive })
      showSuccess(toggleAccount.isActive ? 'Account deactivated' : 'Account reactivated')
      setToggleAccount(null)
      await fetchData()
    } catch (err) {
      showApiError(err, 'Failed to update account')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteAccount) return
    setActionLoading(true)
    try {
      await accountService.remove(deleteAccount._id)
      showSuccess('Account deleted')
      setDeleteAccount(null)
      await fetchData()
    } catch (err) {
      showApiError(err, 'Failed to delete account')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title={ACCOUNTING_UX.moneyAccounts}
          subheader='Cash and bank accounts used for payments, receipts, and transfers'
          action={
            <Stack direction='row' spacing={1} alignItems='center'>
              {canManage && (
                <FormControlLabel
                  control={<Switch size='small' checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />}
                  label='Show inactive'
                  slotProps={{ typography: { variant: 'body2', color: 'text.secondary' } }}
                />
              )}
              {canAccessAdvancedAccounting && (
                <Button variant='outlined' component={Link} href='/finance/accounts/advanced' size='small'>
                  {ACCOUNTING_UX.accountantMode}
                </Button>
              )}
              {canCreateSimpleAccount && (
                <Button variant='contained' onClick={() => openCreate()} size='small'>
                  {ACCOUNTING_UX.addMoneyAccount}
                </Button>
              )}
            </Stack>
          }
        />
        <CardContent>
          {loading ? (
            <div className='flex justify-center p-8'>
              <CircularProgress />
            </div>
          ) : accounts.length === 0 ? (
            <Stack spacing={2} alignItems='flex-start'>
              <Typography color='text.secondary'>No money accounts yet.</Typography>
              {canCreateSimpleAccount && (
                <Button variant='contained' onClick={() => openCreate('CASH')}>
                  Add your first cash or bank account
                </Button>
              )}
            </Stack>
          ) : (
            <Grid container spacing={3}>
              {accounts.map(a => {
                const showMenu = canManage && !a.isSystem
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={a._id}>
                    <Card variant='outlined' sx={{ height: '100%', opacity: a.isActive ? 1 : 0.65 }}>
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Stack direction='row' justifyContent='space-between' alignItems='flex-start'>
                            <Typography variant='h6' fontWeight={700}>
                              {a.isBank ? '🏦' : '💵'} {a.name}
                            </Typography>
                            <Stack direction='row' spacing={0.5} alignItems='center'>
                              {!a.isActive && <Chip label='Inactive' size='small' color='default' variant='tonal' />}
                              <Chip label={moneyAccountTypeLabel(a)} size='small' color='primary' variant='tonal' />
                              {showMenu && (
                                <IconButton size='small' onClick={e => openMenu(e, a)}>
                                  <i className='tabler-dots-vertical text-[20px]' />
                                </IconButton>
                              )}
                            </Stack>
                          </Stack>
                          <Typography variant='h5' fontWeight={700}>
                            {fmt(a.currentBalance ?? 0)}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            Available balance
                          </Typography>
                          {a.isActive && (
                            <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap className='mts-2'>
                              <Button size='small' variant='outlined' component={Link} href='/payments/add'>
                                Receive payment
                              </Button>
                              {canVoucherEntry && (
                                <Button size='small' variant='outlined' component={Link} href='/finance/transfers'>
                                  {ACCOUNTING_UX.transferMoney}
                                </Button>
                              )}
                            </Stack>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          )}

          <Typography variant='caption' color='text.secondary' display='block' className='mts-6'>
            {ACCOUNTING_UX.autoAccountingHint}
          </Typography>
        </CardContent>
      </Card>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            setEditAccount(menuAccount)
            closeMenu()
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setToggleAccount(menuAccount)
            closeMenu()
          }}
        >
          {menuAccount?.isActive ? 'Deactivate' : 'Reactivate'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteAccount(menuAccount)
            closeMenu()
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      <SimpleAccountCreateDialog
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setCreateType(undefined)
        }}
        onCreated={() => void fetchData()}
        initialType={createType}
        canCreateMoneyAccountOnly={canCreateMoneyAccountOnly}
      />

      <MoneyAccountEditDialog
        open={Boolean(editAccount)}
        account={editAccount}
        onClose={() => setEditAccount(null)}
        onSaved={() => void fetchData()}
      />

      <ConfirmDialog
        open={Boolean(toggleAccount)}
        onClose={() => setToggleAccount(null)}
        onConfirm={() => void handleToggleActive()}
        loading={actionLoading}
        title={toggleAccount?.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={
          toggleAccount?.isActive
            ? 'It will be hidden from new payments and transfers but kept for historical reports. You can reactivate it anytime.'
            : 'It will become available again for new payments and transfers.'
        }
        confirmText={toggleAccount?.isActive ? 'Yes, Deactivate' : 'Yes, Reactivate'}
        confirmColor={toggleAccount?.isActive ? 'warning' : 'success'}
      />

      <ConfirmDialog
        open={Boolean(deleteAccount)}
        onClose={() => setDeleteAccount(null)}
        onConfirm={() => void handleDelete()}
        loading={actionLoading}
        title='Delete this account?'
        description='This permanently removes an account that has never been used. Accounts with transaction history cannot be deleted — deactivate them instead.'
      />
    </>
  )
}

export default MoneyAccountsPage
