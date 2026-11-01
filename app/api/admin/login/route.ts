import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { adminCookieMaxAge, adminCookieName, makeAdminCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.ADMIN_SESSION_SECRET) return Response.json({ error: "Admin sign-in is not configured." }, { status: 503 });
  if (expected.length < 12 || process.env.ADMIN_SESSION_SECRET.length < 32) return Response.json({ error: "Set an admin password of at least 12 characters and a session secret of at least 32 characters." }, { status: 503 });
  let password = "";
  try {
    const raw = await request.text();
    if (raw.length > 1000) return Response.json({ error: "Too long" }, { status: 413 });
    const payload = JSON.parse(raw) as { password?: unknown };
    if (typeof payload.password === "string") password = payload.password;
  } catch { return Response.json({ error: "Enter your password." }, { status: 400 }); }
  const digest = (value: string) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(value).digest();
  if (!timingSafeEqual(digest(password), digest(expected))) return Response.json({ error: "That password did not match." }, { status: 401 });
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(adminCookieName, makeAdminCookie(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: adminCookieMaxAge });
  return response;
}
