import { redirect } from "next/navigation";
import { getViewer } from "../ecosystem/identity";
import type { PlayerProfile } from "../ecosystem/types";
import type { Actor } from "./store";

/** Server-component guard for the /play pages: signed-in players only. */
export async function requirePlayer(next: string): Promise<{
  viewer: PlayerProfile;
  actor: Actor;
  me: { id: string; slug: string; nickname: string; avatar: string | null; isYou: true };
}> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/account?next=${encodeURIComponent(next)}`);
  // staff & admin run the venue from the console; friend play is for players
  if (viewer.role !== "player") redirect("/admin");
  return {
    viewer,
    actor: { id: viewer.id, role: viewer.role, nickname: viewer.nickname },
    me: {
      id: viewer.id,
      slug: viewer.slug,
      nickname: viewer.nickname,
      avatar: viewer.avatar ?? null,
      isYou: true,
    },
  };
}
