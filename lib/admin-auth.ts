import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "farewell_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must contain at least 32 characters.");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function validAdminCookie(value: string | undefined) {
  if (!value) return false;
  if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) return false;
  const [expiry, supplied] = value.split(".");
  if (!expiry || !supplied || !/^\d+$/.test(expiry) || Number(expiry) < Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expiry);
  const left = Buffer.from(supplied, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function makeAdminCookie() {
  const expiry = String(Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS);
  return `${expiry}.${signature(expiry)}`;
}

export async function isAdminSession() {
  return validAdminCookie((await cookies()).get(COOKIE)?.value);
}

export function isAdminRequest(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return validAdminCookie(value);
}

export const adminCookieName = COOKIE;
export const adminCookieMaxAge = MAX_AGE_SECONDS;
