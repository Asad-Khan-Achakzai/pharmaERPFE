'use client'

// Two experiences: manager web command center vs field rep mobile app.
// Offline-first sync (mobile outbox + SQLite masters) is a verified
// capability of pharERPMobile (src/data/outbox.ts, syncEngine.ts).
import { useInView, useLoopPause } from '../hooks/useInView'
import { PLAY_STORE_ARIA_LABEL, PLAY_STORE_LABEL, PLAY_STORE_URL } from '../playStore'
import { IconArrowRight } from './icons'
import PhoneFrame from './PhoneFrame'

const MANAGER_POINTS = [
  'Live map of the whole team, with attendance status',
  'Weekly plan and expense approvals in one inbox',
  'Rankings, exceptions and trends per rep and territory',
  'Orders, collections and outstanding balances at a glance',
  'Route history and replay for any rep, any day'
]

const REP_POINTS = [
  'Today’s sequenced route with doctor details',
  'GPS check-in with zone status — and optional selfie',
  'Guided visit flow: products, samples, notes, wrap-up',
  'Orders and collections captured during the visit',
  'Works offline — everything queues and syncs automatically'
]

const PersonasSection = () => {
  const ref = useInView<HTMLDivElement>(0.1)
  const pauseRef = useLoopPause<HTMLDivElement>()

  return (
    <section className='lp-section' aria-labelledby='personas-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            One platform, two experiences
          </span>
          <h2 id='personas-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            Built for the office — and for the road.
          </h2>
        </div>

        <div className='lp-personas__grid'>
          <div className='lp-persona' data-animate='' style={{ ['--i' as string]: 2 }}>
            <span className='lp-eyebrow' style={{ marginBlockEnd: 0 }}>
              For managers
            </span>
            <h3>The web command center</h3>
            <ul className='lp-persona__list'>
              {MANAGER_POINTS.map(point => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className='lp-persona__visual' aria-hidden='true'>
              <div className='lp-panel' style={{ boxShadow: 'var(--lp-shadow-sm)' }}>
                <div className='lp-panel__head'>
                  <span className='lp-panel__title'>Approvals inbox</span>
                  <span className='lp-chip lp-chip--warning'>4 pending</span>
                </div>
                <div className='lp-panel__body' style={{ paddingBlock: 6 }}>
                  {[
                    { text: 'Weekly plan · Hassan Raza · Week 35', chip: 'Review', tone: 'lp-chip--info' },
                    { text: 'Late check-in · Imran Qureshi · 9:31 AM', chip: 'Approve', tone: 'lp-chip--warning' },
                    { text: 'Expense · Fuel · PKR 3,200', chip: 'Approve', tone: 'lp-chip--neutral' }
                  ].map(row => (
                    <div className='lp-row' key={row.text}>
                      <span style={{ fontSize: 13, color: 'var(--lp-navy-700)' }}>{row.text}</span>
                      <span className={`lp-chip ${row.tone}`} style={{ marginInlineStart: 'auto' }}>
                        {row.chip}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className='lp-persona lp-persona--dark' data-animate='' style={{ ['--i' as string]: 3 }}>
            <span className='lp-eyebrow' style={{ marginBlockEnd: 0, color: '#60a5fa' }}>
              For field reps
            </span>
            <h3>Everything in their pocket</h3>
            <ul className='lp-persona__list'>
              {REP_POINTS.map(point => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <a
              href={PLAY_STORE_URL}
              className='lp-btn lp-btn--ghost-on-dark'
              target='_blank'
              rel='noopener noreferrer'
              aria-label={PLAY_STORE_ARIA_LABEL}
            >
              {PLAY_STORE_LABEL}
              <IconArrowRight width={16} height={16} />
            </a>
            <div
              className='lp-persona__visual'
              aria-hidden='true'
              style={{ maxWidth: 230, marginInline: 'auto' }}
              ref={pauseRef}
            >
              <PhoneFrame>
                <div style={{ padding: 12 }}>
                  {/* Offline → syncing → synced loop (12s, pure CSS) */}
                  <div className='lp-sync__status'>
                    <span className='lp-sync__state lp-sync-a'>
                      <i style={{ background: 'var(--lp-warning)' }} />
                      Offline — 3 items queued
                    </span>
                    <span className='lp-sync__state lp-sync-b'>
                      <i style={{ background: 'var(--lp-blue)' }} />
                      Back online — syncing…
                    </span>
                    <span className='lp-sync__state lp-sync-c'>
                      <i style={{ background: 'var(--lp-green)' }} />
                      All changes synced
                    </span>
                  </div>
                  {[
                    { label: 'Visit · Dr. Ayesha Khan', cycle: 1 },
                    { label: 'Order · City Care Pharmacy', cycle: 2 },
                    { label: 'Check-in · 9:02 AM', cycle: 0 }
                  ].map(row => (
                    <div
                      key={row.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 6,
                        background: '#fff',
                        border: '1px solid var(--lp-border)',
                        borderRadius: 9,
                        padding: '7px 10px',
                        marginBlockEnd: 6,
                        fontSize: 9.5
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--lp-heading)' }}>{row.label}</span>
                      {row.cycle === 0 ? (
                        <span style={{ color: '#047857', fontWeight: 600 }}>Synced ✓</span>
                      ) : (
                        <span className='lp-sync__swap'>
                          <span className={`lp-sync-will-${row.cycle}`} style={{ color: 'var(--lp-text-soft)' }}>
                            Will sync
                          </span>
                          <span className={`lp-sync-done-${row.cycle}`} style={{ color: '#047857', fontWeight: 600 }}>
                            Synced ✓
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PersonasSection
