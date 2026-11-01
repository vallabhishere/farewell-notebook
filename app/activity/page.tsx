import { redirect } from 'next/navigation';
import { isAdminSession } from '@/lib/admin-auth';
import { getDashboardData } from '@/lib/storage';
import { ClearDataButton } from './clear-data-button';
import { ActivityDashboard } from './activity-dashboard';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
  if (!await isAdminSession()) redirect('/admin/login?next=%2Factivity');
  const data = await getDashboardData();

  return <>
    <ActivityDashboard {...data} />
    <section style={{ maxWidth: 1180, margin: '0 auto', padding: '0 26px 48px', color: '#697487', fontFamily: 'Arial,sans-serif' }}>
      <div style={{ borderTop: '1px solid #d9d9d1', paddingTop: 22 }}><h2 style={{ margin: '0 0 7px', font: '400 22px Georgia,serif', color: '#26334f' }}>Data controls</h2><p style={{ margin: '0 0 14px', fontSize: 12, lineHeight: 1.55 }}>Clearing removes all stored activity and suggestions and resets the Site Visits counter.</p><ClearDataButton submissions={data.totalSubmissions} events={data.totalActivityEvents} /></div>
    </section>
  </>;
}
