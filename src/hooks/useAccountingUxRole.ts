'use client'
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { resolveFinanceUxRole, isAccountantView, type FinanceUxRole } from '@/constants/accountingUx'

export function useAccountingUxRole(): {
  role: FinanceUxRole
  showTechnicalAccounting: boolean
  canAccessAdvancedAccounting: boolean
  canAccessBusinessFinance: boolean
  canCreateSimpleAccount: boolean
  canCreateMoneyAccountOnly: boolean
} {
  const { hasPermission } = useAuth()

  return useMemo(() => {
    const role = resolveFinanceUxRole(hasPermission)
    const canManage = hasPermission('accounts.manage')
    const canPay = hasPermission('payments.create')
    return {
      role,
      showTechnicalAccounting: isAccountantView(role),
      canAccessAdvancedAccounting: role === 'accountant',
      canAccessBusinessFinance: role === 'manager' || role === 'accountant',
      canCreateSimpleAccount: canManage || canPay,
      canCreateMoneyAccountOnly: canPay && !canManage
    }
  }, [hasPermission])
}
