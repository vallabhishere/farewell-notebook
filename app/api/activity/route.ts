import { getStore } from "@/lib/storage";
import { farewellConfig } from "@/lib/site-config";
import { enforceIpAndGlobalLimits, rateLimited } from "@/lib/rate-limit";

const allowedEvents = new Set(["page_view", "page_hidden", "page_resumed", "page_exit", "name_entered", "personalized_note_viewed", "name_cleared", "envelope_opened", "form_started", "form_abandoned", "form_validation_error", "choice_changed", "form_field_focused", "form_submitted", "profanity_blocked", "scratch_card_revealed", "project_pause_started", "project_pause_stopped", "project_pause_completed", "whatsapp_draft_link_clicked", "invitation_downloaded", "personal_note_downloaded", "link_opened", "qr_scanned", "page_bottom_reached"]);

export async function POST(request: Request) {
  if (!farewellConfig.analyticsEnabled) return Response.json({ ok: true, disabled: true });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const limit = await enforceIpAndGlobalLimits(request, "public-activity", 120, 60, 100000, 86400);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  try {
    const raw = await request.text();
    if (raw.length > 1500) return Response.json({ error: "Too long" }, { status: 413 });
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(data.sessionId) || typeof data.name !== "string" || data.name.length > 50 || typeof data.event !== "string" || !allowedEvents.has(data.event) || typeof data.detail !== "string" || data.detail.length > 300) return Response.json({ error: "Invalid activity event" }, { status: 400 });
    await getStore().insertActivity({ id: crypto.randomUUID(), session_id: data.sessionId, name: data.name.trim(), event: data.event, detail: data.detail });
    return Response.json({ ok: true }, { status: 201 });
  } catch { return Response.json({ error: "Could not record activity" }, { status: 503 }); }
}
