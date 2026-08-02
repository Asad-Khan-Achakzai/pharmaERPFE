'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import CustomTextField from '@core/components/mui/TextField'
import { taxService, type CompanyTaxConfig, type TaxRule } from '@/services/tax.service'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import { useAuth } from '@/contexts/AuthContext'
import {
  AVAILABLE_TAX_TYPES,
  DEFAULT_LIABILITY_BY_TYPE,
  calculationBaseLabel,
  formatDate,
  formatMoney,
  taxStatusLabel,
  taxTypeLabel
} from './taxUiLabels'

type PreviewResult = {
  enabled?: boolean
  lines?: Array<{
    taxTypeCode?: string
    taxTypeName?: string
    taxSection?: string
    taxDescription?: string
    calculationBase?: string
    calculationBaseAmount?: number
    ratePercent?: number | null
    taxAmount?: number
  }>
  taxTotal?: number
  invoiceGrandTotal?: number
  meta?: {
    engineVersion?: string
    postingVersion?: string
    executionOrderApplied?: string[]
    countryCode?: string
    currency?: string
    pharmacyTaxStatus?: string
    taxExempt?: boolean
    taxExemptReason?: string
    amounts?: { goodsNetPayable?: number; taxTotal?: number; invoiceGrandTotal?: number }
  }
}

type RuleGroup = {
  key: string
  taxTypeCode: string
  taxName: string
  section: string
  calculationBase: string
  active: boolean
  effectiveFrom: string | null
  rates: Array<{ label: string; percent: number | null }>
  ruleIds: string[]
}

const groupRulesForDisplay = (rules: TaxRule[]): RuleGroup[] => {
  const byType = new Map<string, TaxRule[]>()
  for (const r of rules) {
    const key = r.taxTypeCode || r._id
    if (!byType.has(key)) byType.set(key, [])
    byType.get(key)!.push(r)
  }

  return [...byType.entries()].map(([taxTypeCode, list]) => {
    const section = list.find(r => r.sectionCode)?.sectionCode || ''
    const calculationBase = list[0]?.calculationBase || 'NET_PAYABLE'
    const active = list.some(r => r.isActive !== false)
    let earliest: string | null = null
    const rates: RuleGroup['rates'] = []

    for (const r of list) {
      const rv = r.rateVersions?.[0]
      const pct = rv?.ratePercent ?? null
      const label = r.condition?.taxStatus
        ? taxStatusLabel(r.condition.taxStatus)
        : list.length === 1
          ? 'Standard'
          : r.name
      rates.push({ label, percent: pct })
      if (rv?.effectiveFrom) {
        if (!earliest || new Date(rv.effectiveFrom) < new Date(earliest)) {
          earliest = rv.effectiveFrom
        }
      }
    }

    return {
      key: taxTypeCode,
      taxTypeCode,
      taxName: taxTypeLabel(taxTypeCode),
      section,
      calculationBase,
      active,
      effectiveFrom: earliest,
      rates,
      ruleIds: list.map(r => r._id)
    }
  })
}

const TaxConfigPage = () => {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('tax.manage') || hasPermission('admin.access')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<CompanyTaxConfig | null>(null)
  const [rules, setRules] = useState<TaxRule[]>([])
  const [previewNet, setPreviewNet] = useState('100000')
  const [previewStatus, setPreviewStatus] = useState('FILER')
  const [previewPharmacyName, setPreviewPharmacyName] = useState('Sample Pharmacy')
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previewRan, setPreviewRan] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    taxTypeCode: 'ADVANCE_TAX_236H',
    name: '',
    sectionCode: '236H',
    calculationBase: 'NET_PAYABLE',
    taxStatus: 'FILER',
    ratePercent: '0.5',
    effectiveFrom: new Date().toISOString().slice(0, 10)
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, rulesRes] = await Promise.all([taxService.getConfig(), taxService.listRules()])
      setConfig(cfgRes.data.data)
      setRules(rulesRes.data.data || [])
    } catch (err) {
      showApiError(err, 'Failed to load tax configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ruleGroups = useMemo(() => groupRulesForDisplay(rules), [rules])
  const currency = config?.currency || 'PKR'
  const isPakistan = (config?.countryCode || '').toUpperCase() === 'PK'
  const enabledSet = useMemo(() => new Set(config?.executionOrder || []), [config?.executionOrder])

  const saveConfig = async (patch: Partial<CompanyTaxConfig>, silent = false) => {
    if (!canManage) return
    setSaving(true)
    try {
      const res = await taxService.updateConfig(patch)
      setConfig(res.data.data)
      if (!silent) showSuccess('Tax settings saved')
    } catch (err) {
      showApiError(err, 'Failed to save tax settings')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabledTax = async (code: string, checked: boolean) => {
    if (!canManage || !config) return
    const current = [...(config.executionOrder || [])]
    const next = checked
      ? current.includes(code)
        ? current
        : [...current, code]
      : current.filter(c => c !== code)
    setConfig({ ...config, executionOrder: next })
    await saveConfig({ executionOrder: next })
  }

  const installPakistanPack = async () => {
    if (!canManage) return
    setSaving(true)
    try {
      await taxService.seedPakistanPack()
      showSuccess('Pakistan tax configuration installed')
      setInstallOpen(false)
      await load()
    } catch (err) {
      showApiError(err, 'Could not install Pakistan tax configuration')
    } finally {
      setSaving(false)
    }
  }

  const openCreateRule = () => {
    setCreateForm({
      taxTypeCode: 'ADVANCE_TAX_236H',
      name: 'Advance Tax (Section 236H) — Filer',
      sectionCode: '236H',
      calculationBase: 'NET_PAYABLE',
      taxStatus: 'FILER',
      ratePercent: '0.5',
      effectiveFrom: new Date().toISOString().slice(0, 10)
    })
    setCreateOpen(true)
  }

  const submitCreateRule = async () => {
    if (!canManage) return
    const rate = Number(createForm.ratePercent)
    if (!createForm.name.trim()) {
      showApiError(null, 'Please enter a tax name')
      return
    }
    if (!Number.isFinite(rate) || rate < 0) {
      showApiError(null, 'Please enter a valid rate percentage')
      return
    }
    setSaving(true)
    try {
      await taxService.createRule({
        taxTypeCode: createForm.taxTypeCode,
        name: createForm.name.trim(),
        description: createForm.name.trim(),
        sectionCode: createForm.sectionCode,
        calculationMethod: 'PERCENTAGE',
        calculationBase: createForm.calculationBase,
        appliesTo: 'BY_TAX_STATUS',
        condition: { taxStatus: createForm.taxStatus },
        postingBehavior: 'ADD_TO_RECEIVABLE',
        liabilityAccountCode: DEFAULT_LIABILITY_BY_TYPE[createForm.taxTypeCode] || '2140',
        priority: 10,
        isActive: true,
        rateVersions: [
          {
            ratePercent: rate,
            effectiveFrom: new Date(createForm.effectiveFrom).toISOString(),
            effectiveTo: null,
            reason: 'Created from Tax Configuration'
          }
        ]
      })
      const order = config?.executionOrder || []
      if (!order.includes(createForm.taxTypeCode)) {
        await taxService.updateConfig({ executionOrder: [...order, createForm.taxTypeCode] })
      }
      showSuccess('Tax rule created')
      setCreateOpen(false)
      await load()
    } catch (err) {
      showApiError(err, 'Could not create tax rule')
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    try {
      const res = await taxService.preview({
        netPayable: Number(previewNet) || 0,
        taxStatus: previewStatus,
        businessDate: new Date().toISOString()
      })
      setPreviewResult(res.data.data as PreviewResult)
      setPreviewRan(true)
    } catch (err) {
      showApiError(err, 'Could not calculate tax preview')
    }
  }

  const scrollToRules = () => {
    document.getElementById('tax-rules-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex justify-center p-8'>
          <CircularProgress size={32} />
        </CardContent>
      </Card>
    )
  }

  const goodsAmount = Number(previewNet) || 0
  const previewLines = previewResult?.lines || []
  const hasPreviewTax = previewLines.length > 0
  const previewCurrency = previewResult?.meta?.currency || currency

  return (
    <Stack spacing={3}>
      {/* Company settings */}
      <Card>
        <CardHeader
          title='Company Tax Settings'
          subheader='Control whether tax is charged on customer invoices for this company.'
        />
        <CardContent>
          <Stack spacing={3}>
            {!config?.enabled && (
              <Alert severity='info'>
                Tax is currently turned off. Invoice amounts will include goods only. Configure your tax rules below, set each
                pharmacy as Filer or Non-Filer, then turn tax on.
              </Alert>
            )}
            {config?.enabled && !rules.length && (
              <Alert severity='warning'>
                Tax is turned on, but no tax rules are configured yet. Install a tax pack or create a custom rule before
                delivering orders.
              </Alert>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(config?.enabled)}
                  disabled={!canManage || saving}
                  onChange={(_, checked) => saveConfig({ enabled: checked })}
                />
              }
              label={
                <Box>
                  <Typography fontWeight={600}>
                    {config?.enabled ? 'Tax is active on invoices' : 'Tax is inactive'}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    When active, applicable tax is added to the invoice total and tracked as a tax liability.
                  </Typography>
                </Box>
              }
            />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  select
                  SelectProps={{ native: true }}
                  fullWidth
                  label='Country'
                  value={config?.countryCode || 'PK'}
                  disabled={!canManage}
                  helperText='Used to suggest the right default tax setup.'
                  onChange={e => {
                    const countryCode = e.target.value.toUpperCase()
                    setConfig(c => (c ? { ...c, countryCode } : c))
                    void saveConfig({ countryCode })
                  }}
                >
                  <option value='PK'>Pakistan</option>
                  <option value='AE'>United Arab Emirates</option>
                  <option value='SA'>Saudi Arabia</option>
                  <option value='OTHER'>Other</option>
                </CustomTextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <CustomTextField
                  fullWidth
                  label='Currency'
                  value={config?.currency || 'PKR'}
                  disabled={!canManage}
                  helperText='Currency shown on tax amounts and previews.'
                  onChange={e => setConfig(c => (c ? { ...c, currency: e.target.value.toUpperCase() } : c))}
                  onBlur={() => config && saveConfig({ currency: config.currency })}
                />
              </Grid>
            </Grid>

            <Box>
              <Typography variant='subtitle2' className='mbe-1'>
                Enabled taxes
              </Typography>
              <Typography variant='body2' color='text.secondary' className='mbe-3'>
                Select which taxes can apply on invoices. Rules for each tax still need to be configured below.
              </Typography>
              <Stack direction='row' flexWrap='wrap' gap={1}>
                {AVAILABLE_TAX_TYPES.map(t => (
                  <FormControlLabel
                    key={t.code}
                    control={
                      <Checkbox
                        checked={enabledSet.has(t.code)}
                        disabled={!canManage || saving}
                        onChange={(_, checked) => void toggleEnabledTax(t.code, checked)}
                      />
                    }
                    label={t.label}
                  />
                ))}
              </Stack>
              {(config?.executionOrder || []).length > 0 && (
                <Stack direction='row' flexWrap='wrap' gap={1} className='mts-2'>
                  {(config?.executionOrder || []).map(code => (
                    <Chip key={code} size='small' color='primary' variant='tonal' label={taxTypeLabel(code)} />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Tax rules */}
      <Card id='tax-rules-section'>
        <CardHeader
          title='Tax Rules'
          subheader='These rules determine how tax is calculated on invoices.'
          action={
            canManage && rules.length > 0 ? (
              <Stack direction='row' spacing={1}>
                {isPakistan && (
                  <Button variant='tonal' onClick={() => setInstallOpen(true)} disabled={saving}>
                    Reinstall Pakistan pack
                  </Button>
                )}
                <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreateRule}>
                  Create tax rule
                </Button>
              </Stack>
            ) : undefined
          }
        />
        <CardContent>
          {!rules.length ? (
            <Box className='text-center py-8 px-4'>
              <Box className='inline-flex items-center justify-center rounded-full bg-actionHover mlb-2' sx={{ width: 72, height: 72 }}>
                <i className='tabler-receipt-tax text-3xl text-primary' />
              </Box>
              <Typography variant='h5' className='mbe-2'>
                No tax rules have been configured yet
              </Typography>
              <Typography color='text.secondary' className='mbe-6' sx={{ maxWidth: 520, mx: 'auto' }}>
                {isPakistan
                  ? 'To get started, you can install the default Pakistan tax configuration or create your own custom tax rules.'
                  : 'Create a custom tax rule to define how tax should be calculated on invoices for this company.'}
              </Typography>
              {canManage && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='center'>
                  {isPakistan && (
                    <Button
                      variant='contained'
                      size='large'
                      startIcon={<i className='tabler-package' />}
                      onClick={() => setInstallOpen(true)}
                      disabled={saving}
                    >
                      Install Pakistan Tax Pack
                    </Button>
                  )}
                  <Button
                    variant={isPakistan ? 'tonal' : 'contained'}
                    size='large'
                    startIcon={<i className='tabler-plus' />}
                    onClick={openCreateRule}
                    disabled={saving}
                  >
                    Create Custom Tax Rule
                  </Button>
                </Stack>
              )}
              {!canManage && (
                <Typography color='text.secondary'>You need tax management permission to configure rules.</Typography>
              )}
            </Box>
          ) : (
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Tax name</TableCell>
                  <TableCell>Section</TableCell>
                  <TableCell>Calculation base</TableCell>
                  <TableCell>Rates</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Effective date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ruleGroups.map(g => (
                  <TableRow key={g.key} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{g.taxName}</Typography>
                    </TableCell>
                    <TableCell>{g.section || '—'}</TableCell>
                    <TableCell>
                      <Typography>{calculationBaseLabel(g.calculationBase)}</Typography>
                      <Typography variant='caption' color='text.secondary'>
                        The amount on which this tax is calculated.
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        {g.rates.map((r, idx) => (
                          <Typography key={`${g.key}-${idx}`} variant='body2'>
                            <strong>{r.label}</strong>
                            {r.percent != null ? ` · ${r.percent}%` : ' · —'}
                          </Typography>
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size='small'
                        label={g.active ? 'Active' : 'Inactive'}
                        color={g.active ? 'success' : 'default'}
                        variant='tonal'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>{formatDate(g.effectiveFrom)}</Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Applies to invoices on or after this date.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader
          title='Tax Preview'
          subheader='Estimate tax for a sample invoice. This does not create or change any invoice.'
        />
        <CardContent>
          <Grid container spacing={3} className='mbe-4'>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Goods amount'
                type='number'
                value={previewNet}
                onChange={e => setPreviewNet(e.target.value)}
                helperText='Net amount before tax (after discounts).'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                fullWidth
                label='Pharmacy name'
                value={previewPharmacyName}
                onChange={e => setPreviewPharmacyName(e.target.value)}
                helperText='For display only in this preview.'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CustomTextField
                select
                SelectProps={{ native: true }}
                fullWidth
                label='Tax status'
                value={previewStatus}
                onChange={e => setPreviewStatus(e.target.value)}
                helperText='Choose whether this pharmacy is a Filer or Non-Filer.'
              >
                <option value='FILER'>Filer</option>
                <option value='NON_FILER'>Non-Filer</option>
              </CustomTextField>
            </Grid>
          </Grid>

          <Button variant='contained' onClick={runPreview} startIcon={<i className='tabler-calculator' />}>
            Calculate tax
          </Button>

          {previewRan && previewResult && (
            <Box className='mt-6'>
              {!previewResult.enabled ? (
                <Alert severity='info'>
                  Tax is turned off for this company. Turn on tax in Company Tax Settings to include tax on invoices.
                </Alert>
              ) : !hasPreviewTax ? (
                <Alert
                  severity='warning'
                  action={
                    <Button color='inherit' size='small' onClick={scrollToRules}>
                      View tax rules
                    </Button>
                  }
                >
                  <Typography fontWeight={600} className='mbe-1'>
                    No tax could be calculated
                  </Typography>
                  <Typography variant='body2' component='div'>
                    Possible reasons:
                    <ul className='mis-4 mbs-1'>
                      <li>No active tax rule exists</li>
                      <li>Tax rules have not been configured</li>
                      <li>The rule is outside its effective period</li>
                      <li>The pharmacy is marked as tax exempt</li>
                    </ul>
                  </Typography>
                </Alert>
              ) : (
                <Stack spacing={3}>
                  <Box
                    sx={{
                      border: theme => `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      p: 3,
                      bgcolor: 'action.hover'
                    }}
                  >
                    <Typography variant='overline' color='text.secondary'>
                      Preview summary
                    </Typography>
                    <Grid container spacing={2} className='mbs-2'>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SummaryRow label='Goods amount' value={formatMoney(goodsAmount, previewCurrency)} />
                        <SummaryRow label='Pharmacy' value={previewPharmacyName || '—'} />
                        <SummaryRow label='Tax status' value={taxStatusLabel(previewStatus)} />
                        <SummaryRow
                          label='Calculation base'
                          value={calculationBaseLabel(previewLines[0]?.calculationBase || 'NET_PAYABLE')}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <SummaryRow
                          label='Applied rule'
                          value={
                            previewLines[0]?.taxDescription ||
                            previewLines[0]?.taxTypeName ||
                            taxTypeLabel(previewLines[0]?.taxTypeCode)
                          }
                        />
                        <SummaryRow
                          label='Rate'
                          value={
                            previewLines.length === 1 && previewLines[0]?.ratePercent != null
                              ? `${previewLines[0].ratePercent}%`
                              : `${previewLines.length} tax line(s)`
                          }
                        />
                        <SummaryRow
                          label='Tax amount'
                          value={formatMoney(previewResult.taxTotal || 0, previewCurrency)}
                          emphasize
                        />
                        <SummaryRow
                          label='Grand total'
                          value={formatMoney(previewResult.invoiceGrandTotal || goodsAmount, previewCurrency)}
                          emphasize
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {previewLines.length > 0 && (
                    <Box>
                      <Typography variant='subtitle2' className='mbe-2'>
                        Tax breakdown
                      </Typography>
                      <Table size='small'>
                        <TableHead>
                          <TableRow>
                            <TableCell>Tax</TableCell>
                            <TableCell>Rate</TableCell>
                            <TableCell>Base</TableCell>
                            <TableCell align='right'>Amount</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewLines.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                {line.taxDescription || line.taxTypeName || taxTypeLabel(line.taxTypeCode)}
                                {line.taxSection ? (
                                  <Typography variant='caption' color='text.secondary' display='block'>
                                    Section {line.taxSection}
                                  </Typography>
                                ) : null}
                              </TableCell>
                              <TableCell>{line.ratePercent != null ? `${line.ratePercent}%` : '—'}</TableCell>
                              <TableCell>
                                {formatMoney(line.calculationBaseAmount || 0, previewCurrency)}
                                <Typography variant='caption' color='text.secondary' display='block'>
                                  {calculationBaseLabel(line.calculationBase)}
                                </Typography>
                              </TableCell>
                              <TableCell align='right'>
                                {formatMoney(line.taxAmount || 0, previewCurrency)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  )}
                </Stack>
              )}

              <Accordion disableGutters elevation={0} sx={{ mt: 3, bgcolor: 'transparent' }}>
                <AccordionSummary expandIcon={<i className='tabler-chevron-down' />}>
                  <Typography variant='body2' color='text.secondary'>
                    Developer details
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant='caption' color='text.secondary' display='block' className='mbe-2'>
                    Technical metadata for support and debugging. Not required for day-to-day accounting.
                  </Typography>
                  <Typography component='pre' sx={{ whiteSpace: 'pre-wrap', fontSize: 12, m: 0 }}>
                    {JSON.stringify(previewResult, null, 2)}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Install Pakistan pack dialog */}
      <Dialog open={installOpen} onClose={() => !saving && setInstallOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Install Pakistan Tax Pack?</DialogTitle>
        <DialogContent>
          <Typography color='text.secondary' className='mbe-3'>
            This will set up the standard Pakistan advance tax configuration for your company:
          </Typography>
          <Box
            sx={{
              border: theme => `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              p: 2.5,
              mb: 2
            }}
          >
            <Typography fontWeight={600}>Advance Tax — Section 236H</Typography>
            <Typography variant='body2' color='text.secondary' className='mbe-2'>
              Calculation base: Net payable
            </Typography>
            <Divider className='mbe-2' />
            <Typography variant='body2'>
              <strong>Filer</strong> — 0.5%
            </Typography>
            <Typography variant='body2'>
              <strong>Non-Filer</strong> — 2.5%
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary'>
            Existing matching rules are left unchanged. You can adjust rates later if government rates change.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstallOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => void installPakistanPack()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-package' />}
          >
            {saving ? 'Installing…' : 'Install Pakistan Tax Pack'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create custom rule dialog */}
      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Create Custom Tax Rule</DialogTitle>
        <DialogContent>
          <Stack spacing={3} className='mbs-1'>
            <CustomTextField
              select
              SelectProps={{ native: true }}
              fullWidth
              label='Tax type'
              value={createForm.taxTypeCode}
              helperText='Choose the kind of tax this rule applies.'
              onChange={e => {
                const taxTypeCode = e.target.value
                const meta = AVAILABLE_TAX_TYPES.find(t => t.code === taxTypeCode)
                setCreateForm(f => ({
                  ...f,
                  taxTypeCode,
                  sectionCode: meta?.section || f.sectionCode,
                  name: meta ? `${meta.label} — ${taxStatusLabel(f.taxStatus)}` : f.name
                }))
              }}
            >
              {AVAILABLE_TAX_TYPES.map(t => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </CustomTextField>
            <CustomTextField
              fullWidth
              label='Tax name'
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              helperText='A clear name finance users will recognise on invoices and reports.'
            />
            <CustomTextField
              fullWidth
              label='Section / reference'
              value={createForm.sectionCode}
              onChange={e => setCreateForm(f => ({ ...f, sectionCode: e.target.value }))}
              helperText='e.g. 236H for Pakistan Advance Tax.'
            />
            <CustomTextField
              select
              SelectProps={{ native: true }}
              fullWidth
              label='Calculation base'
              value={createForm.calculationBase}
              onChange={e => setCreateForm(f => ({ ...f, calculationBase: e.target.value }))}
              helperText='The amount on which this tax is calculated.'
            >
              <option value='NET_PAYABLE'>Net payable</option>
              <option value='GROSS_AMOUNT'>Gross amount</option>
              <option value='AFTER_DISCOUNT'>After discount</option>
              <option value='SUBTOTAL'>Subtotal</option>
            </CustomTextField>
            <CustomTextField
              select
              SelectProps={{ native: true }}
              fullWidth
              label='Applies to tax status'
              value={createForm.taxStatus}
              onChange={e => {
                const taxStatus = e.target.value
                setCreateForm(f => ({
                  ...f,
                  taxStatus,
                  name: `${taxTypeLabel(f.taxTypeCode)} — ${taxStatusLabel(taxStatus)}`
                }))
              }}
              helperText='Choose whether this rule is for Filer or Non-Filer pharmacies.'
            >
              <option value='FILER'>Filer</option>
              <option value='NON_FILER'>Non-Filer</option>
            </CustomTextField>
            <CustomTextField
              fullWidth
              type='number'
              label='Rate (%)'
              value={createForm.ratePercent}
              onChange={e => setCreateForm(f => ({ ...f, ratePercent: e.target.value }))}
              helperText='Percentage applied to the calculation base.'
            />
            <CustomTextField
              fullWidth
              type='date'
              label='Effective from'
              value={createForm.effectiveFrom}
              InputLabelProps={{ shrink: true }}
              onChange={e => setCreateForm(f => ({ ...f, effectiveFrom: e.target.value }))}
              helperText='This rule will only apply to invoices created on or after this date.'
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => void submitCreateRule()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color='inherit' /> : undefined}
          >
            {saving ? 'Saving…' : 'Create rule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

const SummaryRow = ({
  label,
  value,
  emphasize
}: {
  label: string
  value: string
  emphasize?: boolean
}) => (
  <Stack direction='row' justifyContent='space-between' spacing={2} className='py-1'>
    <Typography variant='body2' color='text.secondary'>
      {label}
    </Typography>
    <Typography variant='body2' fontWeight={emphasize ? 700 : 500} textAlign='right'>
      {value}
    </Typography>
  </Stack>
)

export default TaxConfigPage
