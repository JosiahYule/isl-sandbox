// IMAGE COMPRESSION, shared by scripts/copy-images.mjs (new copies) and scripts/compress-images.mjs (existing ones).
//
// Squarespace's image server hands out near-lossless files: a headshot 500px wide weighs about 330 KB.
// Saved again at WebP quality 80, the same photo weighs about 30 KB and looks the same on screen.
// Photos are what make a page slow on a phone, so this one setting matters more than any code.
//
// "Bytes per pixel" says how heavily an image is already compressed: Squarespace's copies are around 1,
// a quality-80 WebP around 0.1. Anything below THRESHOLD is left alone, so running this twice does
// nothing the second time (compressing an already compressed image again would only lose detail).
import sharp from 'sharp';

export const QUALITY = 80;
export const THRESHOLD = 0.15; // bytes per pixel

// Returns the smaller WebP, or null when the image is already light enough (or wouldn't get smaller)
export async function compress(buffer) {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height || buffer.length / (width * height) < THRESHOLD) return null;
  // alphaQuality 100 keeps the edges of transparent logos and badges crisp
  const out = await image.webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
  return out.length < buffer.length * 0.9 ? out : null;
}

// Any image as a WebP at the same quality, however light it already is (to keep one image's widths in one format)
export const toWebp = (buffer) => sharp(buffer).webp({ quality: QUALITY, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
