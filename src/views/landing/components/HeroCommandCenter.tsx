'use client'

// Animated hero composite — a stylized recreation of the PharmaERP manager
// command center (source screens: src/views/mrep/MrepCommandCenterPage.tsx,
// src/views/team/LiveTrackingView.tsx, mobile app/(tabs)/visits.tsx).
// Map entity colors mirror src/geo/marker/mapDesignTokens.ts.
import BrowserFrame from './BrowserFrame'
import PhoneFrame from './PhoneFrame'
import { useCountUp } from '../hooks/useCountUp'
import { useLoopPause } from '../hooks/useInView'

const Kpi = ({ label, target, trend, delay }: { label: string; target: number; trend: string; delay: number }) => {
  const ref = useCountUp<HTMLDivElement>(target)

  return (
    <div className='lp-kpi' style={{ animationDelay: `${delay}s` }}>
      <div className='lp-kpi__label'>{label}</div>
      <div className='lp-kpi__value lp-num' ref={ref}>
        {target}
      </div>
      <div className='lp-kpi__trend'>{trend}</div>
    </div>
  )
}

/** Rep marker with live pulse ring. */
const RepMarker = ({ x, y, delay, extra = false }: { x: number; y: number; delay: number; extra?: boolean }) => (
  <g className={extra ? 'lp-map-marker--extra' : undefined}>
    <circle cx={x} cy={y} r={9} fill='none' stroke='#1976d2' strokeWidth={2} opacity={0.5} className='lp-pulse' style={{ animationDelay: `${delay + 0.5}s` }} />
    <g className='lp-marker-drop' style={{ animationDelay: `${delay}s` }}>
      <circle cx={x} cy={y} r={8} fill='#1976d2' stroke='#fff' strokeWidth={2.5} />
      <circle cx={x} cy={y} r={2.6} fill='#fff' />
    </g>
  </g>
)

/** Doctor / pharmacy / call-point pin using product marker colors. */
const EntityPin = ({ x, y, color, delay, extra = false }: { x: number; y: number; color: string; delay: number; extra?: boolean }) => (
  <g className={`lp-marker-drop${extra ? ' lp-map-marker--extra' : ''}`} style={{ animationDelay: `${delay}s` }}>
    <path d={`M${x} ${y} c -7 -8 -7 -14 0 -14 c 7 0 7 6 0 14 z`} transform={`translate(0 -2)`} fill={color} stroke='#fff' strokeWidth={1.6} />
    <circle cx={x} cy={y - 10.5} r={2.6} fill='#fff' />
  </g>
)

const HeroCommandCenter = () => {
  const pauseRef = useLoopPause<HTMLDivElement>()

  return (
    <div className='lp-cc' ref={pauseRef}>
      <p className='lp-sr-only'>
        Animated preview of the PharmaERP command center: a live map shows field representatives, doctor and pharmacy
        locations, a route being followed, a geofenced check-in, and a completed visit, while KPI cards for reps in
        field, visits today and orders booked update alongside a live activity feed.
      </p>

      <div aria-hidden='true'>
        <BrowserFrame url='app.pharmaerp.com/dashboard'>
          <div className='lp-cc__body'>
            <div className='lp-cc__kpis'>
              <Kpi label='Reps in field' target={14} trend='All checked in' delay={0.45} />
              <Kpi label='Visits today' target={86} trend='92% coverage' delay={0.58} />
              <Kpi label='Orders booked' target={32} trend='+18% vs last week' delay={0.71} />
            </div>

            <div className='lp-cc__map'>
              <svg viewBox='0 0 640 360' role='img' aria-hidden='true'>
                {/* Base map */}
                <rect width='640' height='360' fill='#f8fafc' />
                <g stroke='#e8edf4' strokeWidth={10} strokeLinecap='round'>
                  <path d='M0 80 H640' />
                  <path d='M0 176 H640' />
                  <path d='M0 276 H640' />
                  <path d='M96 0 V360' />
                  <path d='M226 0 V360' />
                  <path d='M366 0 V360' />
                  <path d='M512 0 V360' />
                </g>
                <g stroke='#eef2f7' strokeWidth={4} strokeLinecap='round'>
                  <path d='M0 128 H640' />
                  <path d='M0 318 H640' />
                  <path d='M160 0 V360' />
                  <path d='M300 0 V360' />
                  <path d='M444 0 V360' />
                  <path d='M580 0 V360' />
                  <path d='M0 30 L640 60' />
                </g>
                {/* Park + water accents */}
                <rect x='522' y='286' width='106' height='64' rx='8' fill='#ecfdf5' />
                <rect x='10' y='10' width='76' height='58' rx='8' fill='#eff6ff' />

                {/* Territory boundary — matches product territory purple */}
                <polygon
                  points='70,52 320,36 420,120 330,236 96,206'
                  fill='#7b1fa2'
                  fillOpacity='0.045'
                  stroke='#7b1fa2'
                  strokeOpacity='0.4'
                  strokeWidth='1.6'
                  strokeDasharray='7 6'
                  className='lp-pop'
                  style={{ animationDelay: '0.55s' }}
                />

                {/* Route being followed today (product route polyline blue) */}
                <path
                  d='M148 238 L204 252 L332 262 L414 186 L478 152'
                  fill='none'
                  stroke='#1565c0'
                  strokeWidth={3}
                  strokeLinecap='round'
                  strokeDasharray={100}
                  strokeDashoffset={100}
                  pathLength={100}
                  className='lp-route-draw'
                  style={{ animationDelay: '1.7s' }}
                />

                {/* Geofence around the active doctor */}
                <g className='lp-fence' style={{ animationDelay: '2.55s' }}>
                  <circle cx='478' cy='152' r='34' fill='#2e7d32' fillOpacity='0.08' stroke='#2e7d32' strokeOpacity='0.5' strokeWidth='1.5' strokeDasharray='4 4' />
                </g>

                {/* Entity pins */}
                <EntityPin x={478} y={158} color='#2e7d32' delay={1.15} />
                <EntityPin x={166} y={128} color='#2e7d32' delay={1.3} extra />
                <EntityPin x={306} y={210} color='#d32f2f' delay={1.45} />
                <EntityPin x={566} y={92} color='#f57c00' delay={1.55} extra />

                {/* Live reps */}
                <RepMarker x={148} y={238} delay={0.95} />
                <RepMarker x={252} y={92} delay={1.1} />
                <RepMarker x={548} y={268} delay={1.25} extra />

                {/* Visit completed chip */}
                <g className='lp-pop' style={{ animationDelay: '3.1s' }}>
                  <rect x='412' y='96' width='132' height='28' rx='14' fill='#fff' stroke='#a7f3d0' strokeWidth='1.4' />
                  <circle cx='430' cy='110' r='5' fill='#10b981' />
                  <path d='M427.5 110l2 2 3.4-4' stroke='#fff' strokeWidth='1.6' fill='none' strokeLinecap='round' strokeLinejoin='round' />
                  <text x='441' y='114' fontSize='11.5' fontWeight='600' fill='#047857' fontFamily='inherit'>
                    Visit completed
                  </text>
                </g>
              </svg>

              {/* Live activity feed */}
              <div className='lp-cc__feed'>
                <div className='lp-feed-item' style={{ animationDelay: '3.2s' }}>
                  <i style={{ background: '#1976d2' }} />
                  <span>
                    <strong>Imran Q.</strong> checked in · Within zone
                  </span>
                </div>
                <div className='lp-feed-item' style={{ animationDelay: '3.5s' }}>
                  <i style={{ background: '#10b981' }} />
                  <span>
                    Visit completed · <strong>Dr. Ayesha Khan</strong>
                  </span>
                </div>
                <div className='lp-feed-item' style={{ animationDelay: '3.8s' }}>
                  <i style={{ background: '#f59e0b' }} />
                  <span>
                    New order · <strong>Meditrust Pharmacy</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>

        {/* Field rep mobile view — source: mobile app/(tabs)/visits.tsx */}
        <div className='lp-cc__phone'>
          <PhoneFrame>
            <div style={{ padding: '10px 12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--lp-heading)', marginBottom: 8 }}>
                Today&apos;s route
                <span className='lp-chip lp-chip--info' style={{ float: 'right', height: 18, fontSize: 9 }}>
                  6 planned
                </span>
              </div>
              {[
                { name: 'Dr. Ayesha Khan', status: 'Visited', chip: 'lp-chip--success' },
                { name: 'Dr. Bilal Ahmed', status: 'Active', chip: 'lp-chip--info' },
                { name: 'City Care Pharmacy', status: 'Pending', chip: 'lp-chip--neutral' }
              ].map(row => (
                <div
                  key={row.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                    background: '#fff',
                    border: '1px solid var(--lp-border)',
                    borderRadius: 9,
                    padding: '7px 9px',
                    marginBottom: 6
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--lp-heading)' }}>{row.name}</span>
                  <span className={`lp-chip ${row.chip}`} style={{ height: 17, fontSize: 8.5, paddingInline: 7 }}>
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  )
}

export default HeroCommandCenter
