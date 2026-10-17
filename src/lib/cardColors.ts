// Card colors teachers can give each step, e.g. a red FIRST and a green THEN like a
// paper board. Every color keeps the big dark heading readable (at least 3.9:1).
import type { CardColor } from "#lib/types.ts";

export interface CardColorSwatch {
  id: CardColor;
  label: string;
  hex: string;
}

export const CARD_COLORS: readonly CardColorSwatch[] = [
  { id: "white", label: "White", hex: "#ffffff" },
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "orange", label: "Orange", hex: "#fb923c" },
  { id: "yellow", label: "Yellow", hex: "#facc15" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "blue", label: "Blue", hex: "#60a5fa" },
  { id: "purple", label: "Purple", hex: "#c084fc" },
  { id: "pink", label: "Pink", hex: "#f472b6" },
];

export function isCardColor(value: unknown): value is CardColor {
  return CARD_COLORS.some((swatch) => swatch.id === value);
}

export function cardColorHex(color: CardColor): string {
  return CARD_COLORS.find((swatch) => swatch.id === color)?.hex ?? "#ffffff";
}
