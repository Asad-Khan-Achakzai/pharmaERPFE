'use client'

// Attendance section — animated recreation of the mobile check-in flow and
// the manager attendance board. Source screens:
// pharERPMobile src/features/attendance/CheckInCard.tsx (GPS zone + selfie),
// web src/app/(dashboard)/attendance/team (team board).
// The phone runs a 12s loop: locating -> within zone -> selfie -> check in
// -> checked in -> live tracking on.
import PhoneFrame from './PhoneFrame'
import { IconArrowRight, IconCamera, IconCheck } from './icons'
import { useInView, useLoopPause } from '../hooks/useInView'

const TEAM_ROWS = [
  { who: 'HR', name: 'Hassan Raza', time: '9:02 AM', chip: 'Present', tone: 'lp-chip--success', color: '#1976d2' },
  { who: 'SM', name: 'Sana Malik', time: '8:54 AM', chip: 'Present', tone: 'lp-chip--success', color: '#7c3aed' },
  { who: 'IQ', name: 'Imran Qureshi', time: '9:31 AM', chip: 'Late · pending approval', tone: 'lp-chip--warning', color: '#0d9488' },
  { who: 'AT', name: 'Ali Tariq', time: '9:05 AM', chip: 'Out of zone', tone: 'lp-chip--error', color: '#b45309' }
]

const CHECKLIST = [
  {
    strong: 'Geofenced check-ins.',
    text: 'Attendance is verified against doctor locations, call points or a zone radius.'
  },
  {
    strong: 'Optional selfie capture.',
    text: 'A photo at check-in when your policy requires it.'
  },
  {
    strong: 'Approval workflows.',
    text: 'Late or out-of-zone check-ins route to managers — with an audit trail.'
  },
  {
    strong: 'Automatic day close.',
    text: 'Auto-checkout and tracking stop at the end of the field day.'
  }
]

const AttendanceSection = () => {
  const ref = useInView<HTMLDivElement>(0.12)
  const pauseRef = useLoopPause<HTMLDivElement>()

  return (
    <section className='lp-section' aria-labelledby='attendance-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head'>
          <span className='lp-eyebrow' data-animate=''>
            Attendance & field activity
          </span>
          <h2 id='attendance-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            Attendance you don’t have to take on faith.
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            Every field day starts with a GPS-verified check-in and ends with a clean, policy-driven record — no
            WhatsApp messages, no guesswork.
          </p>
        </div>

        <div className='lp-attn__layout' ref={pauseRef}>
          <div>
            <ul className='lp-checklist' style={{ padding: 0, marginBlockStart: 0 }}>
              {CHECKLIST.map((item, index) => (
                <li key={item.strong} data-animate='' style={{ ['--i' as string]: index + 2 }}>
                  <span className='lp-checklist__icon'>
                    <IconCheck />
                  </span>
                  <span>
                    <strong>{item.strong}</strong> {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className='lp-attn__phone' data-animate='' style={{ ['--i' as string]: 3 }} aria-hidden='true'>
            <PhoneFrame>
              <div className='lp-checkin'>
                <div className='lp-checkin__greeting'>
                  Good morning
                  <strong>Hassan Raza</strong>
                </div>

                <div className='lp-checkin__zone'>
                  <span className='lp-chip lp-chip--neutral lp-zone-a'>Locating…</span>
                  <span className='lp-chip lp-chip--success lp-zone-b'>
                    <i />
                    Within zone · 120 m radius
                  </span>
                </div>

                <div className='lp-checkin__selfie'>
                  <span className='lp-checkin__selfie-thumb'>
                    <IconCamera width={16} height={16} />
                  </span>
                  Selfie captured
                </div>

                <div className='lp-checkin__btn'>
                  <span className='lp-btn-cycle-a'>Check in</span>
                  <span className='lp-btn-cycle-b'>Checked in · 9:02 AM</span>
                </div>

                <div className='lp-checkin__tracking'>
                  <i />
                  Live tracking on
                </div>
              </div>
            </PhoneFrame>
            <p className='lp-sr-only'>
              The rep’s phone confirms they are within the allowed check-in zone, captures an optional selfie, and
              records the check-in at 9:02 AM, after which live tracking turns on.
            </p>
          </div>

          <div data-animate='' style={{ ['--i' as string]: 4 }}>
            <div className='lp-panel'>
              <div className='lp-panel__head'>
                <span className='lp-panel__title'>Team attendance · today</span>
                <span className='lp-chip lp-chip--success'>
                  <i />
                  12 of 12 marked
                </span>
              </div>
              <div className='lp-panel__body'>
                {TEAM_ROWS.map((row, index) => (
                  <div className='lp-row' key={row.name} data-animate='' style={{ ['--i' as string]: index + 5 }}>
                    <span className='lp-avatar' style={{ background: row.color }}>
                      {row.who}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--lp-heading)' }}>{row.name}</div>
                      <div className='lp-num' style={{ fontSize: 12, color: 'var(--lp-text-soft)' }}>{row.time}</div>
                    </div>
                    <span className={`lp-chip ${row.tone}`} style={{ marginInlineStart: 'auto' }}>
                      {row.chip}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBlockStart: 14,
                    fontSize: 13,
                    color: 'var(--lp-text-soft)'
                  }}
                >
                  <IconArrowRight width={15} height={15} style={{ color: 'var(--lp-blue)' }} />
                  Exceptions route to the manager’s approval inbox
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AttendanceSection
