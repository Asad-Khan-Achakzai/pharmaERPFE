'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { showApiError, showSuccess } from '@/utils/apiErrors'
import CustomTextField from '@core/components/mui/TextField'
import { LookupAutocomplete } from '@/components/lookup/LookupAutocomplete'
import { useAuth } from '@/contexts/AuthContext'
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

const CreateOrderPage = () => {
  const router = useRouter()
  const { user } = useAuth()
  const [selectedPharmacy, setSelectedPharmacy] = useState<any | null>(null)
  const [selectedDistributor, setSelectedDistributor] = useState<any | null>(null)
  const [selectedDoctor, setSelectedDoctor] = useState<any | null>(null)
  const [selectedRep, setSelectedRep] = useState<RepOption | null>(null)
  const [productCatalog, setProductCatalog] = useState<any[]>([])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([defaultLineItem(0, 0, 0, 0)])
  const [submitting, setSubmitting] = useState(false)
  const pharmacyDoctorGateRef = useRef<'initial' | 'ready'>('initial')

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

  useEffect(() => {
    if (user?._id)
      setSelectedRep(prev => prev ?? { _id: user._id, name: user.name, role: user.role })
  }, [user])

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

  const getDiscountDefaults = () => {
    const d = selectedDistributor?.discountOnTP ?? 0
    const p = selectedPharmacy?.discountOnTP ?? 0
    return { d, p }
  }

  const getBonusScheme = () => ({
    buy: selectedPharmacy?.bonusScheme?.buyQty ?? 0,
    get: selectedPharmacy?.bonusScheme?.getQty ?? 0
  })

  useEffect(() => {
    if (!selectedPharmacy || !selectedDistributor) return
    const d = selectedDistributor.discountOnTP ?? 0
    const p = selectedPharmacy.discountOnTP ?? 0
    const buy = selectedPharmacy.bonusScheme?.buyQty ?? 0
    const get = selectedPharmacy.bonusScheme?.getQty ?? 0
    setItems(prev =>
      prev.map(it => ({
        ...it,
        distributorDiscount: d,
        clinicDiscount: p,
        manualBonus: false,
        bonusQuantity: calculateBonus(it.quantity, buy, get)
      }))
    )
  }, [selectedPharmacy, selectedDistributor])

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
      await ordersService.create({
        pharmacyId,
        distributorId,
        doctorId: doctorId || undefined,
        medicalRepId,
        items: payloadItems,
        notes
      })
      showSuccess('Order created')
      router.push('/orders/list')
    } catch (err) {
      showApiError(err, 'Failed to create order')
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
      <CardHeader title='Create Order' />
      <CardContent>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <LookupAutocomplete
              value={selectedPharmacy}
              onChange={setSelectedPharmacy}
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
              onChange={setSelectedDistributor}
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
              helperText='Defaults to you. Change if this order is for another rep.'
              fetchErrorMessage='Failed to load users'
            />
          </Grid>

          {pharmacyId && distributorId && (
            <Grid size={{ xs: 12 }}>
              <Typography variant='body2' color='text.secondary'>
                Default discounts (on TP): distributor {previewDistDisc}% · pharmacy {previewPharmDisc}% — applied to
                all lines; you can override per line below.
              </Typography>
              <Typography variant='body2' color='text.secondary' className='mts-1'>
                Bonus scheme (Buy X Get Y):{' '}
                {schemeBuy > 0 && schemeGet > 0 ? `${schemeBuy} + ${schemeGet}` : 'None'} — bonus units are free (no
                TP); inventory cost uses paid + bonus.
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
            <CustomTextField fullWidth label='Notes' multiline rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button variant='contained' onClick={handleSubmit} disabled={submitting || !isFormValid}>
              {submitting ? 'Creating...' : 'Create Order'}
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  )
}

export default CreateOrderPage
