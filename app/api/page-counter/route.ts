import { getStore } from '@/lib/storage';
import { farewellConfig } from '@/lib/site-config';
import { enforceIpAndGlobalLimits, rateLimited } from '@/lib/rate-limit';

const startingCount = farewellConfig.initialVisitCount;

async function getCount() {
  return startingCount + await getStore().countActivity("page_view");
}

export async function GET(request: Request) {
  if (!farewellConfig.analyticsEnabled) return Response.json({ count: startingCount }, { headers: { 'Cache-Control': 'no-store' } });
  const limit = await enforceIpAndGlobalLimits(request, 'page-counter-read', 300, 60, 200000, 86400);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  try {
    return Response.json({ count: await getCount() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ count: startingCount }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  if (!farewellConfig.analyticsEnabled) return Response.json({ count: startingCount }, { headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: 'Invalid origin' }, { status: 403 });
  const limit = await enforceIpAndGlobalLimits(request, 'page-counter', 30, 60, 200000, 86400);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  try {
    const raw = await request.text();
    if (raw.length > 500) return Response.json({ error: 'Too long' }, { status: 413 });
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
    if (!payload || typeof payload !== 'object') return Response.json({ error: 'Invalid request' }, { status: 400 });
    const data = payload as Record<string, unknown>;
    if (typeof data.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.sessionId) ||
        typeof data.visitId !== 'string' || !/^[0-9a-f-]{36}$/i.test(data.visitId) ||
        typeof data.name !== 'string' || data.name.length > 50 ||
        typeof data.detail !== 'string' || data.detail.length > 250) {
      return Response.json({ error: 'Invalid visit' }, { status: 400 });
    }
    const detail = `site_visit_id=${data.visitId};${data.detail}`;
    await getStore().insertActivity({ id: crypto.randomUUID(), session_id: data.sessionId, name: data.name.trim(), event: 'page_view', detail });
    return Response.json({ count: await getCount() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Page visit counter storage failed');
    return Response.json({ error: 'Could not update visit count' }, { status: 503 });
  }
}
