'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './activity-dashboard.module.css';

type ActivityRow = { id: string; session_id: string; name: string; event: string; detail: string; created_at: string };
type MessageRow = { id: string; name: string; surname: string; kind: string; choice: string; date?: string; contact: string; message: string; session_id: string; fingerprint_hash: string; email_status: string; created_at: string };
type Topic = 'Arrival' | 'Personal note' | 'Private note' | 'Detour' | 'Coffee & catch-up' | 'Project' | 'Stock ideas' | 'Connections' | 'Other';
type TimelineItem = { id: string; name: string; topic: Topic; title: string; detail: string; createdAt: string; sessionId: string; message?: MessageRow; event?: ActivityRow };
type SessionJourney = { id: string; name: string; events: ActivityRow[]; latestAt: string; lastStep: string };

const topicFor = (event: string, detail: string, kind = ''): Topic => {
  const value = `${event} ${detail} ${kind}`.toLowerCase();
  if (/project|pause/.test(value)) return 'Project';
  if (/stock/.test(value)) return 'Stock ideas';
  if (/coffee|catch.?up|meetup/.test(value)) return 'Coffee & catch-up';
  if (/detour|recommendation|book|podcast|movie|series|restaurant|experience|place/.test(value)) return 'Detour';
  if (/memory|private|confession/.test(value)) return 'Private note';
  if (/social|whatsapp|linkedin|instagram|qr|link_opened/.test(value)) return 'Connections';
  if (/note|personalized|scratch|download/.test(value)) return 'Personal note';
  if (/page_view|name_entered|name_cleared|profanity|page_hidden|page_resumed|page_exit/.test(value)) return 'Arrival';
  return 'Other';
};

const eventCopy: Record<string, string> = {
  page_view: 'Opened the farewell page', name_entered: 'Entered a first name', personalized_note_viewed: 'Viewed a personalized note',
  name_cleared: 'Cleared the name field', profanity_blocked: 'A name was blocked by the language filter', envelope_opened: 'Opened an envelope',
  scratch_card_revealed: 'Revealed the scratch card', personal_note_downloaded: 'Saved a personal note', invitation_downloaded: 'Saved an invitation',
  form_started: 'Started a suggestion', form_abandoned: 'Left a suggestion unfinished', choice_changed: 'Changed a selection',
  form_field_focused: 'Started filling in a form field', form_submitted: 'Sent a suggestion', qr_scanned: 'Opened a QR destination',
  link_opened: 'Opened an external link', whatsapp_draft_link_clicked: 'Opened a WhatsApp draft', page_bottom_reached: 'Reached the end of the page',
  page_hidden: 'Left the page in the background', page_resumed: 'Returned to the page', page_exit: 'Ended the visit',
  project_pause_started: 'Started the project pause', project_pause_completed: 'Completed the project pause', project_pause_skipped: 'Skipped the project pause',
};

const humanEvent = (event: string) => eventCopy[event] ?? event.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
const topicOptions: Topic[] = ['Arrival', 'Personal note', 'Private note', 'Detour', 'Coffee & catch-up', 'Project', 'Stock ideas', 'Connections', 'Other'];

export function ActivityDashboard(props: {
  activities: ActivityRow[]; submissions: MessageRow[]; visits: number; named: number; envelopes: number;
  totalSubmissions: number; visitorFingerprints: number; pending: number; totalActivityEvents: number;
  counts: { event: string; total: number }[]; topicCounts: { topic: Topic; total: number }[];
  journeyEvents: ActivityRow[]; journeyCounts: { arrived: number; opened: number; started: number; submitted: number }; waitlistClicks: number; now: number;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState('All topics');
  const [windowDays, setWindowDays] = useState('all');
  const [query, setQuery] = useState('');
  const items = useMemo(() => {
    const submissionEvents = new Set(props.submissions.map((m) => `${m.session_id}|${m.kind}|${m.created_at.slice(0, 16)}`));
    const rows: TimelineItem[] = props.activities.filter((a) => {
      if (a.event === 'form_submitted' && submissionEvents.has(`${a.session_id}|${a.detail.split(':')[0]}|${a.created_at.slice(0, 16)}`)) return false;
      return true;
    }).map((a): TimelineItem => ({
      id: `event-${a.id}`, name: a.name || 'Name not provided', topic: topicFor(a.event, a.detail), title: humanEvent(a.event),
      detail: a.detail, createdAt: a.created_at, sessionId: a.session_id, event: a,
    })).concat(props.submissions.map((m): TimelineItem => ({
      id: `message-${m.id}`, name: [m.name, m.surname].filter(Boolean).join(' ') || 'Name not provided', topic: topicFor('form_submitted', m.choice, m.kind),
      title: `Suggestion sent · ${m.kind.replaceAll('_', ' ')}`, detail: m.choice, createdAt: m.created_at, sessionId: m.session_id, message: m,
    }))).sort((a, b) => new Date(b.createdAt.replace(' ', 'T') + 'Z').getTime() - new Date(a.createdAt.replace(' ', 'T') + 'Z').getTime());
    const cutoff = windowDays === 'all' ? 0 : props.now - Number(windowDays) * 86400000;
    const search = query.trim().toLowerCase();
    return rows.filter((item) => {
      const ts = new Date(item.createdAt.replace(' ', 'T') + 'Z').getTime();
      return (topic === 'All topics' || item.topic === topic) && (!cutoff || ts >= cutoff) && (!search || `${item.name} ${item.title} ${item.detail} ${item.message?.message ?? ''} ${item.sessionId}`.toLowerCase().includes(search));
    });
  }, [props.activities, props.submissions, topic, windowDays, query, props.now]);
  const journey = [['Arrived', props.journeyCounts.arrived], ['Opened an envelope', props.journeyCounts.opened], ['Started a form', props.journeyCounts.started], ['Sent a suggestion', props.journeyCounts.submitted]] as const;
  const maxJourney = Math.max(...journey.map(([, value]) => value), 1);
  const openCount = (name: Topic) => props.topicCounts.find((x) => x.topic === name)?.total ?? 0;
  const eventCount = (name: string) => props.counts.find((x) => x.event === name)?.total ?? 0;
  const displayTime = (value: string) => new Date(`${value.replace(' ', 'T')}Z`).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  const journeys = useMemo(() => {
    const groups = new Map<string, ActivityRow[]>();
    for (const event of props.journeyEvents) {
      if (!event.session_id) continue;
      const current = groups.get(event.session_id) ?? [];
      current.push(event);
      groups.set(event.session_id, current);
    }
    return Array.from(groups, ([id, events]): SessionJourney => {
      events.sort((a, b) => new Date(a.created_at.replace(' ', 'T') + 'Z').getTime() - new Date(b.created_at.replace(' ', 'T') + 'Z').getTime());
      const last = events.at(-1)!;
      const has = (event: string) => events.some((row) => row.event === event);
      const lastStep = has('form_submitted') ? 'Suggestion submitted' : has('form_abandoned') ? 'Left during a form' : has('form_started') ? 'Form started · no submission recorded' : has('envelope_opened') ? 'Envelope opened · no form started' : has('name_entered') ? 'Name entered · no envelope opened' : 'Arrived · no later action recorded';
      const submissionName = props.submissions.find((row) => row.session_id === id);
      const name = submissionName ? [submissionName.name, submissionName.surname].filter(Boolean).join(' ') : [...events].reverse().find((row) => row.name)?.name;
      return { id, name: name || 'Visitor name not provided', events, latestAt: last.created_at, lastStep };
    }).sort((a, b) => new Date(b.latestAt.replace(' ', 'T') + 'Z').getTime() - new Date(a.latestAt.replace(' ', 'T') + 'Z').getTime());
  }, [props.journeyEvents, props.submissions]);
  const matchingJourneys = journeys.filter((session) => {
    const cutoff = windowDays === 'all' ? 0 : props.now - Number(windowDays) * 86400000;
    const latest = new Date(session.latestAt.replace(' ', 'T') + 'Z').getTime();
    const hasTopic = topic === 'All topics' || session.events.some((event) => topicFor(event.event, event.detail) === topic);
    const search = query.trim().toLowerCase();
    const hasSearch = !search || `${session.name} ${session.id} ${session.lastStep} ${session.events.map((event) => `${event.event} ${event.detail}`).join(' ')}`.toLowerCase().includes(search);
    return (!cutoff || latest >= cutoff) && hasTopic && hasSearch;
  }).slice(0, 18);
  const eventDetail = (event: ActivityRow) => {
    const context = event.detail.split(':')[0];
    const namedContext: Record<string, string> = { social_linkedin: 'LinkedIn', social_whatsapp: 'WhatsApp', social_instagram: 'Instagram', coffee_suggestion_form: 'Catch-up form · WhatsApp', project_waitlist_top: 'Project link' };
    if (event.event === 'qr_scanned') return `Scanned ${namedContext[context] ?? context.replaceAll('_', ' ')}`;
    if (event.event === 'link_opened') return `Tapped ${namedContext[context] ?? (context.replaceAll('_', ' ') || 'an external link')}`;
    if (event.event === 'envelope_opened') return `Opened ${context.replaceAll('_', ' ')}`;
    if (event.event === 'choice_changed') return `Selected ${event.detail.split(':').slice(1).join(':') || 'an option'}`;
    return humanEvent(event.event);
  };

  return <main className={styles.page}>
    <header className={styles.topline}>
      <p className={styles.eyebrow}>Your farewell notebook · owner view</p>
      <nav className={styles.actions}><a href="/api/activity/export">Download activity CSV</a><Link href="/">Open the website</Link><button type="button" onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); router.push('/admin/login'); }}>Sign out</button></nav>
    </header>
    <section className={styles.hero}><h1>The story so far</h1><p>Follow how people arrived, opened an envelope, and left an idea. These are recorded actions; one person can create several events, so counts are not unique people.</p></section>

    <section className={styles.stats} aria-label="Activity summary">
      {[["Page opens", props.visits, 'Every visit and reload'], ['First names entered', props.named, 'Distinct name and session pairs'], ['Envelope opens', props.envelopes, 'All recorded envelope opens'], ['Suggestions sent', props.totalSubmissions, 'Saved submissions'], ['Repeat visitor matches', props.visitorFingerprints, 'Hashed browser and network matches']].map(([label, value, hint]) => <article className={styles.stat} key={String(label)}><span className={styles.statLabel}>{label}</span><strong>{value}</strong><small>{hint}</small></article>)}
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>The visitor journey</h2><p>Distinct browser sessions that reached each step, across all recorded activity.</p></div></div>
      <div className={styles.journey}>{journey.map(([label, value]) => <div className={styles.step} key={label}><span className={styles.stepLabel}>{label}</span><strong>{value}</strong><span className={styles.stepTrack}><i style={{ width: `${Math.min(100, (value / maxJourney) * 100)}%` }} /></span></div>)}</div>
      <p className={styles.caption}>People can skip steps or return in a new session. This is a directional funnel, not a strict conversion rate.</p>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>How people reached out</h2><p>QR scans are counted separately from tapping a link on the page.</p></div></div>
      <div className={styles.outboundGrid}><article><span>QR scans</span><strong>{eventCount('qr_scanned')}</strong></article><article><span>Link taps</span><strong>{eventCount('link_opened')}</strong></article><article><span>Project link taps</span><strong>{props.waitlistClicks}</strong></article></div>
      <p className={styles.caption}>A waitlist tap confirms the link opened; a confirmed signup requires a signup signal from the linked project.</p>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>Which envelopes drew attention?</h2><p>Opens grouped by envelope topic.</p></div></div>
      <div className={styles.topicGrid}>{(['Private note', 'Detour', 'Coffee & catch-up', 'Project', 'Stock ideas'] as Topic[]).map((name) => <div className={styles.topicCard} key={name}><span>{name}</span><strong>{openCount(name)}</strong></div>)}</div>
    </section>

    <section className={styles.filterPanel}>
      <div className={styles.sectionHeading}><div><h2>Explore the activity</h2><p>Filter the timeline by part of the site, date, or visitor details.</p></div><strong className={styles.resultCount}>{items.length} {items.length === 1 ? 'item' : 'items'}</strong></div>
      <div className={styles.filters}>
        <div className={styles.filter}><label htmlFor="topic-filter">Topic / page</label><select id="topic-filter" value={topic} onChange={(e) => setTopic(e.target.value)}><option>All topics</option>{topicOptions.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div className={styles.filter}><label htmlFor="time-filter">When</label><select id="time-filter" value={windowDays} onChange={(e) => setWindowDays(e.target.value)}><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div>
        <div className={styles.filter}><label htmlFor="search-filter">Find a visitor or detail</label><input id="search-filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, session, or text" /></div>
      </div>
      <p className={styles.filterSummary}>Showing {items.length} of up to {props.activities.length + props.submissions.length} recent items. The CSV keeps the full event detail.</p>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>Recent visitor paths</h2><p>Actions grouped into sessions, with the last recorded step called out. These are the 60 most recently active sessions; a session can continue later.</p></div></div>
      {matchingJourneys.length === 0 ? <div className={styles.empty}><strong>No matching visitor paths</strong><p>Try widening the topic or date filters.</p></div> : <div className={styles.sessionGrid}>{matchingJourneys.map((session) => <article className={styles.sessionCard} key={session.id}><header><div><h3>{session.name}</h3><span className={styles.sessionId}>Session {session.id.slice(0, 8)}</span></div><time>{displayTime(session.latestAt)} IST</time></header><p className={styles.sessionLast}>{session.lastStep}</p><ol>{session.events.map((event) => <li key={event.id}><span>{eventDetail(event)}</span><time>{new Date(`${event.created_at.replace(' ', 'T')}Z`).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}</time></li>)}</ol></article>)}</div>}
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}><div><h2>What happened</h2><p>Newest activity first. Open the details on any item for its recorded context.</p></div></div>
      {items.length === 0 ? <div className={styles.empty}><strong>No matching activity</strong><p>Try another topic or date range. If tracking was recently cleared, new visits will appear here as they happen.</p></div> : <div className={styles.timeline}>{items.map((item) => <article className={styles.moment} key={item.id}>
        <div className={styles.momentHeader}><div><h3>{item.title}</h3><div className={styles.momentMeta}><span className={styles.pill}>{item.topic}</span><span className={styles.pill}>{item.name}</span></div></div><time className={styles.momentTime}>{displayTime(item.createdAt)} IST</time></div>
        {item.message ? <><p className={styles.momentDetail}>{item.detail || 'No selection recorded'}{item.message.date ? ` · Suggested date: ${item.message.date}` : ''}</p>{item.message.message && <div className={styles.messageBox}>{item.message.message}</div>}<details className={styles.adminDetails}><summary>Submission and visitor details</summary><p>Last name: {item.message.surname || 'Not provided'}<br />Email alert: {item.message.email_status || 'Unknown'}<br />Visitor match: {item.message.fingerprint_hash ? item.message.fingerprint_hash.slice(0, 16) : 'Unavailable'}<br />Session: {item.sessionId || 'Unavailable'}</p></details></> : <details className={styles.adminDetails}><summary>Recorded details</summary><p>{item.detail || 'No additional detail'}<br />Session: {item.sessionId || 'Unavailable'}</p></details>}
      </article>)}</div>}
    </section>

    <details className={styles.dataDetails}><summary>Tracking and data notes</summary><div><p>Email alerts not sent: <b>{props.pending}</b>. This counts submissions whose notification status is not “sent”.</p><p>A visitor match is a private HMAC of the IP and browser signature, not a verified identity. Raw IP addresses are not shown here. A QR event means its tracked URL was reached; it does not prove that a visitor sent a WhatsApp message, followed an account, or joined a waitlist.</p><p>For a complete export of recent events, use <a href="/api/activity/export">Download activity CSV</a>. Event types collected: {props.counts.map((x) => `${x.event.replaceAll('_', ' ')} (${x.total})`).join(' · ') || 'No events recorded yet'}.</p></div></details>
  </main>;
}
