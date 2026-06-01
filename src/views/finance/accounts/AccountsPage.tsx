'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { accountService } from '@/services/account.service'
import { showApiError } from '@/utils/apiErrors'
import { ACCOUNTING_UX } from '@/constants/accountingUx'
import { useAccountingUxRole } from '@/hooks/useAccountingUxRole'
import { SimpleAccountCreateDialog } from '@/components/finance/SimpleAccountCreateDialog'
import type { Account } from '@/types/accounting'

type BusinessView = {
  moneyAccounts: Account[]
  expenseCategories: Account[]
  incomeCategories: Account[]
  inventoryAccounts: Account[]
  notices: { suppliers: string; pharmacies: string }
}

const fmt = (n: number) => `₨ ${(n ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`

const AccountSection = ({
  title,
  icon,
  hint,
  accounts,
  emptyLabel
}: {
  title: string
  icon: string
  hint?: string
  accounts: Account[]
  emptyLabel: string
}) => (
  <Card variant='outlined' sx={{ height: '100%' }}>
    <CardHeader
      title={
        <Stack direction='row' spacing={1} alignItems='center'>
          <span>{icon}</span>
          <span>{title}</span>
        </Stack>
      }
      subheader={hint}
    />
    <CardContent>
      {accounts.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          {emptyLabel}
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {accounts.map(a => (
            <Stack
              key={a._id}
              direction='row'
              justifyContent='space-between'
              alignItems='center'
              sx={{ py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Typography fontWeight={500}>{a.name}</Typography>
              <Typography fontWeight={600}>{fmt(a.currentBalance ?? 0)}</Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </CardContent>
  </Card>
)

const AccountsPage = () => {
  const { canCreateSimpleAccount, canCreateMoneyAccountOnly, canAccessAdvancedAccounting } = useAccountingUxRole()
  const [data, setData] = useState<BusinessView | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: r } = await accountService.businessView()
      setData(r.data)
    } catch (err) {
      showApiError(err, 'Failed to load financial structure')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return (
    <>
      <Stack spacing={3}>
        <Card>
          <CardHeader
            title={ACCOUNTING_UX.financialStructure}
            subheader='Your business accounts — organized without accounting jargon'
            action={
              <Stack direction='row' spacing={1}>
                <Button variant='outlined' component={Link} href='/finance/money-accounts' size='small'>
                  {ACCOUNTING_UX.moneyAccounts}
                </Button>
                {canAccessAdvancedAccounting && (
                  <Button variant='outlined' component={Link} href='/finance/accounts/advanced' size='small'>
                    {ACCOUNTING_UX.accountantMode}
                  </Button>
                )}
                {canCreateSimpleAccount && (
                  <Button variant='contained' onClick={() => setCreateOpen(true)} size='small'>
                    {ACCOUNTING_UX.addAccount}
                  </Button>
                )}
              </Stack>
            }
          />
          <CardContent>
            <Alert severity='info' className='mbe-4'>
              {ACCOUNTING_UX.simpleModeHint}
            </Alert>
            {loading ? (
              <div className='flex justify-center p-8'>
                <CircularProgress />
              </div>
            ) : data ? (
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <AccountSection
                    title={ACCOUNTING_UX.moneyAccounts}
                    icon='🏦'
                    hint='Used in payments, receipts, and transfers'
                    accounts={data.moneyAccounts}
                    emptyLabel='No money accounts — add a cash or bank account'
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <AccountSection
                    title={ACCOUNTING_UX.expenseCategories}
                    icon='💸'
                    hint='Tracks what the business spends'
                    accounts={data.expenseCategories}
                    emptyLabel='No expense categories yet'
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <AccountSection
                    title={ACCOUNTING_UX.incomeCategories}
                    icon='📈'
                    hint='Tracks money earned'
                    accounts={data.incomeCategories}
                    emptyLabel='No income categories yet'
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <AccountSection
                    title={ACCOUNTING_UX.inventoryAssets}
                    icon='📦'
                    hint='Stock and asset values'
                    accounts={data.inventoryAccounts}
                    emptyLabel='No inventory accounts yet'
                  />
                </Grid>
              </Grid>
            ) : null}
          </CardContent>
        </Card>

        <Typography variant='caption' color='text.secondary'>
          {ACCOUNTING_UX.autoAccountingHint} Supplier and pharmacy balances are managed in their respective modules.
        </Typography>
      </Stack>

      <SimpleAccountCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void fetchData()}
        canCreateMoneyAccountOnly={canCreateMoneyAccountOnly}
      />
    </>
  )
}

export default AccountsPage
