'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import CustomTextField from '@core/components/mui/TextField'
import { onboardingService } from '@/services/onboarding.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'

type StepCode =
  | 'COMPANY_SETUP'
  | 'MASTER_DATA'
  | 'OPENING_STOCK'
  | 'OPENING_BALANCES'
  | 'OPTIONAL_HISTORY'
  | 'VERIFICATION'
  | 'GO_LIVE'

const MASTER_ENTITY_OPTIONS = [
  'products',
  'pharmacies',
  'distributors',
  'employees',
  'openingStock',
  'openingBalances'
] as const

const HISTORY_ENTITY_OPTIONS = [
  'salesHistory',
  'returnsHistory',
  'collectionsHistory',
  'visitsHistory',
  'targetsHistory'
] as const

const IMPORT_SEQUENCE = ['products', 'pharmacies', 'distributors', 'employees', 'openingStock', 'openingBalances'] as const

type BusinessModule = {
  key: string
  title: string
  description: string
  entityType?: string
  step: StepCode
}

const MODULES: BusinessModule[] = [
  {
    key: 'company',
    title: 'Company Setup',
    description: 'Basic company profile, timezone, policies, and readiness preferences.',
    step: 'COMPANY_SETUP'
  },
  {
    key: 'products',
    title: 'Products Setup',
    description: 'Upload product catalog to enable stock, sales, and reporting.',
    entityType: 'products',
    step: 'MASTER_DATA'
  },
  {
    key: 'pharmacies',
    title: 'Pharmacy Setup',
    description: 'Upload customer pharmacies with required contact and commercial details.',
    entityType: 'pharmacies',
    step: 'MASTER_DATA'
  },
  {
    key: 'doctors',
    title: 'Doctor Setup',
    description: 'Upload doctor master data for field visits and doctor-focused analytics.',
    step: 'MASTER_DATA'
  },
  {
    key: 'employees',
    title: 'Employee Setup',
    description: 'Upload employee users to assign roles and begin operations.',
    entityType: 'employees',
    step: 'MASTER_DATA'
  },
  {
    key: 'openingStock',
    title: 'Opening Stock',
    description: 'Upload opening stock quantities and valuation to start inventory correctly.',
    entityType: 'openingStock',
    step: 'OPENING_STOCK'
  },
  {
    key: 'openingBalances',
    title: 'Financial Balances',
    description: 'Upload opening receivables, payables, and cash balances.',
    entityType: 'openingBalances',
    step: 'OPENING_BALANCES'
  },
  {
    key: 'historical',
    title: 'Previous Sales Data',
    description: 'Archive prior period sales and related data for business reference.',
    entityType: 'salesHistory',
    step: 'OPTIONAL_HISTORY'
  },
  {
    key: 'verification',
    title: 'Verification',
    description: 'Verify imported totals and resolve mismatches before activation.',
    step: 'VERIFICATION'
  },
  {
    key: 'activate',
    title: 'Activate ERP',
    description: 'Finalize setup and activate ERP for daily operations.',
    step: 'GO_LIVE'
  }
]

const TEMPLATE_ROWS: Record<string, { headers: string[]; sample: Array<Record<string, string | number>> }> = {
  products: {
    headers: ['ProductCode', 'ProductName', 'Composition', 'TP', 'MRP', 'Casting'],
    sample: [
      { ProductCode: 'PAN001', ProductName: 'Panadol', Composition: 'Paracetamol 500mg', TP: 120, MRP: 150, Casting: 95 },
      { ProductCode: 'AUG001', ProductName: 'Augmentin', Composition: 'Co-amoxiclav 625mg', TP: 450, MRP: 520, Casting: 360 },
      { ProductCode: 'CAL001', ProductName: 'Calpol', Composition: 'Paracetamol Syrup', TP: 90, MRP: 120, Casting: 70 }
    ]
  },
  pharmacies: {
    headers: ['PharmacyCode', 'PharmacyName', 'City', 'Phone', 'DiscountOnTP'],
    sample: [
      { PharmacyCode: 'PH001', PharmacyName: 'City Pharmacy', City: 'Karachi', Phone: '03001234567', DiscountOnTP: 5 },
      { PharmacyCode: 'PH002', PharmacyName: 'Al Rehman Medical', City: 'Lahore', Phone: '03007654321', DiscountOnTP: 4 },
      { PharmacyCode: 'PH003', PharmacyName: 'Life Care Pharmacy', City: 'Quetta', Phone: '03001112222', DiscountOnTP: 3 }
    ]
  },
  distributors: {
    headers: ['DistributorCode', 'DistributorName', 'City', 'Phone', 'CreditLimit'],
    sample: [
      { DistributorCode: 'DST001', DistributorName: 'City Distributor', City: 'Karachi', Phone: '03001230001', CreditLimit: 500000 },
      { DistributorCode: 'DST002', DistributorName: 'Metro Distribution', City: 'Lahore', Phone: '03001230002', CreditLimit: 450000 },
      { DistributorCode: 'DST003', DistributorName: 'Prime Medisupply', City: 'Islamabad', Phone: '03001230003', CreditLimit: 400000 }
    ]
  },
  doctors: {
    headers: ['DoctorCode', 'DoctorName', 'Specialization', 'City', 'MobileNo'],
    sample: [
      { DoctorCode: 'DR001', DoctorName: 'Dr. Ayesha Khan', Specialization: 'General Physician', City: 'Karachi', MobileNo: '03003334444' },
      { DoctorCode: 'DR002', DoctorName: 'Dr. Hamza Ali', Specialization: 'Pediatrics', City: 'Lahore', MobileNo: '03005556666' },
      { DoctorCode: 'DR003', DoctorName: 'Dr. Sana Rauf', Specialization: 'Cardiology', City: 'Islamabad', MobileNo: '03007778888' }
    ]
  },
  employees: {
    headers: ['EmployeeCode', 'Name', 'Email', 'Phone', 'Role'],
    sample: [
      { EmployeeCode: 'EMP001', Name: 'Ahmed Tariq', Email: 'ahmed.tariq@abcpharma.com', Phone: '03009991111', Role: 'ADMIN' },
      { EmployeeCode: 'EMP002', Name: 'Sara Imran', Email: 'sara.imran@abcpharma.com', Phone: '03009992222', Role: 'MEDICAL_REP' },
      { EmployeeCode: 'EMP003', Name: 'Bilal Shah', Email: 'bilal.shah@abcpharma.com', Phone: '03009993333', Role: 'MEDICAL_REP' }
    ]
  },
  openingStock: {
    headers: ['Distributor', 'Product', 'Batch', 'Expiry', 'Quantity', 'AvgCostPerUnit'],
    sample: [
      { Distributor: 'City Distributor', Product: 'Panadol', Batch: 'B001', Expiry: '2027-01', Quantity: 1000, AvgCostPerUnit: 95 },
      { Distributor: 'City Distributor', Product: 'Calpol', Batch: 'B002', Expiry: '2027-03', Quantity: 500, AvgCostPerUnit: 70 },
      { Distributor: 'Metro Distribution', Product: 'Augmentin', Batch: 'B003', Expiry: '2028-01', Quantity: 250, AvgCostPerUnit: 360 }
    ]
  },
  openingBalances: {
    headers: ['AccountType', 'EntityName', 'Amount', 'Side', 'Notes'],
    sample: [
      { AccountType: 'PHARMACY_RECEIVABLE', EntityName: 'City Pharmacy', Amount: 350000, Side: 'DEBIT', Notes: 'Opening receivable' },
      { AccountType: 'SUPPLIER_PAYABLE', EntityName: 'MediSource Labs', Amount: 210000, Side: 'DEBIT', Notes: 'Opening payable' },
      { AccountType: 'COMPANY_CASH', EntityName: '', Amount: 500000, Side: 'DEBIT', Notes: 'Opening cash balance' }
    ]
  },
  salesHistory: {
    headers: ['InvoiceNo', 'InvoiceDate', 'Pharmacy', 'Product', 'Quantity', 'NetAmount'],
    sample: [
      { InvoiceNo: 'INV-1001', InvoiceDate: '2026-04-01', Pharmacy: 'City Pharmacy', Product: 'Panadol', Quantity: 120, NetAmount: 18000 },
      { InvoiceNo: 'INV-1002', InvoiceDate: '2026-04-02', Pharmacy: 'Al Rehman Medical', Product: 'Augmentin', Quantity: 40, NetAmount: 20800 },
      { InvoiceNo: 'INV-1003', InvoiceDate: '2026-04-03', Pharmacy: 'Life Care Pharmacy', Product: 'Calpol', Quantity: 90, NetAmount: 10800 }
    ]
  },
  returnsHistory: {
    headers: ['ReturnNo', 'ReturnDate', 'Pharmacy', 'Product', 'Quantity', 'ReturnAmount'],
    sample: [
      { ReturnNo: 'RET-3001', ReturnDate: '2026-04-06', Pharmacy: 'City Pharmacy', Product: 'Panadol', Quantity: 8, ReturnAmount: 1200 },
      { ReturnNo: 'RET-3002', ReturnDate: '2026-04-08', Pharmacy: 'Al Rehman Medical', Product: 'Augmentin', Quantity: 2, ReturnAmount: 1040 },
      { ReturnNo: 'RET-3003', ReturnDate: '2026-04-10', Pharmacy: 'Life Care Pharmacy', Product: 'Calpol', Quantity: 6, ReturnAmount: 720 }
    ]
  },
  collectionsHistory: {
    headers: ['ReceiptNo', 'ReceiptDate', 'Pharmacy', 'Amount', 'Mode'],
    sample: [
      { ReceiptNo: 'COL-5001', ReceiptDate: '2026-04-07', Pharmacy: 'City Pharmacy', Amount: 25000, Mode: 'CASH' },
      { ReceiptNo: 'COL-5002', ReceiptDate: '2026-04-09', Pharmacy: 'Al Rehman Medical', Amount: 18000, Mode: 'BANK_TRANSFER' },
      { ReceiptNo: 'COL-5003', ReceiptDate: '2026-04-11', Pharmacy: 'Life Care Pharmacy', Amount: 22000, Mode: 'CHEQUE' }
    ]
  },
  visitsHistory: {
    headers: ['VisitDate', 'EmployeeCode', 'DoctorCode', 'PharmacyCode', 'Notes'],
    sample: [
      { VisitDate: '2026-04-04', EmployeeCode: 'EMP002', DoctorCode: 'DR001', PharmacyCode: 'PH001', Notes: 'Follow-up for new stock' },
      { VisitDate: '2026-04-05', EmployeeCode: 'EMP003', DoctorCode: 'DR002', PharmacyCode: 'PH002', Notes: 'Discussed monthly targets' },
      { VisitDate: '2026-04-06', EmployeeCode: 'EMP002', DoctorCode: 'DR003', PharmacyCode: 'PH003', Notes: 'Collected feedback on supply' }
    ]
  },
  targetsHistory: {
    headers: ['Month', 'EmployeeCode', 'TargetType', 'TargetValue', 'AchievedValue'],
    sample: [
      { Month: '2026-04', EmployeeCode: 'EMP002', TargetType: 'SALES_VALUE', TargetValue: 500000, AchievedValue: 470000 },
      { Month: '2026-04', EmployeeCode: 'EMP003', TargetType: 'SALES_VALUE', TargetValue: 420000, AchievedValue: 430000 },
      { Month: '2026-04', EmployeeCode: 'EMP001', TargetType: 'COLLECTION_VALUE', TargetValue: 350000, AchievedValue: 340000 }
    ]
  }
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

const statusColor = (status?: string): 'default' | 'warning' | 'success' | 'error' | 'info' => {
  if (!status) return 'default'
  if (status.includes('COMPLETED') || status === 'LIVE' || status === 'MATCHED') return 'success'
  if (status.includes('FAILED') || status === 'MISMATCHED') return 'error'
  if (status.includes('IN_PROGRESS') || status.includes('RUNNING')) return 'info'
  if (status.includes('READY')) return 'warning'
  return 'default'
}

const toFriendlyStatus = (status?: string) => {
  if (!status) return 'Pending'
  if (status === 'COMPLETED' || status === 'MATCHED' || status === 'LIVE') return 'Completed'
  if (status === 'IN_PROGRESS' || status === 'RUNNING') return 'In Progress'
  if (status === 'FAILED' || status === 'MISMATCHED') return 'Attention Required'
  if (status === 'READY_FOR_GO_LIVE') return 'Ready to Activate'
  return 'Pending'
}

const asCsv = (headers: string[], rows: Array<Record<string, string | number>>) => {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const out = [headers.join(',')]
  rows.forEach(r => out.push(headers.map(h => esc(r[h] ?? '')).join(',')))
  return out.join('\n')
}

const downloadFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const entityLabel = (entity: string) => {
  const labels: Record<string, string> = {
    products: 'Products',
    pharmacies: 'Pharmacies',
    distributors: 'Distributors',
    employees: 'Employees',
    openingStock: 'Opening Stock',
    openingBalances: 'Opening Balances',
    salesHistory: 'Sales History',
    returnsHistory: 'Returns History',
    collectionsHistory: 'Collections History',
    visitsHistory: 'Visits History',
    targetsHistory: 'Targets History'
  }
  return labels[entity] || entity
}

const OnboardingPage = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [recons, setRecons] = useState<any[]>([])
  const [archives, setArchives] = useState<any[]>([])
  const [opsSummary, setOpsSummary] = useState<any>(null)

  const [entityType, setEntityType] = useState<string>('products')
  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [masterFileBase64, setMasterFileBase64] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [historyFile, setHistoryFile] = useState<File | null>(null)
  const [historyFileBase64, setHistoryFileBase64] = useState('')
  const [dragTarget, setDragTarget] = useState<'master' | 'history' | null>(null)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [helpExpanded, setHelpExpanded] = useState(true)

  const [historyEntity, setHistoryEntity] = useState<(typeof HISTORY_ENTITY_OPTIONS)[number]>('salesHistory')
  const [historyFrom, setHistoryFrom] = useState<string>(() => new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10))
  const [historyTo, setHistoryTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const templateEntity = useMemo(() => (TEMPLATE_ROWS[entityType] ? entityType : 'products'), [entityType])
  const historyTemplateEntity = useMemo(() => (TEMPLATE_ROWS[historyEntity] ? historyEntity : 'salesHistory'), [historyEntity])
  const dataPresence = useMemo(() => opsSummary?.dataPresence || {}, [opsSummary?.dataPresence])

  const companyName = useMemo(() => {
    const active = user?.activeCompanyId
    if (!active) return 'Your Company'
    if (typeof active === 'string') return 'Your Company'
    return active.name || 'Your Company'
  }, [user?.activeCompanyId])

  const moduleState = useMemo(() => {
    const jobsByEntity = new Map<string, any>()
    jobs.forEach(j => {
      if (!jobsByEntity.has(j.entityType)) jobsByEntity.set(j.entityType, j)
    })
    const hasData = (entity: string) => Boolean(dataPresence?.[entity]?.satisfied)
    const countFor = (entity: string) => Number(dataPresence?.[entity]?.count || 0)
    const progressToStatus = (step: StepCode) => {
      const key = {
        COMPANY_SETUP: 'companySetup',
        MASTER_DATA: 'masterData',
        OPENING_STOCK: 'openingStock',
        OPENING_BALANCES: 'openingBalances',
        OPTIONAL_HISTORY: 'optionalHistory',
        VERIFICATION: 'verification',
        GO_LIVE: 'goLive'
      }[step]
      return session?.progress?.[key]?.status || 'PENDING'
    }
    return MODULES.map(m => {
      const job = m.entityType ? jobsByEntity.get(m.entityType) : null
      const dbSatisfied =
        (m.entityType && hasData(m.entityType)) ||
        (m.key === 'doctors' && hasData('doctors')) ||
        (m.key === 'historical' && archives.length > 0)
      const statusRaw = dbSatisfied ? 'COMPLETED' : job?.status || progressToStatus(m.step)
      let status: 'Completed' | 'In Progress' | 'Pending' | 'Attention Required' = 'Pending'
      if (statusRaw === 'COMPLETED' || statusRaw === 'LIVE' || statusRaw === 'MATCHED') status = 'Completed'
      else if (statusRaw === 'RUNNING' || statusRaw === 'IN_PROGRESS' || statusRaw === 'READY_FOR_GO_LIVE') status = 'In Progress'
      else if (statusRaw === 'FAILED' || statusRaw === 'MISMATCHED') status = 'Attention Required'
      const dbCount = m.entityType
        ? countFor(m.entityType)
        : m.key === 'doctors'
          ? countFor('doctors')
          : m.key === 'historical'
            ? archives.length
            : 0
      return {
        ...m,
        status,
        rawStatus: statusRaw,
        job,
        validRows: job?.metrics?.validRows ?? dbCount,
        invalidRows: job?.metrics?.invalidRows ?? 0,
        skippedRows: job?.metrics?.skippedRows ?? 0,
        totalRows: job?.metrics?.totalRows ?? dbCount
      }
    })
  }, [archives.length, dataPresence, jobs, session?.progress])

  const completionPct = useMemo(() => {
    const completed = moduleState.filter(m => m.status === 'Completed').length
    return Math.round((completed / moduleState.length) * 100)
  }, [moduleState])

  const nextAction = useMemo(() => {
    const attention = moduleState.find(m => m.status === 'Attention Required')
    if (attention) return attention
    const pending = moduleState.find(m => m.status === 'Pending')
    if (pending) return pending
    return moduleState.find(m => m.status !== 'Completed') || null
  }, [moduleState])

  const groupedErrors = useMemo(() => {
    if (!Array.isArray(result?.errors)) return []
    const map = new Map<string, number>()
    result.errors.forEach((e: any) => {
      const key = e.message || 'Validation issue'
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries()).map(([message, count]) => ({ message, count }))
  }, [result?.errors])

  const isDataSatisfied = useCallback((entity: string) => Boolean(dataPresence?.[entity]?.satisfied), [dataPresence])

  const firstLockedEntity = useMemo(() => {
    for (const entity of IMPORT_SEQUENCE) {
      if (!isDataSatisfied(entity)) return entity
    }
    return null
  }, [isDataSatisfied])

  const isEntityUnlocked = useCallback(
    (entity: string) => {
      const index = IMPORT_SEQUENCE.indexOf(entity as (typeof IMPORT_SEQUENCE)[number])
      if (index <= 0) return true
      return IMPORT_SEQUENCE.slice(0, index).every(prev => isDataSatisfied(prev))
    },
    [isDataSatisfied]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, j, r, a, o] = await Promise.all([
        onboardingService.session(),
        onboardingService.imports.list({ limit: 20, page: 1 }),
        onboardingService.reconciliations.list({ limit: 20, page: 1 }),
        onboardingService.historical.listArchives({ limit: 20, page: 1 }),
        onboardingService.ops.summary()
      ])
      setSession(s.data?.data || null)
      setJobs(j.data?.data || [])
      setRecons(r.data?.data || [])
      setArchives(a.data?.data || [])
      setOpsSummary(o.data?.data || null)
    } catch (e) {
      showApiError(e, 'Failed to load onboarding data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setFocusModule = (m: BusinessModule) => {
    if (m.entityType && MASTER_ENTITY_OPTIONS.includes(m.entityType as any)) {
      if (!isEntityUnlocked(m.entityType)) {
        showApiError(new Error('Please complete previous dependencies first'), `Please add ${firstLockedEntity} data before ${m.entityType}`)
        return
      }
      setEntityType(m.entityType)
      if (typeof window !== 'undefined') document.getElementById('data-import-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (m.key === 'doctors') {
      if (typeof window !== 'undefined') window.location.href = '/doctors/list'
      return
    }
    if (m.key === 'historical') {
      setHistoryEntity('salesHistory')
      if (typeof window !== 'undefined') document.getElementById('historical-import-center')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (m.step === 'VERIFICATION') {
      void markStep('VERIFICATION', 'IN_PROGRESS')
    }
  }

  const downloadBlankTemplate = (entity: string) => {
    const t = TEMPLATE_ROWS[entity]
    if (!t) return
    // Business users asked for ready-to-understand templates with test rows.
    // Keep template and sample aligned so every download has at least 3 example lines.
    downloadFile(`${entity}-template.csv`, asCsv(t.headers, t.sample))
    showSuccess('Template downloaded')
  }

  const downloadSampleTemplate = (entity: string) => {
    const t = TEMPLATE_ROWS[entity]
    if (!t) return
    downloadFile(`${entity}-sample.csv`, asCsv(t.headers, t.sample))
    showSuccess('Sample file downloaded')
  }

  const rollbackJob = async (id: string) => {
    setBusy(true)
    try {
      await onboardingService.imports.rollback(id, { reason: 'Manual rollback from onboarding console' })
      showSuccess('Rollback completed')
      await load()
    } catch (e) {
      showApiError(e, 'Rollback failed')
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setBusy(true)
    setLoadingAction('start')
    try {
      await onboardingService.start({ currentStep: session?.currentStep || 'COMPANY_SETUP' })
      showSuccess('Onboarding started')
      await load()
    } catch (e) {
      showApiError(e, 'Failed to start onboarding')
    } finally {
      setLoadingAction(null)
      setBusy(false)
    }
  }

  const markStep = async (step: StepCode, status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED') => {
    setBusy(true)
    try {
      await onboardingService.updateStep({ step, status, currentStep: step })
      showSuccess(`Step ${status.toLowerCase()}`)
      await load()
    } catch (e) {
      showApiError(e, 'Failed to update step')
    } finally {
      setBusy(false)
    }
  }

  const triggerGoLive = async () => {
    setBusy(true)
    setLoadingAction('goLive')
    try {
      await onboardingService.goLive()
      showSuccess('Go-live completed')
      await load()
    } catch (e) {
      showApiError(e, 'Go-live failed')
    } finally {
      setLoadingAction(null)
      setBusy(false)
    }
  }

  const ingestFile = async (target: 'master' | 'history', f?: File | null) => {
    if (!f) return
    const lowerName = f.name.toLowerCase()
    if (!(lowerName.endsWith('.xlsx') || lowerName.endsWith('.csv'))) {
      showApiError(new Error('Please upload a .csv or .xlsx file'), 'Invalid file type')
      return
    }
    if (target === 'master') {
      setPreview(null)
      setResult(null)
      setMasterFile(f)
    } else {
      setHistoryFile(f)
    }
    try {
      const b64 = await fileToBase64(f)
      if (target === 'master') setMasterFileBase64(b64)
      else setHistoryFileBase64(b64)
    } catch (err) {
      showApiError(err, 'Could not read file')
    }
  }

  const onMasterFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    await ingestFile('master', f)
  }

  const onHistoryFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    await ingestFile('history', f)
  }

  const onDropFile =
    (target: 'master' | 'history') =>
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragTarget(null)
      const f = e.dataTransfer.files?.[0]
      await ingestFile(target, f)
    }

  const resetMasterImportCard = () => {
    setMasterFile(null)
    setMasterFileBase64('')
    setPreview(null)
    setResult(null)
  }

  const resetHistoryImportCard = () => {
    setHistoryFile(null)
    setHistoryFileBase64('')
  }

  const runPreview = async () => {
    if (!masterFileBase64) return
    if (!isEntityUnlocked(entityType)) {
      showApiError(new Error('Please complete previous dependencies first'), `Please add ${firstLockedEntity} data before ${entityType}`)
      return
    }
    setBusy(true)
    setLoadingAction('preview')
    try {
      const res = await onboardingService.imports.preview({ entityType, fileBase64: masterFileBase64 })
      setPreview(res.data?.data || null)
      showSuccess('Preview generated')
    } catch (e) {
      showApiError(e, 'Preview failed')
    } finally {
      setLoadingAction(null)
      setBusy(false)
    }
  }

  const runCommit = async () => {
    if (!masterFileBase64 || !preview?.mapping) return
    if (!isEntityUnlocked(entityType)) {
      showApiError(new Error('Please complete previous dependencies first'), `Please add ${firstLockedEntity} data before ${entityType}`)
      return
    }
    setBusy(true)
    setLoadingAction('commit')
    try {
      const res = await onboardingService.imports.commit({
        entityType,
        fileBase64: masterFileBase64,
        mapping: preview.mapping,
        mode: 'COMMIT',
        skipDuplicates: true
      })
      setResult(res.data?.data || null)
      showSuccess('Import finished')
      if (entityType === 'openingStock') await markStep('OPENING_STOCK', 'COMPLETED')
      else if (entityType === 'openingBalances') await markStep('OPENING_BALANCES', 'COMPLETED')
      else await markStep('MASTER_DATA', 'IN_PROGRESS')
      await load()
      resetMasterImportCard()
    } catch (e) {
      showApiError(e, 'Import failed')
    } finally {
      setLoadingAction(null)
      setBusy(false)
    }
  }

  const archiveHistory = async () => {
    if (!historyFileBase64) return
    setBusy(true)
    setLoadingAction('history')
    try {
      await onboardingService.historical.archive({
        entityType: historyEntity,
        fileBase64: historyFileBase64,
        fromDate: historyFrom,
        toDate: historyTo,
        archiveMode: 'ARCHIVE_ONLY',
        file: historyFile ? { originalName: historyFile.name, sizeBytes: historyFile.size, mimeType: historyFile.type } : undefined
      })
      showSuccess('Historical data archived')
      await markStep('OPTIONAL_HISTORY', 'COMPLETED')
      await load()
      resetHistoryImportCard()
    } catch (e) {
      showApiError(e, 'Historical archive failed')
    } finally {
      setLoadingAction(null)
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Box className='flex items-center justify-center p-8'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Grid container spacing={6}>
      {opsSummary ? (
        <Grid size={{ xs: 12 }}>
          <Alert severity={opsSummary.reconciliationAlerts > 0 ? 'warning' : 'info'}>
            Reconciliation alerts: {opsSummary.reconciliationAlerts} | Recent failed jobs: {(opsSummary.recentFailures || []).length}
          </Alert>
        </Grid>
      ) : null}

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title={`Welcome to ${companyName} Setup`}
            subheader='Complete these steps to activate your ERP. Estimated setup time: 20-40 minutes.'
            action={
              <Stack spacing={1} sx={{ minInlineSize: 260 }}>
                <Stack direction='row' spacing={1} justifyContent='flex-end'>
                  <Chip label={toFriendlyStatus(session?.status)} color={statusColor(session?.status)} variant='tonal' />
                  <Chip label={`ERP Setup Progress: ${completionPct}%`} color='primary' variant='tonal' />
                </Stack>
                <LinearProgress variant='determinate' value={completionPct} />
              </Stack>
            }
          />
          <CardContent>
            <Stack spacing={2}>
              <Alert severity='info'>
                Complete these onboarding modules in sequence. We validate your uploaded data and show what is pending before ERP activation.
              </Alert>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} justifyContent='space-between'>
                <Box>
                  <Typography variant='subtitle2'>Recommended Next Action</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {nextAction ? `${nextAction.title}: ${nextAction.description}` : 'All setup modules are completed.'}
                  </Typography>
                </Box>
                <Stack direction='row' spacing={1}>
                  <Button variant='outlined' onClick={start} disabled={busy}>
                    {loadingAction === 'start' ? <CircularProgress size={16} color='inherit' /> : 'Resume Setup'}
                  </Button>
                  {nextAction?.entityType ? (
                    <Button
                      variant='contained'
                      onClick={() => setFocusModule(nextAction)}
                      disabled={busy || (!!nextAction.entityType && MASTER_ENTITY_OPTIONS.includes(nextAction.entityType as any) && !isEntityUnlocked(nextAction.entityType))}
                    >
                      {nextAction.key === 'historical' ? 'Open Previous Sales Import' : `Open Data Import Center (${nextAction.title.replace(' Setup', '')})`}
                    </Button>
                  ) : (
                    <Button variant='contained' color='success' onClick={triggerGoLive} disabled={busy || session?.status !== 'READY_FOR_GO_LIVE'}>
                      {loadingAction === 'goLive' ? <CircularProgress size={16} color='inherit' /> : 'Activate ERP'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardHeader
            title='How to Use This Page'
            subheader='One guided place for importing setup data and one place for historical archives.'
            action={
              <Button size='small' variant='text' onClick={() => setHelpExpanded(v => !v)}>
                {helpExpanded ? 'Hide Guide' : 'Show Guide'}
              </Button>
            }
          />
          {helpExpanded ? (
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
                    <Typography fontWeight={700}>1. Master Data Import</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Go to Data Import Center, choose entity, download template/sample, upload file, then run Validate Data.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
                    <Typography fontWeight={700}>2. Final Save to ERP</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      After validation looks correct, click Final Import to save records in your company database.
                    </Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant='outlined' sx={{ p: 2, height: '100%' }}>
                    <Typography fontWeight={700}>3. Optional Historical Import</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Use Previous Sales Import for legacy historical files. This is archival for reference and reconciliation.
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          ) : null}
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Grid container spacing={2}>
          {moduleState.map(m => (
            <Grid key={m.key} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant='outlined' sx={{ height: '100%' }}>
                <CardContent>
                  <Stack spacing={1.5} sx={{ height: '100%' }}>
                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                      <Typography fontWeight={700}>{m.title}</Typography>
                      <Chip label={m.status} size='small' color={statusColor(m.rawStatus)} variant='tonal' />
                    </Stack>
                    <Typography variant='body2' color='text.secondary'>
                      {m.description}
                    </Typography>
                    <Box>
                      <Typography variant='caption' color='text.secondary'>
                        Progress
                      </Typography>
                      <LinearProgress
                        variant='determinate'
                        value={m.status === 'Completed' ? 100 : m.status === 'In Progress' ? 55 : m.status === 'Attention Required' ? 40 : 10}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                    <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                      {m.entityType ? (
                        <Button
                          size='small'
                          variant='outlined'
                          onClick={() => setFocusModule(m)}
                          disabled={MASTER_ENTITY_OPTIONS.includes(m.entityType as any) && !isEntityUnlocked(m.entityType)}
                        >
                          {m.key === 'historical' ? 'Open Previous Sales Import' : 'Open Data Import Center'}
                        </Button>
                      ) : m.key === 'doctors' ? (
                        <Button size='small' variant='outlined' onClick={() => setFocusModule(m)}>
                          Open Doctors
                        </Button>
                      ) : m.step === 'GO_LIVE' ? (
                        <Button size='small' variant='contained' color='success' onClick={triggerGoLive} disabled={session?.status !== 'READY_FOR_GO_LIVE'}>
                          {loadingAction === 'goLive' ? <CircularProgress size={16} color='inherit' /> : 'Activate ERP'}
                        </Button>
                      ) : (
                        <Button size='small' variant='outlined' onClick={() => void markStep(m.step, 'IN_PROGRESS')}>
                          Continue
                        </Button>
                      )}
                    </Stack>
                    <Divider />
                    <Stack direction='row' spacing={1.5} flexWrap='wrap' useFlexGap>
                      <Tooltip title='Total uploaded rows for latest run'>
                        <Chip size='small' label={`Rows: ${m.totalRows}`} />
                      </Tooltip>
                      <Chip size='small' color='success' variant='tonal' label={`Valid: ${m.validRows}`} />
                      <Chip size='small' color='warning' variant='tonal' label={`Warnings: ${m.skippedRows}`} />
                      <Chip size='small' color='error' variant='tonal' label={`Issues: ${m.invalidRows}`} />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Grid>

      <Grid id='data-import-center' size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardHeader
            title='Data Import Center'
            subheader='Validate data first, then run final import when results look correct.'
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField select fullWidth label='Entity' value={entityType} onChange={e => setEntityType(e.target.value as any)}>
                  {MASTER_ENTITY_OPTIONS.map(e => (
                    <MenuItem key={e} value={e} disabled={!isEntityUnlocked(e)}>
                      {entityLabel(e)}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Stack direction='row' spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
                  <Button variant='outlined' onClick={() => downloadBlankTemplate(entityType)}>
                    Download Template
                  </Button>
                  <Button variant='outlined' onClick={() => downloadSampleTemplate(entityType)}>
                    Download Sample
                  </Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <input id='master-file-input' type='file' accept='.csv,.xlsx' hidden onChange={onMasterFileChange} />
                <Paper
                  variant='outlined'
                  onDragEnter={() => setDragTarget('master')}
                  onDragOver={e => {
                    e.preventDefault()
                    setDragTarget('master')
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={onDropFile('master')}
                  sx={{ p: 2, borderStyle: dragTarget === 'master' ? 'dashed' : 'solid', borderColor: dragTarget === 'master' ? 'primary.main' : 'divider' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent='space-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Drag and drop your `.csv` or `.xlsx` file here, or browse to upload.
                    </Typography>
                    <Button variant='outlined' component='label' htmlFor='master-file-input'>
                      Choose File
                    </Button>
                  </Stack>
                </Paper>
                {masterFile ? (
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Selected file: {masterFile.name}
                  </Typography>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction='row' spacing={1}>
                  <Button variant='outlined' onClick={runPreview} disabled={busy || !masterFileBase64 || !isEntityUnlocked(entityType)}>
                    {loadingAction === 'preview' ? <CircularProgress size={16} color='inherit' /> : 'Validate Data'}
                  </Button>
                  <Button variant='contained' onClick={runCommit} disabled={busy || !preview || !isEntityUnlocked(entityType)}>
                    {loadingAction === 'commit' ? <CircularProgress size={16} color='inherit' /> : 'Final Import'}
                  </Button>
                </Stack>
                <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                  Validate Data checks your file only. Final Import saves records to your company database.
                </Typography>
                {!isEntityUnlocked(entityType) ? (
                  <Typography variant='caption' color='warning.main' display='block' sx={{ mt: 1 }}>
                    Complete {firstLockedEntity || 'the previous dependency'} first. Imports must follow dependency order.
                  </Typography>
                ) : null}
              </Grid>
            </Grid>

            {preview ? (
              <>
                <Divider className='my-4' />
                <Typography variant='subtitle2' className='mbe-2'>
                  Validation Preview ({preview.totalRows} rows)
                </Typography>
                <Paper variant='outlined' sx={{ p: 2, maxHeight: 220, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(preview.sampleRows || [], null, 2)}</pre>
                </Paper>
              </>
            ) : null}

            {result ? (
              <>
                <Divider className='my-4' />
                <Typography variant='subtitle2' className='mbe-2'>
                  Validation Summary
                </Typography>
                <Grid container spacing={1.5} className='mbe-2'>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Paper variant='outlined' sx={{ p: 1.5 }}>
                      <Typography variant='caption' color='text.secondary'>Total Rows</Typography>
                      <Typography fontWeight={700}>{result.totalRows ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Paper variant='outlined' sx={{ p: 1.5 }}>
                      <Typography variant='caption' color='text.secondary'>Valid Rows</Typography>
                      <Typography fontWeight={700} color='success.main'>{result.created ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Paper variant='outlined' sx={{ p: 1.5 }}>
                      <Typography variant='caption' color='text.secondary'>Duplicate / Skipped</Typography>
                      <Typography fontWeight={700} color='warning.main'>{result.skipped ?? 0}</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Paper variant='outlined' sx={{ p: 1.5 }}>
                      <Typography variant='caption' color='text.secondary'>Issues</Typography>
                      <Typography fontWeight={700} color='error.main'>{result.failed ?? 0}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
                <Alert severity={result.failed > 0 ? 'warning' : 'success'}>
                  {result.failed > 0
                    ? `${result.failed} rows need attention before a clean import.`
                    : 'All rows look good. You can proceed confidently.'}
                </Alert>
                {groupedErrors.length > 0 ? (
                  <Stack spacing={0.5} className='mts-2'>
                    {groupedErrors.map(g => (
                      <Typography key={g.message} variant='body2'>
                        - {g.count} rows: {g.message}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
                {Array.isArray(result.errors) && result.errors.length > 0 ? (
                  <Paper variant='outlined' sx={{ mt: 2, maxHeight: 240, overflow: 'auto' }}>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Field</TableCell>
                          <TableCell>Message</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.errors.map((e: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{e.row}</TableCell>
                            <TableCell>{e.status}</TableCell>
                            <TableCell>{e.field || '—'}</TableCell>
                            <TableCell>{e.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                ) : null}
              </>
            ) : (
              <Paper variant='outlined' sx={{ mt: 3, p: 2 }}>
                <Typography variant='subtitle2'>No data uploaded yet</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Start by downloading a template and sample file, fill your business data, then upload for validation.
                </Typography>
                <Stack direction='row' spacing={1} className='mts-2'>
                  <Button variant='outlined' onClick={() => downloadBlankTemplate(templateEntity)}>
                    Download Template
                  </Button>
                  <Button variant='outlined' onClick={() => downloadSampleTemplate(templateEntity)}>
                    Download Sample File
                  </Button>
                </Stack>
              </Paper>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid id='historical-import-center' size={{ xs: 12, lg: 4 }}>
        <Card>
          <CardHeader title='Previous Sales Import' subheader='Import past-period data in a safe, bounded window.' />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <CustomTextField
                  select
                  fullWidth
                  label='Historical entity'
                  value={historyEntity}
                  onChange={e => setHistoryEntity(e.target.value as any)}
                >
                  {HISTORY_ENTITY_OPTIONS.map(e => (
                    <MenuItem key={e} value={e}>
                      {entityLabel(e)}
                    </MenuItem>
                  ))}
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction='row' spacing={1}>
                  <Button variant='outlined' onClick={() => downloadBlankTemplate(historyTemplateEntity)}>
                    Download Template
                  </Button>
                  <Button variant='outlined' onClick={() => downloadSampleTemplate(historyTemplateEntity)}>
                    Download Sample File
                  </Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <input id='history-file-input' type='file' accept='.csv,.xlsx' hidden onChange={onHistoryFileChange} />
                <Paper
                  variant='outlined'
                  onDragEnter={() => setDragTarget('history')}
                  onDragOver={e => {
                    e.preventDefault()
                    setDragTarget('history')
                  }}
                  onDragLeave={() => setDragTarget(null)}
                  onDrop={onDropFile('history')}
                  sx={{ p: 2, borderStyle: dragTarget === 'history' ? 'dashed' : 'solid', borderColor: dragTarget === 'history' ? 'primary.main' : 'divider' }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent='space-between'>
                    <Typography variant='body2' color='text.secondary'>
                      Drag and drop historical `.csv` or `.xlsx` file, or browse to upload.
                    </Typography>
                    <Button variant='outlined' component='label' htmlFor='history-file-input'>
                      Choose File
                    </Button>
                  </Stack>
                </Paper>
                {historyFile ? (
                  <Typography variant='caption' color='text.secondary' display='block'>
                    Selected file: {historyFile.name}
                  </Typography>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField type='date' label='From' fullWidth value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <CustomTextField type='date' label='To' fullWidth value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Button variant='contained' onClick={archiveHistory} disabled={busy || !historyFileBase64}>
                  {loadingAction === 'history' ? <CircularProgress size={16} color='inherit' /> : 'Import Previous Sales Data'}
                </Button>
              </Grid>
            </Grid>
            {archives.length === 0 ? (
              <Paper variant='outlined' sx={{ mt: 2, p: 2 }}>
                <Typography variant='subtitle2'>No previous sales data imported</Typography>
                <Typography variant='body2' color='text.secondary'>
                  This step is optional. Import only if you need historical business context in the ERP.
                </Typography>
              </Paper>
            ) : null}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardHeader title='Verify Imported Data' subheader='Compare imported totals with ERP totals before activation.' />
          <CardContent>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Module</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Imported</TableCell>
                  <TableCell>ERP Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      Verify Imported Data will appear after your first successful import.
                    </TableCell>
                  </TableRow>
                ) : (
                  recons.map((r: any) => (
                    <TableRow key={r._id}>
                      <TableCell>{r.entityType}</TableCell>
                      <TableCell>
                        <Chip size='small' label={r.status} color={statusColor(r.status)} variant='tonal' />
                      </TableCell>
                      <TableCell>{r.sourceCount}</TableCell>
                      <TableCell>{r.targetCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 6 }}>
        <Card>
          <CardHeader title='Import Activity' subheader='Recent data import runs and rollback controls.' />
          <CardContent>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Module</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Rows</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      No imports started yet. Upload your first module to begin setup.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs.map((j: any) => (
                    <TableRow key={j._id}>
                      <TableCell>{j.entityType}</TableCell>
                      <TableCell>{j.mode === 'COMMIT' ? 'Saved to ERP' : 'Validation Only'}</TableCell>
                      <TableCell>
                        <Chip size='small' label={j.status} color={statusColor(j.status)} variant='tonal' />
                      </TableCell>
                      <TableCell>{j.metrics?.totalRows ?? 0}</TableCell>
                      <TableCell align='right'>
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={busy || j.mode !== 'COMMIT' || j.status !== 'COMPLETED'}
                          onClick={() => void rollbackJob(j._id)}
                        >
                          Rollback
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Previous Sales Import History' />
          <CardContent>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Entity</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Rows</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {archives.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No previous sales imports yet.</TableCell>
                  </TableRow>
                ) : (
                  archives.map((a: any) => (
                    <TableRow key={a._id}>
                      <TableCell>{a.entityType}</TableCell>
                      <TableCell>
                        {a.period?.fromDate} - {a.period?.toDate}
                      </TableCell>
                      <TableCell>{a.archiveMode}</TableCell>
                      <TableCell>{a.rowCount}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default OnboardingPage
