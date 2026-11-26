import "server-only";
import { Redis } from "@upstash/redis";
import { createDraw } from "./draw";
import { isDrawOpen } from "./draw-config";
import presets from "./guest-presets.json";
import { parseGuestRoster, type DrawStatus, type Guest, type GuestRoster, type SharedGuestRoster } from "./guest-roster";

type StoredRoster = GuestRoster & { drawOpen?: true; draw?: [string, string][]; pulled?: string[] };

const key = "santa-shuffle:guest-roster:v1";
const initialRoster = parseGuestRoster(presets);
const compareAndSet = `
  if (redis.call("GET", KEYS[1]) or "") ~= ARGV[1] then
    return 0
  end
  redis.call("SET", KEYS[1], ARGV[2])
  return 1
`;
let redis: Redis | undefined;

export class RosterError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
  }
}

function getRedis() {
  if (redis) return redis;

  let url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  let token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  if (!url || !token) {
    const prefixedUrls = Object.keys(process.env).filter((name) =>
      /_(?:UPSTASH_REDIS_REST|KV_REST_API)_URL$/.test(name),
    );
    const pairs = prefixedUrls.map((name) => ({
      url: process.env[name]?.trim(),
      token: process.env[`${name.slice(0, -3)}TOKEN`]?.trim(),
    })).filter((pair) => pair.url && pair.token);

    if (pairs.length > 1) {
      throw new RosterError("Multiple Redis connections were found. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for the roster database.", 503);
    }
    if (pairs[0]) ({ url, token } = pairs[0]);
    if (!url && !token && prefixedUrls.length === 0) return null;
  }
  if (!url || !token) throw new RosterError("Shared roster storage is missing configuration.", 503);
  return redis = new Redis({
    url,
    token,
    cache: "no-store",
    automaticDeserialization: false,
    enableAutoPipelining: false,
    signal: () => AbortSignal.timeout(5_000),
  });
}

function decodeRoster(raw: string | null): StoredRoster {
  if (raw === null) return initialRoster;
  const stored: unknown = JSON.parse(raw);
  const roster: StoredRoster = parseGuestRoster(stored);
  if (!stored || typeof stored !== "object") return roster;
  if ("drawOpen" in stored && stored.drawOpen === true) roster.drawOpen = true;
  if (!("draw" in stored)) return roster;

  const ids = new Set(roster.guests.map(({ id }) => id));
  const givers = new Set<string>();
  const recipients = new Set<string>();
  const assignments: [string, string][] = [];
  const draw = stored.draw;
  if (!Array.isArray(draw) || draw.length !== ids.size || draw.length < 2) {
    throw new Error("Invalid stored draw.");
  }
  for (const pair of draw) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error("Invalid stored draw.");
    const [giver, recipient] = pair;
    if (typeof giver !== "string" || typeof recipient !== "string" ||
        giver === recipient || !ids.has(giver) || !ids.has(recipient) ||
        givers.has(giver) || recipients.has(recipient)) {
      throw new Error("Invalid stored draw.");
    }
    givers.add(giver);
    recipients.add(recipient);
    assignments.push([giver, recipient]);
  }
  if ("pulled" in stored) {
    const { pulled } = stored;
    if (!Array.isArray(pulled) || new Set(pulled).size !== pulled.length ||
        pulled.some((id) => typeof id !== "string" || !ids.has(id))) {
      throw new Error("Invalid stored pull history.");
    }
    roster.pulled = pulled;
  }
  return { ...roster, draw: assignments };
}

function getDrawStatus(roster: StoredRoster): DrawStatus {
  if (!roster.drawOpen && !isDrawOpen()) return "closed";
  if (roster.draw) return "open";
  if (roster.guests.length < 2) return "needs-guests";
  if (roster.guests.some((guest) => !guest.wishlist?.length)) return "needs-wishlists";
  return "open";
}

function publicRoster(roster: StoredRoster): SharedGuestRoster {
  const { version, guests } = roster;
  return { version, guests, drawStatus: getDrawStatus(roster) };
}

async function readStoredRoster() {
  const client = getRedis();
  return client ? decodeRoster(await client.get<string>(key)) : null;
}

export async function readSharedRoster(guestId?: string) {
  const roster = await readStoredRoster();
  if (!roster) return null;
  return guestId
    ? { ...publicRoster(roster), hasPulled: roster.pulled?.includes(guestId) ?? false }
    : publicRoster(roster);
}

async function updateSharedRoster(change: (current: StoredRoster) => StoredRoster) {
  const client = getRedis();
  if (!client) throw new RosterError("Shared roster storage hasn’t been configured.", 503);

  // Retry against the latest roster when another request wins the write.
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = await client.get<string>(key);
    const current = decodeRoster(raw);
    const next = change(current);
    const encoded = JSON.stringify(next);
    if (next === current || raw === encoded ||
        await client.eval<string[], number>(compareAndSet, [key], [raw ?? "", encoded]) === 1) {
      return next;
    }
  }
  throw new RosterError("The roster changed while saving. Try again.", 409);
}

export async function changeSharedGuests(change: (guests: Guest[]) => Guest[]) {
  const result = await updateSharedRoster((current) => {
    const guests = change(current.guests);
    const ids = new Set(current.guests.map(({ id }) => id));
    const sameGuests = ids.size === guests.length && guests.every(({ id }) => ids.has(id));
    if (!sameGuests && current.pulled?.length) {
      throw new RosterError("Guests can’t be added or removed after someone has pulled a name.", 409);
    }
    return { ...current, guests, draw: sameGuests ? current.draw : undefined };
  });
  return publicRoster(result);
}

export async function openSharedDraw() {
  await updateSharedRoster((current) => {
    if (current.drawOpen) return current;
    if (current.guests.length < 2) throw new RosterError("The draw needs at least two guests.", 409);

    const missing = current.guests.filter((guest) => !guest.wishlist?.length);
    if (missing.length) {
      const names = missing.map((guest) => guest.name).join(", ");
      throw new RosterError(`Each guest needs at least one wishlist item. Still waiting for ${names}.`, 409);
    }

    return { ...current, drawOpen: true, draw: current.draw ?? [...createDraw(current.guests)] };
  });
}

function assignedRecipient(roster: StoredRoster, id: string) {
  const recipientId = roster.draw?.find(([giver]) => giver === id)?.[1];
  const recipient = roster.guests.find((guest) => guest.id === recipientId);
  if (!recipient) throw new Error("Missing stored recipient.");
  return recipient;
}

export async function pullSharedRecipient(id: string) {
  const roster = await updateSharedRoster((current) => {
    const status = getDrawStatus(current);
    if (status === "closed") throw new RosterError("The organizer hasn’t opened the draw yet.", 403);
    if (!current.guests.some((guest) => guest.id === id)) {
      throw new RosterError("This guest is no longer on the roster. Go back and choose your name again.", 404);
    }
    if (status === "needs-guests") throw new RosterError("The draw needs at least two guests.", 409);
    if (status === "needs-wishlists") throw new RosterError("Each guest needs at least one wishlist item.", 409);
    if (current.pulled?.includes(id)) {
      throw new RosterError("You’ve already pulled a name.", 409, "already-pulled");
    }
    return {
      ...current,
      draw: current.draw ?? [...createDraw(current.guests)],
      pulled: [...(current.pulled ?? []), id],
    };
  });
  return assignedRecipient(roster, id);
}

export async function readSharedRecipient(id: string) {
  const roster = await readStoredRoster();
  if (!roster) throw new RosterError("Shared roster storage hasn’t been configured.", 503);
  if (getDrawStatus(roster) !== "open") throw new RosterError("The draw isn’t open.", 403);
  if (!roster.pulled?.includes(id)) throw new RosterError("Pull a name to see your match.", 404);
  return assignedRecipient(roster, id);
}
