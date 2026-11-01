'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ClearDataButton({ submissions, events }: { submissions: number; events: number }) {
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  async function clearAll() {
    if (!armed) { setArmed(true); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/activity/cleanup', { method: 'POST' });
      const result = await response.json() as { ok?: boolean; deletedSubmissions?: number; deletedActivityEvents?: number; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not clear the records.');
      setMessage(`Cleared ${result.deletedActivityEvents} activity events and ${result.deletedSubmissions} submissions.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not clear the records.');
    } finally { setBusy(false); }
  }
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <button type="button" onClick={clearAll} disabled={busy} style={{ border: '1px solid #b6532b', background: '#fff8f2', color: '#8f3f22', padding: '10px 13px', fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
      {busy ? 'Clearing…' : armed ? `Confirm clear ${events} events and ${submissions} submissions` : 'Clear all analytics and submissions'}
    </button>
    {armed && !busy && <button type="button" onClick={() => setArmed(false)} style={{ border: '1px solid #d8dce3', background: '#fff', color: '#52617b', padding: '10px 13px', fontWeight: 600 }}>Cancel</button>}
    {message && <span role="status" style={{ color: '#52617b', fontSize: 13 }}>{message}</span>}
  </div>;
}
