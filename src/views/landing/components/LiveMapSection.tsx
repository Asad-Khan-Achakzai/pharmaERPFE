'use client'

// Flagship section — stylized recreation of the live tracking experience.
// Source screens: src/views/team/LiveTrackingView.tsx, RouteHistoryView.tsx,
// src/geo/scenes/LiveTrackingScene.tsx + VisitHeatMapScene.tsx.
// Everything runs on one synchronized 14s CSS timeline (see landing.css):
// rep A travels the route -> geofence blooms -> visit completes -> the side
// rail status and activity feed update in lockstep.
import { useInView, useLoopPause } from '../hooks/useInView'

const FEATURES = [
  {
    title: 'Live tracking',
    body: 'Every rep on one map with attendance status, freshness and zone context.'
  },
  {
    title: 'Route history & replay',
    body: 'Replay any day’s actual movement with a playback scrubber.'
  },
  {
    title: 'Visit heatmaps',
    body: 'See where field activity concentrates — and where territory is going cold.'
  },
  {
    title: 'Geofenced zones',
    body: 'Check-ins verified against doctor locations, call points and zone radius.'
  }
]

const StaticRep = ({ x, y, extra = false }: { x: number; y: number; extra?: boolean }) => (
  <g className={extra ? 'lp-map-marker--extra' : undefined}>
    <circle cx={x} cy={y} r={10} fill='none' stroke='#60a5fa' strokeWidth={2} opacity={0.45} className='lp-pulse' />
    <circle cx={x} cy={y} r={8} fill='#1976d2' stroke='#0f172a' strokeWidth={2.5} />
    <circle cx={x} cy={y} r={2.6} fill='#fff' />
  </g>
)

const Pin = ({ x, y, color, extra = false }: { x: number; y: number; color: string; extra?: boolean }) => (
  <g className={extra ? 'lp-map-marker--extra' : undefined}>
    <path d={`M${x} ${y} c -7.4 -8.4 -7.4 -14.8 0 -14.8 c 7.4 0 7.4 6.4 0 14.8 z`} fill={color} stroke='#0f172a' strokeWidth={1.4} />
    <circle cx={x} cy={y - 11} r={2.7} fill='#0f172a' opacity={0.85} />
  </g>
)

const LiveMapSection = () => {
  const revealRef = useInView<HTMLDivElement>(0.08)
  const pauseRef = useLoopPause<HTMLDivElement>()

  return (
    <section id='product' className='lp-section lp-section--dark' aria-labelledby='livemap-heading'>
      <div className='lp-container' ref={revealRef}>
        <div className='lp-section-head'>
          <span className='lp-eyebrow' data-animate=''>
            Live field visibility
          </span>
          <h2 id='livemap-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            The command center for pharmaceutical field operations.
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            Live rep locations, routes, geofenced zones and visit status — streamed to one map your managers can act
            on. Know where your team is, and what’s happening, without a single phone call.
          </p>
        </div>

        <div ref={pauseRef}>
          <p className='lp-sr-only'>
            Animated demonstration of the live map: a representative travels along a planned route, arrives at a
            doctor’s geofenced location, the visit is completed, and the manager’s team list and activity feed update
            in real time.
          </p>

          <div className='lp-livemap__layout' data-animate='' style={{ ['--i' as string]: 3 }} aria-hidden='true'>
            <div className='lp-livemap__map'>
              <svg viewBox='0 0 760 480'>
                <rect width='760' height='480' fill='#111c33' />
                {/* Street grid */}
                <g stroke='#1b2946' strokeWidth={12} strokeLinecap='round'>
                  <path d='M0 110 H760' />
                  <path d='M0 250 H760' />
                  <path d='M0 388 H760' />
                  <path d='M130 0 V480' />
                  <path d='M310 0 V480' />
                  <path d='M500 0 V480' />
                  <path d='M660 0 V480' />
                </g>
                <g stroke='#182542' strokeWidth={4} strokeLinecap='round' opacity={0.6}>
                  <path d='M0 60 H760' stroke='#182542' />
                  <path d='M0 180 H760' stroke='#182542' />
                  <path d='M0 320 H760' stroke='#182542' />
                  <path d='M0 444 H760' stroke='#182542' />
                  <path d='M70 0 V480' stroke='#182542' />
                  <path d='M220 0 V480' stroke='#182542' />
                  <path d='M410 0 V480' stroke='#182542' />
                  <path d='M580 0 V480' stroke='#182542' />
                  <path d='M0 20 L760 70' stroke='#182542' />
                </g>
                {/* Park + water */}
                <rect x='540' y='30' width='150' height='94' rx='10' fill='#123028' opacity={0.8} />
                <path d='M0 480 L120 430 Q190 410 240 452 L260 480 Z' fill='#0e2038' />

                {/* Territory boundary */}
                <polygon
                  points='84,70 400,44 560,180 470,392 130,340'
                  fill='#7b1fa2'
                  fillOpacity='0.06'
                  stroke='#a855f7'
                  strokeOpacity='0.45'
                  strokeWidth='1.8'
                  strokeDasharray='8 7'
                />

                {/* Planned route (faint) */}
                <path
                  d='M150 300 L224 294 L278 338 L346 326'
                  fill='none'
                  stroke='#334a77'
                  strokeWidth={3}
                  strokeLinecap='round'
                  strokeDasharray='2 7'
                />

                {/* Traveled trail — draws in sync with rep A's movement */}
                <path
                  d='M150 300 L224 294 L278 338 L346 326'
                  fill='none'
                  stroke='#3b82f6'
                  strokeWidth={3.5}
                  strokeLinecap='round'
                  pathLength={100}
                  strokeDasharray={100}
                  className='lp-trail-cycle'
                  style={{ ['--lp-trail-length' as string]: 100 }}
                />

                {/* Static entity pins */}
                <Pin x={346} y={318} color='#66bb6a' />
                <Pin x={214} y={150} color='#66bb6a' />
                <Pin x={452} y={210} color='#66bb6a' extra />
                <Pin x={560} y={330} color='#ef5350' />
                <Pin x={100} y={210} color='#ffa726' extra />
                <Pin x={620} y={160} color='#ef5350' extra />

                {/* Geofence around the target doctor — blooms on arrival */}
                <circle
                  cx='346'
                  cy='326'
                  r='42'
                  fill='#2e7d32'
                  fillOpacity='0.14'
                  stroke='#4ade80'
                  strokeOpacity='0.6'
                  strokeWidth='1.6'
                  strokeDasharray='5 5'
                  className='lp-fence-cycle'
                />

                {/* Visit completed chip — appears while rep is at the doctor */}
                <g className='lp-visited-cycle'>
                  <rect x='378' y='268' width='138' height='30' rx='15' fill='#0f2b22' stroke='#34d399' strokeOpacity='0.55' strokeWidth='1.4' />
                  <circle cx='397' cy='283' r='5.5' fill='#10b981' />
                  <path d='M394.4 283l2 2 3.6-4.2' stroke='#0f2b22' strokeWidth='1.7' fill='none' strokeLinecap='round' strokeLinejoin='round' />
                  <text x='409' y='287.5' fontSize='12' fontWeight='600' fill='#6ee7b7' fontFamily='inherit'>
                    Visit completed
                  </text>
                </g>

                {/* Other live reps */}
                <StaticRep x={565} y={120} />
                <StaticRep x={636} y={400} />
                <StaticRep x={230} y={80} extra />

                {/* Rep A — travels the route on the 14s loop */}
                <g className='lp-rep-move'>
                  <circle cx={150} cy={300} r={11} fill='none' stroke='#60a5fa' strokeWidth={2} opacity={0.5} className='lp-pulse' />
                  <circle cx={150} cy={300} r={9} fill='#1976d2' stroke='#fff' strokeWidth={2.6} />
                  <text x={150} y={304} textAnchor='middle' fontSize='9' fontWeight='700' fill='#fff' fontFamily='inherit'>
                    HR
                  </text>
                </g>
              </svg>

              {/* Live activity toast synced with the visit */}
              <div
                className='lp-feed-item lp-feed-cycle'
                style={{
                  position: 'absolute',
                  insetInlineStart: 16,
                  insetBlockStart: 16,
                  width: 'auto',
                  background: 'rgb(15 23 42 / 0.85)',
                  borderColor: 'rgb(148 163 184 / 0.25)',
                  color: '#e2e8f0'
                }}
              >
                <i style={{ background: '#10b981' }} />
                <span>
                  Visit completed · <strong style={{ color: '#fff' }}>Dr. Imran Malik</strong> · 2:36 PM
                </span>
              </div>

              {/* Route replay scrubber */}
              <div className='lp-livemap__scrubber'>
                <span>Route replay</span>
                <span className='lp-livemap__scrubber-track'>
                  <span className='lp-livemap__scrubber-fill' style={{ display: 'block' }} />
                </span>
                <span className='lp-num'>Today · 9:00 – 18:00</span>
              </div>
            </div>

            <div className='lp-siderail'>
              <div className='lp-siderail__card'>
                <div className='lp-siderail__title'>Team · Lahore North</div>

                <div className='lp-siderail__row'>
                  <span className='lp-avatar' style={{ width: 28, height: 28, fontSize: 10.5 }}>
                    HR
                  </span>
                  Hassan Raza
                  <span className='lp-siderail__status'>
                    <span className='lp-chip lp-chip--info lp-cycle-a'>
                      <i />
                      En route
                    </span>
                    <span className='lp-chip lp-chip--warning lp-cycle-b'>
                      <i />
                      In visit
                    </span>
                    <span className='lp-chip lp-chip--success lp-cycle-c'>
                      <i />
                      Completed
                    </span>
                  </span>
                </div>

                <div className='lp-siderail__row'>
                  <span className='lp-avatar' style={{ width: 28, height: 28, fontSize: 10.5, background: '#7c3aed' }}>
                    SM
                  </span>
                  Sana Malik
                  <span className='lp-chip lp-chip--success' style={{ marginInlineStart: 'auto' }}>
                    <i />
                    Within zone
                  </span>
                </div>

                <div className='lp-siderail__row'>
                  <span className='lp-avatar' style={{ width: 28, height: 28, fontSize: 10.5, background: '#0d9488' }}>
                    IQ
                  </span>
                  Imran Qureshi
                  <span className='lp-chip lp-chip--info' style={{ marginInlineStart: 'auto' }}>
                    <i />
                    In visit
                  </span>
                </div>

                <div className='lp-siderail__row'>
                  <span className='lp-avatar' style={{ width: 28, height: 28, fontSize: 10.5, background: '#b45309' }}>
                    AT
                  </span>
                  Ali Tariq
                  <span className='lp-chip lp-chip--neutral' style={{ marginInlineStart: 'auto' }}>
                    Idle · 12 min
                  </span>
                </div>
              </div>

              <div className='lp-siderail__card'>
                <div className='lp-siderail__title'>Today</div>
                {[
                  { label: 'Visits completed', value: '34 of 41' },
                  { label: 'Attendance', value: '12 of 12' },
                  { label: 'Orders booked', value: 'PKR 892k' }
                ].map(row => (
                  <div className='lp-siderail__row' key={row.label}>
                    {row.label}
                    <strong className='lp-num' style={{ marginInlineStart: 'auto', color: '#fff', fontWeight: 600 }}>
                      {row.value}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='lp-livemap__features'>
          {FEATURES.map((feature, index) => (
            <div className='lp-livemap__feature' key={feature.title} data-animate='' style={{ ['--i' as string]: index + 4 }}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default LiveMapSection
