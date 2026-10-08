import { apiFetch } from "../../lib/api";

import { useEffect, useMemo, useState } from 'react';

type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: string;
  source: string;
  service: string;
  status: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  message: string | null;
  landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  booking_id: string | null;
  start_at: string | null;
  time_zone: string | null;
  booking_status: string | null;
};

const statuses = ['new', 'meeting', 'contacted', 'qualified', 'proposal', 'won', 'lost'];

export function StudioDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  async function load() {
    try {
      const response = await apiFetch('/api/studio/leads');
      if (!response.ok) throw new Error('Could not load leads');
      const data = (await response.json()) as { leads: Lead[] };
      setLeads(data.leads);
      setError('');
    } catch {
      setError('Could not load CRM data. Check the database binding and admin access.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiFetch('/api/studio/leads')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load leads');
        return response.json() as Promise<{ leads: Lead[] }>;
      })
      .then((data) => {
        if (active) setLeads(data.leads);
      })
      .catch(() => {
        if (active) setError('Could not load CRM data. Check the database binding and admin access.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function updateStatus(id: string, status: string) {
    const previous = leads;
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead));
    try {
      const response = await apiFetch('/api/studio/leads', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error('Update failed');
    } catch {
      setLeads(previous);
      setError('Status update failed. Please retry.');
    }
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesFilter = filter === 'all' || lead.status === filter;
      const matchesSearch = !term || [lead.name, lead.company, lead.email, lead.service].some((value) => value?.toLowerCase().includes(term));
      return matchesFilter && matchesSearch;
    });
  }, [leads, search, filter]);

  const metrics = {
    total: leads.length,
    new: leads.filter((lead) => lead.status === 'new').length,
    meetings: leads.filter((lead) => lead.start_at).length,
    won: leads.filter((lead) => lead.status === 'won').length,
  };

  return (
    <div className="studio-dashboard">
      <div className="studio-metrics">
        <article><span>Total leads</span><strong>{metrics.total}</strong></article>
        <article><span>New</span><strong>{metrics.new}</strong></article>
        <article><span>Bookings</span><strong>{metrics.meetings}</strong></article>
        <article><span>Won</span><strong>{metrics.won}</strong></article>
      </div>
      <div className="studio-toolbar">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company, person or email…" />
        <select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select>
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {loading ? <p className="studio-empty">Loading CRM…</p> : visible.length === 0 ? <p className="studio-empty">No leads match this view yet.</p> : (
        <div className="lead-list">
          {visible.map((lead) => (
            <article className="lead-card" key={lead.id}>
              <div className="lead-main">
                <div className="lead-heading"><span className={`lead-source source-${lead.source}`}>{lead.source === 'booking' ? 'Booking' : lead.locale.toUpperCase()}</span><time>{new Date(lead.created_at).toLocaleString()}</time></div>
                <h2>{lead.name} <span>· {lead.company}</span></h2>
                <div className="lead-contact"><a href={`mailto:${lead.email}`}>{lead.email}</a>{lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}</div>
                <p className="lead-service">{lead.service}</p>
                {lead.message && <p className="lead-message">{lead.message}</p>}
                {lead.start_at && <p className="lead-booking"><b>Requested call:</b> {new Date(lead.start_at).toLocaleString()} <small>{lead.time_zone}</small></p>}
                {(lead.utm_source || lead.utm_campaign) && <p className="lead-attribution"><b>Attribution:</b> {[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ')}</p>}
              </div>
              <div className="lead-actions">
                <label><span>Status</span><select value={lead.status} onChange={(event) => void updateStatus(lead.id, event.target.value)}>{statuses.map((status) => <option value={status} key={status}>{status}</option>)}</select></label>
                <a href={`mailto:${lead.email}?subject=${encodeURIComponent('Your Gordon project request')}`}>Reply by email →</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
