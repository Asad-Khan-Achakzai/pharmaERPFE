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
import { accountService } from '@/services/account.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { useAccountingUxRole } from '@/hooks/useAccountingUxRole'
import { useAuth } from '@/contexts/AuthContext'
import { SimpleAccountCreateDialog } from '@/components/finance/SimpleAccountCreateDialog'
import { moneyAccountTypeLabel } from '@/constants/simpleAccountTypes'
import type { Account } from '@/types/accounting'
import type { SimpleAccountTypeId } from '@/constants/simpleAccountTypes'

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`

const MoneyAccountsPage = () => {
  const { hasPermission } = useAuth()
  const { canCreateSimpleAccount, canCreateMoneyAccountOnly, canAccessAdvancedAccounting } = useAccountingUxRole()
  const canVoucherEntry = hasPermission('vouchers.transfer')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<SimpleAccountTypeId | undefined>()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: r } = await accountService.listMoneyAccounts()
      setAccounts(r.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load money accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const openCreate = (type?: SimpleAccountTypeId) => {
    setCreateType(type)
    setCreateOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader
          title={ACCOUNTING_UX.moneyAccounts}
          subheader='Cash and bank accounts used for payments, receipts, and transfers'
          action={
            <Stack direction='row' spacing={1}>
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
              {accounts.map(a => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={a._id}>
                  <Card variant='outlined' sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Stack direction='row' justifyContent='space-between' alignItems='flex-start'>
                          <Typography variant='h6' fontWeight={700}>
                            {a.isBank ? '🏦' : '💵'} {a.name}
                          </Typography>
                          <Chip label={moneyAccountTypeLabel(a)} size='small' color='primary' variant='tonal' />
                        </Stack>
                        <Typography variant='h5' fontWeight={700}>
                          {fmt(a.currentBalance ?? 0)}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Available balance
                        </Typography>
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
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          <Typography variant='caption' color='text.secondary' display='block' className='mts-6'>
            {ACCOUNTING_UX.autoAccountingHint}
          </Typography>
        </CardContent>
      </Card>

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
    </>
  )
}

export default MoneyAccountsPage
