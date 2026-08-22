import HeroCommandCenter from './HeroCommandCenter'

const Hero = () => {
  return (
    <section className='lp-hero' aria-labelledby='hero-heading'>
      <div className='lp-container'>
        <div className='lp-hero__grid'>
          <div className='lp-hero__copy'>
            <span className='lp-eyebrow'>Field force management for pharmaceutical teams</span>
            <h1 id='hero-heading' className='lp-h1'>
              See your field force as it actually works.
            </h1>
            <p className='lp-lead'>
              PharmaERP is how pharma sales teams plan doctor visits, track the field in real time, capture orders on
              the spot, and see performance the same day — on web and an offline-capable mobile app.
            </p>
            <div className='lp-hero__ctas'>
              <a href='#contact' className='lp-btn lp-btn--primary cursor-pointer' style={{ cursor: 'pointer' }}>
                Book a Demo
              </a>
              <a href='#how-it-works' className='lp-btn lp-btn--secondary cursor-pointer' style={{ cursor: 'pointer' }}>
                See how it works
              </a>
            </div>
            <p className='lp-hero__note'>Web command center for managers · offline mobile app for field reps</p>
          </div>

          <HeroCommandCenter />
        </div>
      </div>
    </section>
  )
}

export default Hero
