import { LeadForm } from '../LeadForm/LeadForm';
import { InnerShell } from '../InnerShell/InnerShell';
import type { ServiceEntry } from '../../data/service-content';

export function ServiceDetail({ service }: { service: ServiceEntry }) {
  const labels = { problem: 'Where value is lost', result: 'What changes', included: 'Built around the work', faq: 'Questions, answered clearly', contact: 'Discuss your project' };

  const schema = {
    '@context': 'https://schema.org', '@type': 'Service', name: service.metaTitle,
    description: service.description, provider: { '@type': 'Organization', name: 'Gordon Digital Marketing', url: 'https://gordondm.com' },
    areaServed: 'United States',
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: service.faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
  };

  return (
    <InnerShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <section className="service-hero shell"><p className="eyebrow"><span />{service.eyebrow}</p><h1>{service.title}</h1><p>{service.lede}</p><a className="button button-primary" href="#project-form">{labels.contact}<span aria-hidden="true">→</span></a></section>
      <section className="service-band"><div className="shell service-problem"><p className="eyebrow eyebrow-light"><span />{labels.problem}</p><h2>{service.painTitle}</h2><ul>{service.pains.map((pain) => <li key={pain}>{pain}</li>)}</ul></div></section>
      <section className="section shell"><div className="section-heading"><p className="eyebrow"><span />{labels.result}</p><h2>{service.outcomeTitle}</h2></div><div className="outcome-grid">{service.outcomes.map((outcome, index) => <article key={outcome.title}><span>0{index + 1}</span><h3>{outcome.title}</h3><p>{outcome.text}</p></article>)}</div></section>
      <section className="feature-section"><div className="shell feature-grid"><div><p className="eyebrow"><span />{labels.included}</p><h2>{service.featureTitle}</h2></div><ul>{service.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div></section>
      <section className="section shell faq-section"><div className="section-heading split-heading"><div><p className="eyebrow"><span />FAQ</p><h2>{labels.faq}</h2></div><p>Useful answers before you decide whether a conversation makes sense.</p></div><div className="faq-list">{service.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div></section>
      <section className="section shell service-contact" id="project-form"><div><p className="eyebrow"><span />{labels.contact}</p><h2>{service.ctaTitle}</h2><p>{service.ctaText}</p></div><LeadForm locale="en" initialService={service.key} /></section>
    </InnerShell>
  );
}
