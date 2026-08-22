'use client'

// "A day with PharmaERP" — scroll-driven storytelling of the verified field
// workflow. Panels are faithful lightweight recreations of real screens:
// weekly plan (WeeklyPlanDetailPage), check-in (mobile CheckInCard), today's
// route (visits tab + DailyRouteScene), visit execution (ActiveVisitScreen),
// order capture (order/new), manager live view (LiveTrackingView).
import type { ReactNode } from 'react'

import BrowserFrame from './BrowserFrame'
import PhoneFrame from './PhoneFrame'
import { useStickyProgress } from '../hooks/useStickyProgress'
import { useInView } from '../hooks/useInView'

type Step = {
  title: string
  body: string
  panel: ReactNode
}

const PlanPanel = (
  <BrowserFrame url='app.pharmaerp.com/weekly-plans'>
    <div className='lp-panel__head'>
      <span className='lp-panel__title'>Weekly plan · Aug 17 – 22</span>
      <span className='lp-chip lp-chip--success'>
        <i />
        Approved
      </span>
    </div>
    <div className='lp-panel__body'>
      {[
        { day: 'Monday', stops: 'Dr. Ayesha Khan · Dr. Bilal Ahmed · City Care Pharmacy', count: 6 },
        { day: 'Tuesday', stops: 'Dr. Imran Malik · Dr. Sara Iqbal', count: 5 },
        { day: 'Wednesday', stops: 'Dr. Nadia Hussain · Meditrust Pharmacy', count: 7 },
        { day: 'Thursday', stops: 'Dr. Omar Farooq · Dr. Hina Raza', count: 6 }
      ].map((row, index) => (
        <div className='lp-row' key={row.day} style={{ ['--i' as string]: index }}>
          <strong style={{ width: 92, flexShrink: 0, color: 'var(--lp-heading)' }}>{row.day}</strong>
          <span
            style={{
              color: 'var(--lp-text-soft)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0
            }}
          >
            {row.stops}
          </span>
          <span className='lp-chip lp-chip--info' style={{ marginInlineStart: 'auto' }}>
            {row.count} visits
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginBlockStart: 14, fontSize: 12.5, color: 'var(--lp-text-soft)' }}>
        Submitted by Hassan R. · Approved by Area Manager
      </div>
    </div>
  </BrowserFrame>
)

const CheckInPanel = (
  <div style={{ maxWidth: 280, marginInline: 'auto' }}>
    <PhoneFrame>
      <div className='lp-checkin'>
        <div className='lp-checkin__greeting'>
          Good morning
          <strong>Hassan Raza</strong>
        </div>
        <span className='lp-chip lp-chip--success'>
          <i />
          Within zone · 120 m radius
        </span>
        <div className='lp-checkin__selfie'>
          <span
            className='lp-checkin__selfie-thumb'
            style={{ animation: 'none', opacity: 1, transform: 'none' }}
            aria-hidden='true'
          >
            ✓
          </span>
          Selfie captured
        </div>
        <div className='lp-checkin__btn'>
          <span style={{ position: 'static', background: 'var(--lp-green-soft)', color: '#047857' }}>
            Checked in · 9:02 AM
          </span>
        </div>
        <div className='lp-checkin__tracking' style={{ animation: 'none', opacity: 1 }}>
          <i />
          Live tracking on
        </div>
      </div>
    </PhoneFrame>
  </div>
)

const RoutePanel = (
  <BrowserFrame url='app.pharmaerp.com/visits/today'>
    <div className='lp-panel__head'>
      <span className='lp-panel__title'>Today&apos;s route · 6 sequenced visits</span>
      <span className='lp-chip lp-chip--info'>Optimized</span>
    </div>
    <svg viewBox='0 0 520 210' style={{ display: 'block', width: '100%' }} aria-hidden='true'>
      <rect width='520' height='210' fill='#f8fafc' />
      <g stroke='#e8edf4' strokeWidth={8} strokeLinecap='round'>
        <path d='M0 60 H520' />
        <path d='M0 150 H520' />
        <path d='M120 0 V210' />
        <path d='M300 0 V210' />
        <path d='M430 0 V210' />
      </g>
      <path
        className='lp-day-route'
        d='M60 170 L150 120 L255 140 L340 70 L455 90'
        fill='none'
        stroke='#1565c0'
        strokeWidth={3}
        strokeLinecap='round'
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={0}
      />
      {[
        { x: 60, y: 170, n: 1, done: true },
        { x: 150, y: 120, n: 2, done: true },
        { x: 255, y: 140, n: 3, done: false },
        { x: 340, y: 70, n: 4, done: false },
        { x: 455, y: 90, n: 5, done: false }
      ].map(pin => (
        <g key={pin.n}>
          <circle cx={pin.x} cy={pin.y} r={13} fill={pin.done ? '#2e7d32' : '#fff'} stroke={pin.done ? '#2e7d32' : '#1976d2'} strokeWidth={2} />
          <text x={pin.x} y={pin.y + 4} textAnchor='middle' fontSize='11.5' fontWeight='700' fill={pin.done ? '#fff' : '#1976d2'}>
            {pin.n}
          </text>
        </g>
      ))}
    </svg>
  </BrowserFrame>
)

const VisitPanel = (
  <div style={{ maxWidth: 300, marginInline: 'auto' }}>
    <PhoneFrame>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-heading)' }}>Dr. Ayesha Khan</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-soft)', marginBlockEnd: 10 }}>
          Cardiologist · Gulberg · Tier A
        </div>
        <div style={{ display: 'flex', gap: 4, marginBlockEnd: 12 }}>
          {['Details', 'Products', 'Samples', 'Notes', 'Wrap-up'].map((tab, index) => (
            <span
              key={tab}
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: '4px 7px',
                borderRadius: 7,
                background: index === 1 ? 'var(--lp-blue)' : 'var(--lp-bg-tint)',
                color: index === 1 ? '#fff' : 'var(--lp-text-soft)',
                border: index === 1 ? 'none' : '1px solid var(--lp-border)'
              }}
            >
              {tab}
            </span>
          ))}
        </div>
        {[
          { name: 'CardioMax 10mg', meta: 'Discussed · 2 samples' },
          { name: 'LipidCare Plus', meta: 'Discussed' },
          { name: 'TensoRelief 5mg', meta: '1 sample' }
        ].map(product => (
          <div
            key={product.name}
            style={{
              background: '#fff',
              border: '1px solid var(--lp-border)',
              borderRadius: 9,
              padding: '8px 10px',
              marginBlockEnd: 7
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--lp-heading)' }}>{product.name}</div>
            <div style={{ fontSize: 9.5, color: 'var(--lp-text-soft)' }}>{product.meta}</div>
          </div>
        ))}
        <span className='lp-chip lp-chip--success' style={{ marginBlockStart: 4 }}>
          <i />
          Visit in progress
        </span>
      </div>
    </PhoneFrame>
  </div>
)

const OrderPanel = (
  <div style={{ maxWidth: 300, marginInline: 'auto' }}>
    <PhoneFrame>
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-heading)', marginBlockEnd: 2 }}>New order</div>
        <div style={{ fontSize: 11, color: 'var(--lp-text-soft)', marginBlockEnd: 12 }}>
          City Care Pharmacy · via Alpha Distributors
        </div>
        {[
          { name: 'CardioMax 10mg', qty: '40 packs', amount: '48,000' },
          { name: 'LipidCare Plus', qty: '25 packs', amount: '31,250' },
          { name: 'TensoRelief 5mg', qty: '30 packs', amount: '27,600' }
        ].map(line => (
          <div
            key={line.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '7px 0',
              borderBlockEnd: '1px solid var(--lp-border-soft)',
              fontSize: 10.5
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--lp-heading)' }}>{line.name}</span>
            <span style={{ color: 'var(--lp-text-soft)' }}>{line.qty}</span>
            <span className='lp-num' style={{ fontWeight: 600, color: 'var(--lp-heading)' }}>
              {line.amount}
            </span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBlockStart: 10,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--lp-heading)'
          }}
        >
          <span>Total (PKR)</span>
          <span className='lp-num'>106,850</span>
        </div>
        <div
          style={{
            marginBlockStart: 12,
            height: 38,
            borderRadius: 10,
            background: 'var(--lp-blue)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700
          }}
        >
          Submit order
        </div>
      </div>
    </PhoneFrame>
  </div>
)

const ManagerPanel = (
  <BrowserFrame url='app.pharmaerp.com/team/live'>
    <div className='lp-panel__head'>
      <span className='lp-panel__title'>Team activity · live</span>
      <span className='lp-chip lp-chip--success'>
        <i />
        12 of 12 in field
      </span>
    </div>
    <div className='lp-panel__body'>
      {[
        { who: 'HR', name: 'Hassan Raza', what: 'Completed visit · Dr. Ayesha Khan', chip: 'Visited', tone: 'lp-chip--success' },
        { who: 'SM', name: 'Sana Malik', what: 'Order booked · Meditrust Pharmacy', chip: 'PKR 74,300', tone: 'lp-chip--info' },
        { who: 'IQ', name: 'Imran Qureshi', what: 'Checked in · Within zone', chip: '9:12 AM', tone: 'lp-chip--neutral' },
        { who: 'AT', name: 'Ali Tariq', what: 'En route · Visit 4 of 6', chip: 'On plan', tone: 'lp-chip--info' }
      ].map((row, index) => (
        <div className='lp-row' key={row.name} style={{ ['--i' as string]: index }}>
          <span className='lp-avatar'>{row.who}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--lp-heading)' }}>{row.name}</div>
            <div style={{ fontSize: 12, color: 'var(--lp-text-soft)' }}>{row.what}</div>
          </div>
          <span className={`lp-chip ${row.tone}`} style={{ marginInlineStart: 'auto' }}>
            {row.chip}
          </span>
        </div>
      ))}
    </div>
  </BrowserFrame>
)

const STEPS: Step[] = [
  {
    title: 'The week is planned — and approved',
    body: 'Reps build their weekly plan of doctor and pharmacy visits. Managers review, adjust and approve it before the week starts, so every day in the field has a purpose.',
    panel: PlanPanel
  },
  {
    title: 'The day starts with a verified check-in',
    body: 'Reps check in from the field with GPS — inside a defined zone, with an optional selfie. Attendance is verifiable from day one, and live tracking starts automatically.',
    panel: CheckInPanel
  },
  {
    title: 'The route is already organized',
    body: 'The day opens with a sequenced, route-optimized list of visits. No time wasted deciding where to go next.',
    panel: RoutePanel
  },
  {
    title: 'Every visit is captured with substance',
    body: 'Products discussed, samples given, notes and follow-ups — recorded in a guided visit flow, not a checkbox. Unplanned visits and manager co-visits are supported too.',
    panel: VisitPanel
  },
  {
    title: 'Orders are booked on the spot',
    body: 'Reps capture pharmacy orders during the visit — even offline. Orders sync automatically and flow into deliveries, invoices and your books.',
    panel: OrderPanel
  },
  {
    title: 'Managers see it all, as it happens',
    body: 'Check-ins, visits, orders and locations stream into the manager’s view in real time. The whole field day is visible without a single phone call.',
    panel: ManagerPanel
  }
]

/**
 * One story step. Carries its own in-view ref so that on mobile — where the
 * sticky stage is hidden and each step shows its panel inline — the step
 * reveals sequentially as it scrolls in (title, body, then panel), instead
 * of everything appearing at once with the section header.
 */
const DayStep = ({ step, index, active }: { step: Step; index: number; active: boolean }) => {
  const stepRef = useInView<HTMLDivElement>(0.15, '0px 0px -10% 0px')

  return (
    <div
      ref={stepRef}
      className='lp-day__step'
      data-step-index={index}
      data-step-number={index + 1}
      data-active={active ? 'true' : 'false'}
    >
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      {/* Inline panel shown on tablet/mobile where the sticky stage is hidden */}
      <div className='lp-day__inline-panel'>{step.panel}</div>
    </div>
  )
}

const DayStory = () => {
  const { containerRef, activeStep } = useStickyProgress(STEPS.length)
  const revealRef = useInView<HTMLDivElement>(0.05)

  return (
    <section id='how-it-works' className='lp-section' aria-labelledby='day-heading'>
      <div className='lp-container' ref={revealRef}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            How it works
          </span>
          <h2 id='day-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            A day with PharmaERP
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            From the approved plan to the evening numbers — this is how PharmaERP fits into the real working day of a
            pharmaceutical field team.
          </p>
        </div>

        <div className='lp-day__layout' ref={containerRef}>
          <div className='lp-day__steps'>
            {STEPS.map((step, index) => (
              <DayStep key={step.title} step={step} index={index} active={index === activeStep} />
            ))}
          </div>

          <div className='lp-day__stage'>
            <div className='lp-day__panels'>
              {STEPS.map((step, index) => (
                <div key={step.title} className='lp-day__panel' data-active={index === activeStep ? 'true' : 'false'}>
                  {step.panel}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DayStory
