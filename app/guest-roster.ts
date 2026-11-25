import { parseAvatarLook, type AvatarLook } from "./avatar-options";

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

export type GuestRoster = {
  version: 1;
  guests: Guest[];
};

export type GuestEdit = Partial<Omit<Guest, "id">>;

export type RosterChange =
  | { action: "add"; guest: Guest }
  | { action: "edit"; id: string; changes: GuestEdit }
  | { action: "remove"; id: string }
  | { action: "import"; roster: GuestRoster };

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

export function serializeGuests(guests: readonly Guest[]) {
  return JSON.stringify({ version: 1, guests }, null, 2);
}
