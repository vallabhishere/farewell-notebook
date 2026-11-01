"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Sign-in failed.");
      router.push("/activity");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f5ed", fontFamily: "Arial,sans-serif", color: "#26334f" }}><form onSubmit={submit} style={{ width: "min(100%,420px)", padding: 32, background: "#fffdf6", border: "1px solid #d9d6ca", boxShadow: "0 12px 36px #26334f12" }}><p style={{ color: "#b6532b", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Owner access</p><h1 style={{ font: "400 32px Georgia,serif", margin: "8px 0" }}>Activity dashboard</h1><p style={{ color: "#667085", lineHeight: 1.55 }}>Sign in with the admin password configured for this site.</p><label htmlFor="admin-password" style={{ display: "block", margin: "22px 0 8px", fontSize: 14 }}>Admin password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: 13, border: "1px solid #aeb8ca", background: "white", fontSize: 16 }} />{error && <p role="alert" style={{ color: "#a23b24", fontSize: 14 }}>{error}</p>}<button disabled={busy} style={{ marginTop: 16, padding: "12px 18px", border: 0, background: "#294f9b", color: "white", fontSize: 15, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>{busy ? "Signing in…" : "Sign in"}</button></form></main>;
}
