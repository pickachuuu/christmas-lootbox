import type { Guest } from "./guest-roster";

export const demoGuests: readonly Guest[] = ["Alex", "Bea", "Cam", "Dani", "Jules", "Sam"].map((name) => ({
  id: `demo-${name}`,
  name,
  avatar: null,
}));

export function createDraw(guests: readonly Guest[]): ReadonlyMap<string, string> {
  if (guests.length < 2) return new Map();

  const shuffled = guests.map(({ id }) => id);

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  return new Map(shuffled.map((id, index) => [
    id,
    shuffled[(index + 1) % shuffled.length],
  ]));
}
