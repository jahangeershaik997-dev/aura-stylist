"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import {
  computeOverlayTransform, drawOverlay,
  classifyFaceShape, classifySeasonalTone, rgbToHex, type Landmark,
} from "@/lib/ar/transform";
import type { FaceAnalysis, Product } from "@/types";

interface Props {
  selectedProduct: Product | null;
  onAnalyze: (a: FaceAnalysis) => void;
}

const CHEEK = [50, 280, 234, 454];

export default function FaceCanvas({ selectedProduct, onAnalyze }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const overlayAspectRef = useRef(0.5);
  const landmarksRef = useRef<Landmark[] | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle"|"loading"|"ready"|"error">("idle");
  const [faceFound, setFaceFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!selectedProduct?.overlayUrl) { overlayImgRef.current = null; return; }
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { overlayImgRef.current = img; overlayAspectRef.current = img.naturalHeight / img.naturalWidth; };
    img.src = selectedProduct.overlayUrl;
  }, [selectedProduct]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(drawFrame); return;
    }
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); ctx.restore();
    const lm = landmarksRef.current; const img = overlayImgRef.current;
    if (lm && img && selectedProduct?.anchor !== "none") {
      const t = computeOverlayTransform(lm, canvas.width, canvas.height, selectedProduct!.anchor, overlayAspectRef.current);
      if (t) drawOverlay(ctx, img, t, overlayAspectRef.current);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [selectedProduct]);

  useEffect(() => {
    setStatus("loading");
    let cancelled = false;

    async function init() {
      try {
        // 1. Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await new Promise<void>((res) => { video.onloadedmetadata = () => res(); });
        await video.play();

        // 2. Load MediaPipe face_mesh from CDN
        const w = window as unknown as Record<string, unknown>;
        if (!w["FaceMesh"]) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js";
            s.crossOrigin = "anonymous";
            s.onload = () => res();
            s.onerror = () => rej(new Error("MediaPipe script failed to load"));
            document.head.appendChild(s);
          });
        }

        // 3. Init FaceMesh
        const FM = w["FaceMesh"] as new(o: unknown) => {
          setOptions: (o: unknown) => void;
          onResults: (cb: (r: unknown) => void) => void;
          send: (i: unknown) => Promise<void>;
          close: () => void;
        };
        const fm = new FM({
          locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${f}`,
        });
        fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        fm.onResults((r: unknown) => {
          const res = r as { multiFaceLandmarks?: Landmark[][] };
          const faces = res.multiFaceLandmarks;
          if (faces && faces.length > 0) { landmarksRef.current = faces[0]; if (!cancelled) setFaceFound(true); }
          else { landmarksRef.current = null; if (!cancelled) setFaceFound(false); }
        });

        // 4. Send frames at 10fps for landmark detection
        let running = true;
        const sendLoop = async () => {
          while (running && !cancelled) {
            if (video.readyState >= 2 && !video.paused) {
              try { await fm.send({ image: video }); } catch { /* ignore */ }
            }
            await new Promise(r => setTimeout(r, 100));
          }
        };
        sendLoop();

        if (!cancelled) {
          setStatus("ready");
          rafRef.current = requestAnimationFrame(drawFrame);
          // cleanup on unmount
          return () => { running = false; fm.close(); };
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as Error).name;
        const msg = name === "NotAllowedError"
          ? "Camera permission denied. Click the camera icon in your browser bar and allow access, then refresh."
          : name === "NotFoundError"
          ? "No camera found. Connect a webcam and refresh."
          : `Camera error: ${(e as Error).message}`;
        setStatus("error");
        setErrorMsg(msg);
      }
    }

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [drawFrame]);

  const handleAnalyze = async () => {
    const lm = landmarksRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!lm || !canvas || !ctx) {
      alert("No face detected yet. Make sure your face is visible in the frame.");
      return;
    }
    setAnalyzing(true);
    const w = canvas.width, h = canvas.height;
    let r = 0, g = 0, b = 0, n = 0;
    for (const idx of CHEEK) {
      const l = lm[idx]; if (!l) continue;
      const px = Math.round((1 - l.x) * w), py = Math.round(l.y * h);
      try {
        const d = ctx.getImageData(px, py, 1, 1).data;
        r += d[0]; g += d[1]; b += d[2]; n++;
      } catch { /* cross-origin guard */ }
    }
    const skinToneHex = n > 0 ? rgbToHex(r / n, g / n, b / n) : "#c68642";
    const faceShape = classifyFaceShape(lm, w, h);
    const seasonalTone = classifySeasonalTone(skinToneHex);
    const px2 = (i: number) => ({ x: lm[i].x * w, y: lm[i].y * h });
    const hyp = (a: { x: number; y: number }, b2: { x: number; y: number }) => Math.hypot(a.x - b2.x, a.y - b2.y);
    const faceHeight = hyp(px2(10), px2(152));
    const cheekWidth = hyp(px2(234), px2(454));
    onAnalyze({
      faceShape, skinToneHex, seasonalTone,
      metrics: {
        faceWidthRatio: +(cheekWidth / faceHeight).toFixed(3),
        pupillaryDistance: +(hyp(px2(133), px2(362)) / w).toFixed(3),
        foreheadRatio: +(hyp(px2(10), px2(168)) / faceHeight).toFixed(3),
        jawRatio: +(cheekWidth / w).toFixed(3),
      },
    });
    setAnalyzing(false);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <video ref={videoRef} className="hidden" playsInline muted />
      <div className="relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10 bg-zinc-900">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="block w-full h-auto"
          style={{ aspectRatio: "4/3" }}
        />
        {/* Loading */}
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <span className="h-10 w-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
              <p className="text-sm text-zinc-300">Starting camera…</p>
              <p className="text-xs text-zinc-500">Allow camera access when prompted</p>
            </div>
          </div>
        )}
        {/* Error */}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-900/95 p-6">
            <div className="text-center space-y-3 max-w-xs">
              <p className="text-4xl">📷</p>
              <p className="text-sm font-semibold text-rose-300">Camera Access Needed</p>
              <p className="text-xs text-zinc-400">{errorMsg}</p>
              <button onClick={() => window.location.reload()}
                className="rounded-full bg-amber-400 px-5 py-2 text-xs font-bold text-zinc-950">
                Refresh & Try Again
              </button>
            </div>
          </div>
        )}
        {/* Face status badge */}
        {status === "ready" && (
          <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all whitespace-nowrap ${
            faceFound
              ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30"
              : "bg-zinc-900/80 text-zinc-400 ring-white/10"
          }`}>
            {faceFound ? "✓ Face detected — 468 landmarks active" : "Position your face in the frame"}
          </div>
        )}
      </div>
      <button
        onClick={handleAnalyze}
        disabled={status !== "ready" || analyzing}
        className="w-full max-w-xs rounded-full bg-amber-400 py-3 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-400/20"
      >
        {status === "loading" ? "Loading camera…" : analyzing ? "Analyzing…" : "✦ Analyze My Face"}
      </button>
    </div>
  );
}
