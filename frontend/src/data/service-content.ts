export type ServiceEntry = {
  slug: string;
  key: 'software-outsourcing' | 'saas-development' | 'custom-software' | 'ai-automation';
  title: string;
  metaTitle: string;
  description: string;
  eyebrow: string;
  lede: string;
  painTitle: string;
  pains: string[];
  outcomeTitle: string;
  outcomes: { title: string; text: string }[];
  featureTitle: string;
  features: string[];
  faq: { question: string; answer: string }[];
  ctaTitle: string;
  ctaText: string;
};

export const englishServices: ServiceEntry[] = [
  {
    slug: 'software-outsourcing',
    key: 'software-outsourcing',
    title: 'Software outsourcing that feels like part of your team.',
    metaTitle: 'Affordable Software Outsourcing for US Companies | Gordon DM',
    description:
      'Cost-effective software outsourcing for US businesses. Add a senior European product team for web apps, integrations, SaaS and ongoing development.',
    eyebrow: 'Software outsourcing for US companies',
    lede:
      'Get product, design and engineering capacity without a long hiring cycle or heavy US agency overhead. You work directly with a focused European team and see progress every week.',
    painTitle: 'Outsourcing fails when low cost becomes the only thing being optimized.',
    pains: [
      'Freelancers disappear or cannot cover the full product lifecycle.',
      'Large agencies add layers of account management and overhead.',
      'An internal roadmap stalls while your team is hiring.',
      'Offshore handoffs create unclear ownership and slow feedback.',
    ],
    outcomeTitle: 'Flexible capacity with clear ownership.',
    outcomes: [
      { title: 'A team, not a ticket queue', text: 'Work directly with people who understand the product, priorities and business context.' },
      { title: 'Practical economics', text: 'A Sarajevo-based delivery team gives US companies access to strong talent with a leaner cost structure.' },
      { title: 'Visible progress', text: 'Focused releases, regular demos and one clear backlog keep the engagement easy to follow.' },
    ],
    featureTitle: 'Your extended product team can cover',
    features: [
      'Product discovery and technical planning', 'UX and interface design',
      'Frontend and backend development', 'API and third-party integrations',
      'Quality assurance and release support', 'Existing product modernization',
      'Ongoing maintenance and improvements', 'Clear documentation and handover',
    ],
    faq: [
      { question: 'Why outsource software development to Bosnia?', answer: 'Bosnia offers a strong European technology talent pool and a leaner operating cost than major US markets. Gordon adds direct communication, product thinking and clear delivery ownership from Sarajevo.' },
      { question: 'Can you work with our existing team?', answer: 'Yes. We can own a defined product stream, add capacity to an existing roadmap or take a focused release from discovery through launch.' },
      { question: 'How do we start without a large commitment?', answer: 'We begin by defining the smallest useful scope. That may be a discovery sprint, prototype or focused first release before expanding the engagement.' },
    ],
    ctaTitle: 'Need more delivery capacity without another long hiring cycle?',
    ctaText: 'Tell us what is on your roadmap, where it is stuck and what a useful first release would change.',
  },
  {
    slug: 'saas-development',
    key: 'saas-development',
    title: 'Build a SaaS product people can understand and use.',
    metaTitle: 'SaaS Development Company for Startups & SMBs | Gordon DM',
    description:
      'SaaS product design and development for US startups and growing businesses—from product discovery and MVP development to integrations and scaling.',
    eyebrow: 'SaaS product development',
    lede:
      'Move from product idea to a focused release with one team covering strategy, UX, development and the operational details behind a dependable SaaS business.',
    painTitle: 'A SaaS idea becomes expensive when the first release tries to do everything.',
    pains: [
      'The roadmap is a feature list without a clear customer outcome.',
      'Design and development move separately and create rework.',
      'Important admin, billing or onboarding flows arrive too late.',
      'The MVP takes so long that real customer learning is delayed.',
    ],
    outcomeTitle: 'A smaller, clearer path to market.',
    outcomes: [
      { title: 'Focused product scope', text: 'Prioritize the user journey and business assumption the first release needs to prove.' },
      { title: 'One connected team', text: 'Product thinking, UX and engineering decisions happen together instead of through handoffs.' },
      { title: 'A foundation that can grow', text: 'Build the account, permissions, billing, analytics and integration basics with the next stage in mind.' },
    ],
    featureTitle: 'A SaaS engagement can include',
    features: [
      'Product discovery and roadmap definition', 'Clickable prototypes and usability flows',
      'MVP and web application development', 'User accounts, roles and permissions',
      'Subscription and payment integrations', 'Admin dashboards and reporting',
      'Email, CRM and API integrations', 'Post-launch iteration and support',
    ],
    faq: [
      { question: 'Can you build an MVP from an early idea?', answer: 'Yes. We first clarify the customer, core problem and riskiest assumption, then shape a smaller release that can produce real learning.' },
      { question: 'Do you handle design as well as development?', answer: 'Yes. Product strategy, UX, interface design and engineering are handled as one connected process.' },
      { question: 'Can you continue after launch?', answer: 'Yes. We can support monitoring, customer feedback, improvements and new releases after the initial launch.' },
    ],
    ctaTitle: 'Bring us the idea, prototype or roadmap.',
    ctaText: 'We will help you identify the first release worth building and the clearest way to reach it.',
  },
  {
    slug: 'custom-software-development',
    key: 'custom-software',
    title: 'Custom software shaped around how your business works.',
    metaTitle: 'Custom Software Development for US Businesses | Gordon DM',
    description:
      'Custom software development for US businesses: CRM, booking platforms, customer portals, internal tools, dashboards and system integrations.',
    eyebrow: 'Custom software development',
    lede:
      'Replace spreadsheets, repetitive administration and disconnected tools with a practical system designed around your customers, team and operation.',
    painTitle: 'Your process should not be forced into a generic tool.',
    pains: [
      'Critical work is tracked across inboxes, documents and spreadsheets.',
      'Teams copy the same data between tools and introduce errors.',
      'Customers wait while internal steps move manually.',
      'Off-the-shelf software creates workarounds instead of solving the process.',
    ],
    outcomeTitle: 'One useful system where the work actually happens.',
    outcomes: [
      { title: 'A clearer operation', text: 'Bring the workflow, owners, customer history and next actions into a shared system.' },
      { title: 'Less administration', text: 'Automate predictable steps and keep your team focused on judgment and customer care.' },
      { title: 'Software people adopt', text: 'Design around the real users and introduce the system through focused, testable releases.' },
    ],
    featureTitle: 'Custom platforms can include',
    features: [
      'CRM and lead management systems', 'Custom booking and scheduling',
      'Customer and partner portals', 'Operations dashboards and reporting',
      'Approval and document workflows', 'Payments and subscription flows',
      'Third-party and legacy integrations', 'Data migration and role-based access',
    ],
    faq: [
      { question: 'When is custom software a better choice than an off-the-shelf tool?', answer: 'It becomes useful when a core process creates repeated manual work, existing tools require costly workarounds or the workflow itself is part of your competitive advantage.' },
      { question: 'Can you replace our spreadsheets gradually?', answer: 'Yes. We can start with the highest-value workflow, import the required data and expand after the team is comfortable with the first release.' },
      { question: 'Do you build custom CRM and booking systems?', answer: 'Yes. CRM, booking, customer portals and operations tools are common custom software projects for Gordon.' },
    ],
    ctaTitle: 'Show us the process your current tools cannot handle.',
    ctaText: 'We will map the bottleneck and recommend the smallest system that can create meaningful value.',
  },
  {
    slug: 'ai-automation',
    key: 'ai-automation',
    title: 'Practical AI automation for work your team repeats every day.',
    metaTitle: 'AI Automation Services for Small Businesses | Gordon DM',
    description:
      'Practical AI automation for US businesses. Connect tools, qualify leads, process documents and build reliable AI-assisted workflows with human oversight.',
    eyebrow: 'AI automation services',
    lede:
      'Use AI where it removes a real bottleneck—not because it is fashionable. We connect your tools, data and review steps into workflows your team can trust.',
    painTitle: 'AI experiments only matter when they improve a real workflow.',
    pains: [
      'Staff repeatedly sorts, summarizes or re-enters the same information.',
      'Leads wait because qualification and routing happen manually.',
      'Knowledge is trapped across documents, inboxes and individual employees.',
      'Disconnected AI tools create more tabs without changing the operation.',
    ],
    outcomeTitle: 'Automation with a clear job and a human checkpoint.',
    outcomes: [
      { title: 'Faster response', text: 'Classify, route and prepare routine work before a team member needs to step in.' },
      { title: 'Connected context', text: 'Give workflows access to the right business data, documents and system actions.' },
      { title: 'Controlled operation', text: 'Add review steps, logs and fallback rules so important decisions stay accountable.' },
    ],
    featureTitle: 'AI automation projects can include',
    features: [
      'Workflow discovery and opportunity mapping', 'Lead qualification and routing',
      'Document extraction and classification', 'Internal knowledge assistants',
      'Customer support drafting and triage', 'CRM and operations updates',
      'Human review and exception handling', 'Monitoring and performance reporting',
    ],
    faq: [
      { question: 'What should a small business automate first?', answer: 'Start with a high-frequency, rules-based task that has clear inputs and an easy way to check the result. We map value and risk before choosing the technology.' },
      { question: 'Will AI make decisions without our team?', answer: 'It does not have to. We design human review, approval thresholds and fallback paths around the importance of each decision.' },
      { question: 'Can AI automation connect with our current CRM and tools?', answer: 'Usually, yes. We review the available APIs, data access and security requirements before recommending an integration approach.' },
    ],
    ctaTitle: 'Start with the task everyone is tired of repeating.',
    ctaText: 'Tell us what happens today. We will assess whether AI, standard automation or a simpler process change is the right answer.',
  },
];
