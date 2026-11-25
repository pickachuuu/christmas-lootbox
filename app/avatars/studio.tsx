"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useState } from "react";
import AvatarFields from "../avatar-fields";
import { defaultAvatar, type AvatarLook } from "../avatar-options";
import {
  cleanWishlist, emptyWishlist, type Guest, importGuestRoster, maxGuestNameLength,
  parseGuestRoster, removeGuest, saveGuest, serializeGuests, useGuestRoster,
} from "../guest-roster";
import PixelAvatar from "../pixel-avatar";
import WishlistFields from "../wishlist-fields";

type Notice = { text: string; error?: boolean; undo?: Guest };

function AvatarEditor({ guest, notice, onSave, onRemove, onUndo, onEdit }: {
  guest?: Guest;
  notice: Notice | null;
  onSave: (guest: Guest) => boolean;
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    const id = guest?.id ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(36)).join("-");
    if (onSave({ id, name: name.trim(), avatar: look, wishlist: draftWishlist ? cleanWishlist(draftWishlist) : guest?.wishlist })) {
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

      <div className="studio-controls">
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
          <button className="game-button" type="submit" disabled={!name.trim()}>Save avatar</button>
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
      </div>
    </form>
  );
}

export default function Studio() {
  const { guests } = useGuestRoster();
  const [selected, setSelected] = useState<string | null>();
  const [editorRevision, setEditorRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fileNotice, setFileNotice] = useState<Notice | null>(null);
  const activeGuest = selected === undefined ? guests[0] : guests.find(({ id }) => id === selected);

  function chooseGuest(id: string | null) {
    setSelected(id);
    setNotice(null);
  }

  function commitGuest(guest: Guest) {
    try {
      saveGuest(guest);
      setSelected(guest.id);
      setNotice({ text: `Saved ${guest.name}'s avatar on this device.` });
      return true;
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
      return false;
    }
  }

  function deleteGuest(guest: Guest) {
    try {
      removeGuest(guest.id);
      setSelected(undefined);
      setNotice({ text: `Removed ${guest.name}.`, undo: guest });
    } catch (error) {
      setNotice({ text: (error as Error).message, error: true });
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

  async function importRoster(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    try {
      if (file.size > 256_000) throw new Error("Choose a roster file smaller than 256 KB.");
      const content = JSON.parse(await file.text()) as unknown;
      const roster = parseGuestRoster(content);
      importGuestRoster(roster);
      setSelected(roster.guests[0]?.id);
      setEditorRevision((revision) => revision + 1);
      setNotice(null);
      setFileNotice({ text: `Imported ${roster.guests.length} ${roster.guests.length === 1 ? "guest" : "guests"}.` });
    } catch (error) {
      setFileNotice({
        text: error instanceof SyntaxError ? "That file isn’t valid JSON." : (error as Error).message,
        error: true,
      });
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

          <button className="game-button game-button--secondary studio-add" type="button" onClick={() => chooseGuest(null)}>
            <span aria-hidden="true">+</span> Add guest
          </button>

          <div className="studio-file-actions">
            <button className="game-button game-button--secondary" type="button" onClick={exportRoster} disabled={guests.length === 0}>Export JSON</button>
            <label className="game-button game-button--secondary studio-import">
              Import JSON
              <input type="file" accept=".json,application/json" onChange={importRoster} />
            </label>
          </div>
          {fileNotice && (
            <p className="studio-notice" role={fileNotice.error ? "alert" : "status"} data-error={fileNotice.error}>
              {fileNotice.text}
            </p>
          )}
          <p className="studio-storage">Saved in this browser.</p>
        </aside>

        <AvatarEditor
          key={`${editorRevision}:${activeGuest ? `guest:${activeGuest.id}` : "new"}`}
          guest={activeGuest}
          notice={notice}
          onSave={commitGuest}
          onRemove={deleteGuest}
          onUndo={commitGuest}
          onEdit={() => setNotice(null)}
        />
      </div>
    </div>
  );
}
