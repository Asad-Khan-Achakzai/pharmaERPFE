'use client'

// Platform capability grid — every bullet verified against the codebase.
import { IconCalendar, IconChart, IconDoctor, IconMapPin, IconShield, IconWallet } from './icons'
import { useInView } from '../hooks/useInView'

const GROUPS = [
  {
    icon: <IconMapPin />,
    title: 'Field operations',
    items: [
      'Live team tracking with attendance status',
      'GPS + selfie check-in, geofenced zones',
      'Approval workflows and auto-checkout',
      'Manager co-visits and field days'
    ]
  },
  {
    icon: <IconCalendar />,
    title: 'Planning',
    items: [
      'Weekly plans with submit / approve workflow',
      'Sequenced daily visits and route optimization',
      'Team calendar and copy-week',
      'Missed visits flagged automatically'
    ]
  },
  {
    icon: <IconDoctor />,
    title: 'Doctors & customers',
    items: [
      'Doctor CRM with tiers and GPS-verified locations',
      'Pharmacies, distributors and call points',
      'Territory tree: zones, areas, bricks',
      'Visit history and doctor activity tracking'
    ]
  },
  {
    icon: <IconWallet />,
    title: 'Sales & finance',
    items: [
      'Orders, deliveries, invoices and credit notes (PDF)',
      'Collections, settlements and outstanding balances',
      'Double-entry ledgers, P&L and balance sheet',
      'Pakistan tax configuration and remittance'
    ]
  },
  {
    icon: <IconChart />,
    title: 'Analytics',
    items: [
      'Rep rankings, exceptions and trends',
      'Targets vs achieved per rep and product',
      'Territory coverage and visit heatmaps',
      'Route history and replay'
    ]
  },
  {
    icon: <IconShield />,
    title: 'Control & trust',
    items: [
      'Role-based access with custom roles',
      'Full audit log and device binding',
      'Multi-company platform, push notifications',
      'AI assistant for your ERP data'
    ]
  }
]

const PlatformGrid = () => {
  const ref = useInView<HTMLDivElement>(0.08)

  return (
    <section id='platform' className='lp-section' aria-labelledby='platform-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            The full platform
          </span>
          <h2 id='platform-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            Everything a pharma field organization runs on.
          </h2>
        </div>

        <div className='lp-grid'>
          {GROUPS.map((group, index) => (
            <div className='lp-grid__card' key={group.title} data-animate='' style={{ ['--i' as string]: index + 2 }}>
              <span className='lp-grid__icon'>{group.icon}</span>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default PlatformGrid
