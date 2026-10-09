// Makes pictograms with a non-default skin or hair color. ARASAAC's renderer draws
// its own colors; the deeper skin tones in `appearance.ts` are painted here.
//
// ARASAAC recolors a pictogram by swapping its skin color, so its `light` and `dark`
// renders differ only in the skin, including the shading and the anti-aliased edges
// where skin meets an outline. Each of those pixels is a blend that is linear in the
// skin color, so per channel
//   new = light + (dark − light) × (target − lightSkin) / (darkSkin − lightSkin)
// repaints the skin exactly and leaves every other pixel as it was.
//
// Both renders are fetched with CORS (ARASAAC sends `Access-Control-Allow-Origin: *`)
// so the canvas can be read back. Callers cache the results (see `saved.ts`).
import { pictogramUrl } from "./api.ts";
import { needsRecolor, skinSwatch, type PictogramLook } from "./appearance.ts";

/** Pictures made at once, so the first search results aren't stuck behind the last. */
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

async function paint(id: number, look: PictogramLook): Promise<Blob> {
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
  return blob;
}

async function download(id: number, look: PictogramLook): Promise<Blob> {
  const res = await fetch(pictogramUrl(id, 500, look));
  if (!res.ok) throw new Error(`ARASAAC renderer replied ${res.status}`);
  return res.blob();
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

/**
 * PNG of pictogram `id` drawn with `look` (a non-default skin or hair color), from
 * ARASAAC's renderer or painted here. Rejects if ARASAAC can't be reached.
 */
export function recolorPictogram(
  id: number,
  look: PictogramLook,
): Promise<Blob> {
  return limited(() =>
    needsRecolor(look) ? paint(id, look) : download(id, look),
  );
}
