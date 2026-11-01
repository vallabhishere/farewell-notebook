import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/storage";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (!isAdminRequest(request)) return new Response("Not found", { status: 404 });
  try {
    const deleted = await getStore().clear();
    return Response.json({ ok: true, deletedSubmissions: deleted.messages, deletedActivityEvents: deleted.events }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Cleanup could not be completed" }, { status: 503 }); }
}
