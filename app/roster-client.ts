import { parseGuestRoster, type Guest, type GuestRoster, type RosterChange } from "./guest-roster";

const legacyStorageKey = "santa-shuffle:guest-roster:v1";

async function rosterRequest<T>(options?: RequestInit): Promise<T> {
  const response = await fetch("/api/roster", { cache: "no-store", ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn’t connect to the shared roster. Try again.");
  }
  return response.json();
}

function post<T>(change: RosterChange | { action: "draw"; id: string }) {
  return rosterRequest<T>({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(change),
  });
}

export function loadRoster(signal?: AbortSignal) {
  return rosterRequest<GuestRoster | null>({ signal });
}

export function updateRoster(change: RosterChange) {
  return post<GuestRoster>(change);
}

export function drawRecipient(id: string) {
  return post<Guest>({ action: "draw", id });
}

export function readBrowserRoster() {
  try {
    const raw = window.localStorage.getItem(legacyStorageKey);
    return raw ? { raw, roster: parseGuestRoster(JSON.parse(raw)) } : null;
  } catch {
    return null;
  }
}

export function clearImportedBrowserRoster(raw: string) {
  try {
    if (window.localStorage.getItem(legacyStorageKey) === raw) {
      window.localStorage.removeItem(legacyStorageKey);
    }
  } catch {
    // The shared copy has already been saved.
  }
}
