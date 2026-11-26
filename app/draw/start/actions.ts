"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { openSharedDraw, RosterError } from "../../roster-storage";

export type DrawStartResult = { opened: boolean; message: string } | null;

export async function startDraw(_previous: DrawStartResult, formData: FormData): Promise<DrawStartResult> {
  const expected = process.env.MANITO_MANITA_DRAW_ADMIN_KEY?.trim();
  if (!expected) return { opened: false, message: "The organizer code hasn’t been configured." };

  const code = formData.get("code");
  if (typeof code !== "string" || !timingSafeEqual(
    createHash("sha256").update(code.trim()).digest(),
    createHash("sha256").update(expected).digest(),
  )) {
    return { opened: false, message: "That organizer code is incorrect." };
  }

  try {
    await openSharedDraw();
    return { opened: true, message: "The draw is open. Guests can now pull a name." };
  } catch (error) {
    if (error instanceof RosterError) return { opened: false, message: error.message };
    console.error("Couldn’t open the draw.", error instanceof Error ? error.name : "Unknown error");
    return { opened: false, message: "Couldn’t open the draw. Try again." };
  }
}
