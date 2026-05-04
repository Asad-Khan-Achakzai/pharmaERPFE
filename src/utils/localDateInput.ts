/** `YYYY-MM-DD` in the user's local calendar (for `<input type="date">`). */
export const localDateInputToday = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** True if `yyyyMmDd` is strictly before today's local calendar day. */
export const isBackdatedLocalInput = (yyyyMmDd: string): boolean => yyyyMmDd < localDateInputToday()
