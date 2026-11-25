import { maxWishLength, maxWishlistItems } from "./guest-roster";

const slots = Array.from({ length: maxWishlistItems }, (_, index) => index);

export default function WishlistFields({ items, onChange }: {
  items: readonly string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="wishlist-paper wishlist-inputs">
      {slots.map((index) => (
        <label className="wishlist-input" key={index}>
          <span className="wishlist-slot" aria-hidden="true">{index + 1}</span>
          <input
            type="text"
            aria-label={`Gift idea ${index + 1}`}
            maxLength={maxWishLength}
            autoComplete="off"
            value={items[index] ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onChange(slots.map((slot) => slot === index ? value : items[slot] ?? ""));
            }}
          />
        </label>
      ))}
    </div>
  );
}
