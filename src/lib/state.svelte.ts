// Reactive app state (Svelte 5 runes) persisted to localStorage.
// Everything loads synchronously from localStorage at startup, so a backup import
// that writes these keys and reloads the page is picked up automatically.
import {
  DEFAULT_SETTINGS,
  emptyBoard,
  MAX_SLOTS,
  SLOT_COUNTS,
  STORAGE_KEYS,
  symbolKey,
  type BoardState,
  type Settings,
  type SlotCount,
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
  if (!isRecord(value)) return emptyBoard();
  // Boards saved before 3- and 4-step layouts were `{ first, then, firstDone }`.
  const rawSlots: unknown[] = Array.isArray(value.slots)
    ? value.slots
    : [value.first, value.then];
  const rawDone: unknown[] = Array.isArray(value.done)
    ? value.done
    : [value.firstDone];
  const slots = Array.from({ length: MAX_SLOTS }, (_, i) =>
    toSymbolRef(rawSlots[i]),
  );
  return {
    slots,
    done: slots.map((ref, i) => ref !== null && rawDone[i] === true),
  };
}

function isSlotCount(value: unknown): value is SlotCount {
  return SLOT_COUNTS.includes(value as SlotCount);
}

function toHeadings(value: unknown, n: SlotCount): string[] {
  const list = Array.isArray(value) ? value : [];
  return DEFAULT_SETTINGS.headings[n].map((fallback, i) =>
    typeof list[i] === "string"
      ? (list[i] as string).slice(0, MAX_HEADING_LENGTH)
      : fallback,
  );
}

function toSettings(value: unknown): Settings {
  const raw: Record<string, unknown> = isRecord(value) ? value : {};
  const saved = isRecord(raw.headings) ? raw.headings : {};
  // Settings saved before 3- and 4-step layouts had two flat heading fields.
  const legacy = [raw.firstHeading, raw.thenHeading];
  return {
    slotCount: isSlotCount(raw.slotCount)
      ? raw.slotCount
      : DEFAULT_SETTINGS.slotCount,
    headings: {
      2: toHeadings(saved[2] ?? legacy, 2),
      3: toHeadings(saved[3], 3),
      4: toHeadings(saved[4], 4),
    },
    language:
      raw.language === "en" || raw.language === "es"
        ? raw.language
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

/** Copy of `list` with one item swapped (`Array#with` is too new for older iPads). */
function replaceAt<T>(list: T[], index: number, item: T): T[] {
  const copy = [...list];
  copy[index] = item;
  return copy;
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

/** The heading text to show over a step, falling back to the default when left blank. */
export function headingFor(settings: Settings, index: number): string {
  const n = settings.slotCount;
  return (
    settings.headings[n][index]?.trim() || DEFAULT_SETTINGS.headings[n][index]
  );
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

  /** The steps currently shown on the board. */
  get visibleSlots(): (SymbolRef | null)[] {
    return this.board.slots.slice(0, this.settings.slotCount);
  }

  /** Every shown step but the last (the reward) can be tapped as done. */
  canMarkDone(index: number): boolean {
    return index < this.settings.slotCount - 1;
  }

  /** Put a symbol in a slot and remember it in recents. */
  setSlot(index: number, ref: SymbolRef): void {
    const placed = { ...ref };
    this.#writeSlot(index, placed);
    this.addRecent(placed);
  }

  clearSlot(index: number): void {
    this.#writeSlot(index, null);
  }

  /** Empties every slot, including ones hidden by a smaller layout. */
  clearBoard(): void {
    this.board = emptyBoard();
    this.#saveBoard();
  }

  /** Put back a board saved earlier (used for "Undo" after Clear). */
  restoreBoard(board: BoardState): void {
    this.board = toBoard($state.snapshot(board));
    this.#saveBoard();
  }

  toggleDone(index: number): void {
    if (!this.board.slots[index] || !this.canMarkDone(index)) return;
    const done = replaceAt(this.board.done, index, !this.board.done[index]);
    this.board = { ...this.board, done };
    this.#saveBoard();
  }

  /** Change the word under a slot's symbol (also remembered in recents/favorites). */
  setLabel(index: number, label: string): void {
    const ref = this.board.slots[index];
    if (!ref) return;
    const clean = label.trim().slice(0, MAX_LABEL_LENGTH);
    this.board = {
      ...this.board,
      slots: replaceAt(this.board.slots, index, { ...ref, label: clean }),
    };
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

    if (this.board.slots.some(matches)) {
      this.board = {
        slots: this.board.slots.map((item) => (matches(item) ? null : item)),
        done: this.board.done.map(
          (done, i) => done && !matches(this.board.slots[i]),
        ),
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

  /** Change one heading word in the current layout. */
  setHeading(index: number, text: string): void {
    const n = this.settings.slotCount;
    const headings = $state.snapshot(this.settings.headings);
    headings[n] = replaceAt(headings[n], index, text);
    this.updateSettings({ headings });
  }

  /** Put the current layout's headings back to the defaults. */
  resetHeadings(): void {
    const n = this.settings.slotCount;
    const headings = $state.snapshot(this.settings.headings);
    headings[n] = [...DEFAULT_SETTINGS.headings[n]];
    this.updateSettings({ headings });
  }

  // --- persistence ----------------------------------------------------------

  /** Replace one slot; a new or removed symbol always starts not done. */
  #writeSlot(index: number, ref: SymbolRef | null): void {
    this.board = {
      slots: replaceAt(this.board.slots, index, ref),
      done: replaceAt(this.board.done, index, false),
    };
    this.#saveBoard();
  }

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
