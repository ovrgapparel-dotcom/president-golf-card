import { guestRoute, readJson } from "@/lib/server/route-helpers";
import { putScore } from "@/lib/server/rounds-service";
import { tokenFromRequest } from "@/lib/server/guest-token";

export async function PUT(request: Request, context: { params: Promise<{ id: string; hole: string }> }) {
  const { id, hole } = await context.params;
  const body = await readJson(request);
  return guestRoute(request, "score", 240, (rpc) => putScore(rpc, id, hole, tokenFromRequest(request), body));
}
