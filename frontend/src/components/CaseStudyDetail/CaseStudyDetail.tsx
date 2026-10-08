import Image from "../Image/Image";
import Link from "../Link/Link";
import type { CaseStudy } from '../../data/case-studies';
import { InnerShell } from '../InnerShell/InnerShell';

export function CaseStudyDetail({
  study,
}: {
  study: CaseStudy;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: study.title,
    description: study.description,
    creator: {
      '@type': 'Organization',
      name: 'Gordon Digital Marketing',
      url: 'https://gordondm.com',
    },
  };

  return (
    <InnerShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="case-study-page">
        <header className="case-hero shell">
          <p className="eyebrow"><span />{study.eyebrow}</p>
          <h1>{study.title}</h1>
          <p>{study.summary}</p>
        </header>
        <div className="case-cover shell">
          <Image
            src={study.images[0].src}
            alt={study.images[0].alt}
            width={study.images[0].width}
            height={study.images[0].height}
            sizes="(max-width: 1200px) 100vw, 1180px"
            priority
          />
        </div>
        <section className="case-highlights shell" aria-label="Project highlights">
          {study.highlights.map((highlight) => (
            <div key={highlight.label}>
              <strong>{highlight.value}</strong>
              <span>{highlight.label}</span>
            </div>
          ))}
        </section>
        <section className="case-story shell">
          <div><p className="eyebrow"><span />01</p><h2>{study.challengeTitle}</h2><p>{study.challenge}</p></div>
          <div><p className="eyebrow"><span />02</p><h2>{study.workTitle}</h2><ul>{study.work.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div><p className="eyebrow"><span />03</p><h2>{study.outcomeTitle}</h2><p>{study.outcome}</p></div>
        </section>
        <section className="case-gallery shell">
          {study.images.slice(1).map((item) => (
            <Image
              key={item.src}
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes="(max-width: 1200px) 100vw, 1180px"
            />
          ))}
        </section>
        <section className="case-cta">
          <div className="shell">
            <h2>{study.ctaTitle}</h2>
            <p>{study.ctaText}</p>
            <Link className="button button-light" href="/#contact">
              Discuss your project →
            </Link>
          </div>
        </section>
      </article>
    </InnerShell>
  );
}
