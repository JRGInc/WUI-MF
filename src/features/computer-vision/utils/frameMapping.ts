import type { BoundingBox } from '@/shared/types';

// Geometry helpers for mapping bounding boxes from an analyzed source frame
// onto the visible container they are rendered over. Detections are normalized
// to the *frame* the model saw; the screen may show a cropped/scaled version
// of that frame (e.g. a <video> with `object-fit: cover`), so painting them as
// raw container percentages drifts whenever the aspect ratios differ.

// Placement of a source frame on the container, in normalized container
// coordinates. A cover-crop yields left/top < 0 and width/height > 1 (the
// frame overflows the container); identity means the frame and container
// coincide exactly.
export interface FrameRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const IDENTITY_RECT: FrameRect = { left: 0, top: 0, width: 1, height: 1 };

// Where CSS `object-fit: cover` places a srcW×srcH frame inside a dstW×dstH
// container: scaled uniformly until both container axes are covered, centered,
// overflow cropped equally on both sides of the long axis.
export function coverMapping(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): FrameRect {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return IDENTITY_RECT;
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const width = (srcW * scale) / dstW;
  const height = (srcH * scale) / dstH;
  return {
    left: (1 - width) / 2,
    top: (1 - height) / 2,
    width,
    height,
  };
}

// Re-express a box normalized to the frame as a box normalized to the
// container the frame is drawn into.
export function mapBoundingBox(box: BoundingBox, rect: FrameRect): BoundingBox {
  return {
    x: rect.left + box.x * rect.width,
    y: rect.top + box.y * rect.height,
    width: box.width * rect.width,
    height: box.height * rect.height,
  };
}

// Intersect a normalized box with the visible [0,1]² container. Returns null
// when the box lies entirely in the cropped-away region.
export function clipBoundingBox(box: BoundingBox): BoundingBox | null {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(1, box.x + box.width);
  const y1 = Math.min(1, box.y + box.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function isIdentityRect(rect: FrameRect): boolean {
  return (
    rect.left === 0 && rect.top === 0 && rect.width === 1 && rect.height === 1
  );
}
