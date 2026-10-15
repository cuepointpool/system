import { query, transaction } from "./pg";
import { audit, invalidateStatsCache, rid } from "./ecosystem/store";

/* ------------------------------------------------------------------
   Player profile photos. The browser crops + resizes to a small square
   before upload; here we only check it's really a JPEG/PNG/WebP of a
   sane size. Bytes live in `player_avatars`; player_profiles.avatar is
   the versioned URL that serves them (/api/avatars/<id>/<version>).
   ------------------------------------------------------------------ */

export const MAX_AVATAR_BYTES = 400 * 1024;

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarError";
  }
}

/** Does the file really start like the type it claims to be? */
function magicMatches(mime: string, b: Buffer): boolean {
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/png")
    return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp")
    return b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function setAvatar(playerId: string, dataUrl: string): Promise<string> {
  const m = DATA_URL.exec(dataUrl);
  if (!m) throw new AvatarError("Upload a JPG, PNG or WebP image.");
  const mime = m[1];
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length) throw new AvatarError("That image is empty.");
  if (bytes.length > MAX_AVATAR_BYTES) throw new AvatarError("That image is too large.");
  if (!magicMatches(mime, bytes)) throw new AvatarError("That file isn't a valid image.");

  const version = rid().slice(0, 8);
  const url = `/api/avatars/${playerId}/${version}`;
  await transaction(async (c) => {
    await c.query(
      `INSERT INTO player_avatars (player_id, mime, data, version, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (player_id) DO UPDATE
         SET mime = EXCLUDED.mime, data = EXCLUDED.data,
             version = EXCLUDED.version, updated_at = now()`,
      [playerId, mime, bytes, version],
    );
    await c.query(`UPDATE player_profiles SET avatar = $2 WHERE id = $1`, [playerId, url]);
  });
  invalidateStatsCache();
  await audit(playerId, "player.avatar.set", "player", playerId, `${mime} · ${bytes.length} bytes`);
  return url;
}

export async function removeAvatar(playerId: string): Promise<void> {
  await transaction(async (c) => {
    await c.query(`DELETE FROM player_avatars WHERE player_id = $1`, [playerId]);
    await c.query(`UPDATE player_profiles SET avatar = NULL WHERE id = $1`, [playerId]);
  });
  invalidateStatsCache();
  await audit(playerId, "player.avatar.remove", "player", playerId, "");
}

export async function getAvatar(
  playerId: string,
): Promise<{ mime: string; data: Buffer; version: string } | null> {
  const rows = await query<{ mime: string; data: Buffer; version: string }>(
    `SELECT mime, data, version FROM player_avatars WHERE player_id = $1`,
    [playerId],
  );
  return rows[0] ?? null;
}
