// ARASAAC pictogram search (https://arasaac.org, API docs: https://api.arasaac.org/developers/api).
//
// Pictograms are CC BY-NC-SA, property of the Government of Aragón, author Sergio Palao.
// Images are always loaded from ARASAAC at runtime; never bundle them in this repo.
//
// API notes (verified against the live API):
// - `GET /v1/pictograms/{locale}/bestsearch/{text}`: tight, relevance-ordered matches.
// - `GET /v1/pictograms/{locale}/search/{text}`: broad matches. Common words return huge
//   payloads (e.g. "work" ≈ 1900 results / 1.2 MB, uncompressed), so we only use it
//   when bestsearch finds little, or when the teacher asks for more results.
// - Both return 404 with body `[]` when nothing matches, and send
//   `Access-Control-Allow-Origin: *`.
// - Images: `static.arasaac.org` serves pre-rendered PNGs (300/500/2500 px) from nginx
//   with ETag/Last-Modified and CORS `*`; much faster and more cacheable than the
//   dynamic `/v1/pictograms/{id}` renderer (`Cache-Control: max-age=0`).
import type { Language } from "#lib/types.ts";

export interface ArasaacResult {
  id: number;
  /** Best keyword for the requested language, used as the default label. */
  keyword: string;
}

/** Why a search failed, so the UI can show a friendly, localized message. */
export type ArasaacErrorKind = "offline" | "server";

export class ArasaacSearchError extends Error {
  readonly kind: ArasaacErrorKind;
  constructor(kind: ArasaacErrorKind, message: string) {
    super(message);
    this.name = "ArasaacSearchError";
    this.kind = kind;
  }
}

export interface SearchOptions {
  /** Also include broad `search` matches (slower for common words). */
  more?: boolean;
}

const API = "https://api.arasaac.org/v1/pictograms";
const MAX_RESULTS = 60;
const MAX_RESULTS_MORE = 120;
/** When bestsearch finds fewer than this, merge in broad search results automatically. */
const FEW_RESULTS = 6;
const TIMEOUT_MS = 15000;
const CACHE_SIZE = 60;

interface RawKeyword {
  keyword?: string;
  plural?: string;
}

interface RawPictogram {
  _id: number;
  keywords?: RawKeyword[];
  violence?: boolean;
  sex?: boolean;
}

/** Trim, lower-case, collapse whitespace and drop characters that break the URL path. */
export function normalizeQuery(query: string): string {
  return query
    .replace(/[/\\?#%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 60);
}

/** Lower-case and strip accents so "bano" matches "baño". */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** 0 = exact, 1 = starts with query, 2 = contains query as a word start, 3 = contains, 4 = other. */
function matchScore(keyword: string, foldedQuery: string): number {
  const k = fold(keyword);
  if (k === foldedQuery) return 0;
  if (k.startsWith(foldedQuery)) return 1;
  if (k.includes(" " + foldedQuery)) return 2;
  if (k.includes(foldedQuery)) return 3;
  return 4;
}

interface Scored extends ArasaacResult {
  score: number;
  order: number;
}

function toResult(
  p: RawPictogram,
  foldedQuery: string,
  order: number,
): Scored | null {
  if (typeof p._id !== "number" || p.violence || p.sex) return null;
  let best: { keyword: string; score: number } | null = null;
  for (const k of p.keywords ?? []) {
    const keyword = k.keyword?.trim();
    if (!keyword) continue;
    const score = Math.min(
      matchScore(keyword, foldedQuery),
      k.plural ? matchScore(k.plural, foldedQuery) : 4,
    );
    if (!best || score < best.score) best = { keyword, score };
  }
  if (!best) return null;
  return { id: p._id, keyword: best.keyword, score: best.score, order };
}

/** Fetch one endpoint; 404 means "no results". */
async function fetchEndpoint(
  endpoint: "bestsearch" | "search",
  query: string,
  language: Language,
  signal?: AbortSignal,
): Promise<RawPictogram[]> {
  // Own timeout (AbortSignal.timeout/any need iOS 16+/17.4+), linked to the caller's signal.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${API}/${language}/${endpoint}/${encodeURIComponent(query)}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw new ArasaacSearchError(
          "offline",
          "You seem to be offline. Connect to the internet to search symbols.",
        );
      }
      throw new ArasaacSearchError(
        "offline",
        "Couldn't reach ARASAAC. Check the internet connection and try again.",
      );
    }
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new ArasaacSearchError(
        "server",
        "ARASAAC isn't responding right now. Please try again in a moment.",
      );
    }
    try {
      const data: unknown = await res.json();
      return Array.isArray(data) ? (data as RawPictogram[]) : [];
    } catch (err) {
      if (signal?.aborted) throw err;
      throw new ArasaacSearchError(
        "server",
        "ARASAAC sent an unexpected reply. Please try again.",
      );
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const cache = new Map<string, ArasaacResult[]>();

function remember(key: string, value: ArasaacResult[]) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/**
 * Search ARASAAC pictograms. Returns [] for an empty query.
 *
 * Results skip pictograms flagged `violence` or `sex`, are ordered by how well a keyword
 * matches the query (keeping ARASAAC's order within each tier), and use the
 * best-matching keyword as the label. Throws `ArasaacSearchError` on network or server
 * failure, and rethrows the AbortError when `signal` aborts.
 */
export async function searchPictograms(
  query: string,
  language: Language,
  signal?: AbortSignal,
  options: SearchOptions = {},
): Promise<ArasaacResult[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  const more = options.more === true;
  const key = `${language}:${more ? "more" : "best"}:${q}`;
  const cached = cache.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }

  const best = await fetchEndpoint("bestsearch", q, language, signal);
  let raw = best;
  const merged = more || best.length < FEW_RESULTS;
  if (merged) {
    const broad = await fetchEndpoint("search", q, language, signal);
    const seen = new Set(best.map((p) => p._id));
    raw = best.concat(broad.filter((p) => !seen.has(p._id)));
  }

  const folded = fold(q);
  const scored: Scored[] = [];
  raw.forEach((p, i) => {
    const r = toResult(p, folded, i);
    if (r) scored.push(r);
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  const plain = scored.map(({ id, keyword }) => ({ id, keyword }));
  const results = plain.slice(0, more ? MAX_RESULTS_MORE : MAX_RESULTS);

  remember(key, results);
  // Already includes the broad results, so "more" has nothing new to fetch.
  if (merged && !more) {
    remember(`${language}:more:${q}`, plain.slice(0, MAX_RESULTS_MORE));
  }
  return results;
}

/** Whether a "more results" search could add anything beyond the default one. */
export function canSearchMore(query: string, language: Language): boolean {
  const q = normalizeQuery(query);
  return q !== "" && !cache.has(`${language}:more:${q}`);
}

/** URL of a pictogram PNG suitable for an <img src>. */
export function pictogramUrl(id: number, size: 300 | 500 | 2500 = 500): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`;
}
