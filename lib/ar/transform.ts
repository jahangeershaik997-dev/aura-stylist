// ============================================================================
// lib/ar/transform.ts — Pure geometry. The DSP heart of the project.
//
// MediaPipe FaceMesh emits 468 normalized 3D landmarks (x,y in [0,1], z
// relative depth). We derive the rigid-body transform (translate, rotate,
// scale) needed to align a 2D overlay PNG to the face each frame.
//
// Canonical FaceMesh indices used:
//   33  = right eye outer corner    263 = left eye outer corner
//   133 = right eye inner corner    362 = left eye inner corner
//   10  = forehead top              152 = chin bottom
//   234 = right cheek (face left)   454 = left cheek (face right)
// ============================================================================
import type {
  AnchorType,
  FaceShape,
  OverlayTransform,
  SeasonalTone,
} from "@/types";

export interface Landmark {
  x: number; // normalized 0..1
  y: number;
  z: number;
}

const IDX = {
  rightEyeOuter: 33,
  rightEyeInner: 133,
  leftEyeOuter: 263,
  leftEyeInner: 362,
  foreheadTop: 10,
  chin: 152,
  cheekRight: 234,
  cheekLeft: 454,
  noseBridge: 168,
} as const;

interface Pt {
  x: number;
  y: number;
}

function toPixel(lm: Landmark, w: number, h: number): Pt {
  return { x: lm.x * w, y: lm.y * h };
}

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Head roll in radians from the eye line. atan2 keeps the sign correct across
 * all four quadrants so the overlay counter-rotates as the user tilts.
 */
export function computeRoll(rightEye: Pt, leftEye: Pt): number {
  return Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);
}

/**
 * Build the per-frame overlay transform for a given anchor.
 * baseWidthFactor scales the overlay's natural width relative to the
 * measured anchor span (e.g. glasses span ~2.1x the inter-pupil distance).
 */
export function computeOverlayTransform(
  landmarks: Landmark[],
  canvasW: number,
  canvasH: number,
  anchor: AnchorType,
  overlayAspect: number, // overlay natural height / width
  baseWidthFactor = 2.1
): OverlayTransform | null {
  if (anchor === "none" || landmarks.length < 468) return null;

  const px = (i: number) => toPixel(landmarks[i], canvasW, canvasH);

  const rEyeOuter = px(IDX.rightEyeOuter);
  const lEyeOuter = px(IDX.leftEyeOuter);
  const rEyeInner = px(IDX.rightEyeInner);
  const lEyeInner = px(IDX.leftEyeInner);

  // Pupil proxies = midpoint of each eye's inner+outer corners.
  const rPupil = midpoint(rEyeOuter, rEyeInner);
  const lPupil = midpoint(lEyeOuter, lEyeInner);
  const pupillaryDistance = dist(rPupil, lPupil);

  const rotation = computeRoll(rPupil, lPupil);

  let center: Pt;
  let span: number;

  switch (anchor) {
    case "eyes":
      center = midpoint(rPupil, lPupil);
      span = pupillaryDistance;
      break;
    case "forehead": {
      const forehead = px(IDX.foreheadTop);
      const cheekSpan = dist(px(IDX.cheekRight), px(IDX.cheekLeft));
      // Sit the hat slightly above the forehead landmark.
      center = { x: forehead.x, y: forehead.y - cheekSpan * 0.25 };
      span = cheekSpan;
      break;
    }
    case "chin": {
      const chin = px(IDX.chin);
      span = pupillaryDistance;
      center = { x: chin.x, y: chin.y + span * 0.4 };
      break;
    }
    default:
      return null;
  }

  // Scale derives from the measured span, so the overlay tracks depth: lean
  // toward the camera, the face grows, the span grows, the overlay grows.
  const targetWidth = span * baseWidthFactor;
  const scale = targetWidth; // consumer multiplies by 1/naturalWidth

  return {
    x: center.x,
    y: center.y,
    scale,
    rotation,
    opacity: 1,
    // overlayAspect retained by caller for draw height
  } as OverlayTransform & { _aspect?: number };
}

/**
 * Draw the overlay image with the computed rigid transform.
 * Canvas transform order: translate to anchor -> rotate by roll ->
 * draw centered. This composes T * R * S in screen space.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: OverlayTransform,
  overlayAspect: number
): void {
  const drawW = t.scale;
  const drawH = drawW * overlayAspect;

  ctx.save();
  ctx.globalAlpha = t.opacity;
  ctx.translate(t.x, t.y);
  ctx.rotate(t.rotation);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Face-shape classification from geometry (used by the analysis step)
// ---------------------------------------------------------------------------
export function classifyFaceShape(landmarks: Landmark[], w: number, h: number): FaceShape {
  const px = (i: number) => toPixel(landmarks[i], w, h);
  const faceHeight = dist(px(IDX.foreheadTop), px(IDX.chin));
  const cheekWidth = dist(px(IDX.cheekRight), px(IDX.cheekLeft));
  const ratio = faceHeight / cheekWidth;

  if (ratio > 1.55) return "oblong";
  if (ratio > 1.35) return "oval";
  if (ratio > 1.18) return cheekWidth > faceHeight * 0.78 ? "heart" : "diamond";
  return cheekWidth >= faceHeight ? "round" : "square";
}

// ---------------------------------------------------------------------------
// Seasonal tone from sampled skin hex (warm/cool x light/deep)
// ---------------------------------------------------------------------------
export function classifySeasonalTone(hex: string): SeasonalTone {
  const { r, g, b } = hexToRgb(hex);
  const warm = r - b; // positive => warm undertone
  const lightness = (r + g + b) / 3;
  if (warm >= 0) return lightness > 150 ? "spring" : "autumn";
  return lightness > 150 ? "summer" : "winter";
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(Math.round(r))}${c(Math.round(g))}${c(Math.round(b))}`;
}
