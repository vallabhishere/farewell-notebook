import { getStore } from '@/lib/storage';
import { farewellConfig } from '@/lib/site-config';

function allowedDestination(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;

    const configuredLinks = [
      farewellConfig.social.linkedin,
      farewellConfig.social.instagram,
      farewellConfig.project.url,
    ].filter(Boolean);
    if (configuredLinks.some((link) => new URL(link).href === url.href)) return url;

    if (url.hostname === 'wa.me' && farewellConfig.social.whatsappNumber && url.pathname === `/${farewellConfig.social.whatsappNumber}`) {
      const target = new URL(`https://wa.me/${farewellConfig.social.whatsappNumber}`);
      const message = url.searchParams.get('text');
      if (message && message.length <= 500) target.searchParams.set('text', message);
      return target;
    }
    return null;
  } catch { return null; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const event = params.get('event');
  const sessionId = params.get('sessionId') ?? '';
  const name = (params.get('name') ?? '').trim();
  const context = params.get('context') ?? 'unknown';
  const destination = allowedDestination(params.get('to') ?? '');
  if (!destination || (event !== 'qr_scanned' && event !== 'link_opened') ||
      !/^[0-9a-f-]{36}$/i.test(sessionId) || name.length > 50 || !/^[a-z0-9_-]{1,60}$/i.test(context)) {
    return new Response('Invalid destination', { status: 400 });
  }

  if (farewellConfig.analyticsEnabled) try {
    await getStore().insertActivity({ id: crypto.randomUUID(), session_id: sessionId, name, event, detail: `${context}:${destination.hostname}` });
  } catch {
    console.error('Tracked link event storage failed');
  }
  return Response.redirect(destination.toString(), 302);
}
