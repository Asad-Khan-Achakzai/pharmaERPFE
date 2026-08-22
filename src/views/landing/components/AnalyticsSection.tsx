'use client'

// Performance analytics — recreations of real analytics UI.
// Source screens: src/views/mrep/MrepCommandCenterPage.tsx,
// src/components/mrep/MrepRankingWidget.tsx, MrepExceptionsPage.tsx,
// /targets (MedRepTarget model: sales/packs target vs achieved).
import BrowserFrame from './BrowserFrame'
import { useCountUp } from '../hooks/useCountUp'
import { useInView } from '../hooks/useInView'

const Metric = ({ target, suffix, label }: { target: number; suffix: string; label: string }) => {
  const ref = useCountUp<HTMLElement>(target)

  return (
    <div className='lp-metric'>
      <div className='lp-metric__value lp-num'>
        <em ref={ref}>{target}</em>
        {suffix}
      </div>
      <div className='lp-metric__label'>{label}</div>
    </div>
  )
}

// Sales vs target by month (illustrative product data)
const BARS = [
  { month: 'Mar', target: 62, achieved: 54 },
  { month: 'Apr', target: 66, achieved: 61 },
  { month: 'May', target: 70, achieved: 74 },
  { month: 'Jun', target: 74, achieved: 69 },
  { month: 'Jul', target: 78, achieved: 82 },
  { month: 'Aug', target: 82, achieved: 88 }
]

const RANKING = [
  { name: 'Sana Malik', score: 96, width: 100 },
  { name: 'Hassan Raza', score: 91, width: 94 },
  { name: 'Imran Qureshi', score: 84, width: 87 },
  { name: 'Ali Tariq', score: 71, width: 72 }
]

const AnalyticsSection = () => {
  const ref = useInView<HTMLDivElement>(0.12)

  return (
    <section className='lp-section lp-section--tint' aria-labelledby='analytics-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head'>
          <span className='lp-eyebrow' data-animate=''>
            Performance & analytics
          </span>
          <h2 id='analytics-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            Know who’s performing — and who needs help.
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            Rankings, exceptions, trends, targets versus achieved, territory coverage — the numbers managers argue
            about at month-end, available the same day.
          </p>
        </div>

        <div className='lp-metrics' data-animate='' style={{ ['--i' as string]: 3 }}>
          <Metric target={92} suffix='%' label='Plan coverage this month' />
          <Metric target={88} suffix='%' label='Target achievement' />
          <Metric target={41} suffix=' / day' label='Team visits, daily average' />
        </div>

        <div className='lp-analytics__grid'>
          <div data-animate='' style={{ ['--i' as string]: 4 }} aria-hidden='true'>
            <BrowserFrame url='app.pharmaerp.com/dashboard/mrep'>
              <div className='lp-panel__head'>
                <span className='lp-panel__title'>Sales vs target · last 6 months</span>
                <span style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--lp-text-soft)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: '#c7d8f7', display: 'inline-block' }} />
                    Target
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--lp-blue)', display: 'inline-block' }} />
                    Achieved
                  </span>
                </span>
              </div>
              <div className='lp-panel__body'>
                <svg viewBox='0 0 520 220' style={{ display: 'block', width: '100%' }}>
                  {[0, 1, 2, 3].map(line => (
                    <line key={line} x1='0' x2='520' y1={40 + line * 50} y2={40 + line * 50} stroke='#eef2f7' strokeWidth='1' />
                  ))}
                  {BARS.map((bar, index) => {
                    const groupX = 30 + index * 82

                    return (
                      <g key={bar.month}>
                        <rect
                          className='lp-barchart__bar'
                          x={groupX}
                          y={190 - bar.target * 1.6}
                          width='22'
                          height={bar.target * 1.6}
                          rx='4'
                          fill='#c7d8f7'
                          style={{ ['--i' as string]: index }}
                        />
                        <rect
                          className='lp-barchart__bar'
                          x={groupX + 27}
                          y={190 - bar.achieved * 1.6}
                          width='22'
                          height={bar.achieved * 1.6}
                          rx='4'
                          fill='#2563eb'
                          style={{ ['--i' as string]: index + 1 }}
                        />
                        <text x={groupX + 24} y='210' textAnchor='middle' fontSize='12' fill='#5d6c81' fontFamily='inherit'>
                          {bar.month}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            </BrowserFrame>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className='lp-panel' data-animate='' style={{ ['--i' as string]: 5 }}>
              <div className='lp-panel__head'>
                <span className='lp-panel__title'>Rep ranking · this month</span>
                <span className='lp-chip lp-chip--info'>Live</span>
              </div>
              <div className='lp-panel__body' style={{ paddingBlock: 8 }}>
                {RANKING.map((rep, index) => (
                  <div className='lp-ranking__row' key={rep.name}>
                    <span className='lp-ranking__pos lp-num'>{index + 1}</span>
                    <span style={{ width: 110, flexShrink: 0, fontWeight: 600, color: 'var(--lp-heading)' }}>{rep.name}</span>
                    <span className='lp-ranking__bar'>
                      <i style={{ width: `${rep.width}%`, ['--i' as string]: index }} />
                    </span>
                    <span className='lp-num' style={{ fontWeight: 700, color: 'var(--lp-heading)', width: 32, textAlign: 'right' }}>
                      {rep.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className='lp-panel' data-animate='' style={{ ['--i' as string]: 6 }}>
              <div className='lp-panel__head'>
                <span className='lp-panel__title'>Exceptions</span>
              </div>
              <div className='lp-panel__body' style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span className='lp-chip lp-chip--warning'>3 reps below 70% coverage</span>
                <span className='lp-chip lp-chip--error'>5 missed visits yesterday</span>
                <span className='lp-chip lp-chip--info'>2 doctors unvisited 30+ days</span>
                <span className='lp-chip lp-chip--neutral'>1 late check-in pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AnalyticsSection
