import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/storage";

function csv(value: unknown) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ").replace(/^[=+@\-]/, "'$&");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return new Response("Not found", { status: 404 });
  try {
    const rows = await getStore().listActivity(20000);
    const headers = ["created_at_utc", "session_id", "first_name", "event", "detail"];
    const lines = [headers, ...rows.filter((row) => row.event !== "receipt_downloaded").map((row) => [row.created_at, row.session_id, row.name, row.event, row.detail])].map((row) => row.map(csv).join(","));
    return new Response(lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="farewell-activity.csv"', "Cache-Control": "no-store" } });
  } catch { return new Response("Activity export unavailable", { status: 503 }); }
}
