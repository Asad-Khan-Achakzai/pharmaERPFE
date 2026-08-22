'use client'

// Orders-to-cash pipeline — every stage is a real backend capability:
// Order -> deliver (invoice PDF) -> return/amendment (credit note PDF) ->
// collection -> settlement -> ledgers/GL. Source: order.routes.js,
// DeliveryRecord/ReturnRecord/OrderAmendment/CreditNote models,
// docs/delivery-return-amendment-impact-architecture.md.
import { IconFile } from './icons'
import { useInView } from '../hooks/useInView'

const STAGES = [
  {
    title: 'Order',
    body: 'Captured by the rep during the visit — even offline.',
    chip: 'Order receipt PDF'
  },
  {
    title: 'Delivery',
    body: 'Delivered via the distributor with quantities and tax recorded.',
    chip: 'Invoice PDF'
  },
  {
    title: 'Returns & amendments',
    body: 'Post-delivery changes handled cleanly, with full audit.',
    chip: 'Credit note PDF'
  },
  {
    title: 'Collection',
    body: 'Payments recorded against pharmacy outstanding balances.',
    chip: 'AR updated'
  },
  {
    title: 'Settlement',
    body: 'Distributor settlements reconcile cash back to the company.',
    chip: 'Reconciled'
  },
  {
    title: 'Your books',
    body: 'Every step posts to ledgers and the general ledger automatically.',
    chip: 'GL posted'
  }
]

const OrdersPipeline = () => {
  const ref = useInView<HTMLDivElement>(0.12)

  return (
    <section className='lp-section' aria-labelledby='orders-heading'>
      <div className='lp-container' ref={ref}>
        <div className='lp-section-head lp-section-head--center'>
          <span className='lp-eyebrow' data-animate=''>
            Sales, orders & finance
          </span>
          <h2 id='orders-heading' className='lp-h2' data-animate='' style={{ ['--i' as string]: 1 }}>
            From field order to your books — no re-entry.
          </h2>
          <p className='lp-lead' data-animate='' style={{ ['--i' as string]: 2 }}>
            PharmaERP is not just a field app. Orders flow through delivery, invoicing, returns, collections and
            settlements straight into double-entry accounting and tax records.
          </p>
        </div>

        <div className='lp-pipe'>
          {STAGES.map((stage, index) => (
            <div className='lp-pipe__stage' key={stage.title} data-animate='' style={{ ['--i' as string]: index + 2 }}>
              <div className='lp-pipe__num lp-num'>{String(index + 1).padStart(2, '0')}</div>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
              <span className='lp-doc-chip'>
                <IconFile />
                {stage.chip}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default OrdersPipeline
