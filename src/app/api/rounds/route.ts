import { guestRoute, readJson } from "@/lib/server/route-helpers";
import { createRound } from "@/lib/server/rounds-service";

export async function POST(request: Request) {
  const body = await readJson(request);
  return guestRoute(request, "create", 10, (rpc) => createRound(rpc, body));
}
