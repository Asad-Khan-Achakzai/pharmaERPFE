'use client'

import { IconMail, IconPhone, IconUser } from './icons'
import { useInView } from '../hooks/useInView'

const DEMO_MAIL =
  'mailto:asad.khan.achakzie@gmail.com?subject=PharmaERP%20Demo%20Request&body=Hi%20Asad%2C%0A%0AWe%27d%20like%20to%20see%20a%20demo%20of%20PharmaERP%20for%20our%20field%20team.%0A%0ACompany%3A%0ATeam%20size%3A%0A'

const DemoCta = () => {
  const ref = useInView<HTMLDivElement>(0.15)

  return (
    <section id='contact' className='lp-section lp-cta' aria-labelledby='cta-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-cta__layout'>
          <div>
            <span className='lp-eyebrow' data-animate=''>
              Book a demo
            </span>
            <h2 id='cta-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1, color: '#fff' }}>
              See PharmaERP running on your territory.
            </h2>
            <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
              A 30-minute walkthrough with your own workflow: planning, live tracking, visits, orders and the numbers
              your managers care about. No commitments.
            </p>
            <div className='lp-hero__ctas' data-animate='' style={{ ['--i' as string]: 3 }}>
              <a href={DEMO_MAIL} className='lp-btn lp-btn--on-dark cursor-pointer' style={{ cursor: 'pointer' }}>
                Book a Demo
              </a>
            </div>
          </div>

          <div className='lp-cta__card' data-animate='' style={{ ['--i' as string]: 3 }}>
            <h3>Talk to us directly</h3>
            <div className='lp-cta__contact'>
              <span>
                <IconUser />
                Asad Khan
              </span>
              <a href='mailto:asad.khan.achakzie@gmail.com'>
                <IconMail />
                asad.khan.achakzie@gmail.com
              </a>
              <a href='tel:+923118491079'>
                <IconPhone />
                0311 8491079
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DemoCta
