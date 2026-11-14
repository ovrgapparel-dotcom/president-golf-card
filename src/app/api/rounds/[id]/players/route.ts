import { guestRoute, readJson } from "@/lib/server/route-helpers";
import { addPlayer } from "@/lib/server/rounds-service";
import { tokenFromRequest } from "@/lib/server/guest-token";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await readJson(request);
  return guestRoute(request, "players", 30, (rpc) => addPlayer(rpc, id, tokenFromRequest(request), body));
}
