"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import AvatarFields from "../avatar-fields";
import { defaultAvatar, type AvatarLook } from "../avatar-options";
import {
  cleanWishlist, emptyWishlist, type Guest, type GuestEdit, type GuestRoster, maxGuestNameLength,
  parseGuestRoster, serializeGuests,
} from "../guest-roster";
import PixelAvatar from "../pixel-avatar";
import { clearImportedBrowserRoster, loadRoster, readBrowserRoster, updateRoster } from "../roster-client";
import WishlistFields from "../wishlist-fields";

type Notice = { text: string; error?: boolean; undo?: Guest };

function AvatarEditor({ guest, notice, disabled, busy, onSave, onRemove, onUndo, onEdit }: {
  guest?: Guest;
  notice: Notice | null;
  disabled: boolean;
  busy: boolean;
  onSave: (guest: Guest, changes?: GuestEdit) => Promise<boolean>;
  onRemove: (guest: Guest) => void;
  onUndo: (guest: Guest) => void;
  onEdit: () => void;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftLook, setDraftLook] = useState<AvatarLook | null>(null);
  const [draftWishlist, setDraftWishlist] = useState<string[] | null>(null);
  const name = draftName ?? guest?.name ?? "";
  const look = draftLook ?? guest?.avatar ?? defaultAvatar;
  const wishlist = draftWishlist ?? guest?.wishlist ?? emptyWishlist;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !name.trim()) return;

    const id = guest?.id ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(36)).join("-");
    const savedWishlist = draftWishlist === null ? undefined : cleanWishlist(draftWishlist);
    const changes: GuestEdit = {};
    if (draftName !== null) changes.name = name.trim();
    if (draftLook !== null || guest?.avatar === null) changes.avatar = look;
    if (savedWishlist !== undefined) changes.wishlist = savedWishlist;
    if (await onSave({ id, name: name.trim(), avatar: look, wishlist: savedWishlist }, guest ? changes : undefined)) {
      setDraftName(null);
      setDraftLook(null);
      setDraftWishlist(null);
    }
  }

  return (
    <form className="studio-editor studio-panel" onSubmit={submit}>
      <figure className="studio-preview">
        <div className="preview-window">
          <PixelAvatar look={look} label="Pixel avatar preview" />
        </div>
        <figcaption>Live preview</figcaption>
      </figure>

      <fieldset className="studio-controls" disabled={disabled}>
        <label className="avatar-field">
          Guest name
          <input
            type="text"
            value={name}
            maxLength={maxGuestNameLength}
            autoComplete="off"
            onChange={(event) => {
              setDraftName(event.target.value);
              onEdit();
            }}
            required
          />
        </label>

        <AvatarFields look={look} onChange={(avatar) => {
          setDraftLook(avatar);
          onEdit();
        }} />

        <details className="studio-wishlist">
          <summary className="game-button game-button--secondary">
            Wishlist <span className="studio-wishlist-count">{cleanWishlist(wishlist).length}/5</span>
          </summary>
          <WishlistFields
            items={wishlist}
            onChange={(items) => {
              setDraftWishlist(items);
              onEdit();
            }}
          />
        </details>

        <div className="studio-save">
          <button className="game-button" type="submit" disabled={!name.trim()}>{busy ? "Saving…" : "Save avatar"}</button>
          {guest && (
            <button className="game-button game-button--secondary game-button--danger" type="button" onClick={() => onRemove(guest)}>
              Remove guest
            </button>
          )}
        </div>

        {notice && (
          <div className="studio-notice" data-error={notice.error}>
            <span role={notice.error ? "alert" : "status"}>{notice.text}</span>
            {notice.undo && (
              <button className="game-button game-button--secondary" type="button" onClick={() => onUndo(notice.undo!)}>
                Undo
              </button>
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}

export default function Studio() {
  const [roster, setRoster] = useState<GuestRoster | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hasBrowserRoster, setHasBrowserRoster] = useState(false);
  const [selected, setSelected] = useState<string | null>();
  const [editorRevision, setEditorRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fileNotice, setFileNotice] = useState<Notice | null>(null);
  const guests = roster?.guests ?? [];
  const disabled = busy || !roster;
  const activeGuest = selected === undefined ? guests[0] : guests.find(({ id }) => id === selected);

  useEffect(() => {
    const controller = new AbortController();
    loadRoster(controller.signal).then((loaded) => {
      if (controller.signal.aborted) return;
      setRoster(loaded);
      setHasBrowserRoster(Boolean(readBrowserRoster()));
      if (!loaded) setLoadError("Shared roster storage hasn’t been configured.");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : "Couldn’t load the guest roster.");
      }
    });
    return () => controller.abort();
  }, [loadAttempt]);

  function chooseGuest(id: string | null) {
    setSelected(id);
    setNotice(null);
  }

  async function commitGuest(guest: Guest, changes?: GuestEdit) {
    setBusy(true);
    setNotice(null);
    try {
      setRoster(await updateRoster(changes
        ? { action: "edit", id: guest.id, changes }
        : { action: "add", guest }));
      setSelected(guest.id);
      setNotice({ text: "Guest saved." });
      return true;
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteGuest(guest: Guest) {
    setBusy(true);
    setNotice(null);
    try {
      setRoster(await updateRoster({ action: "remove", id: guest.id }));
      setSelected(undefined);
      setNotice({ text: `Removed ${guest.name}.`, undo: guest });
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  function exportRoster() {
    const file = new Blob([serializeGuests(guests)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const download = document.createElement("a");
    download.href = url;
    download.download = "guest-presets.json";
    download.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveImport(incoming: GuestRoster) {
    setRoster(await updateRoster({ action: "import", roster: incoming }));
    setSelected(incoming.guests[0]?.id);
    setEditorRevision((revision) => revision + 1);
    setNotice(null);
    setFileNotice({ text: `Imported ${incoming.guests.length} ${incoming.guests.length === 1 ? "guest" : "guests"}.` });
  }

  async function importRoster(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || disabled) return;

    setBusy(true);
    setFileNotice(null);
    try {
      if (file.size > 256_000) throw new Error("Choose a roster file smaller than 256 KB.");
      const content = JSON.parse(await file.text()) as unknown;
      await saveImport(parseGuestRoster(content));
    } catch (error) {
      setFileNotice({
        text: error instanceof SyntaxError ? "That file isn’t valid JSON." : (error as Error).message,
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }

  async function importBrowserRoster() {
    const saved = readBrowserRoster();
    if (!saved) {
      setHasBrowserRoster(false);
      setFileNotice({ text: "There’s no saved roster in this browser.", error: true });
      return;
    }
    setBusy(true);
    setFileNotice(null);
    try {
      await saveImport(saved.roster);
      clearImportedBrowserRoster(saved.raw);
      setHasBrowserRoster(Boolean(readBrowserRoster()));
    } catch (error) {
      setFileNotice({ text: (error as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio">
      <header className="studio-header">
        <Link className="game-button game-button--secondary studio-back" href="/">← Santa Shuffle</Link>
        <h1>Avatar Studio</h1>
      </header>

      <div className="studio-layout">
        <aside className="studio-roster studio-panel" aria-labelledby="studio-roster-title">
          <div className="studio-roster-title">
            <h2 id="studio-roster-title">Guests</h2>
            <span aria-label={`${guests.length} guests`}>{guests.length}</span>
          </div>

          {guests.length > 0 && (
            <ul className="studio-guest-list">
              {guests.map((guest) => (
                <li key={guest.id}>
                  <button
                    className="game-button game-button--secondary studio-guest-button"
                    type="button"
                    aria-pressed={guest.id === activeGuest?.id}
                    disabled={busy}
                    onClick={() => chooseGuest(guest.id)}
                  >
                    <span className="studio-guest-icon">
                      {guest.avatar ? <PixelAvatar look={guest.avatar} /> : <span aria-hidden="true">{guest.name[0]}</span>}
                    </span>
                    <span>{guest.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button className="game-button game-button--secondary studio-add" type="button" onClick={() => chooseGuest(null)} disabled={disabled}>
            <span aria-hidden="true">+</span> Add guest
          </button>

          <div className="studio-file-actions">
            <button className="game-button game-button--secondary" type="button" onClick={exportRoster} disabled={disabled || guests.length === 0}>Export JSON</button>
            <label className="game-button game-button--secondary studio-import" aria-disabled={disabled}>
              Import JSON
              <input type="file" accept=".json,application/json" onChange={importRoster} disabled={disabled} />
            </label>
            {hasBrowserRoster && (
              <button className="game-button game-button--secondary" type="button" onClick={importBrowserRoster} disabled={disabled}>
                Import this browser’s roster
              </button>
            )}
          </div>
          {fileNotice && (
            <p className="studio-notice" role={fileNotice.error ? "alert" : "status"} data-error={fileNotice.error}>
              {fileNotice.text}
            </p>
          )}
          {loadError ? (
            <>
              <p className="studio-notice" role="alert" data-error>{loadError}</p>
              <button className="game-button game-button--secondary" type="button" onClick={() => {
                setLoadError("");
                setLoadAttempt((attempt) => attempt + 1);
              }}>Try again</button>
            </>
          ) : (
            <p className="studio-storage" role="status">{roster ? "Roster shared across devices." : "Loading guests…"}</p>
          )}
        </aside>

        <AvatarEditor
          key={`${editorRevision}:${activeGuest ? `guest:${activeGuest.id}` : "new"}`}
          guest={activeGuest}
          notice={notice}
          disabled={disabled}
          busy={busy}
          onSave={commitGuest}
          onRemove={deleteGuest}
          onUndo={commitGuest}
          onEdit={() => setNotice(null)}
        />
      </div>
    </div>
  );
}
