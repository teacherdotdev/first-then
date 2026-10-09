// Paints people's skin in tones ARASAAC's renderer can't draw (the deeper tones in
// `appearance.ts`).
//
// ARASAAC recolors a pictogram by swapping its skin color, so its `light` and `dark`
// renders differ only in the skin, including the shading and the anti-aliased edges
// where skin meets an outline. Each of those pixels is a blend that is linear in the
// skin color, so per channel
//   new = light + (dark − light) × (target − lightSkin) / (darkSkin − lightSkin)
// repaints the skin exactly and leaves every other pixel as it was.
//
// Both renders are fetched with CORS (ARASAAC sends `Access-Control-Allow-Origin: *`)
// so the canvas can be read back. Results are kept as object URLs for this session.
import { pictogramUrl } from "./api.ts";
import { skinSwatch, type PictogramLook } from "./appearance.ts";

/** Each entry is a ~40 KB PNG; generous so a long search never evicts what's shown. */
const CACHE_SIZE = 300;
/** Recolors at once, so the first search results aren't stuck behind the last. */
const MAX_CONCURRENT = 4;

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const LIGHT = rgb(skinSwatch("light").hex);
const DARK = rgb(skinSwatch("dark").hex);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });
}

async function paint(id: number, look: PictogramLook): Promise<string> {
  const target = rgb(skinSwatch(look.skin ?? "light").hex);
  const [light, dark] = await Promise.all([
    loadImage(pictogramUrl(id, 500, { hair: look.hair })),
    loadImage(pictogramUrl(id, 500, { skin: "dark", hair: look.hair })),
  ]);

  const width = light.naturalWidth;
  const height = light.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.drawImage(light, 0, 0);
  const out = ctx.getImageData(0, 0, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(dark, 0, 0, width, height);
  const other = ctx.getImageData(0, 0, width, height).data;

  const scale = [0, 1, 2].map(
    (c) => (target[c] - LIGHT[c]) / (DARK[c] - LIGHT[c]),
  );
  const data = out.data;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = other[i + c] - data[i + c];
      if (diff !== 0) data[i + c] += diff * scale[c];
    }
  }
  ctx.putImageData(out, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Couldn't encode the recolored picture");
  return URL.createObjectURL(blob);
}

// --- a small queue so a 120-result search doesn't start 240 downloads at once ---

let running = 0;
const waiting: (() => void)[] = [];

async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT) running++;
  // A finishing task hands its slot straight to the next one waiting.
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

const cache = new Map<string, Promise<string>>();

/**
 * Object URL of pictogram `id` drawn with `look`, for skin tones that `needsRecolor`.
 * Rejects if either ARASAAC render fails to load.
 */
export function recoloredUrl(id: number, look: PictogramLook): Promise<string> {
  const key = `${id}:${look.skin ?? ""}:${look.hair ?? ""}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const promise = limited(() => paint(id, look));
  cache.set(key, promise);
  // Let a failed recolor be tried again later (e.g. after reconnecting).
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key);
  });

  if (cache.size > CACHE_SIZE) {
    const [oldestKey, oldest] = cache.entries().next().value!;
    cache.delete(oldestKey);
    oldest.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  }
  return promise;
}
