import "server-only";
import { d1Store } from "./d1";
import { firebaseStore } from "./firebase";
import { localStore } from "./local";
import { supabaseStore } from "./supabase";
import type { FarewellStore } from "./types";

export type { ActivityRow, MessageRow, NewActivity, NewMessage } from "./types";
type DashboardTopic = "Private note" | "Detour" | "Coffee & catch-up" | "Project" | "Stock ideas" | "Other";

export function getStore(): FarewellStore {
  const configured = process.env.DATABASE_PROVIDER?.toLowerCase();
  if (!configured && process.env.NODE_ENV === "production") throw new Error("Set DATABASE_PROVIDER to d1, firebase, or supabase for production. The local JSON store is for development only.");
  switch ((configured || "local").toLowerCase()) {
    case "local": return localStore;
    case "d1": return d1Store;
    case "firebase": return firebaseStore;
    case "supabase": return supabaseStore;
    default: throw new Error("DATABASE_PROVIDER must be local, d1, firebase, or supabase.");
  }
}

export async function getDashboardData() {
  const store = getStore();
  const [allEvents, submissions, visits, envelopeOpens, totalSubmissions, pending, visitorFingerprints, totalActivityEvents] = await Promise.all([
    store.listActivity(50000), store.listMessages(300),
    store.countActivity("page_view"), store.countActivity("envelope_opened"), store.countMessages(),
    store.countMessages("pending"), store.countMessages("fingerprints"), store.countActivity(),
  ]);
  const countsMap = new Map<string, number>();
  for (const event of allEvents) if (event.event !== "receipt_downloaded") countsMap.set(event.event, (countsMap.get(event.event) ?? 0) + 1);
  const counts = Array.from(countsMap, ([event, total]) => ({ event, total })).sort((a,b)=>b.total-a.total);
  const named = new Set(allEvents.filter((event)=>event.event==="name_entered").map((event)=>`${event.session_id}:${event.name.toLocaleLowerCase()}`)).size;
  const topicMap = new Map<DashboardTopic, number>();
  for (const row of allEvents.filter((event)=>event.event==="envelope_opened")) {
    const value = row.detail.toLowerCase();
    const topic: DashboardTopic = value.includes("project") ? "Project" : value.includes("stock") ? "Stock ideas" : /coffee|catch.?up|meetup/.test(value) ? "Coffee & catch-up" : /detour|book|podcast|movie|series|restaurant|experience|place/.test(value) ? "Detour" : /memory|private/.test(value) ? "Private note" : "Other";
    topicMap.set(topic,(topicMap.get(topic)??0)+1);
  }
  const bySession = new Map<string, typeof allEvents>();
  for (const event of allEvents) {
    if (!event.session_id) continue;
    const list = bySession.get(event.session_id) ?? [];
    list.push(event); bySession.set(event.session_id,list);
  }
  const recentSessions = Array.from(bySession,([sessionId,events])=>({sessionId,events,latest:events[0]?.created_at??""})).sort((a,b)=>b.latest.localeCompare(a.latest)).slice(0,60);
  const journeyEvents = recentSessions.flatMap((session)=>session.events.slice(0,50));
  const distinctSessions = (eventName:string) => new Set(allEvents.filter((event)=>event.event===eventName&&event.session_id).map((event)=>event.session_id)).size;
  return {
    activities: allEvents.filter((event)=>event.event!=="receipt_downloaded").slice(0, 1000), submissions,
    visits, named, envelopes: envelopeOpens, totalSubmissions, pending, visitorFingerprints, totalActivityEvents,
    counts, topicCounts:Array.from(topicMap,([topic,total])=>({topic,total})), journeyEvents,
    journeyCounts:{arrived:distinctSessions("page_view"),opened:distinctSessions("envelope_opened"),started:distinctSessions("form_started"),submitted:distinctSessions("form_submitted")},
    waitlistClicks:allEvents.filter((event)=>event.event==="link_opened"&&event.detail.startsWith("project_waitlist_top:")).length,
    now: Date.now(),
  };
}
