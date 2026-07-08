'use client'

import type { HTMLAttributes, Key } from 'react'
import type { AutocompleteRenderOptionState } from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** Shape returned by GET /doctors/lookup (and compatible with populated doctor refs). */
export type DoctorLookupOption = {
  _id: string
  name?: string | null
  specialization?: string | null
  doctorBrick?: string | null
  doctorCode?: string | null
  city?: string | null
  zone?: string | null
  pharmacyId?: string | null
}

export function doctorLookupSecondaryParts(d: DoctorLookupOption): string[] {
  const parts: string[] = []
  const spec = d.specialization?.trim()
  if (spec) parts.push(spec)
  const brick = d.doctorBrick?.trim()
  const zone = d.zone?.trim()
  if (brick) parts.push(`Brick: ${brick}`)
  else if (zone) parts.push(`Zone: ${zone}`)
  const code = d.doctorCode?.trim()
  if (code) parts.push(`Code: ${code}`)
  const city = d.city?.trim()
  if (city) parts.push(city)
  return parts
}

export function doctorLookupOptionLabel(d: DoctorLookupOption): string {
  const name = d.name?.trim() || ''
  const meta = doctorLookupSecondaryParts(d)
  if (!meta.length) return name || '—'
  return `${name} — ${meta.join(' · ')}`
}

/** Stable Autocomplete key — labels can repeat when doctors share name + brick. */
export function doctorLookupOptionKey(d: DoctorLookupOption): string {
  return String(d._id)
}

export function renderDoctorLookupOption(
  props: HTMLAttributes<HTMLLIElement> & { key?: Key },
  option: DoctorLookupOption,
  _state: AutocompleteRenderOptionState
) {
  const { key: _muiKey, ...liProps } = props
  const secondary = doctorLookupSecondaryParts(option)
  return (
    <li key={doctorLookupOptionKey(option)} {...liProps}>
      <Box sx={{ py: 0.5, width: '100%', overflow: 'hidden' }}>
        <Typography variant='body2' fontWeight={600} noWrap={false}>
          {option.name?.trim() || '—'}
        </Typography>
        {secondary.length ? (
          <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.25 }}>
            {secondary.join(' · ')}
          </Typography>
        ) : null}
      </Box>
    </li>
  )
}
