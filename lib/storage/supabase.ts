import { createClient } from "@supabase/supabase-js";
import type { ActivityRow, FarewellStore, MessageRow, NewActivity, NewMessage } from "./types";

type Table<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Row>; Relationships: [] };
type FarewellDatabase = {
  public: {
    Tables: {
      activity_events: Table<ActivityRow, NewActivity & { created_at: string }>;
      messages: Table<MessageRow, NewMessage & { email_status: string; created_at: string }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: ReturnType<typeof createClient<FarewellDatabase>> | undefined;
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  client ??= createClient<FarewellDatabase>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
function fail(error: { message: string } | null) { if (error) throw new Error(`Supabase: ${error.message}`); }

export const supabaseStore: FarewellStore = {
  async insertActivity(row: NewActivity) {
    const { error } = await db().from("activity_events").insert({ ...row, created_at: new Date().toISOString() });
    fail(error);
  },
  async insertMessage(row: NewMessage) {
    const { data, error } = await db().from("messages").upsert({ ...row, email_status: "pending", created_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: true }).select("id");
    fail(error);
    return Boolean(data?.length);
  },
  async getMessageEmailStatus(id) {
    const { data, error } = await db().from("messages").select("email_status").eq("id", id).maybeSingle();
    fail(error);
    return data?.email_status ?? null;
  },
  async setMessageEmailStatus(id, status) {
    const { error } = await db().from("messages").update({ email_status: status }).eq("id", id);
    fail(error);
  },
  async listActivity(limit) {
    const { data, error } = await db().from("activity_events").select("id,session_id,name,event,detail,created_at").order("created_at", { ascending: false }).limit(limit);
    fail(error);
    return data ?? [];
  },
  async listMessages(limit) {
    const { data, error } = await db().from("messages").select("id,name,surname,kind,choice,date,contact,message,session_id,fingerprint_hash,email_status,created_at").order("created_at", { ascending: false }).limit(limit);
    fail(error);
    return data ?? [];
  },
  async countActivity(event) {
    let request = db().from("activity_events").select("id", { count: "exact", head: true });
    if (event) request = request.eq("event", event);
    const { count, error } = await request;
    fail(error);
    return count ?? 0;
  },
  async countMessages(predicate) {
    let request = db().from("messages").select("id", { count: "exact", head: true });
    if (predicate === "pending") request = request.neq("email_status", "sent");
    if (predicate === "fingerprints") {
      const unique = new Set<string>();
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db().from("messages").select("fingerprint_hash").neq("fingerprint_hash", "").range(offset, offset + 999);
        fail(error);
        for (const row of data ?? []) if (row.fingerprint_hash) unique.add(row.fingerprint_hash);
        if ((data?.length ?? 0) < 1000) break;
      }
      return unique.size;
    }
    const { count, error } = await request;
    fail(error);
    return count ?? 0;
  },
  async clear() {
    const [messages, events] = await Promise.all([this.countMessages(), this.countActivity()]);
    const [{ error: messageError }, { error: eventError }] = await Promise.all([
      db().from("messages").delete().neq("id", ""),
      db().from("activity_events").delete().neq("id", ""),
    ]);
    fail(messageError); fail(eventError);
    return { messages, events };
  },
};
