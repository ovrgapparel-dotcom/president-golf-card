import { guestRoute } from "@/lib/server/route-helpers";
import { getRound } from "@/lib/server/rounds-service";
import { tokenFromRequest } from "@/lib/server/guest-token";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return guestRoute(request, "read", 120, (rpc) => getRound(rpc, id, tokenFromRequest(request)));
}
