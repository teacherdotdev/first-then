// OWNER: ARASAAC agent. Stub — signatures are the contract used by the core app.
import type { Language } from "#lib/types.ts";

export interface ArasaacResult {
  id: number;
  /** Best keyword for the requested language, used as the default label. */
  keyword: string;
}

/** Search ARASAAC pictograms. Returns [] for an empty query. */
export async function searchPictograms(
  query: string,
  language: Language,
  signal?: AbortSignal,
): Promise<ArasaacResult[]> {
  void query;
  void language;
  void signal;
  return [];
}

/** URL of a pictogram PNG suitable for an <img src>. */
export function pictogramUrl(id: number, size: 300 | 500 | 2500 = 500): string {
  return `https://static.arasaac.org/pictograms/${id}/${id}_${size}.png`;
}
