import { createHmac, randomBytes } from "node:crypto";
import { getStore } from "@/lib/storage";

const ephemeralKey = randomBytes(32);

export async function enforceIpLimit(request: Request, scope: string, maximum: number, windowSeconds: number) {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER || "cf-connecting-ip";
  const ip = request.headers.get(header) || "unknown-client";
  const key = createHmac("sha256", process.env.ADMIN_SESSION_SECRET || ephemeralKey).update(`${scope}:${ip}`).digest("hex");
  return getStore().consumeRateLimit(key, maximum, windowSeconds);
}

export async function enforceGlobalLimit(scope: string, maximum: number, windowSeconds: number) {
  const key = createHmac("sha256", process.env.ADMIN_SESSION_SECRET || ephemeralKey).update(`global:${scope}`).digest("hex");
  return getStore().consumeRateLimit(key, maximum, windowSeconds);
}

export async function enforceIpAndGlobalLimits(
  request: Request,
  scope: string,
  ipMaximum: number,
  ipWindowSeconds: number,
  globalMaximum: number,
  globalWindowSeconds: number,
) {
  const ipResult = await enforceIpLimit(request, scope, ipMaximum, ipWindowSeconds);
  if (!ipResult.allowed) return ipResult;
  return enforceGlobalLimit(scope, globalMaximum, globalWindowSeconds);
}

export function rateLimited(retryAfterSeconds: number) {
  return Response.json({ error: "Too many requests. Please try again later." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" },
  });
}
