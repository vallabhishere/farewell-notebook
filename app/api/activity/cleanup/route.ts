import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/storage";
import { enforceIpLimit, rateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (!isAdminRequest(request)) return new Response("Not found", { status: 404 });
  const limit = await enforceIpLimit(request, "admin-cleanup", 5, 3600);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);
  try {
    const deleted = await getStore().clear();
    return Response.json({ ok: true, deletedSubmissions: deleted.messages, deletedActivityEvents: deleted.events }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Cleanup could not be completed" }, { status: 503 }); }
}
