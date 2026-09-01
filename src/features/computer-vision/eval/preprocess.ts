import {
  INPUT_SIZE,
  floatToHalfBits,
  letterboxGeometry,
  type LetterboxGeometry,
} from '../services/wuiDetector';

/**
 * Node-side preprocessing for the detector evaluation: reproduces the browser
 * path's canvas letterbox (Ultralytics gray padding, bilinear resample) on a
 * raw RGBA buffer and packs the fp16 NCHW input tensor. Pure — unit-testable
 * without a DOM.
 */

const PAD_GRAY = 114;

export interface PreprocessedInput {
  data: Uint16Array; // fp16 bit patterns, [1, 3, INPUT_SIZE, INPUT_SIZE]
  geom: LetterboxGeometry;
}

export function letterboxRgbaToHalfNchw(
  rgba: Uint8Array | Uint8ClampedArray,
  srcW: number,
  srcH: number
): PreprocessedInput {
  const geom = letterboxGeometry(srcW, srcH);
  const n = INPUT_SIZE * INPUT_SIZE;
  const data = new Uint16Array(3 * n);
  const padHalf = floatToHalfBits(PAD_GRAY / 255);

  // Precompute the 256 possible pixel values, like the browser path's LUT.
  const lut = new Uint16Array(256);
  for (let i = 0; i < 256; i++) lut[i] = floatToHalfBits(i / 255);

  for (let y = 0; y < INPUT_SIZE; y++) {
    for (let x = 0; x < INPUT_SIZE; x++) {
      const i = y * INPUT_SIZE + x;
      // Position of this output pixel in source coordinates.
      const sx = (x - geom.padL + 0.5) / geom.scale - 0.5;
      const sy = (y - geom.padT + 0.5) / geom.scale - 0.5;
      if (sx < -0.5 || sy < -0.5 || sx > srcW - 0.5 || sy > srcH - 0.5) {
        data[i] = padHalf;
        data[n + i] = padHalf;
        data[2 * n + i] = padHalf;
        continue;
      }
      // Bilinear sample, clamped at the edges.
      const x0 = Math.max(0, Math.floor(sx));
      const y0 = Math.max(0, Math.floor(sy));
      const x1 = Math.min(srcW - 1, x0 + 1);
      const y1 = Math.min(srcH - 1, y0 + 1);
      const fx = Math.min(1, Math.max(0, sx - x0));
      const fy = Math.min(1, Math.max(0, sy - y0));
      for (let c = 0; c < 3; c++) {
        const p00 = rgba[(y0 * srcW + x0) * 4 + c];
        const p10 = rgba[(y0 * srcW + x1) * 4 + c];
        const p01 = rgba[(y1 * srcW + x0) * 4 + c];
        const p11 = rgba[(y1 * srcW + x1) * 4 + c];
        const v =
          p00 * (1 - fx) * (1 - fy) +
          p10 * fx * (1 - fy) +
          p01 * (1 - fx) * fy +
          p11 * fx * fy;
        data[c * n + i] = lut[Math.round(v)];
      }
    }
  }
  return { data, geom };
}
