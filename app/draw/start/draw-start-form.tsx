"use client";

import { useActionState } from "react";
import { startDraw } from "./actions";

export default function DrawStartForm() {
  const [result, action, pending] = useActionState(startDraw, null);

  if (result?.opened) return <p className="screen-caption" role="status">{result.message}</p>;

  return (
    <form className="draw-start-form" action={action}>
      <label className="avatar-field">
        Organizer code
        <input type="password" name="code" required autoComplete="off" disabled={pending} />
      </label>
      {result && <p className="customization-error" role="alert">{result.message}</p>}
      <button className="game-button" type="submit" disabled={pending}>
        {pending ? "Checking wishlists…" : "Open draw"}
      </button>
    </form>
  );
}
