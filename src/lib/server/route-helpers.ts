import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import type { Rpc, ServiceResult } from "@/lib/server/rounds-service";

/** Shared guard for guest endpoints: configuration, rate limit, then run the service call. */
export async function guestRoute(
  request: Request,
  bucket: string,
  limitPerMinute: number,
  run: (rpc: Rpc) => Promise<ServiceResult>,
): Promise<NextResponse> {
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "NOT_CONFIGURED", message: "Supabase n'est pas configuré." }, { status: 503 });
  }
  if (!rateLimit(`${bucket}:${clientIp(request)}`, limitPerMinute, 60_000)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const rpc: Rpc = async (fn, args) => {
    const { data, error } = await admin.rpc(fn, args);
    return { data, error: error ? { message: error.message } : null };
  };
  const result = await run(rpc);
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
