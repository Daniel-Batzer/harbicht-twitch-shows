import { getGameSnapshot } from "@/features/game/services/game-service";

// Read-only snapshot polled by the OBS overlay (Decision 041, temporary).
export async function GET() {
  return Response.json(getGameSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
