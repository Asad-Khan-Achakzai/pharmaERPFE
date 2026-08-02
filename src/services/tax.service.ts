import api from './api'

export type CompanyTaxConfig = {
  _id?: string
  companyId?: string
  enabled: boolean
  countryCode: string
  currency: string
  taxYear?: { mode?: string; startMonth?: number; label?: string }
  rounding?: { strategy?: string; decimalPrecision?: number }
  defaultBehaviour?: {
    missingTaxStatus?: string
    taxExemptSkipsAll?: boolean
    writeOffTaxPolicy?: string
  }
  executionOrder?: string[]
  printDefaults?: {
    showLicense?: boolean
    showNtn?: boolean
    showStrn?: boolean
    showTaxBreakdown?: boolean
  }
}

export type TaxRule = {
  _id: string
  taxTypeCode: string
  name: string
  description?: string
  sectionCode?: string
  calculationMethod?: string
  calculationBase?: string
  appliesTo?: string
  condition?: { taxStatus?: string }
  postingBehavior?: string
  liabilityAccountCode: string
  priority?: number
  isActive?: boolean
  rateVersions?: Array<{
    _id?: string
    ratePercent?: number
    effectiveFrom: string
    effectiveTo?: string | null
    reason?: string
  }>
}

export type TaxRegisterKpis = {
  totalTaxCollected: number
  outstandingLiability: number
  taxDeposited: number
  pendingTaxEntries: number
  invoicesWithTax: number
  currentTaxPeriod: string
  reconciliation: {
    glBalance: number
    registerBalance: number
    difference: number
    outOfBalance: boolean
    glLiability?: { accountCode: string; accountName: string; currentBalance: number }
  }
}

export type TaxDeposit = {
  _id: string
  depositNumber: string
  governmentAuthority?: string
  taxPeriodFrom?: string | null
  taxPeriodTo?: string | null
  paymentDate?: string | null
  paymentReference?: string
  bankReference?: string
  moneyAccountId?: string | { _id: string; name?: string; code?: string } | null
  amount: number
  currency?: string
  status: string
  receiptAttachment?: {
    url?: string
    fileName?: string
    mimeType?: string
    mediaAssetId?: string | null
  }
  registerEntryIds?: string[]
  voucherId?: string | null
  notes?: string
  entries?: any[]
  createdBy?: { name?: string } | string
  submittedAt?: string | null
  createdAt?: string
  reverseReason?: string
  reversedAt?: string | null
  remittanceNumber?: string
  canReverse?: boolean
  canEdit?: boolean
  isComplete?: boolean
}

const mimeForFormat = (format?: string) => {
  const fmt = String(format || 'xlsx').toLowerCase()
  if (fmt === 'pdf') return 'application/pdf'
  if (fmt === 'csv') return 'text/csv;charset=utf-8'
  return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}

const extensionForFormat = (format?: string) => {
  const fmt = String(format || 'xlsx').toLowerCase()
  if (fmt === 'pdf') return 'pdf'
  if (fmt === 'csv') return 'csv'
  return 'xlsx'
}

const downloadExport = async (url: string, params?: Record<string, string>) => {
  const format = params?.format || 'xlsx'
  const res = await api.get(url, { params: { ...params, format }, responseType: 'blob' })
  const data = res.data as Blob

  // API errors often arrive as JSON blobs when responseType is blob
  if (data instanceof Blob && data.type && data.type.includes('application/json')) {
    const text = await data.text()
    let message = 'Export failed'
    try {
      const parsed = JSON.parse(text)
      message = parsed?.message || parsed?.error || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const disposition = (res.headers?.['content-disposition'] ||
    res.headers?.['Content-Disposition']) as string | undefined
  let filename = `tax-export.${extensionForFormat(format)}`
  if (disposition) {
    const match = /filename\*?=(?:UTF-8''|")?([^\";\n]+)"?/i.exec(disposition)
    if (match?.[1]) filename = decodeURIComponent(match[1].replace(/"/g, ''))
  }
  if (!/\.(xlsx|csv|pdf)$/i.test(filename)) {
    filename = `${filename}.${extensionForFormat(format)}`
  }

  const blob =
    data instanceof Blob
      ? data.type
        ? data
        : new Blob([data], { type: mimeForFormat(format) })
      : new Blob([data], { type: mimeForFormat(format) })

  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export const taxService = {
  getConfig: () => api.get<{ data: CompanyTaxConfig }>('/tax/config'),
  updateConfig: (body: Partial<CompanyTaxConfig>) =>
    api.put<{ data: CompanyTaxConfig }>('/tax/config', body),
  listCatalog: () => api.get<{ data: Array<{ code: string; label: string }> }>('/tax/catalog'),
  listRules: () => api.get<{ data: TaxRule[] }>('/tax/rules'),
  createRule: (body: Partial<TaxRule>) => api.post<{ data: TaxRule }>('/tax/rules', body),
  updateRule: (id: string, body: Partial<TaxRule>) =>
    api.patch<{ data: TaxRule }>(`/tax/rules/${id}`, body),
  deleteRule: (id: string) => api.delete(`/tax/rules/${id}`),
  preview: (body: Record<string, unknown>) => api.post<{ data: unknown }>('/tax/preview', body),
  seedPakistanPack: () => api.post<{ data: unknown }>('/tax/seed/pakistan-advance-tax'),

  registerReport: (params?: Record<string, string>) =>
    api.get<{
      data: {
        rows: any[]
        totals: { taxAmount: number; taxableAmount?: number }
        count?: number
        kpis?: TaxRegisterKpis
        statusOptions?: Array<{ value: string; label: string }>
        taxTypeOptions?: Array<{ code: string; label: string }>
      }
    }>('/tax/reports/register', { params }),

  registerSummary: (params?: Record<string, string>) =>
    api.get<{ data: TaxRegisterKpis }>('/tax/reports/register/summary', { params }),

  summaryReport: (params?: Record<string, string>) =>
    api.get<{ data: { rows: unknown[] } }>('/tax/reports/summary', { params }),

  liabilityReport: () => api.get<{ data: unknown }>('/tax/reports/liability'),

  collectionSummary: (params?: Record<string, string>) =>
    api.get<{ data: any }>('/tax/reports/collection', { params }),

  byPharmacy: (params?: Record<string, string>) =>
    api.get<{ data: { rows: any[] } }>('/tax/reports/by-pharmacy', { params }),

  byTaxType: (params?: Record<string, string>) =>
    api.get<{ data: { rows: any[] } }>('/tax/reports/by-type', { params }),

  outstanding: () => api.get<{ data: any }>('/tax/reports/outstanding'),

  filingReport: (params?: Record<string, string>) =>
    api.get<{ data: any }>('/tax/reports/filing', { params }),

  depositHistory: (params?: Record<string, string>) =>
    api.get<{ data: { rows: any[]; totals: any } }>('/tax/reports/deposits', { params }),

  reconciliation: (params?: Record<string, string>) =>
    api.get<{ data: any }>('/tax/reports/reconciliation', { params }),

  charts: (params?: Record<string, string>) =>
    api.get<{ data: any }>('/tax/reports/charts', { params }),

  exportRegister: (params?: Record<string, string>) =>
    downloadExport('/tax/reports/register/export', { ...params, format: params?.format || 'xlsx' }),

  exportReport: (type: string, params?: Record<string, string>) =>
    downloadExport(`/tax/reports/${type}/export`, { ...params, format: params?.format || 'xlsx' }),

  createRemittance: (body: {
    amount: number
    moneyAccountId: string
    taxTypeCode?: string
    narration?: string
  }) => api.post<{ data: unknown }>('/tax/remittances', body),

  listDeposits: (params?: Record<string, string>) =>
    api.get<{ data: { rows: TaxDeposit[]; count: number } }>('/tax/deposits', { params }),

  getDeposit: (id: string) => api.get<{ data: TaxDeposit }>(`/tax/deposits/${id}`),

  createDeposit: (body: Record<string, unknown>) =>
    api.post<{ data: TaxDeposit }>('/tax/deposits', body),

  updateDeposit: (id: string, body: Record<string, unknown>) =>
    api.patch<{ data: TaxDeposit }>(`/tax/deposits/${id}`, body),

  addDepositEntries: (id: string, registerEntryIds: string[]) =>
    api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/entries`, { registerEntryIds }),

  removeDepositEntry: (id: string, entryId: string) =>
    api.delete<{ data: TaxDeposit }>(`/tax/deposits/${id}/entries/${entryId}`),

  submitDeposit: (id: string, body: Record<string, unknown>) =>
    api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/submit`, body),

  attachReceipt: (id: string, body: Record<string, unknown>) =>
    api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/receipt`, body),

  closeDeposit: (id: string) => api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/close`),

  cancelDeposit: (id: string, body?: { reason?: string }) =>
    api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/cancel`, body || {}),

  reverseDeposit: (id: string, body: { reason: string }) =>
    api.post<{ data: TaxDeposit }>(`/tax/deposits/${id}/reverse`, body),

  listOpenEntries: (params?: Record<string, string>) =>
    api.get<{ data: { rows: any[]; total: number } }>('/tax/deposits/open-entries', { params })
}
