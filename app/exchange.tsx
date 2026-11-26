"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import AvatarFields from "./avatar-fields";
import { defaultAvatar, type AvatarLook } from "./avatar-options";
import { createDraw, demoGuests } from "./draw";
import {
  cleanWishlist, emptyWishlist, type DrawStatus, type Guest, type GuestCustomization,
} from "./guest-roster";
import PixelAvatar from "./pixel-avatar";
import { drawRecipient, loadGuestRoster, loadRoster, RosterRequestError, updateRoster, viewRecipient } from "./roster-client";
import WishlistFields from "./wishlist-fields";

type Screen = "welcome" | "guests" | "pull" | "drawing" | "avatar" | "wishlist" | "result";

const pullMessages = [
  { text: "Loading the algorithm…", duration: 800 },
  { text: "Definitely not rigging the results…", duration: 1500 },
  { text: "One last shake…", duration: 750 },
] as const;
const lastPullStep = pullMessages.length - 1;
const recipientCaptions = {
  man: "Your manito",
  woman: "Your manita",
} satisfies Record<AvatarLook["body"], string>;
const drawStatusMessages = {
  closed: "The organizer hasn’t opened the draw yet.",
  "needs-guests": "The draw needs at least two guests.",
  "needs-wishlists": "The draw needs at least one wishlist item from every guest.",
} satisfies Record<Exclude<DrawStatus, "open">, string>;

function GiftScene({ opened = false, shake }: { opened?: boolean; shake?: "soft" | "fast" }) {
  return (
    <div className="gift-scene" data-opened={opened} data-shake={shake} aria-hidden="true">
      <span className="sparkle sparkle-left" />
      <span className="sparkle sparkle-right" />
      <span className="sparkle sparkle-small" />
      <span className="gift" />
    </div>
  );
}

export default function Exchange({ demoDrawOpen }: { demoDrawOpen: boolean }) {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [guests, setGuests] = useState<readonly Guest[]>(demoGuests);
  const [sharedDrawStatus, setSharedDrawStatus] = useState<DrawStatus>("closed");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [sharedHasPulled, setSharedHasPulled] = useState(false);
  const [demoDraw, setDemoDraw] = useState<ReadonlyMap<string, string> | null>(null);
  const [demoPulled, setDemoPulled] = useState<ReadonlySet<string>>(() => new Set());
  const [recipient, setRecipient] = useState<Guest | null>(null);
  const [pullStep, setPullStep] = useState(0);
  const [demoCustomizations, setDemoCustomizations] = useState<Record<string, GuestCustomization>>({});
  const [draftAvatar, setDraftAvatar] = useState<AvatarLook>(defaultAvatar);
  const [draftWishlist, setDraftWishlist] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const previousScreen = useRef<Screen>("welcome");
  const guest = guests.find(({ id }) => id === guestId);
  const isDemo = guests === demoGuests;
  const drawStatus = isDemo ? (demoDrawOpen ? "open" : "closed") : sharedDrawStatus;
  const alreadyPulled = isDemo ? guest !== undefined && demoPulled.has(guest.id) : sharedHasPulled;
  const canPull = drawStatus === "open" && !alreadyPulled;
  const canViewMatch = drawStatus === "open" && alreadyPulled;
  const guestCaption = isDemo ? "Demo guest list" : undefined;

  function customizationFor(entry: Guest): GuestCustomization {
    return isDemo ? demoCustomizations[entry.id] ?? entry : entry;
  }

  const guestCustomization = guest && customizationFor(guest);
  const recipientCustomization = recipient && customizationFor(recipient);
  const guestAvatar = guestCustomization?.avatar;
  const guestWishlist = guestCustomization?.wishlist ?? emptyWishlist;
  const recipientAvatar = recipientCustomization?.avatar;
  const recipientWishlist = recipientCustomization?.wishlist ?? emptyWishlist;

  useEffect(() => {
    if (previousScreen.current !== screen) {
      title.current?.focus();
      previousScreen.current = screen;
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "drawing") return;

    const timer = window.setTimeout(() => {
      if (pullStep === lastPullStep) {
        setScreen("result");
      } else {
        setPullStep(pullStep + 1);
      }
    }, pullMessages[pullStep].duration);

    return () => window.clearTimeout(timer);
  }, [screen, pullStep]);

  async function enterExchange() {
    setError("");
    setBusy(true);
    try {
      const roster = await loadRoster();
      setGuests(roster?.guests.length ? roster.guests : demoGuests);
      setSharedDrawStatus(roster?.drawStatus ?? "closed");
      setGuestId(null);
      setScreen("guests");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t load the guest roster.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guest || busy) return;
    if (isDemo) {
      setScreen("pull");
    } else {
      await checkDrawStatus();
    }
  }

  async function checkDrawStatus() {
    if (!guest) return;
    setError("");
    setBusy(true);
    try {
      const roster = await loadGuestRoster(guest.id);
      if (!roster) throw new Error("The shared roster is unavailable. Try again.");
      setGuests(roster.guests);
      setSharedDrawStatus(roster.drawStatus);
      setSharedHasPulled(roster.hasPulled ?? false);
      if (roster.guests.some(({ id }) => id === guest.id)) {
        setScreen("pull");
      } else {
        returnToGuests();
        setError("This guest is no longer on the roster. Choose your name again.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t check the draw status.");
    } finally {
      setBusy(false);
    }
  }

  async function showMatch(reopen: boolean) {
    if (!guest || busy || (reopen ? !canViewMatch : !canPull)) return;
    setError("");
    setBusy(true);
    try {
      if (isDemo) {
        const draw = demoDraw ?? createDraw(demoGuests);
        setDemoDraw(draw);
        setRecipient(demoGuests.find(({ id }) => id === draw.get(guest.id))!);
        setDemoPulled((pulled) => new Set(pulled).add(guest.id));
      } else {
        setRecipient(await (reopen ? viewRecipient(guest.id) : drawRecipient(guest.id)));
        setSharedHasPulled(true);
      }
      if (reopen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setScreen("result");
      } else {
        setPullStep(0);
        setScreen("drawing");
      }
    } catch (error) {
      if (error instanceof RosterRequestError && error.code === "already-pulled") {
        setSharedHasPulled(true);
        return;
      }
      setError(error instanceof Error ? error.message : "Couldn’t pull a name. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function editWishlist() {
    setDraftWishlist([...guestWishlist]);
    setError("");
    setScreen("wishlist");
  }

  function editAvatar() {
    setDraftAvatar(guestAvatar ?? defaultAvatar);
    setError("");
    setScreen("avatar");
  }

  async function saveCustomization(customization: GuestCustomization) {
    if (!guest) return;

    setError("");
    setBusy(true);
    try {
      if (isDemo) {
        setDemoCustomizations((current) => ({
          ...current,
          [guest.id]: { ...current[guest.id], ...customization },
        }));
      } else {
        const roster = await updateRoster({ action: "edit", id: guest.id, changes: customization });
        setGuests(roster.guests);
        setSharedDrawStatus(roster.drawStatus);
      }
      setScreen("pull");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t save your changes.");
    } finally {
      setBusy(false);
    }
  }

  function returnToGuests() {
    setError("");
    setGuestId(null);
    setSharedHasPulled(false);
    setRecipient(null);
    setScreen("guests");
  }

  function returnToPull() {
    setError("");
    setScreen("pull");
  }

  return (
    <div key={screen} className="card-frame" data-screen={screen}>
      <section className="card" aria-labelledby="exchange-title">
        {screen === "welcome" && (
          <>
            <GiftScene />
            <h1 id="exchange-title" className="welcome-title" ref={title} tabIndex={-1}>
              <span>Manito</span>{" "}
              <span>Manita</span>
            </h1>
            <p className="welcome-caption">Secret Santa</p>
            <button className="game-button" onClick={enterExchange} disabled={busy}>
              {busy ? "Loading guests…" : "Enter"}<span className="button-arrow" aria-hidden="true" />
            </button>
            {error && <p className="customization-error" role="alert">{error}</p>}
          </>
        )}

        {screen === "guests" && (
          <>
            <h1 id="exchange-title" ref={title} tabIndex={-1}>Choose your name</h1>
            {guestCaption && <p className="screen-caption" id="guest-caption">{guestCaption}</p>}
            <form className="guest-form" onSubmit={confirmGuest}>
              <div
                className="guest-list"
                role="radiogroup"
                aria-labelledby="exchange-title"
                aria-describedby={guestCaption ? "guest-caption" : undefined}
              >
                {guests.map((entry) => {
                  const { id, name } = entry;
                  const { avatar } = customizationFor(entry);
                  return (
                    <label className="guest-option" key={id}>
                      <input
                        type="radio"
                        name="guest"
                        value={id}
                        checked={guestId === id}
                        disabled={busy}
                        onChange={() => setGuestId(id)}
                      />
                      <span className="guest-tile">
                        <span className="guest-portrait" aria-hidden="true">
                          {avatar ? <PixelAvatar look={avatar} /> : <span className="guest-initial">{name[0]}</span>}
                        </span>
                        <span className="guest-name">{name}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {error && <p className="customization-error" role="alert">{error}</p>}
              <button className="game-button" type="submit" disabled={!guest || busy}>
                {busy ? "Checking draw…" : "Continue"}<span className="button-arrow" aria-hidden="true" />
              </button>
              <button className="game-button game-button--secondary" type="button" onClick={() => setScreen("welcome")} disabled={busy}>
                Back
              </button>
            </form>
          </>
        )}

        {screen === "pull" && (
          <>
            <GiftScene />
            <h1 id="exchange-title" ref={title} tabIndex={-1}>Ready, {guest?.name}?</h1>
            <button
              className="game-button draw-button"
              onClick={() => showMatch(false)}
              disabled={!canPull || busy}
              aria-describedby={drawStatus === "open" ? undefined : "draw-status"}
            >
              {alreadyPulled ? "Already pulled" : canPull && busy ? "Getting your match…" : "Pull a name"}
              {!canPull && <span className="button-lock" aria-hidden="true" />}
            </button>
            {canViewMatch && (
              <button className="game-button game-button--secondary" onClick={() => showMatch(true)} disabled={busy}>
                {busy ? "Loading your match…" : "View my match"}
              </button>
            )}
            {drawStatus !== "open" && (
              <p id="draw-status" className="screen-caption">
                {drawStatusMessages[drawStatus]}
              </p>
            )}
            {error && <p className="customization-error" role="alert">{error}</p>}
            {drawStatus !== "open" && !isDemo && (
              <button className="game-button game-button--secondary" onClick={checkDrawStatus} disabled={busy}>
                Check draw status
              </button>
            )}
            <button className="game-button game-button--secondary avatar-edit-button" onClick={editAvatar} disabled={busy}>
              {guestAvatar && <PixelAvatar look={guestAvatar} />}
              Edit my avatar
            </button>
            <button className="game-button game-button--secondary" onClick={editWishlist} disabled={busy}>
              {guestWishlist.length ? "Edit my wishlist" : "Add my wishlist"}
            </button>
            <button className="game-button game-button--secondary" onClick={returnToGuests} disabled={busy}>
              Change name
            </button>
          </>
        )}

        {screen === "drawing" && (
          <>
            <h1 id="exchange-title" className="pull-heading" ref={title} tabIndex={-1}>Pulling a name</h1>
            <div className="pull-dialog" role="status" aria-atomic="true">
              <span className="pull-message" key={pullStep}>{pullMessages[pullStep].text}</span>
            </div>
            <GiftScene shake={pullStep === lastPullStep ? "fast" : "soft"} />
          </>
        )}

        {screen === "avatar" && (
          <>
            <h1 id="exchange-title" ref={title} tabIndex={-1}>My avatar</h1>
            <form className="guest-avatar-form" onSubmit={(event) => {
              event.preventDefault();
              saveCustomization({ avatar: draftAvatar });
            }}>
              <figure className="guest-avatar-preview">
                <div className="guest-avatar-window">
                  <PixelAvatar look={draftAvatar} label="Live avatar preview" />
                </div>
                <figcaption>{guest?.name}</figcaption>
              </figure>
              <fieldset className="customization-fields" disabled={busy}>
                <AvatarFields look={draftAvatar} onChange={setDraftAvatar} />
              </fieldset>
              <div className="guest-avatar-actions">
                {error && <p className="customization-error" role="alert">{error}</p>}
                <button className="game-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save avatar"}</button>
                <button className="game-button game-button--secondary" type="button" onClick={returnToPull} disabled={busy}>Back</button>
              </div>
            </form>
          </>
        )}

        {screen === "wishlist" && (
          <>
            <h1 id="exchange-title" ref={title} tabIndex={-1}>My wishlist</h1>
            <p className="screen-caption">Add up to five gift ideas.</p>
            <form className="exchange-wishlist" onSubmit={(event) => {
              event.preventDefault();
              saveCustomization({ wishlist: cleanWishlist(draftWishlist) });
            }}>
              <fieldset className="customization-fields" disabled={busy}>
                <WishlistFields items={draftWishlist} onChange={setDraftWishlist} />
              </fieldset>
              {error && <p className="customization-error" role="alert">{error}</p>}
              <button className="game-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save wishlist"}</button>
              <button className="game-button game-button--secondary" type="button" onClick={returnToPull} disabled={busy}>Back</button>
            </form>
          </>
        )}

        {screen === "result" && (
          <>
            <GiftScene opened />
            <div className="match-ticket">
              {recipientAvatar && (
                <div className="match-avatar"><PixelAvatar look={recipientAvatar} /></div>
              )}
              <h1 id="exchange-title" ref={title} tabIndex={-1}>
                <span className="match-caption">
                  {recipientAvatar ? recipientCaptions[recipientAvatar.body] : "Your gift recipient"}
                </span>
                <span className="match-name">{recipient?.name}</span>
              </h1>
            </div>
            <section className="wishlist-paper result-wishlist" aria-labelledby="result-wishlist-title">
              <h2 id="result-wishlist-title">Wishlist</h2>
              {recipientWishlist.length ? (
                <ol role="list">
                  {recipientWishlist.map((item, index) => (
                    <li key={index}>
                      <span className="wishlist-slot" aria-hidden="true">{index + 1}</span>
                      <span className="wishlist-item">{item}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No gift ideas yet.</p>
              )}
            </section>
            <button className="game-button game-button--secondary" onClick={returnToGuests}>
              {isDemo ? "Back to demo guests" : "Back to guests"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
