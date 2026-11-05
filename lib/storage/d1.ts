import type { ActivityRow, FarewellStore, MessageRow, NewActivity, NewMessage } from "./types";

type D1Result<T> = { results?: T[]; meta?: { changes?: number } };

async function query<T>(sql: string, params: unknown[] = []): Promise<D1Result<T>> {
  const { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_D1_DATABASE_ID || !CF_API_TOKEN) {
    throw new Error("Configure CF_ACCOUNT_ID, CF_D1_DATABASE_ID, and CF_API_TOKEN for Cloudflare D1.");
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
    cache: "no-store",
  });
  const payload = await response.json() as { success?: boolean; errors?: { message?: string }[]; result?: D1Result<T>[] };
  if (!response.ok || !payload.success) throw new Error(payload.errors?.[0]?.message || "Cloudflare D1 request failed.");
  return payload.result?.[0] ?? {};
}

export const d1Store: FarewellStore = {
  async insertActivity(row: NewActivity) {
    await query("INSERT INTO activity_events (id,session_id,name,event,detail,created_at) VALUES (?,?,?,?,?,?)", [row.id,row.session_id,row.name,row.event,row.detail,new Date().toISOString()]);
  },
  async insertMessage(row: NewMessage) {
    const result = await query("INSERT INTO messages (id,name,surname,kind,choice,contact,message,date,session_id,fingerprint_hash,email_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", [row.id,row.name,row.surname,row.kind,row.choice,row.contact,row.message,row.date,row.session_id,row.fingerprint_hash,"pending",new Date().toISOString()]);
    return Number(result.meta?.changes ?? 0) > 0;
  },
  async getMessageEmailStatus(id) { return (await query<{email_status:string}>("SELECT email_status FROM messages WHERE id=?",[id])).results?.[0]?.email_status ?? null; },
  async setMessageEmailStatus(id,status) { await query("UPDATE messages SET email_status=? WHERE id=?",[status,id]); },
  async listActivity(limit) { return (await query<ActivityRow>("SELECT id,session_id,name,event,detail,created_at FROM activity_events ORDER BY created_at DESC LIMIT ?",[limit])).results ?? []; },
  async listMessages(limit) { return (await query<MessageRow>("SELECT id,name,surname,kind,choice,contact,message,date,session_id,fingerprint_hash,email_status,created_at FROM messages ORDER BY created_at DESC LIMIT ?",[limit])).results ?? []; },
  async countActivity(event) { return Number((await query<{total:number}>("SELECT COUNT(*) AS total FROM activity_events"+(event?" WHERE event=?":""),event?[event]:[])).results?.[0]?.total ?? 0); },
  async countMessages(predicate) {
    const sql = predicate === "pending" ? "SELECT COUNT(*) AS total FROM messages WHERE email_status <> 'sent'" : predicate === "fingerprints" ? "SELECT COUNT(DISTINCT fingerprint_hash) AS total FROM messages WHERE fingerprint_hash <> ''" : "SELECT COUNT(*) AS total FROM messages";
    return Number((await query<{total:number}>(sql)).results?.[0]?.total ?? 0);
  },
  async clear() {
    const before = await Promise.all([query<{total:number}>("SELECT COUNT(*) AS total FROM messages"),query<{total:number}>("SELECT COUNT(*) AS total FROM activity_events")]);
    await query("DELETE FROM messages");
    await query("DELETE FROM activity_events");
    return { messages:Number(before[0].results?.[0]?.total??0), events:Number(before[1].results?.[0]?.total??0) };
  },
  async consumeRateLimit(key, maximum, windowSeconds) {
    const now = Math.floor(Date.now() / 1000), start = Math.floor(now / windowSeconds) * windowSeconds;
    await query("CREATE TABLE IF NOT EXISTS admin_rate_limits (key TEXT PRIMARY KEY, window_started INTEGER NOT NULL, hits INTEGER NOT NULL)");
    const row = (await query<{hits:number;window_started:number}>("INSERT INTO admin_rate_limits (key,window_started,hits) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_started=CASE WHEN admin_rate_limits.window_started+?>? THEN admin_rate_limits.window_started ELSE excluded.window_started END,hits=CASE WHEN admin_rate_limits.window_started+?>? THEN admin_rate_limits.hits+1 ELSE 1 END RETURNING hits,window_started", [key,start,windowSeconds,now,windowSeconds,now])).results?.[0];
    return { allowed: Number(row?.hits ?? maximum + 1) <= maximum, retryAfterSeconds: Math.max(1, Number(row?.window_started ?? start) + windowSeconds - now) };
  },
};
