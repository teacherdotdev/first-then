// Shared contracts between the board UI, the ARASAAC integration and user uploads.
// Change these only with care: board state, recents/favorites and backup files all
// persist these shapes.

/** A symbol placed on the board, in recents, or in favorites. */
export type SymbolRef =
  | {
      kind: "arasaac";
      /** ARASAAC pictogram id (`_id` from the API). */
      id: number;
      /** Word shown under the symbol. Starts as the ARASAAC keyword; teacher may edit. */
      label: string;
    }
  | {
      kind: "upload";
      /** Id of the image record in IndexedDB (see `#lib/uploads/db`). */
      id: string;
      /** Word shown under the symbol. Starts as the upload's name; teacher may edit. */
      label: string;
    };

/** How many steps the board shows, left to right. */
export type SlotCount = 2 | 3 | 4;

export const SLOT_COUNTS: readonly SlotCount[] = [2, 3, 4];
export const MAX_SLOTS = 4;

export interface BoardState {
  /**
   * Symbols in board order, always `MAX_SLOTS` long. Only the first `slotCount` are
   * shown; the rest are kept so switching layouts back and forth loses nothing.
   */
  slots: (SymbolRef | null)[];
  /** Steps tapped as done (shows a big checkmark). The last shown step never is. */
  done: boolean[];
}

export type Language = "en" | "es";

export interface Settings {
  slotCount: SlotCount;
  /** Header words over each step, kept separately for each layout. */
  headings: Record<SlotCount, string[]>;
  /** Language used for ARASAAC search and keywords. */
  language: Language;
  /** Board shown on black, with ARASAAC symbols as bright line drawings. */
  highContrast: boolean;
}

/** A photo or picture the teacher uploaded, stored only on this device. */
export interface UploadRecord {
  id: string;
  /** Default label, e.g. "Mom" or "trampoline". */
  name: string;
  /** Resized image (JPEG or PNG), max ~512px on the long edge. */
  blob: Blob;
  createdAt: number;
}

/** Stable keys for small JSON state in localStorage. */
export const STORAGE_KEYS = {
  board: "first-then:board",
  settings: "first-then:settings",
  recents: "first-then:recents",
  favorites: "first-then:favorites",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  slotCount: 2,
  headings: {
    2: ["FIRST", "THEN"],
    3: ["FIRST", "NEXT", "THEN"],
    4: ["FIRST", "NEXT", "THEN", "LAST"],
  },
  language: "en",
  highContrast: false,
};

export function emptyBoard(): BoardState {
  return {
    slots: Array.from({ length: MAX_SLOTS }, () => null),
    done: Array.from({ length: MAX_SLOTS }, () => false),
  };
}

/** Key identifying a symbol regardless of its label (for de-duping recents/favorites). */
export function symbolKey(ref: SymbolRef): string {
  return `${ref.kind}:${ref.id}`;
}
