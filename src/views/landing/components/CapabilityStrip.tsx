'use client'

import { IconChart, IconLive, IconOffline, IconShield, IconWallet } from './icons'
import { useInView } from '../hooks/useInView'

// Product facts only — no invented adoption stats or customer logos.
const ITEMS = [
  { icon: <IconLive />, label: 'Real-time field map' },
  { icon: <IconShield />, label: 'GPS-verified attendance' },
  { icon: <IconOffline />, label: 'Offline mobile app' },
  { icon: <IconWallet />, label: 'Orders to accounting, connected' },
  { icon: <IconChart />, label: 'Role-based access & audit trail' }
]

const CapabilityStrip = () => {
  const ref = useInView<HTMLDivElement>()

  return (
    <div className='lp-strip' ref={ref}>
      <div className='lp-container'>
        <ul className='lp-strip__grid' style={{ margin: 0, padding: 0 }}>
          {ITEMS.map((item, index) => (
            <li
              key={item.label}
              className='lp-strip__item'
              data-animate=''
              style={{ listStyle: 'none', ['--i' as string]: index }}
            >
              <span className='lp-strip__icon'>{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default CapabilityStrip
