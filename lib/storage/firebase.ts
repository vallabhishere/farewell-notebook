import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ActivityRow, FarewellStore, MessageRow, NewActivity, NewMessage } from "./types";

function store() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Configure FIREBASE_SERVICE_ACCOUNT_JSON with a Firebase service account JSON value.");
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw) as ServiceAccount) });
  return getFirestore(app);
}
function fromDoc<T>(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): T {
  const value = doc.data() ?? {};
  return { ...value, id: doc.id } as T;
}
async function count(collection: "messages" | "activity_events", event?: string) {
  let query: FirebaseFirestore.Query = store().collection(collection);
  if (event) query = query.where("event", "==", event);
  const result = await query.count().get();
  return result.data().count;
}

export const firebaseStore: FarewellStore = {
  async insertActivity(row: NewActivity) {
    await store().collection("activity_events").doc(row.id).create({ ...row, created_at: new Date().toISOString() });
  },
  async insertMessage(row: NewMessage) {
    const ref = store().collection("messages").doc(row.id);
    try {
      await ref.create({ ...row, email_status: "pending", created_at: new Date().toISOString() });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 6) return false;
      throw error;
    }
  },
  async getMessageEmailStatus(id) {
    const doc = await store().collection("messages").doc(id).get();
    return doc.exists ? String(doc.get("email_status") ?? "pending") : null;
  },
  async setMessageEmailStatus(id, status) {
    await store().collection("messages").doc(id).update({ email_status: status });
  },
  async listActivity(limit) {
    const snapshot = await store().collection("activity_events").orderBy("created_at", "desc").limit(limit).get();
    return snapshot.docs.map((doc) => fromDoc<ActivityRow>(doc));
  },
  async listMessages(limit) {
    const snapshot = await store().collection("messages").orderBy("created_at", "desc").limit(limit).get();
    return snapshot.docs.map((doc) => fromDoc<MessageRow>(doc));
  },
  async countActivity(event) { return count("activity_events", event); },
  async countMessages(predicate) {
    if (predicate === "pending") return (await store().collection("messages").where("email_status", "!=", "sent").count().get()).data().count;
    if (predicate === "fingerprints") {
      const rows = await store().collection("messages").where("fingerprint_hash", "!=", "").select("fingerprint_hash").limit(10000).get();
      return new Set(rows.docs.map((doc) => doc.get("fingerprint_hash")).filter(Boolean)).size;
    }
    return count("messages");
  },
  async clear() {
    const db = store();
    const [messages, events] = await Promise.all([count("messages"), count("activity_events")]);
    for (const collection of ["messages", "activity_events"] as const) {
      while (true) {
        const snapshot = await db.collection(collection).limit(400).get();
        if (snapshot.empty) break;
        const batch = db.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }
    }
    return { messages, events };
  },
  async consumeRateLimit(key, maximum, windowSeconds) {
    const ref = store().collection("admin_rate_limits").doc(key), now = Math.floor(Date.now() / 1000);
    return store().runTransaction(async (tx) => {
      const snapshot = await tx.get(ref), value = snapshot.data();
      const active = value && Number(value.window_started) + windowSeconds > now;
      const start = active ? Number(value.window_started) : Math.floor(now / windowSeconds) * windowSeconds;
      const hits = active ? Number(value.hits || 0) + 1 : 1;
      tx.set(ref, { window_started: start, hits });
      return { allowed: hits <= maximum, retryAfterSeconds: Math.max(1, start + windowSeconds - now) };
    });
  },
};
