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

export type SlotName = "first" | "then";

export interface BoardState {
  first: SymbolRef | null;
  then: SymbolRef | null;
  /** True once the FIRST activity has been tapped as done (shows a big checkmark). */
  firstDone: boolean;
}

export type Language = "en" | "es";

export interface Settings {
  /** Header word over the left slot. */
  firstHeading: string;
  /** Header word over the right slot. */
  thenHeading: string;
  /** Language used for ARASAAC search and keywords. */
  language: Language;
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
  firstHeading: "FIRST",
  thenHeading: "THEN",
  language: "en",
};

export const EMPTY_BOARD: BoardState = {
  first: null,
  then: null,
  firstDone: false,
};

/** Key identifying a symbol regardless of its label (for de-duping recents/favorites). */
export function symbolKey(ref: SymbolRef): string {
  return `${ref.kind}:${ref.id}`;
}
