// Downscale a picked photo to a small JPEG/PNG entirely on the device.
//
// Orientation: we decode through an <img> element. Safari 13.1+ (and all current
// browsers) apply the photo's EXIF orientation both to the <img>'s natural size and
// when drawing it onto a canvas, so the result comes out upright with no EXIF
// parsing of our own. (createImageBitmap's `imageOrientation` option is not
// reliable on iOS 15, so we don't use it.)

/** Error whose message is safe and friendly to show to the teacher. */
export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageDecodeError";
  }
}

export const MAX_EDGE = 512;
const JPEG_QUALITY = 0.85;
/** Types that might contain transparency, worth checking before choosing JPEG. */
const MAYBE_TRANSPARENT = /^image\/(png|gif|webp|avif|svg\+xml)$/;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new ImageDecodeError(
      "This device couldn't prepare the photo. Please try again.",
    );
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

/** iOS keeps canvas memory around until the canvas is shrunk; free it explicitly. */
function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function hasTransparency(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new ImageDecodeError(
                "This device couldn't save the photo. Please try again.",
              ),
            ),
      type,
      quality,
    );
  });
}

function friendlyName(file: Blob): string {
  return file instanceof File && file.name ? `"${file.name}"` : "This picture";
}

/**
 * Decode `file`, scale it so its long edge is at most `maxEdge` px, and re-encode
 * it (JPEG, or PNG if it has transparent pixels). Throws ImageDecodeError with a
 * friendly message if the picture can't be opened (e.g. an unsupported HEIC).
 */
export async function resizeImage(
  file: Blob,
  maxEdge = MAX_EDGE,
): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new ImageDecodeError(`${friendlyName(file)} is not a picture.`);
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new ImageDecodeError(
      `${friendlyName(file)} couldn't be opened on this device. Try choosing it again from Photos, or take a screenshot of it and add the screenshot instead.`,
    );
  }

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  if (!srcW || !srcH) {
    throw new ImageDecodeError(`${friendlyName(file)} looks empty or damaged.`);
  }

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));

  // Halve in steps for a smoother result than one big jump (Safari's smoothing
  // in a single large downscale can look jagged).
  let source: CanvasImageSource = img;
  let curW = srcW;
  let curH = srcH;
  let temp: HTMLCanvasElement | null = null;
  while (curW / 2 >= dstW * 1.5 && curH / 2 >= dstH * 1.5) {
    const nextW = Math.round(curW / 2);
    const nextH = Math.round(curH / 2);
    const step = makeCanvas(nextW, nextH);
    step.ctx.drawImage(source, 0, 0, nextW, nextH);
    if (temp) releaseCanvas(temp);
    temp = step.canvas;
    source = step.canvas;
    curW = nextW;
    curH = nextH;
  }

  const { canvas, ctx } = makeCanvas(dstW, dstH);
  try {
    ctx.drawImage(source, 0, 0, dstW, dstH);
    if (temp) releaseCanvas(temp);

    const transparent =
      MAYBE_TRANSPARENT.test(file.type) && hasTransparency(ctx, dstW, dstH);
    if (transparent) return await toBlob(canvas, "image/png");
    return await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
  } finally {
    releaseCanvas(canvas);
  }
}

/** Default label for a picked file: its name without the extension. */
export function nameFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .trim();
  return base.slice(0, 60) || "Photo";
}
