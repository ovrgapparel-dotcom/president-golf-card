import { guestRoute } from "@/lib/server/route-helpers";
import { submitRound } from "@/lib/server/rounds-service";
import { tokenFromRequest } from "@/lib/server/guest-token";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return guestRoute(request, "submit", 10, (rpc) => submitRound(rpc, id, tokenFromRequest(request)));
}
