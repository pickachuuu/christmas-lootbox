export const bodyTypes = {
  man: "Man",
  woman: "Woman",
} as const;

export const outfitColors = {
  cranberry: { label: "Cranberry", base: "#a94856", light: "#e27a73", shade: "#72384c" },
  evergreen: { label: "Evergreen", base: "#467e48", light: "#78ac64", shade: "#2e5838" },
  teal: { label: "Teal", base: "#378b77", light: "#69c2a1", shade: "#245f60" },
  blue: { label: "Blue", base: "#486db5", light: "#81a2e6", shade: "#324c80" },
  plum: { label: "Plum", base: "#805099", light: "#b887d1", shade: "#553566" },
  pink: { label: "Pink", base: "#c46897", light: "#ed9abf", shade: "#884669" },
  gold: { label: "Gold", base: "#c38c37", light: "#f3c670", shade: "#885b29" },
  cream: { label: "Cream", base: "#deceaa", light: "#fff0cc", shade: "#ab916f" },
} as const;

export const skinTones = {
  porcelain: { label: "Porcelain", base: "#f7d3b4", light: "#ffe5cc", shade: "#dd9d7e" },
  peach: { label: "Peach", base: "#edb58c", light: "#ffd2a9", shade: "#cc8768" },
  sand: { label: "Sand", base: "#dba47b", light: "#f6bf96", shade: "#ad6f53" },
  honey: { label: "Honey", base: "#c58959", light: "#e2a671", shade: "#9a5b3e" },
  olive: { label: "Olive", base: "#ad815a", light: "#c99e71", shade: "#825b43" },
  copper: { label: "Copper", base: "#a26342", light: "#c7865d", shade: "#763e32" },
  cocoa: { label: "Cocoa", base: "#7e4a36", light: "#a46849", shade: "#583029" },
  ebony: { label: "Ebony", base: "#5d3934", light: "#865442", shade: "#3d2626" },
} as const;

export const hairStyleGroups = [
  { label: "Short", keys: ["crop", "lowFade", "side", "middle", "quiff", "pixie"] },
  { label: "Curls", keys: ["curls", "curlyFade", "messy", "afro", "puffs"] },
  { label: "Bobs & long hair", keys: ["bob", "lob", "long", "waves", "curtain"] },
  { label: "Ponytails & braids", keys: ["ponytail", "bun", "braid", "twinBraids"] },
  { label: "Shaved", keys: ["buzz", "bald"] },
] as const;

type Hairstyle = (typeof hairStyleGroups)[number]["keys"][number];

export const hairStyles = Object.fromEntries(
  hairStyleGroups.flatMap(({ keys }) => keys.map((key, index) => [key, `Hair ${index + 1}`])),
) as Record<Hairstyle, string>;

export const hairColors = {
  ink: { label: "Black", base: "#302a33", light: "#59505b", shade: "#211d29" },
  coffee: { label: "Dark brown", base: "#51382f", light: "#79523d", shade: "#37282a" },
  chestnut: { label: "Chestnut", base: "#7e4935", light: "#aa6744", shade: "#573332" },
  copper: { label: "Ginger", base: "#a85639", light: "#d47d4c", shade: "#753b34" },
  gold: { label: "Blond", base: "#c69853", light: "#ecc778", shade: "#8d633a" },
  silver: { label: "Silver", base: "#a5a8b1", light: "#d4d6df", shade: "#747581" },
  rose: { label: "Rose", base: "#a45373", light: "#d57b9b", shade: "#763a59" },
  teal: { label: "Teal", base: "#34847e", light: "#69b3a1", shade: "#2a5457" },
} as const;

export const eyewearOptions = {
  none: "None",
  round: "Round glasses",
  square: "Square glasses",
  shades: "Sunglasses",
  stars: "Star glasses",
} as const;

export const headwearOptions = {
  none: "None",
  santa: "Santa hat",
  elf: "Elf hat",
  beanie: "Knit beanie",
  antlers: "Reindeer antlers",
  holly: "Holly crown",
  crown: "Gold crown",
} as const;

export const accessoryOptions = {
  none: "None",
  hoops: "Gold hoops",
  candy: "Candy cane earrings",
  scarf: "Striped scarf",
  bowTie: "Bow tie",
  headphones: "Headphones",
  giftPin: "Gift pin",
} as const;

export const faceDetails = {
  none: "None",
  freckles: "Freckles",
  blush: "Rosy cheeks",
  mustache: "Mustache",
  beard: "Beard",
  bandage: "Nose bandage",
  mole: "Beauty mark",
  stud: "Nose stud",
  goatee: "Goatee",
} as const;

export type AvatarLook = {
  body: keyof typeof bodyTypes;
  outfit: keyof typeof outfitColors;
  skin: keyof typeof skinTones;
  hair: keyof typeof hairStyles;
  color: keyof typeof hairColors;
  eyewear: keyof typeof eyewearOptions;
  headwear: keyof typeof headwearOptions;
  accessory: keyof typeof accessoryOptions;
  detail: keyof typeof faceDetails;
};

export const defaultAvatar: AvatarLook = {
  body: "man",
  outfit: "cranberry",
  skin: "honey",
  hair: "side",
  color: "coffee",
  eyewear: "none",
  headwear: "none",
  accessory: "none",
  detail: "none",
};

const choices = {
  body: bodyTypes,
  outfit: outfitColors,
  skin: skinTones,
  hair: hairStyles,
  color: hairColors,
  eyewear: eyewearOptions,
  headwear: headwearOptions,
  accessory: accessoryOptions,
  detail: faceDetails,
} satisfies Record<keyof AvatarLook, object>;

export function parseAvatarLook(value: unknown): AvatarLook | null {
  if (typeof value !== "object" || value === null) return null;
  const { headwear, accessory } = defaultAvatar;
  const look: Record<string, unknown> = { headwear, accessory, ...value };
  if (look.outfit === undefined) look.outfit = look.body === "woman" ? "teal" : defaultAvatar.outfit;
  if (look.hair === "highFade") look.hair = "lowFade";

  const fields = Object.entries(choices);
  const valid = fields.every(([part, options]) => {
    const selection = look[part];
    return typeof selection === "string" && Object.hasOwn(options, selection);
  });
  return valid ? Object.fromEntries(fields.map(([part]) => [part, look[part]])) as AvatarLook : null;
}
