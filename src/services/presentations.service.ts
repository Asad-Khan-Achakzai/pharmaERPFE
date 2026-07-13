import api from './api'

export type SlideType =
  | 'IMAGE'
  | 'VIDEO'
  | 'PDF'
  | 'RICH_TEXT'
  | 'BENEFITS'
  | 'CLINICAL'
  | 'REMINDER'
  | 'SUMMARY'
  | 'HERO'
  | 'CTA'
  | 'PROBLEM'
  | 'MOA'

export type SectionKey =
  | 'PROBLEM'
  | 'DISEASE_OVERVIEW'
  | 'CURRENT_TREATMENT'
  | 'LIMITATIONS'
  | 'OUR_PRODUCT'
  | 'MOA'
  | 'CLINICAL_EVIDENCE'
  | 'KEY_BENEFITS'
  | 'PATIENT_OUTCOME'
  | 'SUMMARY'
  | 'CTA'
  | 'CUSTOM'

export type PresentationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export type PresentationTheme = {
  primaryColor?: string
  secondaryColor?: string
  surfaceStyle?: 'dark' | 'light' | 'brandWash'
  logoAssetId?: string | null
  backgroundAssetId?: string | null
  fontStyle?: 'modern' | 'classic'
  logoMedia?: { url?: string | null } | null
  backgroundMedia?: { url?: string | null } | null
}

export type PresentationSlide = {
  slideId?: string
  sortOrder?: number
  type: SlideType
  sectionId?: string | null
  title?: string
  body?: string
  bullets?: string[]
  highlight?: string | null
  assetId?: string | null
  backgroundAssetId?: string | null
  iconKey?: string | null
  durationHintSec?: number | null
  isOfflineEligible?: boolean
  media?: { assetId?: string; mime?: string; url?: string | null } | null
  backgroundMedia?: { url?: string | null } | null
}

export type PresentationSection = {
  sectionId?: string
  key: SectionKey
  title?: string
  sortOrder?: number
  isOptional?: boolean
  slideIds?: string[]
}

export type QualityCheck = {
  code: string
  severity: 'ERROR' | 'WARN' | 'INFO'
  message: string
  slideId?: string | null
  sectionKey?: string | null
}

export type QualityReport = {
  score: number
  checks: QualityCheck[]
  canPublish?: boolean
  checkedAt?: string
}

export type ProductPresentation = {
  _id: string
  productId: string
  title: string
  status: PresentationStatus
  version?: number
  isDefault?: boolean
  audience?: string
  theme?: PresentationTheme
  sections?: PresentationSection[]
  slides: PresentationSlide[]
  qualityReport?: {
    score?: number | null
    checkedAt?: string | null
    checks?: QualityCheck[]
  }
  publishedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export const presentationsService = {
  getById: (id: string) => api.get(`/presentations/${id}`),
  update: (
    id: string,
    data: {
      title?: string
      audience?: string
      theme?: PresentationTheme
      sections?: PresentationSection[]
      slides?: PresentationSlide[]
    }
  ) => api.put(`/presentations/${id}`, data),
  publish: (id: string) => api.post(`/presentations/${id}/publish`),
  quality: (id: string) => api.get(`/presentations/${id}/quality`),
  remove: (id: string) => api.delete(`/presentations/${id}`)
}
