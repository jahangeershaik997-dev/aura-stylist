"use client";
// ============================================================================
// components/FaceCanvas.tsx — Webcam + MediaPipe FaceMesh + AR overlay.
// Left panel of the split view. Runs the full client-side CV pipeline.
// ============================================================================
import { useEffect, useRef, useCallback, useState } from "react";
import { FaceMesh, type Results } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";
import {
  computeOverlayTransform,
  drawOverlay,
  classifyFaceShape,
  classifySeasonalTone,
  rgbToHex,
  type Landmark,
} from "@/lib/ar/transform";
import type { FaceAnalysis, Product } from "@/types";

interface Props {
  selectedProduct: Product | null;
  onAnalyze: (analysis: FaceAnalysis) => void;
}

// Cheek sample points for skin-tone extraction.
const CHEEK_SAMPLES = [50, 280, 234, 454];

export default function FaceCanvas({ selectedProduct, onAnalyze }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const overlayAspectRef = useRef(0.5);
  const latestLandmarks = useRef<Landmark[] | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preload the selected product's overlay PNG.
  useEffect(() => {
    if (!selectedProduct?.overlayUrl) {
      overlayImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      overlayImgRef.current = img;
      overlayAspectRef.current = img.naturalHeight / img.naturalWidth;
    };
    img.src = selectedProduct.overlayUrl;
  }, [selectedProduct]);

  const onResults = useCallback(
    (results: Results) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (results.image) ctx.drawImage(results.image, 0, 0, w, h);

      const faces = results.multiFaceLandmarks;
      if (!faces || faces.length === 0) return;

      const landmarks = faces[0] as Landmark[];
      latestLandmarks.current = landmarks;

      // Draw AR overlay if a wearable is selected.
      const img = overlayImgRef.current;
      if (img && selectedProduct && selectedProduct.anchor !== "none") {
        const t = computeOverlayTransform(
          landmarks,
          w,
          h,
          selectedProduct.anchor,
          overlayAspectRef.current
        );
        if (t) drawOverlay(ctx, img, t, overlayAspectRef.current);
      }
    },
    [selectedProduct]
  );

  // Initialize MediaPipe + camera once.
  useEffect(() => {
    let camera: Camera | null = null;
    let faceMesh: FaceMesh | null = null;

    async function init() {
      try {
        faceMesh = new FaceMesh({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        faceMesh.onResults(onResults);

        const video = videoRef.current!;
        camera = new Camera(video, {
          onFrame: async () => {
            if (faceMesh) await faceMesh.send({ image: video });
          },
          width: 640,
          height: 480,
        });
        await camera.start();
        setReady(true);
      } catch (e) {
        console.error(e);
        setError("Camera access denied or unavailable. Allow camera and reload.");
      }
    }
    init();

    return () => {
      camera?.stop();
      faceMesh?.close();
    };
  }, [onResults]);

  // Run analysis on the current frame's landmarks.
  const handleAnalyze = () => {
    const landmarks = latestLandmarks.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!landmarks || !canvas || !ctx) {
      setError("No face detected. Center your face and try again.");
      return;
    }
    const w = canvas.width;
    const h = canvas.height;

    // Average skin-tone across cheek samples.
    let r = 0, g = 0, b = 0, n = 0;
    for (const idx of CHEEK_SAMPLES) {
      const lm = landmarks[idx];
      if (!lm) continue;
      const px = Math.round(lm.x * w);
      const py = Math.round(lm.y * h);
      const d = ctx.getImageData(px, py, 1, 1).data;
      r += d[0]; g += d[1]; b += d[2]; n++;
    }
    if (n === 0) return;
    const skinToneHex = rgbToHex(r / n, g / n, b / n);

    const faceShape = classifyFaceShape(landmarks, w, h);
    const seasonalTone = classifySeasonalTone(skinToneHex);

    const px = (i: number) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const hyp = (a: { x: number; y: number }, b2: { x: number; y: number }) =>
      Math.hypot(a.x - b2.x, a.y - b2.y);
    const faceHeight = hyp(px(10), px(152));
    const cheekWidth = hyp(px(234), px(454));
    const pd = hyp(px(133), px(362));

    onAnalyze({
      faceShape,
      skinToneHex,
      seasonalTone,
      metrics: {
        faceWidthRatio: +(cheekWidth / faceHeight).toFixed(3),
        pupillaryDistance: +(pd / w).toFixed(3),
        foreheadRatio: +(hyp(px(10), px(168)) / faceHeight).toFixed(3),
        jawRatio: +(cheekWidth / w).toFixed(3),
      },
    });
  };

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4">
      <video ref={videoRef} className="hidden" playsInline />
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl">
        <canvas ref={canvasRef} width={640} height={480} className="block bg-zinc-900" />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900/80 text-sm text-zinc-300">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900/90 p-6 text-center text-sm text-rose-300">
            {error}
          </div>
        )}
      </div>
      <button
        onClick={handleAnalyze}
        disabled={!ready}
        className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40"
      >
        Analyze my face
      </button>
    </div>
  );
}
