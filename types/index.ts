// ============================================================================
// types/index.ts — Single source of truth for cross-layer contracts
// ============================================================================

export type ProductCategory = "clothes" | "accessories" | "skincare";

export type FaceShape =
  | "oval"
  | "round"
  | "square"
  | "heart"
  | "oblong"
  | "diamond";

export type SeasonalTone = "spring" | "summer" | "autumn" | "winter";

// AR overlay anchoring strategy. Glasses anchor to the eye line; hats to the
// forehead/crown; necklaces to the chin/jaw. Drives the transform math.
export type AnchorType = "eyes" | "forehead" | "chin" | "none";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  currency: string;
  imageUrl: string;
  // PNG with transparency used by the AR canvas. Null for non-wearables.
  overlayUrl: string | null;
  anchor: AnchorType;
  // Cross-referencing tags. The stylist engine and filters match against these.
  faceShapes: FaceShape[];
  seasonalTones: SeasonalTone[];
  description: string;
  inStock: boolean;
}

// ---------------------------------------------------------------------------
// Face analysis payload extracted client-side from MediaPipe FaceMesh
// ---------------------------------------------------------------------------
export interface FaceAnalysis {
  faceShape: FaceShape;
  // Skin tone hex sampled from cheek/forehead regions.
  skinToneHex: string;
  seasonalTone: SeasonalTone;
  // Normalized facial metrics (0..1 of image width/height) for transparency.
  metrics: {
    faceWidthRatio: number; // jaw width / face height
    pupillaryDistance: number; // normalized inter-pupil distance
    foreheadRatio: number;
    jawRatio: number;
  };
}

// ---------------------------------------------------------------------------
// Stylist API contract
// ---------------------------------------------------------------------------
export interface StylistRequest {
  analysis: FaceAnalysis;
}

export interface StylistRecommendation {
  summary: string;
  colorPalette: { name: string; hex: string; reason: string }[];
  styleAdvice: string[];
  avoid: string[];
}

export interface StylistResponse {
  recommendation: StylistRecommendation;
}

// ---------------------------------------------------------------------------
// Live AR transform produced each animation frame
// ---------------------------------------------------------------------------
export interface OverlayTransform {
  x: number; // canvas px — center anchor
  y: number;
  scale: number; // multiplier applied to the overlay's natural size
  rotation: number; // radians, roll of the head
  opacity: number;
}
