import { guestNameKey, parseGuestRoster, type Guest, type GuestRoster } from "../../guest-roster";
import {
  changeSharedGuests, pullSharedRecipient, readSharedRoster, RosterError,
} from "../../roster-storage";

function respond(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function respondToError(error: unknown) {
  if (error instanceof RosterError) return respond({ error: error.message, code: error.code }, error.status);
  console.error("Shared roster storage request failed.", error instanceof Error ? error.name : "Unknown error");
  return respond({ error: "The shared roster is unavailable. Try again." }, 503);
}

function validateRoster(value: unknown) {
  try {
    return parseGuestRoster(value);
  } catch (error) {
    throw new RosterError(error instanceof Error ? error.message : "Invalid guest roster.");
  }
}

function validateGuest(value: unknown) {
  return validateRoster({ version: 1, guests: [value] }).guests[0];
}

function checkUniqueName(guests: Guest[], guest: Guest) {
  const nameKey = guestNameKey(guest.name);
  if (guests.some(({ id, name }) => id !== guest.id && guestNameKey(name) === nameKey)) {
    throw new RosterError("That name is already on the guest list.", 409);
  }
}

function mergeGuests(guests: Guest[], roster: GuestRoster) {
  const imported = new Map(roster.guests.map((guest) => [guest.id, guest]));
  const merged = guests.map((guest) => {
    const replacement = imported.get(guest.id);
    imported.delete(guest.id);
    return replacement ? { ...replacement, wishlist: replacement.wishlist ?? guest.wishlist } : guest;
  });
  return validateRoster({ version: 1, guests: [...merged, ...imported.values()] }).guests;
}

async function applyChange(body: unknown) {
  if (!body || typeof body !== "object" || !("action" in body)) {
    throw new RosterError("Invalid roster request.");
  }
  if (body.action === "add" && "guest" in body) {
    const guest = validateGuest(body.guest);
    return changeSharedGuests((guests) => {
      if (guests.some(({ id }) => id === guest.id)) throw new RosterError("This guest is already on the roster.", 409);
      checkUniqueName(guests, guest);
      return [...guests, guest];
    });
  }
  if (body.action === "import" && "roster" in body) {
    const incoming = validateRoster(body.roster);
    return changeSharedGuests((guests) => mergeGuests(guests, incoming));
  }
  if ("id" in body && typeof body.id === "string" && body.id.trim()) {
    const id = body.id;
    if (body.action === "draw") return pullSharedRecipient(id);
    if (body.action === "remove") return changeSharedGuests((guests) => guests.filter((guest) => guest.id !== id));
    if (body.action === "edit" && "changes" in body) {
      const { changes } = body;
      if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
        throw new RosterError("Invalid guest changes.");
      }
      return changeSharedGuests((guests) => {
        const existing = guests.find((guest) => guest.id === id);
        if (!existing) throw new RosterError("This guest is no longer on the roster. Go back and choose your name again.", 404);
        const updated = validateGuest({ ...existing, ...changes, id });
        checkUniqueName(guests, updated);
        return guests.map((guest) => guest.id === id ? updated : guest);
      });
    }
  }
  throw new RosterError("Invalid roster request.");
}

export async function GET(request: Request) {
  try {
    const guestId = new URL(request.url).searchParams.get("guestId") ?? undefined;
    return respond(await readSharedRoster(guestId));
  } catch (error) {
    return respondToError(error);
  }
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return respond({ error: "Send roster changes as JSON." }, 415);
  }
  try {
    const text = await request.text();
    if (text.length > 262_144) throw new RosterError("The roster request is too large.", 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RosterError("Invalid roster JSON.");
    }
    return respond(await applyChange(body));
  } catch (error) {
    return respondToError(error);
  }
}
