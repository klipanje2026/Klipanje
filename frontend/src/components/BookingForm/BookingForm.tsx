import { apiFetch } from "../../lib/api";

import { FormEvent, useState } from 'react';

type Props = { locale: 'en' | 'de' };

const copy = {
  en: {
    name: 'Your name', email: 'Work email', company: 'Company', phone: 'Phone (optional)',
    service: 'Project type', date: 'Preferred date', time: 'Preferred time', timezone: 'Your time zone',
    message: 'Anything we should know before the call?', consent: 'I agree that Gordon may contact me about this booking.',
    privacy: 'Privacy policy', submit: 'Book the discovery call', sending: 'Booking…',
    success: 'Your discovery call is reserved.', successText: 'The booking is now in Gordon CRM. We will send the final meeting details to your email.',
    error: 'We could not reserve this time. Please choose another slot or email info@gordondm.com.',
    taken: 'That time was just booked by someone else. Please choose another slot.', choose: 'Choose a project type',
  },
  de: {
    name: 'Ihr Name', email: 'Geschäftliche E-Mail', company: 'Unternehmen', phone: 'Telefon (optional)',
    service: 'Projektart', date: 'Wunschtermin', time: 'Uhrzeit', timezone: 'Ihre Zeitzone',
    message: 'Was sollten wir vor dem Gespräch wissen?', consent: 'Ich stimme zu, dass Gordon mich zu dieser Buchung kontaktiert.',
    privacy: 'Datenschutzerklärung', submit: 'Erstgespräch buchen', sending: 'Wird gebucht…',
    success: 'Ihr Erstgespräch ist reserviert.', successText: 'Der Termin ist jetzt im Gordon CRM. Die endgültigen Meeting-Details senden wir an Ihre E-Mail-Adresse.',
    error: 'Dieser Termin konnte nicht reserviert werden. Bitte wählen Sie eine andere Zeit oder schreiben Sie an info@gordondm.com.',
    taken: 'Dieser Termin wurde gerade gebucht. Bitte wählen Sie eine andere Zeit.', choose: 'Projektart auswählen',
  },
};

const projectTypes = {
  en: [['software-outsourcing', 'Software outsourcing'], ['saas-development', 'SaaS product development'], ['custom-software', 'Custom software'], ['ai-automation', 'AI automation'], ['other', 'Something else']],
  de: [['custom-crm', 'Individuelles CRM-System'], ['booking-system', 'Individuelles Buchungssystem'], ['automation', 'Business-Automatisierung'], ['other', 'Etwas anderes']],
};

const timeOptions = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

function isoDateDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function BookingForm({ locale }: Props) {
  const labels = copy[locale];
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error' | 'taken'>('idle');
  const timeZone = typeof Intl === 'undefined'
    ? 'Europe/Sarajevo'
    : Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Sarajevo';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date') ?? '');
    const time = String(form.get('time') ?? '');
    const startAt = new Date(`${date}T${time}:00`).toISOString();
    const params = new URLSearchParams(window.location.search);
    const body = {
      name: form.get('name'), email: form.get('email'), company: form.get('company'),
      phone: form.get('phone'), service: form.get('service'), message: form.get('message'),
      consent: form.get('consent') === 'on', website: form.get('website'), locale,
      startAt, timeZone, landingPage: window.location.href, gclid: params.get('gclid') ?? '',
      utmSource: params.get('utm_source') ?? '', utmMedium: params.get('utm_medium') ?? '',
      utmCampaign: params.get('utm_campaign') ?? '',
    };

    try {
      const response = await apiFetch('/api/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      if (response.status === 409) return setState('taken');
      if (!response.ok) throw new Error('Booking failed');
      setState('success');
      window.dataLayer?.push({ event: 'book_appointment', locale, service: body.service });
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return <div className="booking-success" role="status"><span>✓</span><h2>{labels.success}</h2><p>{labels.successText}</p></div>;
  }

  return (
    <form className="booking-form" onSubmit={submit}>
      <div className="form-grid">
        <label><span>{labels.name}</span><input name="name" autoComplete="name" required /></label>
        <label><span>{labels.email}</span><input name="email" type="email" autoComplete="email" required /></label>
        <label><span>{labels.company}</span><input name="company" autoComplete="organization" required /></label>
        <label><span>{labels.phone}</span><input name="phone" type="tel" autoComplete="tel" /></label>
      </div>
      <label><span>{labels.service}</span><select name="service" defaultValue="" required><option value="" disabled>{labels.choose}</option>{projectTypes[locale].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <div className="booking-slot-grid">
        <label><span>{labels.date}</span><input name="date" type="date" min={isoDateDaysFromNow(1)} max={isoDateDaysFromNow(60)} required /></label>
        <label><span>{labels.time}</span><select name="time" defaultValue="" required><option value="" disabled>—</option>{timeOptions.map((time) => <option value={time} key={time}>{time}</option>)}</select></label>
      </div>
      <p className="timezone-note" suppressHydrationWarning><b>{labels.timezone}:</b> {timeZone}</p>
      <label><span>{labels.message}</span><textarea name="message" rows={4} /></label>
      <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="consent-row"><input name="consent" type="checkbox" required /><span>{labels.consent} <a href={locale === 'en' ? '/privacy' : '/datenschutz'}>{labels.privacy}</a>.</span></label>
      <button className="button button-primary booking-submit" disabled={state === 'sending'}>{state === 'sending' ? labels.sending : labels.submit}<span aria-hidden="true">→</span></button>
      {(state === 'error' || state === 'taken') && <p className="form-error" role="alert">{state === 'taken' ? labels.taken : labels.error}</p>}
    </form>
  );
}
