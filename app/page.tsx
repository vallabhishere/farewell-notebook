"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Check, Coffee, Compass, Download, MessageCircle, Sparkles, TrendingUp, X } from "lucide-react";
import { AmbientMotion } from "@/components/ambient-motion";
const ContactQR = dynamic(
  () => import("@/components/contact-qr").then((module) => module.ContactQR),
  { loading: () => <div className="qr-card qr-card-loading" aria-hidden="true" /> }
);
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { matchGreeting, personalizedGreetings } from "@/lib/greetings";
import { containsProfanity } from "@/lib/profanity";
import { farewellConfig } from "@/lib/site-config";

const openings = farewellConfig.openings;
const reflections = farewellConfig.reflections;
const closings = farewellConfig.closings;
const fallbackPersonalNotes = [
  `It was always good talking with you. I enjoyed our conversations and the small moments in between, and I’ll remember them fondly.`,
  `I learned a lot from working alongside you. I’m grateful for what you shared and for the part you played in this chapter.`,
  `The people made this chapter special. I’m glad we got to share it, and I’ll carry those memories with me.`,
];

const allCombinations = openings.flatMap((_, openingIndex) =>
  reflections.flatMap((_, reflectionIndex) =>
    closings.map((__, closingIndex) => [openingIndex, reflectionIndex, closingIndex] as const)
  )
);

function allowedCombinationsForNote(personalText: string, fallbackIndex: number) {
  const normalized = personalText.toLocaleLowerCase();
  const hasFutureCatchUp = /stay(?:ing)? in touch|catch up|paths cross|meet again soon/.test(normalized);
  const hasCoffee = /\bcoffee\b/.test(normalized);
  const hasDeskReference = /new desk|moved desks/.test(normalized);

  return allCombinations.filter(([openingIndex, reflectionIndex, closingIndex]) => {
    // Avoid repeating the departure, office-joke, coffee, or catch-up beat.
    if ((openingIndex === 1 || openingIndex === 2) && closingIndex === 4) return false;
    if ((openingIndex === 1 || openingIndex === 2) && reflectionIndex === 2) return false;
    if (openingIndex === 2 && closingIndex === 0) return false;
    if (reflectionIndex === 3 && closingIndex === 3) return false;
    if (hasCoffee && closingIndex === 3) return false;
    if (hasDeskReference && openingIndex === 2) return false;
    if (hasFutureCatchUp && (closingIndex === 0 || closingIndex === 2)) return false;
    if (fallbackIndex === 1 && closingIndex === 4) return false;
    if (fallbackIndex === 2 && reflectionIndex === 0) return false;
    return true;
  });
}

const envelopes = [
  { id: "memory", number: "01", ...farewellConfig.envelopeCopy.memory, tone: "yellow", Icon: MessageCircle },
  { id: "detour", number: "02", ...farewellConfig.envelopeCopy.detour, tone: "mint", Icon: Compass },
  { id: "coffee", number: "03", ...farewellConfig.envelopeCopy.catchup, tone: "blue", Icon: Coffee },
  { id: "project", number: "04", title: farewellConfig.project.name, teaser: farewellConfig.project.teaser, note: "A little something I’m building.", tone: "orange", Icon: Sparkles },
  { id: "stocks", number: "05", title: farewellConfig.stockEnvelope.title, teaser: farewellConfig.stockEnvelope.tagline, note: "Markets, with a pinch of faith.", tone: "lavender", Icon: TrendingUp },
] as const;
type EnvelopeId = (typeof envelopes)[number]["id"];
type FormEnvelopeId = "coffee" | "memory" | "detour" | "stocks";
function isFormEnvelope(id: EnvelopeId | ""): id is FormEnvelopeId {
  return id === "coffee" || id === "memory" || id === "detour" || id === "stocks";
}
type Draft = { message: string; surname: string; date: string; company: string };
const emptyDraft = (): Draft => ({ message: "", surname: "", date: "", company: "" });

type ActivityEvent = "page_view" | "page_hidden" | "page_resumed" | "page_exit" | "name_entered" | "personalized_note_viewed" | "name_cleared" | "profanity_blocked" | "envelope_opened" | "form_started" | "form_abandoned" | "form_validation_error" | "choice_changed" | "form_field_focused" | "form_submitted" | "scratch_card_revealed" | "whatsapp_draft_link_clicked" | "invitation_downloaded" | "personal_note_downloaded" | "link_opened";
function trackedTarget(url: string, event: "link_opened", sessionId: string, name: string, context: string) {
  if (!sessionId) return url;
  const params = new URLSearchParams({ event, sessionId, name, to: url, context });
  return `/api/track-link?${params.toString()}`;
}
function recordActivity(sessionId: string, name: string, event: ActivityEvent, detail = "") {
  if (!farewellConfig.analyticsEnabled || !sessionId) return;
  const body = JSON.stringify({ sessionId, name, event, detail: detail.slice(0, 300) });
  try {
    if (navigator.sendBeacon?.("/api/activity", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* Analytics must never interrupt the farewell page. */ }
}

const projectCopy: Record<EnvelopeId, { title: string; body: string }> = {
  coffee: { title: "Good company is on me.", body: "A proper catch-up, whenever our calendars cooperate." },
  project: { title: `A little more about ${farewellConfig.project.name}.`, body: farewellConfig.project.description },
  memory: { title: "You’ve left me something to remember.", body: "Thanks for adding your note to this chapter." },
  detour: { title: "You’ve given me something to try.", body: "I’ll add it to the list. Fair’s fair: I’ve left a few ideas for you too." },
  stocks: { title: "Long-term thinking.", body: "Thanks for sharing an idea worth considering beyond the next quarter." },
};

function ScratchCard({ revealed, onReveal }: { revealed: boolean; onReveal: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || revealed) return;
    const scale = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * scale));
    canvas.height = Math.max(1, Math.floor(rect.height * scale));
    ctx.scale(scale, scale);
    ctx.fillStyle = "#d8d6ca";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#aaa99e";
    ctx.lineWidth = 1;
    for (let x = -rect.height; x < rect.width; x += 14) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + rect.height, rect.height); ctx.stroke();
    }
    ctx.fillStyle = "#354a7d";
    ctx.textAlign = "center";
    ctx.font = "600 13px Arial";
    ctx.fillText("A VERY IMPORTANT REVEAL", rect.width / 2, rect.height / 2 - 2);
    ctx.font = "12px Arial";
    ctx.fillText("scratch here or use the button below", rect.width / 2, rect.height / 2 + 18);
  }, [revealed]);
  function scratch(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || revealed) return;
    const canvas = e.currentTarget;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    strokes.current += 1;
    if (strokes.current > 38) onReveal();
  }
  return <div className="scratch-area">
    <div className="scratch-card" aria-live={revealed ? "polite" : undefined}><div className="scratch-prize" aria-hidden={!revealed}><span>YOU WON</span><strong>A proper catch-up with me.</strong><em>Unfortunately, I’m included.</em></div>
      {!revealed && <canvas ref={canvasRef} className="scratch-layer" aria-hidden="true" onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); scratch(e); }} onPointerMove={scratch} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />}
    </div>
    {!revealed && <button className="reveal-button" type="button" onClick={onReveal}>Reveal the card</button>}
  </div>;
}

export default function Home() {
  return <FarewellHome allowCustomNotes />;
}

export function FarewellHome({ allowCustomNotes }: { allowCustomNotes: boolean }) {
  const [name, setName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [surnameDraft, setSurnameDraft] = useState("");
  const [profanityBlocked, setProfanityBlocked] = useState(false);
  const [greetingId, setGreetingId] = useState<string | null>(null);
  const enteredDisplayName = name.split(/\s+/).filter(Boolean).map((part) => {
    const characters = Array.from(part);
    return characters.length ? characters[0].toLocaleUpperCase() + characters.slice(1).join("").toLocaleLowerCase() : "";
  }).join(" ");
  const greeting = personalizedGreetings.find((person) => person.id === greetingId) ?? null;
  const displayName = greeting?.displayName ?? enteredDisplayName;
  const firstName = greeting?.firstName ?? enteredDisplayName.split(/\s+/)[0] ?? "";
  const letterName = greeting?.salutation ?? displayName;
  const [mix, setMix] = useState([0, 0, 0, 0]);
  const openingCopy = openings[mix[0]];
  const personalCopy = (greeting?.message.trim() || fallbackPersonalNotes[mix[3] ?? 0]).replace(/\s+/g, " ");
  const [active, setActive] = useState<EnvelopeId | "">("");
  const isFormExperience = isFormEnvelope(active);
  const [opening, setOpening] = useState("");
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [meal, setMeal] = useState("Coffee");
  const [category, setCategory] = useState("A book");
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [displayedVisitCount, setDisplayedVisitCount] = useState<number>(farewellConfig.initialVisitCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<FormEnvelopeId, Draft>>({ coffee: emptyDraft(), memory: emptyDraft(), detour: emptyDraft(), stocks: emptyDraft() });
  const analytics = useRef({ sessionId: "", name: "", visibleSince: 0 });
  const visitId = useRef("");
  const liveVisitCount = useRef<number>(farewellConfig.initialVisitCount);
  const bottomCounted = useRef(false);
  const screenState = useRef({ active: active as EnvelopeId | "", done });
  screenState.current = { active, done };

  function track(event: ActivityEvent, detail = "", visitorName = analytics.current.name || name) {
    recordActivity(analytics.current.sessionId, visitorName, event, detail);
  }

  useEffect(() => {
    if (!farewellConfig.analyticsEnabled) return;
    let sessionId = sessionStorage.getItem("farewell-session-v1");
    if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("farewell-session-v1", sessionId);
    }
    analytics.current.sessionId = sessionId;
    analytics.current.visibleSince = Date.now();
    const finishVisibleInterval = (event: "page_hidden" | "page_exit") => {
      const startedAt = analytics.current.visibleSince;
      if (!startedAt) return;
      const visibleMs = Math.max(0, Date.now() - startedAt);
      recordActivity(sessionId, analytics.current.name, event, `visible_ms=${visibleMs}`);
      analytics.current.visibleSince = 0;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") finishVisibleInterval("page_hidden");
      else if (!analytics.current.visibleSince) {
        analytics.current.visibleSince = Date.now();
        recordActivity(sessionId, analytics.current.name, "page_resumed", "");
      }
    };
    const onPageHide = () => {
      if (analytics.current.visibleSince) finishVisibleInterval("page_exit");
      const current = screenState.current;
      if ((current.active === "coffee" || current.active === "memory" || current.active === "detour" || current.active === "stocks") && !current.done) {
        recordActivity(sessionId, analytics.current.name, "form_abandoned", `${current.active}:left_page`);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => { document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", onPageHide); };
  }, []);

  useEffect(() => {
    if (!farewellConfig.analyticsEnabled) return;
    const currentVisitId = crypto.randomUUID();
    visitId.current = currentVisitId;
    let alive = true;
    const countThisVisit = () => {
      if (!analytics.current.sessionId) return;
      const referrerHost = (() => { try { return document.referrer ? new URL(document.referrer).hostname : "direct"; } catch { return "direct"; } })();
      const query = new URLSearchParams(window.location.search);
      const campaign = ["utm_source", "utm_medium", "utm_campaign"].map((key) => `${key}=${(query.get(key) ?? "").slice(0, 60)}`).filter((x) => !x.endsWith("=")).join(";");
      const width = window.innerWidth;
      const device = width < 700 ? "mobile" : width < 1100 ? "tablet" : "desktop";
    const audience = window.location.pathname === "/1" ? "everyone" : "shortlist";
    const detail = `audience=${audience};device=${device};referrer=${referrerHost}${campaign ? `;${campaign}` : ""}`;
      const body = JSON.stringify({ sessionId: analytics.current.sessionId, visitId: currentVisitId, name: analytics.current.name, detail });
      void fetch("/api/page-counter", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((response) => response.ok ? response.json() as Promise<{ count: number }> : null)
        .then((result) => {
          if (alive && result && Number.isFinite(result.count)) {
            liveVisitCount.current = result.count;
            if (bottomCounted.current) setDisplayedVisitCount(result.count);
          }
        })
        .catch(() => {});
    };
    countThisVisit();
    const isAtBottom = () => {
      const root = document.documentElement;
      return window.scrollY + window.innerHeight >= root.scrollHeight - 8;
    };
    const countAtBottom = () => {
      if (bottomCounted.current) return;
      if (!isAtBottom()) return;
      bottomCounted.current = true;
      setDisplayedVisitCount(liveVisitCount.current);
    };
    window.addEventListener("scroll", countAtBottom, { passive: true });
    requestAnimationFrame(countAtBottom);
    return () => { alive = false; window.removeEventListener("scroll", countAtBottom); };
  }, []);

  const whatsappUrl = farewellConfig.social.whatsappNumber
    ? `https://wa.me/${farewellConfig.social.whatsappNumber}?text=${encodeURIComponent(`Hello, ${displayName} here. Good to see your next chapter taking shape. Let’s stay in touch!`)}`
    : "";
  const draft = isFormEnvelope(active) ? drafts[active] : emptyDraft();
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const catchupUrl = farewellConfig.social.whatsappNumber
    ? `https://wa.me/${farewellConfig.social.whatsappNumber}?text=${encodeURIComponent(`Hello, ${displayName} here. I picked ${meal.toLowerCase()} for our catch-up.${draft?.date ? ` Would ${draft.date} work for you?` : " Let’s find a date."} No agenda, just a proper catch-up!`)}`
    : "";

  function shuffle(nextPersonId: string | null = greetingId) {
    const fallbackIndex = Math.floor(Math.random() * fallbackPersonalNotes.length);
    const nextGreeting = personalizedGreetings.find((person) => person.id === nextPersonId) ?? null;
    const personalText = nextGreeting?.message ?? fallbackPersonalNotes[fallbackIndex];
    const allowed = allowedCombinationsForNote(personalText, fallbackIndex);
    const selected = allowed[Math.floor(Math.random() * allowed.length)];
    setMix([...selected, fallbackIndex]);
  }
  function finalizeName(clean: string, personId: string | null) {
    analytics.current.name = clean;
    track("name_entered", personId ? `greeting=${personId}` : "", clean);
    setGreetingId(personId);
    setName(clean); setNameDraft(""); setPendingName(""); setProfanityBlocked(false); shuffle(personId);
    track("personalized_note_viewed", personId ? `greeting=${personId}` : "", clean);
  }
  function enter(value: string) {
    const clean = value.trim().replace(/\s+/g, " ").slice(0, 50);
    if (!clean) return;
    if (containsProfanity(clean, "name")) {
      setNameDraft(""); setPendingName(""); setProfanityBlocked(true);
      recordActivity(analytics.current.sessionId, "", "profanity_blocked", "surface=first_name");
      return;
    }
    if (!allowCustomNotes) { finalizeName(clean, null); return; }
    const firstNameMatch = matchGreeting(clean.split(" ")[0]);
    if (firstNameMatch.kind === "ambiguous") { setPendingName(clean.split(" ")[0]); setSurnameDraft(""); return; }
    const match = matchGreeting(clean);
    finalizeName(clean, match.kind === "unique" ? match.person.id : null);
  }
  function resolveSurname(value: string) {
    const surname = value.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!surname || containsProfanity(surname, "name")) {
      if (surname) { setSurnameDraft(""); setProfanityBlocked(true); recordActivity(analytics.current.sessionId, "", "profanity_blocked", "surface=surname"); }
      return;
    }
    const fullName = `${pendingName.split(" ")[0]} ${surname}`;
    const match = matchGreeting(fullName);
    finalizeName(match.kind === "unique" ? match.person.displayName : fullName, match.kind === "unique" ? match.person.id : null);
  }
  function open(id: EnvelopeId) {
    if (isFormEnvelope(active) && !done) track("form_abandoned", `${active}:opened_${id}`);
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    setOpening(id); setDone(false); setError("");
    track("envelope_opened", id);
    if (isFormEnvelope(id)) track("form_started", id);
    if (id === "coffee") setRevealed(false);
    if (active) setActive(id);
    else openTimer.current = setTimeout(() => { setActive(id); openTimer.current = null; }, 220);
    window.setTimeout(() => setOpening(""), 450);
  }
  function closeExperience() {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (isFormEnvelope(active) && !done) track("form_abandoned", active);
    setActive(""); setError("");
  }
  useEffect(() => () => { if (openTimer.current) clearTimeout(openTimer.current); }, []);
  useEffect(() => {
    const ctx = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options: { signal: AbortSignal }) => Promise<unknown> } }).modelContext;
    if (!ctx?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(ctx.registerTool({ name: "personalize_farewell", description: "Enter a visitor name and show their welcome note and five engagement options.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 50 } }, required: ["name"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input: { name?: unknown }) => { if (typeof input?.name !== "string" || !input.name.trim() || input.name.length > 50) throw Error("Enter a name of 1 to 50 characters."); enter(input.name); return { status: "welcome_shown", name: input.name.trim() }; } }, { signal: controller.signal })).catch(() => {});
    return () => controller.abort();
  }, []);

  function updateDraft(field: keyof Draft, value: string) {
    if (!isFormEnvelope(active)) return;
    setDrafts((current) => ({ ...current, [active]: { ...current[active], [field]: value } }));
  }
  function startAnotherSubmission() {
    if (!isFormEnvelope(active)) return;
    setDrafts((current) => ({ ...current, [active]: emptyDraft() }));
    setError("");
    setDone(false);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isFormEnvelope(active)) return;
    if (containsProfanity(draft.message) || containsProfanity(draft.company) || containsProfanity(draft.surname, "name")) {
      track("profanity_blocked", "surface=submission");
      setError("That wording tripped my very unofficial language filter. Try rephrasing it.");
      return;
    }
    setBusy(true); setError("");
    try {
      const message = active === "stocks" ? `Company: ${draft.company.trim()}\n\nWhy I’d hold it for the next generation: ${draft.message.trim()}` : draft.message;
      const payload = { id: crypto.randomUUID(), sessionId: analytics.current.sessionId, name: firstName, firstName, surname: draft.surname.trim(), kind: active, choice: active === "coffee" ? meal : active === "stocks" ? "Long-term company idea" : category, contact: "", message, date: draft.date, website: "" };
      const response = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("That didn’t go through. Your note is still here. Please try again.");
      setDone(true);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function downloadNoteImage() {
    track("personal_note_downloaded");
    const logicalWidth = 1462;
    const pixelRatio = 2;
    const paddingX = 72;
    const contentWidth = logicalWidth - paddingX * 2;
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) return;

    const wrap = (copy: string, font: string) => {
      measureContext.font = font;
      const lines: string[] = [];
      let line = "";
      for (const word of copy.trim().split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && measureContext.measureText(next).width > contentWidth) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      return lines;
    };

    const openingFont = "31px Georgia, serif";
    const bodyFont = "25px Arial, sans-serif";
    const openingLines = wrap(openingCopy, openingFont);
    const paragraphLines = [personalCopy, reflections[mix[1]], closings[mix[2]]].map((copy) => wrap(copy, bodyFont));
    let signatureY = 275 + openingLines.length * 43 + 23;
    paragraphLines.forEach((lines, index) => {
      signatureY += lines.length * 38;
      if (index < paragraphLines.length - 1) signatureY += 24;
    });
    signatureY += 54;
    const logicalHeight = signatureY + 62;

    const canvas = document.createElement("canvas");
    canvas.width = logicalWidth * pixelRatio;
    canvas.height = logicalHeight * pixelRatio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(pixelRatio, pixelRatio);

    const radius = 24;
    ctx.beginPath();
    ctx.roundRect(1, 1, logicalWidth - 2, logicalHeight - 2, radius);
    ctx.fillStyle = "#fffdf5";
    ctx.fill();
    ctx.strokeStyle = "#294f9b";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#b95e31";
    ctx.font = "600 24px Arial, sans-serif";
    ctx.fillText("One last note before I go", paddingX, 78);

    const heading = `${greeting?.greetingPrefix ?? "Hey"}, ${letterName}.`;
    let headingSize = 76;
    ctx.font = `${headingSize}px Georgia, serif`;
    while (ctx.measureText(heading).width > contentWidth && headingSize > 52) {
      headingSize -= 2;
      ctx.font = `${headingSize}px Georgia, serif`;
    }
    ctx.fillStyle = "#20283a";
    ctx.fillText(heading, paddingX, 184);

    const drawLines = (lines: string[], font: string, color: string, lineHeight: number, y: number) => {
      ctx.font = font;
      ctx.fillStyle = color;
      lines.forEach((line, index) => ctx.fillText(line, paddingX, y + index * lineHeight));
      return y + lines.length * lineHeight;
    };
    let y = drawLines(openingLines, openingFont, "#17233f", 43, 275) + 23;
    paragraphLines.forEach((lines, index) => {
      y = drawLines(lines, bodyFont, "#34445f", 38, y);
      if (index < paragraphLines.length - 1) y += 24;
    });

    const signatureYActual = y + 54;
    ctx.font = "italic 45px Georgia, serif";
    ctx.fillStyle = "#294f9b";
    ctx.fillText(farewellConfig.authorName, paddingX, signatureYActual);
    const nameWidth = ctx.measureText(farewellConfig.authorName).width;
    const signoff = farewellConfig.signoff;
    ctx.font = "19px Arial, sans-serif";
    ctx.fillStyle = "#596477";
    const signoffX = paddingX + nameWidth + 26;
    if (signoffX + ctx.measureText(signoff).width <= logicalWidth - paddingX) {
      ctx.fillText(signoff, signoffX, signatureYActual - 4);
    } else {
      ctx.fillText(signoff, paddingX, signatureYActual + 30);
    }

    const safeName = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "") || "friend";
    const link = document.createElement("a"); link.href = canvas.toDataURL("image/png"); link.download = `farewell-note-for-${safeName}.png`;
    document.body.appendChild(link); link.click(); link.remove();
  }
  const project = active ? projectCopy[active] : null;

  return <div className="site"><AmbientMotion />
    <header className="page-header"><a className="personal-wordmark" href="#top">{farewellConfig.authorName}<span>{farewellConfig.wordmarkTagline}</span></a><span className="edition">{farewellConfig.edition}</span></header>
    {!name ? profanityBlocked ? <main id="top" className="entrance gate-screen"><div className="entrance-copy gate-copy"><div className="paper-tape">{farewellConfig.openingLabel}</div><div className="fish-art" role="img" aria-label="A cheeky little fish"><svg viewBox="0 0 180 110" aria-hidden="true"><path d="M20 55c20-27 54-36 86-25 15 5 27 14 35 25-8 11-20 20-35 25-32 11-66 2-86-25Z" fill="#8fc8df" stroke="#294f9b" strokeWidth="4"/><path d="m135 55 31-24v48l-31-24Z" fill="#f0a368" stroke="#294f9b" strokeWidth="4"/><circle cx="56" cy="48" r="5" fill="#202735"/><path d="M82 43c8 5 8 19 0 24" fill="none" stroke="#fffdf5" strokeWidth="4" strokeLinecap="round"/><path d="M22 55h-9" stroke="#294f9b" strokeWidth="3" strokeLinecap="round"/></svg></div><div className="eyebrow"><span /> TIE TIE FISH!!</div><h1>You thought I wouldn’t protect this website from stupid people like you?</h1><p>Try another first name, you menace.</p><button type="button" className="primary" onClick={() => { setProfanityBlocked(false); setNameDraft(""); }}>Try again <Sparkles size={18} /></button></div></main> : pendingName ? <main id="top" className="entrance gate-screen"><div className="entrance-copy gate-copy"><div className="paper-tape">QUICK CLARIFICATION</div><div className="eyebrow"><span /> ONE LAST DETAIL</div><h1>And your surname?</h1><p>There’s more than one {pendingName.split(" ")[0]}. This helps find the right note.</p><form className="name-form surname-form" onSubmit={(event) => { event.preventDefault(); resolveSurname(surnameDraft); }}><div><input autoFocus value={surnameDraft} onChange={(event) => setSurnameDraft(event.target.value)} maxLength={40} aria-label="Your surname" placeholder="Your surname, please." autoComplete="family-name" /><button className="primary" type="submit">Continue <ArrowRight size={18} /></button></div><p className="form-hint">If we haven’t written a personal note for you, you’ll still get the regular one.</p></form></div></main> : <main id="top" className="entrance"><div className="entrance-copy"><div className="paper-tape">{farewellConfig.openingLabel}</div><div className="eyebrow"><span /> {farewellConfig.openingEyebrow}</div><h1><span className="opening-plain">{farewellConfig.headlineFirstLine}</span><br /><span>{farewellConfig.headlineSecondLine}</span></h1><p>{farewellConfig.introduction}</p>
      <form className="name-form" onSubmit={(e) => { e.preventDefault(); enter(nameDraft); }}><label htmlFor="name">Your first name, please.</label><div><input autoComplete="given-name" id="name" required maxLength={50} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="Your first name" /><button className="primary" type="submit">Show me the goodies <Sparkles size={18} /></button></div></form>
      <div className="signed">{farewellConfig.authorName}</div><div className="bottom-line"><span>FROM {farewellConfig.previousChapter}</span><span className="line" /><span>TO {farewellConfig.nextChapter}</span></div></div>
      <div className="entrance-doodles" aria-hidden="true"><span className="doodle-star">✳</span><svg viewBox="0 0 250 120"><path d="M7 90C50 13 90 110 124 46s67 28 119-32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 8" /></svg></div>
    </main> : <main className="welcome" id="top">
      <div className="welcome-top"><span className="eyebrow"><span /> THE LAST NOTEBOOK ENTRY</span><button className="text-button" onClick={() => { track("name_cleared"); analytics.current.name = ""; setName(""); setGreetingId(null); closeExperience(); }}>Not {displayName}?</button></div>
    <section className="letter" aria-label="Farewell note"><div className="letter-paper"><div className="margin-doodle" aria-hidden="true">✳</div><button className="note-download" type="button" onClick={downloadNoteImage}><Download size={16} />Save my note as an image</button><h1>{greeting?.greetingPrefix ?? "Hey"}, <span>{letterName}.</span></h1><h2 key={`o${mix[0]}`}>{openingCopy}</h2><p className="personal-note" key={`p${greetingId ?? mix[3]}`}>{personalCopy}</p><p key={`r${mix[1]}`}>{reflections[mix[1]]}</p><p key={`c${mix[2]}`}>{closings[mix[2]]}</p><div className="letter-sign">{farewellConfig.authorName} <span>{farewellConfig.signoff}</span></div></div><aside className="letter-aside" aria-label="A farewell wish"><span>UNTIL THEN</span><p>Hope our paths<br />cross again soon!</p></aside></section>
      <section className="envelope-section"><div className="section-heading"><div><span className="eyebrow"><span /> {envelopes.filter(({ id }) => (id !== "stocks" || farewellConfig.stockEnvelope.enabled) && (id !== "project" || farewellConfig.project.enabled)).length} SEALED ENVELOPES</span><h2>Choose your next questionable decision.</h2></div><span>OPEN ANY. THERE IS NO CORRECT ORDER.</span></div>
        <div className="envelope-stack">{envelopes.filter(({ id }) => (id !== "stocks" || farewellConfig.stockEnvelope.enabled) && (id !== "project" || farewellConfig.project.enabled)).map(({ id, number, title, teaser, note, tone, Icon }) => <button type="button" key={id} onClick={() => open(id)} className={`envelope ${tone} ${opening === id ? "opening" : ""}`} aria-label={`Open ${title}`}>
          <span className="env-number">{number}</span><span className="env-flap" aria-hidden="true" /><span className="env-seal" aria-hidden="true">✦</span><span className="env-note">{note}</span><span className="env-content"><span className="env-title">{title}</span><span className="env-teaser">{teaser}</span><span className="env-open">BREAK THE SEAL <Icon size={17} /></span></span>
        </button>)}</div>
      </section>
      {(farewellConfig.social.linkedin || farewellConfig.social.whatsappNumber || farewellConfig.social.instagram) && <section className="stay-connected"><div className="social"><div><span className="eyebrow"><span /> STAY IN TOUCH</span><strong>Stay in my orbit.</strong><span>Add only the ways you want people to reach you.</span></div></div><div className="qr-grid">{farewellConfig.social.linkedin && <ContactQR url={farewellConfig.social.linkedin} title="Let’s Connect on LinkedIn" detail="For the professionally acceptable version of what happens next." linkLabel="Open LinkedIn" sessionId={farewellConfig.analyticsEnabled ? analytics.current.sessionId : ""} name={name} context="social_linkedin" />}{whatsappUrl && <ContactQR url={whatsappUrl} title="Say hello on WhatsApp" detail="For everything that doesn’t belong on LinkedIn." linkLabel="Open WhatsApp" onOpen={() => track("whatsapp_draft_link_clicked", "whatsapp")} sessionId={farewellConfig.analyticsEnabled ? analytics.current.sessionId : ""} name={name} context="social_whatsapp" />}{farewellConfig.social.instagram && <ContactQR url={farewellConfig.social.instagram} title="Follow along" detail="A little more of what I’m up to." linkLabel="Open Instagram" sessionId={farewellConfig.analyticsEnabled ? analytics.current.sessionId : ""} name={name} context="social_instagram" />}</div><p className="qr-hint">On a computer? Scan a code with your phone. On your phone? Tap the link below it.</p></section>}
    </main>}
      <footer><span>That’s all, folks. <b>For now.</b></span>{farewellConfig.analyticsEnabled && <span className="footer-counter" aria-live="polite"><span>Site Visits</span><b key={displayedVisitCount}>{displayedVisitCount}</b></span>}<span>NEW CHAPTER. SAME OLD YOU.</span></footer>

    <Dialog open={!!active} onOpenChange={(isOpen) => { if (!isOpen) closeExperience(); }}><DialogContent showCloseButton={false} className={`engagement ${active ? `modal-${active}` : ""}`}><div className="modal-sticky-head"><button className="modal-back" type="button" onClick={closeExperience}>← Back to the notebook</button><DialogClose asChild><button className="modal-close-sticky" type="button" aria-label="Close submission"><X size={20} /></button></DialogClose></div>
      <DialogTitle className="modal-title">{active === "coffee" ? "A catch-up. No agenda." : active === "project" ? `Meet ${farewellConfig.project.name}.` : active === "memory" ? "Go on. I can take it. Probably." : active === "stocks" ? farewellConfig.stockEnvelope.prompt : "Any recommendations for me?"}</DialogTitle>
      {active !== "detour" && <DialogDescription>{active === "coffee" ? "Coffee, lunch, dinner—or a beer. You pick the setting." : active === "project" ? farewellConfig.project.teaser : active === "memory" ? "A memory, a message, or a roast I probably deserve." : active === "stocks" ? "One company. A very, very long-term view." : ""}</DialogDescription>}

      {active === "stocks" && <div className="stock-note"><div className="stock-note-top"><span className="stock-tagline">{farewellConfig.stockEnvelope.tagline}</span><span className="stock-orbit" aria-hidden="true"><TrendingUp size={22} /></span></div><p className="stock-note-hint">Think in generations, not quarters.</p></div>}
      {active === "project" ? <div className="modal-body project-experience"><div className="project-panel">{farewellConfig.project.image && <img className="project-email-art" src={farewellConfig.project.image} alt="" />}<span className="project-wordmark">{farewellConfig.project.name}</span><div className="project-claim"><p className="project-claim-hook">{farewellConfig.project.headline}</p><p className="project-claim-stat"><span>{farewellConfig.project.description}</span></p></div></div>{farewellConfig.project.url && <a className="primary project-visit project-waitlist-top" href={trackedTarget(farewellConfig.project.url, "link_opened", farewellConfig.analyticsEnabled ? analytics.current.sessionId : "", name, "project_waitlist_top")} target="_blank" rel="noreferrer">{farewellConfig.project.callToAction} <Sparkles size={17} /></a>}<div className="project-copy"><p className="project-copy-line">{farewellConfig.project.teaser}</p></div>
      </div> : isFormExperience && done ? <div className="success" role="status"><div className="success-icon"><Check /></div><h3>{active === "coffee" ? `${meal} it is, ${displayName}.` : active === "memory" ? "Noted. My version of events may differ." : active === "stocks" ? "A long-term idea to think about." : "You’re now the unofficial life adviser."}</h3><p>{active === "coffee" ? "Your catch-up request is saved privately for me. The date is a suggestion, not a confirmed booking." : active === "memory" ? "Safely saved, just for me. No office-wide circulation. Even if it’s very funny." : active === "stocks" ? "Your stock idea is saved privately for me. Thanks for sharing the long-term view." : "Thanks for the recommendation. I’ll add it to the ever-growing list."}</p>{(active === "detour" || active === "stocks") && <button type="button" className="secondary-button" onClick={startAnotherSubmission}>{active === "stocks" ? "Share another company" : "Send another suggestion"}</button>}<button className="primary" onClick={closeExperience}>Back to the envelopes</button></div> : isFormExperience ? <>
        {active === "coffee" && <div className="coffee-intro"><ScratchCard revealed={revealed} onReveal={() => { if (!revealed) { track("scratch_card_revealed"); setRevealed(true); } }} /></div>}
        <form onSubmit={submit} className={`engagement-form ${active === "stocks" ? "stock-form" : ""}`}>{active === "coffee" ? <><fieldset className="meal-picker"><legend>What sounds good?</legend>{["Coffee", "Beer", "Lunch", "Dinner"].map((option) => <button type="button" aria-pressed={meal === option} className={meal === option ? "selected" : ""} key={option} onClick={() => { setMeal(option); track("choice_changed", `coffee:${option}`); }}>{option}</button>)}</fieldset><label>A date in mind? <span>(optional, just a suggestion)</span><input type="date" min={today} value={draft.date} onFocus={() => track("form_field_focused", "coffee:date")} onChange={(e) => updateDraft("date", e.target.value)} /></label>{catchupUrl && <ContactQR url={catchupUrl} title="Let’s make it happen." detail="Scan to open a personalised WhatsApp draft. Review it and tap Send when you’re ready." linkLabel="Open on WhatsApp" onOpen={() => track("whatsapp_draft_link_clicked", "whatsapp")} sessionId={farewellConfig.analyticsEnabled ? analytics.current.sessionId : ""} name={name} context="coffee_suggestion_form" />}<div className="or-save">OR LEAVE A PRIVATE REQUEST HERE</div></> : active === "detour" ? <><fieldset className="meal-picker"><legend>What should I try?</legend>{["A book", "A place", "Podcast", "Music", "Movie/Series", "Restaurant", "Others"].map((option) => <button type="button" aria-pressed={category === option} className={category === option ? "selected" : ""} key={option} onClick={() => { setCategory(option); track("choice_changed", `detour:${option}`); }}>{option}</button>)}</fieldset><p className="form-hint">Multiple submissions encouraged. The more, the merrier.</p></> : active === "stocks" ? <><label className="stock-company-field">Which company? <span>Company name or ticker</span><input required maxLength={100} value={draft.company} onFocus={() => track("form_field_focused", "stocks:company")} onChange={(e) => updateDraft("company", e.target.value)} placeholder="A company you believe in" /></label><p className="form-hint">One company per note. Multiple ideas are welcome.</p></> : null}
          <label>{active === "coffee" ? "Any place or plan in mind?" : active === "memory" ? "Your little something" : active === "stocks" ? "Why would you hold it for the next generation?" : "What should I try and why?"}<textarea value={draft.message} onFocus={() => track("form_field_focused", `${active}:message`)} onChange={(e) => updateDraft("message", e.target.value)} required={active !== "coffee"} maxLength={active === "stocks" ? 1800 : 2000} rows={active === "stocks" ? 3 : 4} placeholder={active === "memory" ? "I’ll always remember…" : active === "stocks" ? "What makes it a long-term keeper?" : active === "detour" ? "What should I try and why?" : "Your favourite spot?"} /></label>
          <div className="visitor-name-fields"><label><span className="visitor-field-label">First name</span><input value={firstName} readOnly aria-label="First name from the opening page" /></label><label><span className="visitor-field-label">Last name <span className="optional-required-mark" aria-hidden="true">*</span></span><input autoComplete="family-name" value={draft.surname} onFocus={() => track("form_field_focused", `${active}:surname`)} onChange={(e) => updateDraft("surname", e.target.value)} maxLength={60} placeholder="Your surname" /></label></div>
          <p className="privacy">Just between us. Your response is saved privately and won’t appear on this page.</p>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Saving…" : active === "coffee" ? "Save a catch-up request" : active === "stocks" ? "Send me your long-term idea" : "Leave it with me"}</button>
        </form>
      </> : null}

      {active && project && active !== "project" && <div className={`project-footnote footnote-${active}`}><div className="project-footnote-heading"><span className="project-footnote-logo">{farewellConfig.project.name}</span><span>A LITTLE MORE ABOUT MY PROJECT</span></div><h4>{project.title}</h4><p>{project.body}</p><button type="button" onClick={() => open("project")} className="project-inline-link">Tell me more <Sparkles size={15} /></button></div>}
    </DialogContent></Dialog>
  </div>;
}
