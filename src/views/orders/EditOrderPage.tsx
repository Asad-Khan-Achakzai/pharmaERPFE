'use client'

import { useState, useEffect, useRef, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { ordersService } from '@/services/orders.service'
import { usersService } from '@/services/users.service'
import { pharmaciesService } from '@/services/pharmacies.service'
import { distributorsService } from '@/services/distributors.service'
import { productsService } from '@/services/products.service'
import { doctorsService } from '@/services/doctors.service'
import { buildPreviewFromFormItems } from '@/utils/orderFinancialPreview'
import { calculateBonus } from '@/utils/bonus'
import OrderFormFinanceSummary from '@/views/orders/OrderFormFinanceSummary'

type LineItem = {
  productId: string
  quantity: number
  distributorDiscount: number
  clinicDiscount: number
  bonusQuantity: number
  manualBonus: boolean
}

type RepOption = { _id: string; name?: string; email?: string; role?: string }

const defaultLineItem = (distDisc: number, pharmDisc: number, buy: number, get: number): LineItem => ({
  productId: '',
  quantity: 1,
  distributorDiscount: distDisc,
  clinicDiscount: pharmDisc,
  bonusQuantity: calculateBonus(1, buy, get),
  manualBonus: false
})

const repOptionLabel = (u: RepOption) =>
  `${u.name ?? ''}${u.role ? ` · ${String(u.role).replace(/_/g, ' ')}` : ''}`

const dedupeCatalogById = (rows: any[]) => {
  const seen = new Set<string>()
  const out: any[] = []
  for (const r of rows) {
    const id = String(r._id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(r)
  }
  return out
}

const EditOrderPage = ({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) => {
  const params = use(paramsPromise)
  const router = useRouter()
  const [selectedPharmacy, setSelectedPharmacy] = useState<any | null>(null)
  const [selectedDistributor, setSelectedDistributor] = useState<any | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null)
  const [selectedRep, setSelectedRep] = useState<RepOption | null>(null)
  const [productCatalog, setProductCatalog] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([defaultLineItem(0, 0, 0, 0)])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const pharmacyDoctorGateRef = useRef<'initial' | 'ready'>('initial')

  const selectedPharmacyRef = useRef<any | null>(null)
  const selectedDistributorRef = useRef<any | null>(null)
  selectedPharmacyRef.current = selectedPharmacy
  selectedDistributorRef.current = selectedDistributor

  useEffect(() => {
    pharmacyDoctorGateRef.current = 'initial'
  }, [params.id])

  const pharmacyId = selectedPharmacy ? String(selectedPharmacy._id) : ''
  const distributorId = selectedDistributor ? String(selectedDistributor._id) : ''
  const doctorId = selectedDoctor ? String(selectedDoctor._id) : ''
  const medicalRepId = selectedRep ? String(selectedRep._id) : ''

  const mergeIntoProductCatalog = useCallback((p: any) => {
    setProductCatalog(prev => (prev.some(x => String(x._id) === String(p._id)) ? prev : [...prev, p]))
  }, [])

  const isFormValid =
    pharmacyId !== '' &&
    distributorId !== '' &&
    medicalRepId !== '' &&
    items.length > 0 &&
    items.every(i => i.productId !== '' && i.quantity > 0)

  const getDiscountDefaults = () => {
    const d = selectedDistributor?.discountOnTP ?? 0
    const p = selectedPharmacy?.discountOnTP ?? 0
    return { d, p }
  }

  const getBonusScheme = () => ({
    buy: selectedPharmacy?.bonusScheme?.buyQty ?? 0,
    get: selectedPharmacy?.bonusScheme?.getQty ?? 0
  })

  const applyDiscountsForPharmacyAndDistributor = (ph: any, dist: any) => {
    const dDisc = dist?.discountOnTP ?? 0
    const pDisc = ph?.discountOnTP ?? 0
    const buy = ph?.bonusScheme?.buyQty ?? 0
    const get = ph?.bonusScheme?.getQty ?? 0
    setItems(prev =>
      prev.map(it => ({
        ...it,
        distributorDiscount: dDisc,
        clinicDiscount: pDisc,
        manualBonus: false,
        bonusQuantity: calculateBonus(it.quantity, buy, get)
      }))
    )
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const orderRes = await ordersService.getById(params.id)
        const order = orderRes.data?.data
        if (!order) {
          showApiError(null, 'Order not found')
          router.replace('/orders/list')
          return
        }
        if (order.status !== 'PENDING') {
          showApiError(null, 'Only pending orders can be edited')
          router.replace(`/orders/${params.id}`)
          return
        }

        const phId = String(order.pharmacyId?._id || order.pharmacyId)
        const phRow = order.pharmacyId && typeof order.pharmacyId === 'object' ? order.pharmacyId : null
        const schemeBuy = phRow?.bonusScheme?.buyQty ?? 0
        const schemeGet = phRow?.bonusScheme?.getQty ?? 0

        setSelectedPharmacy(
          phRow
            ? {
                _id: phId,
                name: phRow.name,
                discountOnTP: phRow.discountOnTP,
                bonusScheme: phRow.bonusScheme
              }
            : { _id: phId, name: 'Pharmacy' }
        )

        const distId = String(order.distributorId?._id || order.distributorId)
        const distRow = order.distributorId && typeof order.distributorId === 'object' ? order.distributorId : null
        setSelectedDistributor(
          distRow
            ? {
                _id: distId,
                name: distRow.name,
                discountOnTP: distRow.discountOnTP,
                commissionPercentOnTP: distRow.commissionPercentOnTP
              }
            : { _id: distId, name: 'Distributor' }
        )

        const orderDocId = order.doctorId ? String(order.doctorId._id || order.doctorId) : ''
        if (orderDocId) {
          const dRow = order.doctorId && typeof order.doctorId === 'object' ? order.doctorId : null
          setSelectedDoctor(
            dRow
              ? { _id: orderDocId, name: dRow.name, pharmacyId: (dRow as any).pharmacyId }
              : { _id: orderDocId, name: 'Doctor' }
          )
        } else {
          setSelectedDoctor(null)
        }

        const repOid = String(order.medicalRepId?._id || order.medicalRepId || '')
        const repRow = order.medicalRepId && typeof order.medicalRepId === 'object' ? order.medicalRepId : null
        const repName = repRow?.name || 'Assigned rep'
        setSelectedRep(repOid ? { _id: repOid, name: repName, role: (repRow as any)?.role } : null)

        setNotes(order.notes || '')

        const catalogFromLines: any[] = []
        for (const it of order.items || []) {
          const p = it.productId
          if (p && typeof p === 'object') {
            catalogFromLines.push({
              _id: String(p._id),
              name: p.name,
              composition: p.composition,
              mrp: p.mrp,
              tp: p.tp,
              casting: p.casting
            })
          }
        }
        setProductCatalog(dedupeCatalogById(catalogFromLines))

        setItems(
          order.items.map((it: any) => {
            const q = it.quantity
            const bq = it.bonusQuantity ?? 0
            const auto = calculateBonus(q, it.bonusScheme?.buyQty ?? schemeBuy, it.bonusScheme?.getQty ?? schemeGet)
            return {
              productId: String(it.productId?._id || it.productId),
              quantity: q,
              distributorDiscount: it.distributorDiscount ?? 0,
              clinicDiscount: it.clinicDiscount ?? 0,
              bonusQuantity: bq,
              manualBonus: bq !== auto
            }
          })
        )
      } catch (err) {
        showApiError(err, 'Failed to load order')
        router.replace('/orders/list')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [params.id, router])

  /** Default doctor from pharmacy-linked list; search still lists all doctors */
  useEffect(() => {
    if (!selectedPharmacy) {
      setSelectedDoctor(null)
      return
    }
    const pid = String(selectedPharmacy._id)
    let cancelled = false
    ;(async () => {
      try {
        const res = await doctorsService.lookup({ pharmacyId: pid, limit: 100, isActive: 'true' })
        const raw = res.data.data || []
        const list = [...raw].sort((a: any, b: any) =>
          (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        )
        if (cancelled) return
        setSelectedDoctor((prev: any | null) => {
          const ids = new Set(list.map((d: any) => String(d._id)))
          const prevId = prev ? String(prev._id) : ''
          if (pharmacyDoctorGateRef.current === 'initial') {
            pharmacyDoctorGateRef.current = 'ready'
            if (prevId && ids.has(prevId)) return prev
            if (prevId) return prev
            return list[0] ?? null
          }
          if (prevId && ids.has(prevId)) return prev
          return list[0] ?? null
        })
      } catch {
        if (!cancelled) setSelectedDoctor(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPharmacy])

  const addItem = () => {
    const { d, p } = getDiscountDefaults()
    const { buy, get } = getBonusScheme()
    setItems(prev => [...prev, defaultLineItem(d, p, buy, get)])
  }
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: string, value: any) => {
    const { buy, get } = getBonusScheme()
    setItems(prev =>
      prev.map((item, idx) => {
        if (idx !== i) return item
        if (field === 'quantity') {
          const q = +value
          return {
            ...item,
            quantity: q,
            manualBonus: false,
            bonusQuantity: calculateBonus(q, buy, get)
          }
        }
        if (field === 'bonusQuantity') {
          const b = Math.max(0, +value)
          return { ...item, bonusQuantity: b, manualBonus: true }
        }
        return { ...item, [field]: value }
      })
    )
  }

  const handleSubmit = async () => {
    if (!pharmacyId || !distributorId) {
      showApiError(null, 'Select pharmacy and distributor')
      return
    }
    if (!medicalRepId) {
      showApiError(null, 'Select medical rep')
      return
    }
    if (items.some(i => !i.productId || i.quantity < 1)) {
      showApiError(null, 'Fill all items')
      return
    }
    setSubmitting(true)
    try {
      const payloadItems = items.map(({ manualBonus: _m, ...rest }) => rest)
      await ordersService.update(params.id, {
        pharmacyId,
        distributorId,
        doctorId: doctorId || null,
        medicalRepId,
        items: payloadItems,
        notes
      })
      showSuccess('Order updated')
      router.push(`/orders/${params.id}`)
    } catch (err) {
      showApiError(err, 'Failed to update order')
    } finally {
      setSubmitting(false)
    }
  }

  const { d: previewDistDisc, p: previewPharmDisc } =
    selectedPharmacy && selectedDistributor ? getDiscountDefaults() : { d: 0, p: 0 }
  const { buy: schemeBuy, get: schemeGet } = getBonusScheme()
  const financePreview = buildPreviewFromFormItems(items, productCatalog, selectedDistributor ?? undefined)

  return (
    <Card>
      <CardHeader
        title={
          <div className='flex items-center gap-1'>
            <IconButton
              aria-label='Back to order'
              onClick={() => router.push(`/orders/${params.id}`)}
              size='small'
              className='-mis-1'
            >
              <i className='tabler-arrow-left' />
            </IconButton>
            <Typography component='span' variant='h5'>
              Edit Order
            </Typography>
          </div>
        }
      />
      {loading ? (
        <CardContent className='flex justify-center items-center min-bs-[240px]'>
          <CircularProgress />
        </CardContent>
      ) : (
        <CardContent>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <LookupAutocomplete
                value={selectedPharmacy}
                onChange={v => {
                  setSelectedPharmacy(v)
                  const d = selectedDistributorRef.current
                  if (v && d) applyDiscountsForPharmacyAndDistributor(v, d)
                }}
                fetchOptions={search =>
                  pharmaciesService
                    .lookup({ limit: 25, ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
                }
                label='Pharmacy'
                placeholder='Type to search'
                helperText='Type to search by pharmacy name or city'
                required
                fetchErrorMessage='Failed to load pharmacies'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <LookupAutocomplete
                value={selectedDistributor}
                onChange={v => {
                  setSelectedDistributor(v)
                  const p = selectedPharmacyRef.current
                  if (v && p) applyDiscountsForPharmacyAndDistributor(p, v)
                }}
                fetchOptions={search =>
                  distributorsService
                    .lookup({ limit: 25, ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
                }
                label='Distributor'
                placeholder='Type to search'
                helperText='Type to search by name'
                required
                fetchErrorMessage='Failed to load distributors'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <LookupAutocomplete
                value={selectedDoctor}
                onChange={setSelectedDoctor}
                fetchOptions={search =>
                  doctorsService
                    .lookup({ limit: 25, isActive: 'true', ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
                }
                label='Doctor (optional)'
                placeholder='Type to search'
                disabled={!selectedPharmacy}
                helperText={
                  selectedPharmacy
                    ? 'Search all doctors. Default picks the first linked to this pharmacy when you change pharmacy.'
                    : 'Select a pharmacy first'
                }
                fetchErrorMessage='Failed to load doctors'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <LookupAutocomplete<RepOption>
                value={selectedRep}
                onChange={setSelectedRep}
                fetchOptions={search =>
                  usersService
                    .assignable({ limit: 25, ...(search ? { search } : {}) })
                    .then(r => r.data.data || [])
                }
                getOptionLabel={repOptionLabel}
                label='Medical rep (assigned to order)'
                placeholder='Type to search'
                required
                helperText='Change who is credited for this order.'
                fetchErrorMessage='Failed to load users'
              />
            </Grid>

            {pharmacyId && distributorId && (
              <Grid size={{ xs: 12 }}>
                <Typography variant='body2' color='text.secondary'>
                  Default discounts (on TP): distributor {previewDistDisc}% · pharmacy {previewPharmDisc}% — applied when
                  you change pharmacy or distributor; override per line below.
                </Typography>
                <Typography variant='body2' color='text.secondary' className='mts-1'>
                  Bonus scheme: {schemeBuy > 0 && schemeGet > 0 ? `${schemeBuy} + ${schemeGet}` : 'None'}
                </Typography>
              </Grid>
            )}

            {items.map((item, i) => (
              <Grid container spacing={3} key={i} size={{ xs: 12 }}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <LookupAutocomplete
                    value={
                      item.productId
                        ? productCatalog.find(p => String(p._id) === item.productId) ?? null
                        : null
                    }
                    onChange={v => {
                      updateItem(i, 'productId', v ? String(v._id) : '')
                      if (v) mergeIntoProductCatalog(v)
                    }}
                    fetchOptions={search =>
                      productsService
                        .lookup({ limit: 25, ...(search ? { search } : {}) })
                        .then(r => r.data.data || [])
                    }
                    label='Product'
                    placeholder='Type to search'
                    required
                    fetchErrorMessage='Failed to load products'
                  />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <CustomTextField
                    required
                    fullWidth
                    label='Paid qty'
                    type='number'
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', +e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Bonus qty'
                    type='number'
                    value={item.bonusQuantity}
                    onChange={e => updateItem(i, 'bonusQuantity', +e.target.value)}
                    helperText={
                      schemeBuy > 0 && schemeGet > 0 ? `Scheme ${schemeBuy}+${schemeGet}` : 'No scheme'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 4, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Dist. Disc. % (on TP)'
                    type='number'
                    value={item.distributorDiscount}
                    onChange={e => updateItem(i, 'distributorDiscount', +e.target.value)}
                    helperText='From distributor'
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <CustomTextField
                    fullWidth
                    label='Pharmacy Disc. % (on TP)'
                    type='number'
                    value={item.clinicDiscount}
                    onChange={e => updateItem(i, 'clinicDiscount', +e.target.value)}
                    helperText='After distributor discount'
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 1 }} className='flex items-center'>
                  {items.length > 1 && (
                    <IconButton onClick={() => removeItem(i)}>
                      <i className='tabler-trash text-error' />
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            ))}

            <Grid size={{ xs: 12 }}>
              <Button variant='outlined' onClick={addItem} startIcon={<i className='tabler-plus' />}>
                Add Item
              </Button>
            </Grid>
            {pharmacyId && distributorId && (
              <Grid size={{ xs: 12 }}>
                <OrderFormFinanceSummary preview={financePreview} />
              </Grid>
            )}
            <Grid size={{ xs: 12 }}>
              <CustomTextField
                fullWidth
                label='Notes'
                multiline
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant='contained' onClick={handleSubmit} disabled={submitting || !isFormValid}>
                {submitting ? 'Saving...' : 'Save changes'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      )}
    </Card>
  )
}

export default EditOrderPage
