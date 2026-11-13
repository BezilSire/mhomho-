/**
 * Client-side image preparation for admin uploads.
 *
 * Phone photos are 5-12 MB; the server caps uploads at 5 MB and every
 * journal page loads its cover, so images are resized in the browser before
 * they are sent. Canvas does the work, so no extra dependency is needed.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Longest edge of the uploaded image, in pixels. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface PreparedImage {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Scales an image down so its longest edge is at most `maxDimension` and
 * re-encodes it as JPEG. PNG images with no transparency are also converted;
 * images with transparency keep their alpha by staying PNG.
 */
export async function prepareImage(file: File, maxDimension = MAX_DIMENSION): Promise<PreparedImage> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare images.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });
  if (!blob) throw new Error('This browser cannot prepare images.');

  const name = file.name.replace(/\.[^.]+$/, '') || 'image';
  const prepared = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  return { file: prepared, previewUrl: URL.createObjectURL(blob), width, height };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('That file could not be read as an image.'));
      image.src = url;
    });
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
