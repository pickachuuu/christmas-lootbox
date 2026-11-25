import { useSyncExternalStore } from "react";
import { parseAvatarLook, type AvatarLook } from "./avatar-options";
import presets from "./guest-presets.json";

export const maxGuestNameLength = 40;
export const maxWishlistItems = 5;
export const maxWishLength = 240;
export const emptyWishlist: readonly string[] = [];

export type Guest = {
  id: string;
  name: string;
  avatar: AvatarLook | null;
  wishlist?: string[];
};

export type GuestCustomization = Partial<Pick<Guest, "avatar" | "wishlist">>;

type GuestRoster = {
  version: 1;
  guests: Guest[];
};

const storageKey = "santa-shuffle:guest-roster:v1";
const rosterEvent = "santa-shuffle:guest-roster-changed";

export function guestNameKey(name: string) {
  return name.normalize("NFKC").toLowerCase();
}

export function cleanWishlist(items: readonly string[]) {
  return items.map((item) => item.trim()).filter(Boolean);
}

export function parseGuestRoster(value: unknown): GuestRoster {
  if (
    typeof value !== "object" || value === null ||
    !("version" in value) || value.version !== 1 ||
    !("guests" in value) || !Array.isArray(value.guests)
  ) {
    throw new Error("Choose a Santa Shuffle roster saved as JSON.");
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const guests = value.guests.map((entry: unknown, index): Guest => {
    if (
      typeof entry !== "object" || entry === null ||
      !("id" in entry) || typeof entry.id !== "string" || !entry.id.trim() ||
      !("name" in entry) || typeof entry.name !== "string" || !entry.name.trim() ||
      entry.name.trim().length > maxGuestNameLength ||
      !("avatar" in entry)
    ) {
      throw new Error(`Guest ${index + 1} has an invalid name or avatar.`);
    }

    const avatar = parseAvatarLook(entry.avatar);
    if (entry.avatar !== null && avatar === null) {
      throw new Error(`Guest ${index + 1} has an invalid avatar.`);
    }

    let wishlist: string[] | undefined;
    if ("wishlist" in entry && entry.wishlist !== undefined) {
      const items = entry.wishlist;
      if (!Array.isArray(items) || items.length > maxWishlistItems ||
        items.some((item) => typeof item !== "string" || item.trim().length > maxWishLength)) {
        throw new Error(`Guest ${index + 1} has an invalid wishlist.`);
      }
      wishlist = cleanWishlist(items);
    }

    const name = entry.name.trim();
    const nameKey = guestNameKey(name);
    if (ids.has(entry.id) || names.has(nameKey)) {
      throw new Error("Each guest in the roster must have a unique name and ID.");
    }

    ids.add(entry.id);
    names.add(nameKey);
    return { id: entry.id, name, avatar, wishlist };
  });

  return { version: 1, guests };
}

const bundledRoster = parseGuestRoster(presets);
let cachedRaw: string | null = null;
let cachedRoster = bundledRoster;

function readRoster(): GuestRoster {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== cachedRaw) {
      cachedRoster = raw ? parseGuestRoster(JSON.parse(raw)) : bundledRoster;
      cachedRaw = raw;
    }
    return cachedRoster;
  } catch {
    return bundledRoster;
  }
}

function subscribe(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) onChange();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(rosterEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(rosterEvent, onChange);
  };
}

export function useGuestRoster() {
  return useSyncExternalStore(subscribe, readRoster, () => bundledRoster);
}

export function serializeGuests(guests: readonly Guest[]) {
  return JSON.stringify({ version: 1, guests }, null, 2);
}

function saveRoster(guests: Guest[]) {
  try {
    window.localStorage.setItem(storageKey, serializeGuests(guests));
  } catch {
    throw new Error("This browser couldn’t save the roster. Check that local storage is enabled.");
  }
  window.dispatchEvent(new Event(rosterEvent));
}

export function saveGuest(guest: Guest) {
  const { guests } = readRoster();
  const nameKey = guestNameKey(guest.name);
  if (guests.some(({ id, name }) => id !== guest.id && guestNameKey(name) === nameKey)) {
    throw new Error("That name is already on the guest list.");
  }

  const existing = guests.some(({ id }) => id === guest.id);
  saveRoster(existing ? guests.map((entry) => entry.id === guest.id ? guest : entry) : [...guests, guest]);
}

export function removeGuest(id: string) {
  saveRoster(readRoster().guests.filter((guest) => guest.id !== id));
}

export function saveGuestCustomization(id: string, customization: GuestCustomization) {
  const { guests } = readRoster();
  if (!guests.some((guest) => guest.id === id)) {
    throw new Error("This guest is no longer on the roster. Go back and choose your name again.");
  }
  saveRoster(guests.map((guest) => guest.id === id ? { ...guest, ...customization } : guest));
}

export function importGuestRoster(roster: GuestRoster) {
  const imported = new Map(roster.guests.map((guest) => [guest.id, guest]));
  const guests = readRoster().guests.map((guest) => {
    const replacement = imported.get(guest.id);
    imported.delete(guest.id);
    return replacement ? { ...replacement, wishlist: replacement.wishlist ?? guest.wishlist } : guest;
  });

  const merged = parseGuestRoster({ version: 1, guests: [...guests, ...imported.values()] });
  saveRoster(merged.guests);
}
