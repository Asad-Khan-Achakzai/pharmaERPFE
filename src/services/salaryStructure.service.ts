import api from './api'
import type { ProductPackIncentiveForm } from '@/utils/productIncentiveUtils'

export type SalaryStructurePayload = {
  name: string
  description?: string
  code?: string
  basicSalary: number
  dailyAllowance?: number
  allowances?: Array<{ name: string; type: 'fixed' | 'percentage'; value: number }>
  deductions?: Array<{ name: string; type: 'fixed' | 'percentage'; value: number }>
  commission?: { type: 'percentage'; value: number }
  productPackIncentives?: Array<{
    type: 'pack_slab'
    productId: string
    includeBonusQty: boolean
    slabs: Array<{ fromPacks: number; toPacks: number | null; ratePerPack: number }>
  }>
  isActive?: boolean
}

export type AssignedEmployee = {
  _id: string
  name: string
  email?: string
  role?: string
  employeeCode?: string
  isActive?: boolean
}

export const salaryStructureService = {
  list: (params?: Record<string, unknown>) => api.get('/salary-structures', { params: { templatesOnly: true, ...params } }),
  getById: (id: string) => api.get(`/salary-structures/${id}`),
  getActive: (employeeId: string) => api.get(`/salary-structures/active/${employeeId}`),
  listAssignedEmployees: (id: string) => api.get(`/salary-structures/${id}/employees`),
  assignEmployees: (id: string, employeeIds: string[]) =>
    api.post(`/salary-structures/${id}/assign`, { employeeIds }),
  unassignEmployees: (id: string, employeeIds: string[]) =>
    api.post(`/salary-structures/${id}/unassign`, { employeeIds }),
  create: (data: SalaryStructurePayload) => api.post('/salary-structures', data),
  update: (id: string, data: Partial<SalaryStructurePayload>) => api.put(`/salary-structures/${id}`, data)
}

export type { ProductPackIncentiveForm }
