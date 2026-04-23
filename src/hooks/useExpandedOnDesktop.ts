import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

/**
 * Accordion: open on `md+`, collapsed on small screens until the user opens.
 * On desktop, content stays visible (expansion locked open).
 */
export function useExpandedOnDesktop() {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'), { defaultMatches: false })
  const [mobileOpen, setMobileOpen] = useState(false)
  const expanded = isMdUp || mobileOpen
  const onChange = (_: SyntheticEvent, next: boolean) => {
    if (!isMdUp) setMobileOpen(next)
  }
  return { expanded, onChange, isMdUp }
}
