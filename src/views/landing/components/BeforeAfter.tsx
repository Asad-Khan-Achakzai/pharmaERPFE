'use client'

// Before/after contrast — only problems PharmaERP genuinely addresses.
import { IconCheck, IconX } from './icons'
import { useInView } from '../hooks/useInView'

const BEFORE = [
  'Attendance claimed over WhatsApp messages',
  'Paper plans nobody reviews or approves',
  'Visits that can’t be verified after the fact',
  'Orders re-typed from notebooks into spreadsheets',
  'Performance visible only at month-end — too late to act'
]

const AFTER = [
  'GPS-verified, geofenced check-ins with an audit trail',
  'Weekly plans reviewed and approved before the week starts',
  'Location-verified visits with products, samples and notes',
  'Orders flow into invoices, credit notes and your books',
  'Live coverage, rankings and exceptions — the same day'
]

const BeforeAfter = () => {
  const ref = useInView<HTMLDivElement>(0.12)

  return (
    <section className='lp-section lp-section--tint' aria-labelledby='compare-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            Why change
          </span>
          <h2 id='compare-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            Field operations, before and after.
          </h2>
        </div>

        <div className='lp-compare'>
          <div className='lp-compare__col lp-compare__col--before' data-animate='' style={{ ['--i' as string]: 2 }}>
            <div className='lp-compare__head'>Without PharmaERP</div>
            <ul className='lp-compare__list'>
              {BEFORE.map((item, index) => (
                <li key={item} data-animate='' style={{ ['--i' as string]: index + 3 }}>
                  <span className='lp-compare__mark'>
                    <IconX />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className='lp-compare__col lp-compare__col--after' data-animate='' style={{ ['--i' as string]: 3 }}>
            <div className='lp-compare__head'>With PharmaERP</div>
            <ul className='lp-compare__list'>
              {AFTER.map((item, index) => (
                <li key={item} data-animate='' style={{ ['--i' as string]: index + 4 }}>
                  <span className='lp-compare__mark'>
                    <IconCheck />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BeforeAfter
