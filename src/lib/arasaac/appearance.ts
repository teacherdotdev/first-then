// Skin and hair colors for people in ARASAAC pictograms.
//
// The renderer (`GET /v1/pictograms/{id}?skin=…&hair=…`) takes ARASAAC's own names
// (`api`), which we keep out of the UI and out of saved data. The hex values are what
// the renderer paints (verified against the live API), used for the swatches. The plain
// static PNGs are drawn with `light` skin and `brown` hair.
//
// ARASAAC's darkest skin is a medium brown, so the deeper tones (no `api`) are painted
// in the browser instead (see `recolor.ts`). They continue ARASAAC's `dark` in even
// steps of lightness, staying light enough that black outlines and faces still show.
import {
  DEFAULT_SETTINGS,
  type Appearance,
  type HairColor,
  type Language,
  type SkinTone,
} from "#lib/types.ts";

export interface Swatch<Id extends string> {
  id: Id;
  /** ARASAAC's name for this color in the renderer's query string; none if we paint it. */
  api?: string;
  hex: string;
  /** Dark enough that a checkmark on it should be white. */
  dark: boolean;
  label: Record<Language, string>;
}

/** Light to dark. */
export const SKIN_TONES: readonly Swatch<SkinTone>[] = [
  {
    id: "light",
    api: "white",
    hex: "#F5E5DE",
    dark: false,
    label: { en: "Light", es: "Clara" },
  },
  {
    id: "lightGolden",
    api: "assian",
    hex: "#F4ECAD",
    dark: false,
    label: { en: "Light golden", es: "Dorada clara" },
  },
  {
    id: "medium",
    api: "mulatto",
    hex: "#E3AB72",
    dark: false,
    label: { en: "Medium", es: "Media" },
  },
  {
    id: "tan",
    api: "aztec",
    hex: "#CF9D7C",
    dark: false,
    label: { en: "Tan", es: "Morena" },
  },
  {
    id: "dark",
    api: "black",
    hex: "#A65C17",
    dark: true,
    label: { en: "Brown", es: "Marrón" },
  },
  {
    id: "darker",
    hex: "#844B23",
    dark: true,
    label: { en: "Dark brown", es: "Marrón oscuro" },
  },
  {
    id: "deep",
    hex: "#673C1F",
    dark: true,
    label: { en: "Deep brown", es: "Marrón intenso" },
  },
  {
    id: "deepest",
    hex: "#4C2E19",
    dark: true,
    label: { en: "Darkest brown", es: "Marrón muy oscuro" },
  },
];

export const HAIR_COLORS: readonly Swatch<HairColor>[] = [
  {
    id: "blonde",
    api: "blonde",
    hex: "#FDD700",
    dark: false,
    label: { en: "Blonde", es: "Rubio" },
  },
  {
    id: "red",
    api: "red",
    hex: "#ED4120",
    dark: true,
    label: { en: "Red", es: "Pelirrojo" },
  },
  {
    id: "brown",
    api: "brown",
    hex: "#A65E26",
    dark: true,
    label: { en: "Brown", es: "Castaño" },
  },
  {
    id: "darkBrown",
    api: "darkBrown",
    hex: "#6A2703",
    dark: true,
    label: { en: "Dark brown", es: "Castaño oscuro" },
  },
  {
    id: "black",
    api: "black",
    hex: "#020100",
    dark: true,
    label: { en: "Black", es: "Negro" },
  },
  {
    id: "gray",
    api: "darkGray",
    hex: "#AAABAB",
    dark: false,
    label: { en: "Gray", es: "Gris" },
  },
  {
    id: "white",
    api: "gray",
    hex: "#EFEFEF",
    dark: false,
    label: { en: "White", es: "Blanco" },
  },
];

const DEFAULT = DEFAULT_SETTINGS.appearance;

export function skinSwatch(id: SkinTone): Swatch<SkinTone> {
  return SKIN_TONES.find((s) => s.id === id) ?? SKIN_TONES[0];
}

export function hairSwatch(id: HairColor): Swatch<HairColor> {
  return HAIR_COLORS.find((s) => s.id === id) ?? HAIR_COLORS[0];
}

export function isSkinTone(value: unknown): value is SkinTone {
  return SKIN_TONES.some((s) => s.id === value);
}

export function isHairColor(value: unknown): value is HairColor {
  return HAIR_COLORS.some((s) => s.id === value);
}

/** The recoloring one pictogram needs: only valid, non-default colors are kept. */
export type PictogramLook = Partial<Appearance>;

/** Whether a look needs a skin tone ARASAAC's renderer can't draw. */
export function needsRecolor(look: PictogramLook): boolean {
  return look.skin !== undefined && !skinSwatch(look.skin).api;
}

export function pictogramLook(skin: unknown, hair: unknown): PictogramLook {
  const look: PictogramLook = {};
  if (isSkinTone(skin) && skin !== DEFAULT.skin) look.skin = skin;
  if (isHairColor(hair) && hair !== DEFAULT.hair) look.hair = hair;
  return look;
}
