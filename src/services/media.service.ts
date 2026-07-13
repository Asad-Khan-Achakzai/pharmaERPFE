import api from './api'

export type MediaKind =
  | 'VISIT_PHOTO'
  | 'ATTENDANCE_SELFIE'
  | 'EXPENSE_RECEIPT'
  | 'PAYMENT_RECEIPT'
  | 'PRODUCT_VISUAL'
  | 'PRODUCT_BROCHURE'
  | 'PRODUCT_LITERATURE'
  | 'PRODUCT_CLINICAL_STUDY'
  | 'PRODUCT_VIDEO'
  | 'PRODUCT_PROMO'
  | 'PRESENTATION_SLIDE'
  | 'CAMPAIGN_BANNER'
  | 'KIT_HERO'
  | 'USER_AVATAR'
  | 'DOCTOR_PHOTO'
  | 'PHARMACY_PHOTO'
  | 'SUPPLIER_PHOTO'
  | 'DISTRIBUTOR_PHOTO'
  | 'OTHER'

export type MediaResource =
  | 'visits'
  | 'attendance'
  | 'expenses'
  | 'collections'
  | 'payments'
  | 'products'
  | 'users'
  | 'doctors'
  | 'pharmacies'
  | 'suppliers'
  | 'distributors'

interface PresignResponse {
  assetId: string
  method: string
  key: string
  bucket: string
  expiresIn: number
  uploadUrl: string | null
  note?: string
}

function unwrap<T>(resp: { data: { data?: T } & T }): T {
  return (resp.data?.data ?? resp.data) as T
}

export const mediaService = {
  presign: (data: { kind: MediaKind; mime: string; size: number }) => api.post('/media/presign', data),
  finalize: (data: { assetId: string; size?: number; mime?: string; width?: number; height?: number }) =>
    api.post('/media/finalize', data),
  attach: (data: { resource: MediaResource; id: string; assetId: string }) => api.post('/media/attach', data),
  link: (data: { resource: MediaResource; id: string; assetIds: string[] }) => api.post('/media/link', data),
  signedUrl: (key: string) => api.get(`/media/${key}/signed-url`),

  /**
   * End-to-end upload: presign -> PUT to R2 -> finalize. Returns the finalized
   * assetId, which callers can pass to an entity create/update (as `assetId`) or
   * to `attach`. Throws if media storage is not configured (uploadUrl null).
   */
  async upload(file: File, kind: MediaKind): Promise<{ assetId: string; key: string }> {
    const presignResp = await mediaService.presign({ kind, mime: file.type, size: file.size })
    const presign = unwrap<PresignResponse>(presignResp)
    if (!presign.uploadUrl) {
      throw new Error(presign.note || 'Media storage is not configured for this company.')
    }
    let putRes: Response
    try {
      putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      })
    } catch {
      // A network/TypeError here is almost always a CORS rejection on the bucket.
      throw new Error(
        'Upload was blocked by the storage bucket (CORS). Ask an admin to apply the R2 CORS policy for this site.'
      )
    }
    if (!putRes.ok) {
      throw new Error(`Upload failed (${putRes.status}). Please try again.`)
    }
    await mediaService.finalize({ assetId: presign.assetId, size: file.size, mime: file.type })
    return { assetId: presign.assetId, key: presign.key }
  }
}
