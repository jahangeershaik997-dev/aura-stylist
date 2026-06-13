"use client";
import { useEffect, useRef, useCallback, useState } from "react";
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

const CHEEK_SAMPLES = [50, 280, 234, 454];

export default function FaceCanvas({ selectedProduct, onAnalyze }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const overlayAspectRef = useRef(0.5);
  const latestLandmarks = useRef<Landmark[] | null>(null);
  const animFrameRef = useRef<number>(0);
  const faceMeshRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Preload overlay image
  useEffect(() => {
    if (!selectedProduct?.overlayUrl) { overlayImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      overlayImgRef.current = img;
      overlayAspectRef.current = img.naturalHeight / img.naturalWidth;
    };
    img.src = selectedProduct.overlayUrl;
  }, [selectedProduct]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !video || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const landmarks = latestLandmarks.current;
    const img = overlayImgRef.current;
    if (landmarks && img && selectedProduct && selectedProduct.anchor !== "none") {
      const t = computeOverlayTransform(landmarks, canvas.width, canvas.height, selectedProduct.anchor, overlayAspectRef.current);
      if (t) drawOverlay(ctx, img, t, overlayAspectRef.current);
    }
    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [selectedProduct]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function init() {
      try {
        // Step 1: get camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        // Step 2: load MediaPipe lazily from CDN
        // @ts-expect-error CDN global
        if (!window.FaceMesh) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("MediaPipe CDN failed"));
            document.head.appendChild(s);
          });
        }

        // @ts-expect-error CDN global
        const fm = new window.FaceMesh({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        fm.onResults((results: { multiFaceLandmarks?: Landmark[][] }) => {
          const faces = results.multiFaceLandmarks;
          if (faces && faces.length > 0) latestLandmarks.current = faces[0];
          else latestLandmarks.current = null;
        });
        faceMeshRef.current = fm;

        // Step 3: send frames to FaceMesh
        const sendLoop = async () => {
          if (video.readyState >= 2) await fm.send({ image: video });
          setTimeout(sendLoop, 100); // 10fps for analysis, canvas draws at 60fps
        };
        sendLoop();

        setReady(true);
        animFrameRef.current = requestAnimationFrame(drawFrame);
      } catch (e) {
        console.error(e);
        if ((e as Error).name === "NotAllowedError") {
          setError("Camera permission denied. Click the camera icon in your browser address bar and allow access, then refresh.");
        } else if ((e as Error).name === "NotFoundError") {
          setError("No camera found. Connect a webcam and refresh.");
        } else {
          setError("Camera unavailable: " + (e as Error).message);
        }
      }
    }

    init();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [drawFrame]);

  const handleAnalyze = async () => {
    const landmarks = latestLandmarks.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!landmarks || !canvas || !ctx) {
      setError("No face detected yet. Make sure your face is visible and try again.");
      return;
    }
    setAnalyzing(true);
    const w = canvas.width, h = canvas.height;

    // Sample skin tone from cheek landmarks
    let r = 0, g = 0, b = 0, n = 0;
    for (const idx of CHEEK_SAMPLES) {
      const lm = landmarks[idx];
      if (!lm) continue;
      // Mirror X because we flipped the canvas
      const px = Math.round((1 - lm.x) * w);
      const py = Math.round(lm.y * h);
      const d = ctx.getImageData(px, py, 1, 1).data;
      r += d[0]; g += d[1]; b += d[2]; n++;
    }
    const skinToneHex = n > 0 ? rgbToHex(r / n, g / n, b / n) : "#c68642";

    const faceShape = classifyFaceShape(landmarks, w, h);
    const seasonalTone = classifySeasonalTone(skinToneHex);

    const px2 = (i: number) => ({ x: landmarks[i].x * w, y: landmarks[i].y * h });
    const hyp = (a: {x:number;y:number}, b2: {x:number;y:number}) => Math.hypot(a.x-b2.x, a.y-b2.y);
    const faceHeight = hyp(px2(10), px2(152));
    const cheekWidth = hyp(px2(234), px2(454));
    const pd = hyp(px2(133), px2(362));

    onAnalyze({
      faceShape, skinToneHex, seasonalTone,
      metrics: {
        faceWidthRatio: +(cheekWidth / faceHeight).toFixed(3),
        pupillaryDistance: +(pd / w).toFixed(3),
        foreheadRatio: +(hyp(px2(10), px2(168)) / faceHeight).toFixed(3),
        jawRatio: +(cheekWidth / w).toFixed(3),
      },
    });
    setAnalyzing(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <video ref={videoRef} className="hidden" playsInline muted />
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-2xl w-full">
        <canvas ref={canvasRef} width={640} height={480} className="block bg-zinc-900 w-full h-auto" />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900/90 text-sm text-zinc-300">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              Starting camera…
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900/95 p-6">
            <div className="text-center space-y-3">
              <p className="text-2xl">📷</p>
              <p className="text-sm text-rose-300 font-medium">Camera Access Needed</p>
              <p className="text-xs text-zinc-400 max-w-xs">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-zinc-950"
              >
                Refresh & Try Again
              </button>
            </div>
          </div>
        )}
        {ready && !latestLandmarks.current && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400">
            Position your face in the frame
          </div>
        )}
        {ready && latestLandmarks.current && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-400 ring-1 ring-emerald-500/30">
            ✓ Face detected — 468 landmarks active
          </div>
        )}
      </div>
      <button
        onClick={handleAnalyze}
        disabled={!ready || analyzing}
        className="rounded-full bg-amber-400 px-8 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {analyzing ? "Analyzing…" : "✦ Analyze My Face"}
      </button>
      {!ready && !error && (
        <p className="text-xs text-zinc-500 text-center max-w-xs">
          Your browser will ask for camera permission. Click <strong className="text-zinc-300">Allow</strong> when prompted.
        </p>
      )}
    </div>
  );
}
