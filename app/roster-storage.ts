import "server-only";
import { Redis } from "@upstash/redis";
import { createDraw } from "./draw";
import { isDrawOpen } from "./draw-config";
import presets from "./guest-presets.json";
import { parseGuestRoster, type Guest, type GuestRoster } from "./guest-roster";

type StoredRoster = GuestRoster & { draw?: [string, string][] };

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
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.KV_REST_API_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.KV_REST_API_TOKEN?.trim();
  if (!url && !token) return null;
  if (!url || !token) throw new RosterError("Shared roster storage is missing configuration.", 503);
  return redis ??= new Redis({
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
  const roster = parseGuestRoster(stored);
  if (!stored || typeof stored !== "object" || !("draw" in stored)) return roster;

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
  return { ...roster, draw: assignments };
}

function publicRoster({ version, guests }: StoredRoster): GuestRoster {
  return { version, guests };
}

export async function readSharedRoster() {
  const client = getRedis();
  return client ? publicRoster(decodeRoster(await client.get<string>(key))) : null;
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
    return { version: 1, guests, draw: sameGuests ? current.draw : undefined };
  });
  return publicRoster(result);
}

export async function getSharedRecipient(id: string) {
  if (!isDrawOpen()) throw new RosterError("The draw opens after the grace period.", 403);
  const roster = await updateSharedRoster((current) => {
    if (!current.guests.some((guest) => guest.id === id)) {
      throw new RosterError("This guest is no longer on the roster. Go back and choose your name again.", 404);
    }
    if (current.guests.length < 2) throw new RosterError("The draw needs at least two guests.", 409);
    return current.draw ? current : { ...current, draw: [...createDraw(current.guests)] };
  });
  const recipientId = roster.draw?.find(([giver]) => giver === id)?.[1];
  const recipient = roster.guests.find((guest) => guest.id === recipientId);
  if (!recipient) throw new Error("Missing stored recipient.");
  return recipient;
}
