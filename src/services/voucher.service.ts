import api from './api'
import type { Voucher, VoucherType } from '@/types/accounting'

export const voucherService = {
  list: (params?: Record<string, string>) => api.get('/vouchers', { params }),
  getById: (id: string) => api.get<{ data: Voucher }>(`/vouchers/${id}`),
  create: (body: {
    voucherType: VoucherType
    date?: string
    narration?: string
    paymentMethod?: string
    lines: { accountId: string; debit?: number; credit?: number; description?: string }[]
  }) => api.post<{ data: Voucher }>('/vouchers', body),
  fundTransfer: (body: {
    fromMoneyAccountId?: string
    toMoneyAccountId?: string
    fromAccountId?: string
    toAccountId?: string
    amount: number
    date?: string
    narration?: string
  }) => api.post<{ data: Voucher }>('/vouchers/fund-transfer', body),
  reverse: (id: string) => api.post<{ data: unknown }>(`/vouchers/${id}/reverse`)
}
