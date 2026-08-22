// Small inline SVG icon set for the landing page — avoids depending on the
// dashboard's generated Iconify bundle so the landing stays self-contained.
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps): IconProps => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props
})

export const IconMapPin = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11z' />
    <circle cx='12' cy='10' r='2.6' />
  </svg>
)

export const IconRoute = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx='6' cy='19' r='2' />
    <circle cx='18' cy='5' r='2' />
    <path d='M8 19h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16' />
  </svg>
)

export const IconClock = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx='12' cy='12' r='9' />
    <path d='M12 7v5l3 2' />
  </svg>
)

export const IconCalendar = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x='4' y='5' width='16' height='16' rx='2' />
    <path d='M8 3v4M16 3v4M4 11h16' />
  </svg>
)

export const IconDoctor = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M9 3v4a3 3 0 0 0 6 0V3' />
    <path d='M12 10v3a5 5 0 0 1-5 5' />
    <circle cx='7' cy='19' r='2' />
    <circle cx='17' cy='15' r='3' />
    <path d='M17 14v2M16 15h2' />
  </svg>
)

export const IconFile = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z' />
    <path d='M14 3v5h5M9 13h6M9 17h6' />
  </svg>
)

export const IconChart = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M4 20V6M4 20h16' />
    <path d='M8 16v-5M12 16V8M16 16v-3M20 16V5' />
  </svg>
)

export const IconShield = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z' />
    <path d='M9.5 12l2 2 3.5-4' />
  </svg>
)

export const IconOffline = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M5 12a7 7 0 0 1 11.6-5.3M19 12a7 7 0 0 1-.4 2.4' />
    <path d='M8.5 15.5a4 4 0 0 1 7-2.6' />
    <circle cx='12' cy='19' r='1' fill='currentColor' stroke='none' />
  </svg>
)

export const IconWallet = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' />
    <path d='M16 12h4v4h-4a2 2 0 0 1 0-4z' />
  </svg>
)

export const IconUsers = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx='9' cy='8' r='3.2' />
    <path d='M3.5 20a5.5 5.5 0 0 1 11 0' />
    <path d='M16 5.2a3.2 3.2 0 0 1 0 5.6M17.8 14.6A5.5 5.5 0 0 1 20.5 20' />
  </svg>
)

export const IconCheck = (props: IconProps) => (
  <svg {...base({ strokeWidth: 3, ...props })}>
    <path d='M4.5 12.5l5 5 10-11' />
  </svg>
)

export const IconX = (props: IconProps) => (
  <svg {...base({ strokeWidth: 3, ...props })}>
    <path d='M6 6l12 12M18 6L6 18' />
  </svg>
)

export const IconArrowRight = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M4 12h16M14 6l6 6-6 6' />
  </svg>
)

export const IconMail = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x='3' y='5' width='18' height='14' rx='2' />
    <path d='M3 7l9 6 9-6' />
  </svg>
)

export const IconPhone = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' />
  </svg>
)

export const IconUser = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx='12' cy='8' r='3.5' />
    <path d='M5 20a7 7 0 0 1 14 0' />
  </svg>
)

export const IconLive = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx='12' cy='12' r='2.4' fill='currentColor' stroke='none' />
    <path d='M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4' />
    <path d='M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14' />
  </svg>
)

export const IconCamera = (props: IconProps) => (
  <svg {...base(props)}>
    <path d='M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z' />
    <circle cx='12' cy='13.5' r='3.2' />
  </svg>
)
