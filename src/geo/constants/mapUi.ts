/** Shared Map UI options for maps embedded in dialogs, drawers, and cards. */
export const EMBEDDED_GEO_MAP_UI = {
  /** Browser fullscreen breaks layout inside MUI Dialog (clipped tiles after exit). */
  fullscreenControl: false,
  streetViewControl: false,
  mapTypeControl: false
} as const
