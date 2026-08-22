'use client'

// Doctor & visit execution journey. Source: Doctor model (tier/territory/
// verified GPS), mobile ActiveVisitScreen (Details/Products/Samples/Notes/
// Wrap-up), VisitLog history, doctor location review workflow.
import { IconCalendar, IconChart, IconCheck, IconDoctor, IconFile, IconMapPin } from './icons'
import { useInView } from '../hooks/useInView'

const STAGES = [
  {
    icon: <IconDoctor />,
    title: 'Doctor profile',
    body: 'Tier, territory, assigned rep and a GPS-verified location — reviewed by managers.'
  },
  {
    icon: <IconCalendar />,
    title: 'Planned visit',
    body: 'The visit sits in an approved weekly plan with a sequence for the day.'
  },
  {
    icon: <IconMapPin />,
    title: 'Arrive & check in',
    body: 'Location context confirms the rep is actually at the doctor.'
  },
  {
    icon: <IconFile />,
    title: 'Visit with substance',
    body: 'Products discussed, samples given, notes — captured in a guided flow.'
  },
  {
    icon: <IconCheck />,
    title: 'Wrap-up',
    body: 'Order taken? Follow-up needed? Out of sequence? Recorded on the spot.'
  },
  {
    icon: <IconChart />,
    title: 'History & reporting',
    body: 'Every visit lands in the doctor’s history and your coverage analytics.'
  }
]

const VisitJourney = () => {
  const ref = useInView<HTMLDivElement>(0.12)

  return (
    <section className='lp-section lp-section--tint' aria-labelledby='visits-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            Doctors & visits
          </span>
          <h2 id='visits-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            A visit is more than a checkbox.
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            PharmaERP follows the whole journey — from a verified doctor record to a completed, reportable visit.
            Unplanned visits and manager co-visits included.
          </p>
        </div>

        <div className='lp-journey'>
          <svg className='lp-journey__line' aria-hidden='true' preserveAspectRatio='none' viewBox='0 0 100 2'>
            <line x1='0' y1='1' x2='100' y2='1' vectorEffect='non-scaling-stroke' />
          </svg>
          {STAGES.map((stage, index) => (
            <div className='lp-journey__card' key={stage.title} data-animate='' style={{ ['--i' as string]: index + 2 }}>
              <span className='lp-journey__icon'>{stage.icon}</span>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default VisitJourney
