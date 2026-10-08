export type CaseStudy = {
  slug: string;
  alternateSlug: string;
  brand: string;
  category: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  title: string;
  summary: string;
  challengeTitle: string;
  challenge: string;
  workTitle: string;
  work: string[];
  outcomeTitle: string;
  outcome: string;
  highlights: { value: string; label: string }[];
  images: { src: string; alt: string; width: number; height: number }[];
  ctaTitle: string;
  ctaText: string;
};

export const englishCaseStudies: CaseStudy[] = [
  {
    slug: 'binance-balkan-community-activation',
    alternateSlug: 'binance-balkan-community',
    brand: 'Binance',
    category: 'Regional community activation',
    metaTitle: 'Binance Balkan Community Activation | Gordon DM Work',
    description:
      'See how Gordon supported local Binance community activations with event formats, regional content and partner coordination across the Balkans.',
    eyebrow: 'Selected work · Binance',
    title: 'Turning a global Web3 brand into local participation.',
    summary:
      'Gordon supported recurring community formats and regional activations that made participation approachable, social and relevant to local audiences.',
    challengeTitle: 'The challenge',
    challenge:
      'A global platform needs more than translated advertising to build trust in a local market. The experience had to feel useful to newcomers, credible to experienced community members and natural to each city and partner venue.',
    workTitle: 'What Gordon contributed',
    work: [
      'Local campaign concepts and content adapted for Balkan audiences',
      'Event promotion for recurring quiz, education and watch-party formats',
      'Partner and venue coordination around the participant journey',
      'On-site content that extended each activation beyond the room',
    ],
    outcomeTitle: 'What the archive shows',
    outcome:
      'The Instagram archive documents a repeatable portfolio of community formats across Sarajevo and the wider region. One Gnijezdo Zmajeva event brought together more than 450 attendees, while Global Quiz developed into a recurring series with at least seven promoted editions.',
    highlights: [
      { value: '450+', label: 'attendees documented at the first Gnijezdo Zmajeva event' },
      { value: '7+', label: 'Global Quiz editions promoted in the owned-media archive' },
      { value: 'Regional', label: 'community activity across several Balkan markets' },
    ],
    images: [
      {
        src: '/work/binance-balkans-event.jpg',
        alt: 'Gordon team and collaborators at a Binance community activation in Prishtina',
        width: 2268,
        height: 1275,
      },
      {
        src: '/work/binance-community-event.jpg',
        alt: 'A guest at a Gordon and Binance community activation in Sarajevo',
        width: 2766,
        height: 1856,
      },
    ],
    ctaTitle: 'Need a local campaign system—not just another ad?',
    ctaText:
      'We can map the content, landing experience, lead capture and follow-up needed to turn attention into measurable business activity.',
  },
  {
    slug: 'solana-community-events',
    alternateSlug: 'solana-community-events',
    brand: 'Solana',
    category: 'Community events & education',
    metaTitle: 'Solana Community Events Sarajevo | Gordon DM Work',
    description:
      'A Gordon case study on community events and educational content developed with Superteam Balkan and support from the Solana ecosystem.',
    eyebrow: 'Selected work · Solana ecosystem',
    title: 'Making Web3 education feel local, practical and welcoming.',
    summary:
      'Together with Superteam Balkan and support from the Solana ecosystem, Gordon helped bring community-led learning and networking formats to Sarajevo.',
    challengeTitle: 'The challenge',
    challenge:
      'Web3 events can feel closed or overly technical. The local format needed to welcome beginners, create value for builders and give the community a reason to meet again after the first event.',
    workTitle: 'What Gordon contributed',
    work: [
      'Local event concept, messaging and registration communication',
      'Educational and promotional content for a mixed-experience audience',
      'Community and venue coordination with Superteam Balkan',
      'Photo and social coverage used to continue the conversation after each event',
    ],
    outcomeTitle: 'What the archive shows',
    outcome:
      'The archive documents a free Sarajevo crypto event supported by the Solana Foundation, follow-up meetups focused on startups and Web3, and the first SuperQuiz by Superteam Balkan—evidence of a format that moved beyond a one-off announcement.',
    highlights: [
      { value: 'Sarajevo', label: 'local entry point for the community programme' },
      { value: 'Free', label: 'low-friction educational event access' },
      { value: 'Recurring', label: 'meetup and quiz formats documented in the archive' },
    ],
    images: [
      {
        src: '/work/solana-superquiz.jpg',
        alt: 'A speaker presenting at the first SuperQuiz by Superteam Balkan in Sarajevo',
        width: 1440,
        height: 1440,
      },
      {
        src: '/work/solana-event-poster.jpg',
        alt: 'Gordon poster for a free Sarajevo crypto event supported by the Solana Foundation',
        width: 940,
        height: 788,
      },
    ],
    ctaTitle: 'Planning an event, launch or community funnel?',
    ctaText:
      'We can connect the campaign, registration, content and follow-up into one measurable system.',
  },
];

export const germanCaseStudies: CaseStudy[] = [
  {
    ...englishCaseStudies[0],
    slug: 'binance-balkan-community',
    alternateSlug: 'binance-balkan-community-activation',
    category: 'Regionale Community-Aktivierung',
    metaTitle: 'Binance Community-Aktivierung im Balkan | Gordon Referenz',
    description:
      'Wie Gordon lokale Binance-Aktivierungen mit Eventformaten, regionalen Inhalten und Partnerkoordination im Balkan unterstützte.',
    eyebrow: 'Referenz · Binance',
    title: 'Eine globale Web3-Marke wird lokal erlebbar.',
    summary:
      'Gordon unterstützte wiederkehrende Community-Formate und regionale Aktivierungen, die Teilnahme verständlich, sozial und lokal relevant machten.',
    challengeTitle: 'Die Herausforderung',
    challenge:
      'Eine globale Plattform baut lokales Vertrauen nicht allein mit übersetzten Anzeigen auf. Das Erlebnis musste für Einsteiger zugänglich, für erfahrene Community-Mitglieder glaubwürdig und für jede Stadt authentisch sein.',
    workTitle: 'Gordons Beitrag',
    work: [
      'Lokale Kampagnenideen und Inhalte für Zielgruppen im Balkan',
      'Event-Promotion für Quiz-, Bildungs- und Public-Viewing-Formate',
      'Koordination von Partnern und Locations entlang der Teilnehmerreise',
      'Content vor Ort, der jede Aktivierung über den Veranstaltungsraum hinaus verlängerte',
    ],
    outcomeTitle: 'Was das Archiv belegt',
    outcome:
      'Das Instagram-Archiv dokumentiert wiederholbare Community-Formate in Sarajevo und weiteren regionalen Märkten. Eine Gnijezdo-Zmajeva-Veranstaltung brachte mehr als 450 Teilnehmer zusammen; Global Quiz entwickelte sich zu einer Serie mit mindestens sieben beworbenen Ausgaben.',
    highlights: [
      { value: '450+', label: 'dokumentierte Teilnehmer beim ersten Gnijezdo-Zmajeva-Event' },
      { value: '7+', label: 'im eigenen Medienarchiv beworbene Global-Quiz-Ausgaben' },
      { value: 'Regional', label: 'Community-Aktivitäten in mehreren Balkan-Märkten' },
    ],
    ctaTitle: 'Sie brauchen ein lokales Kampagnensystem – nicht nur Anzeigen?',
    ctaText:
      'Wir verbinden Content, Landingpage, Lead-Erfassung und Follow-up zu messbarer Geschäftsentwicklung.',
  },
  {
    ...englishCaseStudies[1],
    slug: 'solana-community-events',
    alternateSlug: 'solana-community-events',
    category: 'Community-Events & Weiterbildung',
    metaTitle: 'Solana Community-Events in Sarajevo | Gordon Referenz',
    description:
      'Community-Events und Bildungsinhalte von Gordon mit Superteam Balkan und Unterstützung aus dem Solana-Ökosystem.',
    eyebrow: 'Referenz · Solana-Ökosystem',
    title: 'Web3-Bildung lokal, praktisch und zugänglich machen.',
    summary:
      'Gemeinsam mit Superteam Balkan und Unterstützung aus dem Solana-Ökosystem brachte Gordon community-geführte Lern- und Networking-Formate nach Sarajevo.',
    challengeTitle: 'Die Herausforderung',
    challenge:
      'Web3-Veranstaltungen wirken schnell geschlossen oder zu technisch. Das Format sollte Einsteiger willkommen heißen, Buildern echten Mehrwert bieten und nach dem ersten Termin einen Grund für weitere Treffen schaffen.',
    workTitle: 'Gordons Beitrag',
    work: [
      'Lokales Eventkonzept, Messaging und Registrierungskommunikation',
      'Bildungs- und Promotion-Content für unterschiedliche Erfahrungsstufen',
      'Community- und Location-Koordination mit Superteam Balkan',
      'Foto- und Social-Media-Begleitung für nachhaltige Reichweite',
    ],
    outcomeTitle: 'Was das Archiv belegt',
    outcome:
      'Das Archiv dokumentiert ein kostenloses Krypto-Event in Sarajevo mit Unterstützung der Solana Foundation, weitere Meetups zu Startups und Web3 sowie das erste SuperQuiz von Superteam Balkan – ein Format, das über eine einzelne Veranstaltung hinausging.',
    highlights: [
      { value: 'Sarajevo', label: 'lokaler Einstiegspunkt für das Community-Programm' },
      { value: 'Kostenlos', label: 'niedrige Zugangshürde zur Weiterbildung' },
      { value: 'Wiederkehrend', label: 'Meetup- und Quizformate im Archiv dokumentiert' },
    ],
    ctaTitle: 'Planen Sie ein Event, einen Launch oder einen Community-Funnel?',
    ctaText:
      'Wir verbinden Kampagne, Registrierung, Content und Follow-up zu einem messbaren System.',
  },
];
