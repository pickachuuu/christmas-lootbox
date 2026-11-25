"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import AvatarFields from "./avatar-fields";
import { defaultAvatar, type AvatarLook } from "./avatar-options";
import { createDraw, demoGuests } from "./draw";
import {
  cleanWishlist, emptyWishlist, type Guest, type GuestCustomization,
  saveGuestCustomization, useGuestRoster,
} from "./guest-roster";
import PixelAvatar from "./pixel-avatar";
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

export default function Exchange({ drawOpen }: { drawOpen: boolean }) {
  const roster = useGuestRoster();
  const [requestedScreen, setScreen] = useState<Screen>("welcome");
  const [guests, setGuests] = useState<readonly Guest[]>(demoGuests);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [draw, setDraw] = useState<ReadonlyMap<string, string> | null>(null);
  const [pullStep, setPullStep] = useState(0);
  const [demoCustomizations, setDemoCustomizations] = useState<Record<string, GuestCustomization>>({});
  const [draftAvatar, setDraftAvatar] = useState<AvatarLook>(defaultAvatar);
  const [draftWishlist, setDraftWishlist] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const previousScreen = useRef<Screen>("welcome");
  const canPull = drawOpen && guests.length >= 2;
  const screen = !canPull && (requestedScreen === "drawing" || requestedScreen === "result")
    ? "pull"
    : requestedScreen;
  const guest = guests.find(({ id }) => id === guestId);
  const recipientId = guestId ? draw?.get(guestId) : undefined;
  const recipient = guests.find(({ id }) => id === recipientId);
  const isDemo = guests === demoGuests;
  const guestCaption = isDemo ? "Demo guest list" : undefined;

  function customizationFor(entry: Guest): GuestCustomization {
    if (isDemo) return demoCustomizations[entry.id] ?? entry;
    return roster.guests.find(({ id }) => id === entry.id) ?? entry;
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

  function enterExchange() {
    const nextGuests = roster.guests.length ? roster.guests : demoGuests;
    if (draw && (draw.size !== nextGuests.length || nextGuests.some(({ id }) => !draw.has(id)))) {
      setDraw(null);
    }
    setGuests(nextGuests);
    setGuestId(null);
    setScreen("guests");
  }

  function confirmGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (guest) setScreen("pull");
  }

  function pullName() {
    if (!canPull || !guest) return;
    if (!draw) setDraw(createDraw(guests));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setScreen("result");
    } else {
      setPullStep(0);
      setScreen("drawing");
    }
  }

  function editWishlist() {
    setDraftWishlist([...guestWishlist]);
    setSaveError("");
    setScreen("wishlist");
  }

  function editAvatar() {
    setDraftAvatar(guestAvatar ?? defaultAvatar);
    setSaveError("");
    setScreen("avatar");
  }

  function saveCustomization(customization: GuestCustomization) {
    if (!guest) return;

    try {
      if (isDemo) {
        setDemoCustomizations((current) => ({
          ...current,
          [guest.id]: { ...current[guest.id], ...customization },
        }));
      } else {
        saveGuestCustomization(guest.id, customization);
      }
      setScreen("pull");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Couldn’t save your changes.");
    }
  }

  function returnToGuests() {
    setGuestId(null);
    setScreen("guests");
  }

  return (
    <div key={screen} className="card-frame" data-screen={screen}>
      <section className="card" aria-labelledby="exchange-title">
        {screen === "welcome" && (
          <>
            <GiftScene />
            <h1 id="exchange-title" className="welcome-title" ref={title} tabIndex={-1}>
              <span>Santa</span>{" "}
              <span>Shuffle</span>
            </h1>
            <p className="welcome-caption">Secret Santa</p>
            <button className="game-button" onClick={enterExchange}>
              Enter<span className="button-arrow" aria-hidden="true" />
            </button>
            <Link className="game-button game-button--secondary" href="/avatars">Avatar Studio</Link>
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
              <button className="game-button" type="submit" disabled={!guest}>
                Continue<span className="button-arrow" aria-hidden="true" />
              </button>
              <button className="game-button game-button--secondary" type="button" onClick={() => setScreen("welcome")}>
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
              onClick={pullName}
              disabled={!canPull}
              aria-describedby={canPull ? undefined : "draw-status"}
            >
              Pull a name
              {!canPull && <span className="button-lock" aria-hidden="true" />}
            </button>
            {!canPull && (
              <p id="draw-status" className="screen-caption">
                {drawOpen ? "The draw needs at least two guests." : "The draw opens after the grace period."}
              </p>
            )}
            <button className="game-button game-button--secondary avatar-edit-button" onClick={editAvatar}>
              {guestAvatar && <PixelAvatar look={guestAvatar} />}
              Edit my avatar
            </button>
            <button className="game-button game-button--secondary" onClick={editWishlist}>
              {guestWishlist.length ? "Edit my wishlist" : "Add my wishlist"}
            </button>
            <button className="game-button game-button--secondary" onClick={() => setScreen("guests")}>
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
              <AvatarFields look={draftAvatar} onChange={setDraftAvatar} />
              <div className="guest-avatar-actions">
                {saveError && <p className="customization-error" role="alert">{saveError}</p>}
                <button className="game-button" type="submit">Save avatar</button>
                <button className="game-button game-button--secondary" type="button" onClick={() => setScreen("pull")}>Back</button>
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
              <WishlistFields items={draftWishlist} onChange={setDraftWishlist} />
              {saveError && <p className="customization-error" role="alert">{saveError}</p>}
              <button className="game-button" type="submit">Save wishlist</button>
              <button className="game-button game-button--secondary" type="button" onClick={() => setScreen("pull")}>Back</button>
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
