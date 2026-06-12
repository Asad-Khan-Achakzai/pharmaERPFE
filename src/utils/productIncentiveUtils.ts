export type ProductPackSlab = {
  fromPacks: number
  toPacks: number | null
  ratePerPack: number
}

export type ProductPackIncentiveForm = {
  productId: string
  productName: string
  composition?: string
  includeBonusQty: boolean
  slabs: ProductPackSlab[]
  sampleDeliveredQty?: number
}

export const matchProductSlab = (slabs: ProductPackSlab[], qty: number): ProductPackSlab | null => {
  if (qty <= 0 || !slabs.length) return null
  const sorted = [...slabs].sort((a, b) => a.fromPacks - b.fromPacks)
  for (const slab of sorted) {
    if (qty >= slab.fromPacks && (slab.toPacks == null || qty <= slab.toPacks)) return slab
  }
  return null
}

export const calcFlatSlabIncentive = (slabs: ProductPackSlab[], qty: number) => {
  const slab = matchProductSlab(slabs, qty)
  if (!slab) return { amount: 0, slab: null as ProductPackSlab | null }
  return { amount: Math.round(qty * slab.ratePerPack * 100) / 100, slab }
}

export const serializeProductPackIncentives = (rows: ProductPackIncentiveForm[]) =>
  rows
    .filter(r => r.productId && r.slabs.length > 0)
    .map(r => ({
      type: 'pack_slab' as const,
      productId: r.productId,
      includeBonusQty: r.includeBonusQty,
      slabs: r.slabs
        .filter(s => s.fromPacks > 0 && s.ratePerPack >= 0)
        .map(s => ({
          fromPacks: Math.floor(s.fromPacks),
          toPacks: s.toPacks == null || s.toPacks === 0 ? null : Math.floor(s.toPacks),
          ratePerPack: s.ratePerPack
        }))
    }))
