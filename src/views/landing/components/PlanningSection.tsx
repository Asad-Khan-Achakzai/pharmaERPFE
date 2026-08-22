'use client'

// Planning section — recreation of the weekly plan board.
// Source screens: src/views/weeklyPlans/WeeklyPlanDetailPage.tsx,
// src/views/calendar/CalendarView.tsx. Submit/approve workflow and
// route optimization are real backend capabilities (weeklyPlan.routes.js,
// geo.routes.js /optimize-route).
import BrowserFrame from './BrowserFrame'
import { IconCheck } from './icons'
import { useInView, useLoopPause } from '../hooks/useInView'

const DAYS: { day: string; chips: { label: string; pharmacy?: boolean }[]; extra?: boolean }[] = [
  { day: 'Mon', chips: [{ label: 'Dr. A. Khan' }, { label: 'Dr. B. Ahmed' }, { label: 'City Care', pharmacy: true }] },
  { day: 'Tue', chips: [{ label: 'Dr. I. Malik' }, { label: 'Dr. S. Iqbal' }] },
  { day: 'Wed', chips: [{ label: 'Dr. N. Hussain' }, { label: 'Meditrust', pharmacy: true }, { label: 'Dr. O. Farooq' }] },
  { day: 'Thu', chips: [{ label: 'Dr. H. Raza' }, { label: 'Dr. F. Shah' }], extra: true },
  { day: 'Fri', chips: [{ label: 'Dr. M. Aslam' }, { label: 'WellCare', pharmacy: true }], extra: true },
  { day: 'Sat', chips: [{ label: 'Dr. Z. Batool' }], extra: true }
]

const CHECKLIST = [
  {
    strong: 'Draft, submit, approve.',
    text: 'Reps propose the week; managers review and approve it before it happens.'
  },
  {
    strong: 'Route optimization.',
    text: 'One click orders the day’s visits into an efficient route.'
  },
  {
    strong: 'Copy week & calendar view.',
    text: 'Repeat proven plans and see the whole team’s month at a glance.'
  },
  {
    strong: 'Missed visits surface automatically.',
    text: 'Unvisited plan items are flagged — nothing quietly disappears.'
  }
]

const PlanningSection = () => {
  const ref = useInView<HTMLDivElement>(0.12)
  const pauseRef = useLoopPause<HTMLDivElement>()

  return (
    <section className='lp-section lp-section--tint' aria-labelledby='planning-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-plan__layout'>
          <div>
            <span className='lp-eyebrow' data-animate=''>
              Planning
            </span>
            <h2 id='planning-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
              Every field day is planned before it starts.
            </h2>
            <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
              Weekly plans turn field work from improvisation into an approved, sequenced schedule of doctor and
              pharmacy visits.
            </p>
            <ul className='lp-checklist' style={{ padding: 0 }}>
              {CHECKLIST.map((item, index) => (
                <li key={item.strong} data-animate='' style={{ ['--i' as string]: index + 3 }}>
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

          <div data-animate='' style={{ ['--i' as string]: 2 }} aria-hidden='true' ref={pauseRef}>
            <BrowserFrame url='app.pharmaerp.com/weekly-plans/week-34'>
              <div className='lp-panel__head lp-plan-board__head'>
                <span className='lp-panel__title'>Weekly plan · Hassan Raza · Aug 17 – 22</span>
                <span className='lp-status-cycle'>
                  <span className='lp-chip lp-chip--neutral lp-plan-a'>Draft</span>
                  <span className='lp-chip lp-chip--warning lp-plan-b'>
                    <i />
                    Submitted
                  </span>
                  <span className='lp-chip lp-chip--success lp-plan-c'>
                    <i />
                    Approved
                  </span>
                </span>
              </div>

              <div className='lp-plan-board__cols'>
                {DAYS.map((column, columnIndex) => (
                  <div key={column.day} className={`lp-plan-col${column.extra ? ' lp-plan-col--extra' : ''}`}>
                    <div className='lp-plan-col__name'>{column.day}</div>
                    {column.chips.map((chip, chipIndex) => (
                      <div
                        key={chip.label}
                        className={`lp-plan-chip${chip.pharmacy ? ' lp-plan-chip--pharmacy' : ''}`}
                        data-animate=''
                        style={{ ['--i' as string]: columnIndex * 2 + chipIndex + 2 }}
                      >
                        <i />
                        {chip.label}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className='lp-plan__routebar'>
                <svg width='120' height='22' viewBox='0 0 120 22' aria-hidden='true'>
                  <path
                    d='M6 16 L34 8 L62 14 L90 6 L114 12'
                    fill='none'
                    stroke='#1565c0'
                    strokeWidth={2.4}
                    strokeLinecap='round'
                    pathLength={100}
                    strokeDasharray={100}
                    strokeDashoffset={100}
                    className='lp-route-draw'
                    style={{ animationDelay: '0.9s' }}
                  />
                  {[6, 34, 62, 90, 114].map((x, index) => (
                    <circle key={x} cx={x} cy={[16, 8, 14, 6, 12][index]} r={3} fill='#1976d2' stroke='#fff' strokeWidth={1.4} />
                  ))}
                </svg>
                Monday · 6 visits · 24 km
                <span className='lp-plan__optimize'>Optimize route</span>
              </div>
            </BrowserFrame>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PlanningSection
