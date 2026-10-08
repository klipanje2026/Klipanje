import { apiFetch } from "../../lib/api";

import { FormEvent, useState } from 'react';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

type Props = {
  locale: 'en' | 'de';
  initialService?: string;
};

const labels = {
  en: {
    name: 'Your name',
    email: 'Work email',
    company: 'Company',
    phone: 'Phone (optional)',
    service: 'What do you need?',
    message: 'What is slowing your business down?',
    consent: 'I agree that Gordon may contact me about this request.',
    privacy: 'Privacy policy',
    submit: 'Send project request',
    sending: 'Sending…',
    successTitle: 'Thank you — your request is in the CRM.',
    successText: 'We will review it and reply within one business day.',
    error: 'We could not save your request. Please try again or email info@gordondm.com.',
    choose: 'Choose a service',
  },
  de: {
    name: 'Ihr Name',
    email: 'Geschäftliche E-Mail',
    company: 'Unternehmen',
    phone: 'Telefon (optional)',
    service: 'Was benötigen Sie?',
    message: 'Was bremst Ihr Unternehmen aktuell aus?',
    consent: 'Ich stimme zu, dass Gordon mich zu dieser Anfrage kontaktiert.',
    privacy: 'Datenschutzerklärung',
    submit: 'Projektanfrage senden',
    sending: 'Wird gesendet…',
    successTitle: 'Vielen Dank — Ihre Anfrage ist im CRM.',
    successText: 'Wir prüfen sie und antworten innerhalb eines Werktages.',
    error: 'Ihre Anfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@gordondm.com.',
    choose: 'Leistung auswählen',
  },
};

const services = {
  en: [
    ['software-outsourcing', 'Software outsourcing'],
    ['saas-development', 'SaaS product development'],
    ['custom-software', 'Custom software'],
    ['ai-automation', 'AI automation'],
    ['other', 'Something else'],
  ],
  de: [
    ['custom-crm', 'Individuelles CRM-System'],
    ['booking-system', 'Individuelles Buchungssystem'],
    ['automation', 'Business-Automatisierung'],
    ['other', 'Etwas anderes'],
  ],
};

function trackingFields() {
  const params = new URLSearchParams(window.location.search);
  return {
    landingPage: window.location.href,
    gclid: params.get('gclid') ?? '',
    utmSource: params.get('utm_source') ?? '',
    utmMedium: params.get('utm_medium') ?? '',
    utmCampaign: params.get('utm_campaign') ?? '',
  };
}

export function LeadForm({ locale, initialService = '' }: Props) {
  const copy = labels[locale];
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const form = new FormData(event.currentTarget);
    const service = String(form.get('service') ?? '');
    const body = {
      name: form.get('name'),
      email: form.get('email'),
      company: form.get('company'),
      phone: form.get('phone'),
      service,
      message: form.get('message'),
      consent: form.get('consent') === 'on',
      website: form.get('website'),
      locale,
      ...trackingFields(),
    };

    try {
      const response = await apiFetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Lead request failed');
      setState('success');
      window.dataLayer?.push({ event: 'generate_lead', service, locale });
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="form-success" role="status">
        <span>✓</span>
        <h3>{copy.successTitle}</h3>
        <p>{copy.successText}</p>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          <span>{copy.name}</span>
          <input name="name" autoComplete="name" required />
        </label>
        <label>
          <span>{copy.email}</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          <span>{copy.company}</span>
          <input name="company" autoComplete="organization" required />
        </label>
        <label>
          <span>{copy.phone}</span>
          <input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>
      <label>
        <span>{copy.service}</span>
        <select name="service" defaultValue={initialService} required>
          <option value="" disabled>{copy.choose}</option>
          {services[locale].map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{copy.message}</span>
        <textarea name="message" rows={4} />
      </label>
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="consent-row">
        <input name="consent" type="checkbox" required />
        <span>
          {copy.consent}{' '}
          <a href={locale === 'en' ? '/privacy' : '/datenschutz'}>{copy.privacy}</a>.
        </span>
      </label>
      <button className="button button-light form-submit" disabled={state === 'sending'}>
        {state === 'sending' ? copy.sending : copy.submit}
        <span aria-hidden="true">→</span>
      </button>
      {state === 'error' && <p className="form-error" role="alert">{copy.error}</p>}
    </form>
  );
}
