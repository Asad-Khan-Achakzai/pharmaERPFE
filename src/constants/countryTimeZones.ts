/** Mirrors backend `countryTimeZone.js` — country-default suggestions only (no browser inference). */
export const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  PK: 'Asia/Karachi',
  AE: 'Asia/Dubai',
  UK: 'Europe/London',
  US: 'America/New_York'
}

export const COUNTRY_OPTIONS = [
  { code: 'PK', label: 'Pakistan' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'US', label: 'United States' }
] as const

export function suggestTimeZoneForCountry(code: string): string | null {
  const c = code?.trim().toUpperCase()
  if (!c) return null
  return COUNTRY_TO_TIMEZONE[c] ?? null
}

export function allIanaTimeZones(): string[] {
  try {
    const IntlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    if (typeof Intl !== 'undefined' && typeof IntlAny.supportedValuesOf === 'function') {
      return IntlAny.supportedValuesOf('timeZone')
    }
  } catch {
    /* ignore */
  }
  return [...new Set(Object.values(COUNTRY_TO_TIMEZONE))].sort()
}

/** Map free-text country (e.g. super-admin form) to ISO2 when possible. */
export function countryCodeFromLabel(raw: string): string | null {
  const t = raw?.trim()
  if (!t) return null
  const u = t.toUpperCase()
  if (COUNTRY_TO_TIMEZONE[u]) return u
  const opt = COUNTRY_OPTIONS.find(c => c.code === u || c.label.toUpperCase() === u)
  return opt?.code ?? (u === 'PAKISTAN' ? 'PK' : u === 'UAE' || u === 'EMIRATES' ? 'AE' : null)
}
