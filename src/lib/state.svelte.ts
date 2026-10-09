// Reactive app state (Svelte 5 runes) persisted to localStorage.
// Everything loads synchronously from localStorage at startup, so a backup import
// that writes these keys and reloads the page is picked up automatically.
import {
  DEFAULT_SETTINGS,
  EMPTY_BOARD,
  STORAGE_KEYS,
  symbolKey,
  type BoardState,
  type Settings,
  type SlotName,
  type SymbolRef,
} from "#lib/types.ts";

export const MAX_RECENTS = 24;
export const MAX_LABEL_LENGTH = 40;
export const MAX_HEADING_LENGTH = 16;

// ---------------------------------------------------------------------------
// Validation: anything read from storage is untrusted (old versions, manual
// edits, corrupt backups), so each shape is checked and repaired.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSymbolRef(value: unknown): SymbolRef | null {
  if (!isRecord(value)) return null;
  const label = typeof value.label === "string" ? value.label : "";
  if (
    value.kind === "arasaac" &&
    typeof value.id === "number" &&
    Number.isFinite(value.id)
  ) {
    return { kind: "arasaac", id: value.id, label };
  }
  if (value.kind === "upload" && typeof value.id === "string" && value.id) {
    return { kind: "upload", id: value.id, label };
  }
  return null;
}

function toBoard(value: unknown): BoardState {
  if (!isRecord(value)) return { ...EMPTY_BOARD };
  const first = toSymbolRef(value.first);
  return {
    first,
    then: toSymbolRef(value.then),
    firstDone: first !== null && value.firstDone === true,
  };
}

function toSettings(value: unknown): Settings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS };
  return {
    firstHeading:
      typeof value.firstHeading === "string"
        ? value.firstHeading.slice(0, MAX_HEADING_LENGTH)
        : DEFAULT_SETTINGS.firstHeading,
    thenHeading:
      typeof value.thenHeading === "string"
        ? value.thenHeading.slice(0, MAX_HEADING_LENGTH)
        : DEFAULT_SETTINGS.thenHeading,
    language:
      value.language === "en" || value.language === "es"
        ? value.language
        : DEFAULT_SETTINGS.language,
  };
}

function toSymbolList(value: unknown, max = Infinity): SymbolRef[] {
  if (!Array.isArray(value)) return [];
  // Plain local Set used only while parsing; it is never reactive state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const seen = new Set<string>();
  const list: SymbolRef[] = [];
  for (const item of value) {
    const ref = toSymbolRef(item);
    if (!ref) continue;
    const key = symbolKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(ref);
    if (list.length >= max) break;
  }
  return list;
}

// ---------------------------------------------------------------------------
// localStorage helpers (storage can throw in private mode / when full / when
// blocked, and its contents can be corrupt).

function load<T>(key: string, parse: (value: unknown) => T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // Storage unavailable: fall through to defaults.
  }
  if (raw === null) return parse(undefined);
  try {
    return parse(JSON.parse(raw));
  } catch {
    return parse(undefined);
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the app keeps working for this session.
  }
}

// ---------------------------------------------------------------------------

/** The heading text to show, falling back to the default when left blank. */
export function headingFor(settings: Settings, slot: SlotName): string {
  const value = slot === "first" ? settings.firstHeading : settings.thenHeading;
  const fallback =
    slot === "first"
      ? DEFAULT_SETTINGS.firstHeading
      : DEFAULT_SETTINGS.thenHeading;
  return value.trim() || fallback;
}

class AppState {
  board = $state<BoardState>(load(STORAGE_KEYS.board, toBoard));
  settings = $state<Settings>(load(STORAGE_KEYS.settings, toSettings));
  recents = $state<SymbolRef[]>(
    load(STORAGE_KEYS.recents, (v) => toSymbolList(v, MAX_RECENTS)),
  );
  favorites = $state<SymbolRef[]>(
    load(STORAGE_KEYS.favorites, (v) => toSymbolList(v)),
  );

  #favoriteKeys = $derived(new Set(this.favorites.map(symbolKey)));

  // --- board -------------------------------------------------------------

  /** Put a symbol in a slot and remember it in recents. */
  setSlot(slot: SlotName, ref: SymbolRef): void {
    const placed = { ...ref };
    if (slot === "first") {
      this.board = { ...this.board, first: placed, firstDone: false };
    } else {
      this.board = { ...this.board, then: placed };
    }
    this.#saveBoard();
    this.addRecent(placed);
  }

  clearSlot(slot: SlotName): void {
    if (slot === "first") {
      this.board = { ...this.board, first: null, firstDone: false };
    } else {
      this.board = { ...this.board, then: null };
    }
    this.#saveBoard();
  }

  clearBoard(): void {
    this.board = { ...EMPTY_BOARD };
    this.#saveBoard();
  }

  /** Put back a board saved earlier (used for "Undo" after Clear). */
  restoreBoard(board: BoardState): void {
    this.board = toBoard($state.snapshot(board));
    this.#saveBoard();
  }

  toggleFirstDone(): void {
    if (!this.board.first) return;
    this.board = { ...this.board, firstDone: !this.board.firstDone };
    this.#saveBoard();
  }

  /** Change the word under a slot's symbol (also remembered in recents/favorites). */
  setLabel(slot: SlotName, label: string): void {
    const ref = this.board[slot];
    if (!ref) return;
    const clean = label.trim().slice(0, MAX_LABEL_LENGTH);
    this.board = { ...this.board, [slot]: { ...ref, label: clean } };
    this.#saveBoard();

    const key = symbolKey(ref);
    const relabel = (list: SymbolRef[]) =>
      list.map((item) =>
        symbolKey(item) === key ? { ...item, label: clean } : item,
      );
    this.recents = relabel(this.recents);
    this.favorites = relabel(this.favorites);
    this.#saveRecents();
    this.#saveFavorites();
  }

  // --- recents & favorites --------------------------------------------------

  addRecent(ref: SymbolRef): void {
    const key = symbolKey(ref);
    this.recents = [
      { ...ref },
      ...this.recents.filter((item) => symbolKey(item) !== key),
    ].slice(0, MAX_RECENTS);
    this.#saveRecents();
  }

  clearRecents(): void {
    this.recents = [];
    this.#saveRecents();
  }

  isFavorite(ref: SymbolRef): boolean {
    return this.#favoriteKeys.has(symbolKey(ref));
  }

  toggleFavorite(ref: SymbolRef): void {
    const key = symbolKey(ref);
    if (this.isFavorite(ref)) {
      this.favorites = this.favorites.filter((item) => symbolKey(item) !== key);
    } else {
      this.favorites = [{ ...ref }, ...this.favorites];
    }
    this.#saveFavorites();
  }

  /** Take a symbol off the board and out of recents and favorites (e.g. a deleted photo). */
  forgetSymbol(ref: SymbolRef): void {
    const key = symbolKey(ref);
    const matches = (item: SymbolRef | null) =>
      item !== null && symbolKey(item) === key;

    if (matches(this.board.first) || matches(this.board.then)) {
      const firstGone = matches(this.board.first);
      this.board = {
        first: firstGone ? null : this.board.first,
        then: matches(this.board.then) ? null : this.board.then,
        firstDone: firstGone ? false : this.board.firstDone,
      };
      this.#saveBoard();
    }
    if (this.recents.some(matches)) {
      this.recents = this.recents.filter((item) => !matches(item));
      this.#saveRecents();
    }
    if (this.favorites.some(matches)) {
      this.favorites = this.favorites.filter((item) => !matches(item));
      this.#saveFavorites();
    }
  }

  // --- settings -------------------------------------------------------------

  updateSettings(patch: Partial<Settings>): void {
    this.settings = toSettings({ ...$state.snapshot(this.settings), ...patch });
    save(STORAGE_KEYS.settings, $state.snapshot(this.settings));
  }

  // --- persistence ----------------------------------------------------------

  #saveBoard(): void {
    save(STORAGE_KEYS.board, $state.snapshot(this.board));
  }

  #saveRecents(): void {
    save(STORAGE_KEYS.recents, $state.snapshot(this.recents));
  }

  #saveFavorites(): void {
    save(STORAGE_KEYS.favorites, $state.snapshot(this.favorites));
  }
}

/** The single app-wide state instance. */
export const app = new AppState();
