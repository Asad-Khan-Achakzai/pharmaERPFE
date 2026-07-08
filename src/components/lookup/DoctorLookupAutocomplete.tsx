'use client'

import { LookupAutocomplete, type LookupAutocompleteProps } from '@/components/lookup/LookupAutocomplete'
import { doctorsService } from '@/services/doctors.service'
import {
  type DoctorLookupOption,
  doctorLookupOptionKey,
  doctorLookupOptionLabel,
  renderDoctorLookupOption
} from '@/components/lookup/doctorLookupDisplay'

export type { DoctorLookupOption }

type Extra = {
  /** Merged into `doctorsService.lookup` (e.g. `{ pharmacyId }`). */
  lookupParams?: Record<string, string | number | undefined>
  lookupLimit?: number
}

export type DoctorLookupAutocompleteProps = Omit<
  LookupAutocompleteProps<DoctorLookupOption>,
  'fetchOptions' | 'getOptionLabel' | 'renderOption'
> &
  Extra

const compactLookupParams = (p?: Record<string, string | number | undefined>) => {
  if (!p) return {}
  return Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== undefined && v !== '')
  ) as Record<string, string | number>
}

export function DoctorLookupAutocomplete({
  lookupParams,
  lookupLimit = 25,
  placeholder = 'Search name, specialty, brick, code, city…',
  ...rest
}: DoctorLookupAutocompleteProps) {
  const extra = compactLookupParams(lookupParams)

  return (
    <LookupAutocomplete<DoctorLookupOption>
      {...rest}
      placeholder={placeholder}
      getOptionLabel={doctorLookupOptionLabel}
      getOptionKey={doctorLookupOptionKey}
      renderOption={renderDoctorLookupOption}
      fetchOptions={search =>
        doctorsService
          .lookup({
            limit: lookupLimit,
            isActive: 'true',
            ...extra,
            ...(search ? { search } : {})
          })
          .then(r => (r.data.data || []) as DoctorLookupOption[])
      }
    />
  )
}
