"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { computeOverlayTransform, drawOverlay, classifyFaceShape, classifySeasonalTone, rgbToHex, type Landmark } from "@/lib/ar/transform";
import type { FaceAnalysis, Product } from "@/types";

interface Props { selectedProduct: Product | null; onAnalyze: (a: FaceAnalysis) => void; }
const CHEEK = [50, 280, 234, 454];

export default function FaceCanvas({ selectedProduct, onAnalyze }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const overlayAspectRef = useRef(0.5);
  const landmarksRef = useRef<Landmark[] | null>(null);
  const rafRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [faceFound, setFaceFound] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!selectedProduct?.overlayUrl) { overlayImgRef.current = null; return; }
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { overlayImgRef.current = img; overlayAspectRef.current = img.naturalHeight / img.naturalWidth; };
    img.src = selectedProduct.overlayUrl;
  }, [selectedProduct]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current; const video = videoRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !video || video.readyState < 2) { rafRef.current = requestAnimationFrame(drawFrame); return; }
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); ctx.restore();
    const lm = landmarksRef.current; const img = overlayImgRef.current;
    if (lm && img && selectedProduct?.anchor !== "none") {
      const t = computeOverlayTransform(lm, canvas.width, canvas.height, selectedProduct!.anchor, overlayAspectRef.current);
      if (t) drawOverlay(ctx, img, t, overlayAspectRef.current);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [selectedProduct]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
        const video = videoRef.current!; video.srcObject = stream; await video.play();
        if (!(window as unknown as Record<string,unknown>)["FaceMesh"]) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script");
            s.src = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
            s.onload = () => res(); s.onerror = () => rej(new Error("MediaPipe load failed"));
            document.head.appendChild(s);
          });
        }
        const FM = (window as unknown as Record<string,unknown>)["FaceMesh"] as new(o:unknown)=>{ setOptions:(o:unknown)=>void; onResults:(cb:(r:unknown)=>void)=>void; send:(i:unknown)=>Promise<void>; };
        const fm = new FM({ locateFile: (f:string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
        fm.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });
        fm.onResults((r: unknown) => {
          const res = r as { multiFaceLandmarks?: Landmark[][] };
          const faces = res.multiFaceLandmarks;
          if (faces && faces.length > 0) { landmarksRef.current = faces[0]; setFaceFound(true); }
          else { landmarksRef.current = null; setFaceFound(false); }
        });
        const loop = async () => { if (video.readyState >= 2) await fm.send({ image: video }); setTimeout(loop, 100); };
        loop(); setReady(true); rafRef.current = requestAnimationFrame(drawFrame);
      } catch(e) {
        const name = (e as Error).name;
        if (name === "NotAllowedError") setError("Camera permission denied. Click the camera icon in your browser bar, allow access, then refresh.");
        else if (name === "NotFoundError") setError("No camera found. Connect a webcam and refresh.");
        else setError("Camera error: " + (e as Error).message);
      }
    }
    init();
    return () => { cancelAnimationFrame(rafRef.current); stream?.getTracks().forEach(t => t.stop()); };
  }, [drawFrame]);

  const handleAnalyze = async () => {
    const lm = landmarksRef.current; const canvas = canvasRef.current; const ctx = canvas?.getContext("2d");
    if (!lm || !canvas || !ctx) { setError("No face detected. Center your face and try again."); return; }
    setAnalyzing(true);
    const w = canvas.width, h = canvas.height;
    let r=0,g=0,b=0,n=0;
    for (const idx of CHEEK) {
      const l = lm[idx]; if (!l) continue;
      const px = Math.round((1-l.x)*w), py = Math.round(l.y*h);
      const d = ctx.getImageData(px,py,1,1).data; r+=d[0]; g+=d[1]; b+=d[2]; n++;
    }
    const skinToneHex = n>0 ? rgbToHex(r/n,g/n,b/n) : "#c68642";
    const faceShape = classifyFaceShape(lm,w,h);
    const seasonalTone = classifySeasonalTone(skinToneHex);
    const px2=(i:number)=>({x:lm[i].x*w,y:lm[i].y*h});
    const hyp=(a:{x:number;y:number},b2:{x:number;y:number})=>Math.hypot(a.x-b2.x,a.y-b2.y);
    onAnalyze({ faceShape, skinToneHex, seasonalTone, metrics: {
      faceWidthRatio: +(hyp(px2(234),px2(454))/hyp(px2(10),px2(152))).toFixed(3),
      pupillaryDistance: +(hyp(px2(133),px2(362))/w).toFixed(3),
      foreheadRatio: +(hyp(px2(10),px2(168))/hyp(px2(10),px2(152))).toFixed(3),
      jawRatio: +(hyp(px2(234),px2(454))/w).toFixed(3),
    }});
    setAnalyzing(false);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <video ref={videoRef} className="hidden" playsInline muted />
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 w-full">
        <canvas ref={canvasRef} width={640} height={480} className="block bg-zinc-900 w-full h-auto" />
        {!ready && !error && (<div className="absolute inset-0 grid place-items-center bg-zinc-900/90"><div className="flex flex-col items-center gap-3"><span className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"/><p className="text-sm text-zinc-300">Starting camera…</p></div></div>)}
        {error && (<div className="absolute inset-0 grid place-items-center bg-zinc-900/95 p-6"><div className="text-center space-y-3"><p className="text-3xl">📷</p><p className="text-sm text-rose-300 font-medium">Camera Access Needed</p><p className="text-xs text-zinc-400 max-w-xs">{error}</p><button onClick={()=>window.location.reload()} className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-zinc-950">Refresh & Try Again</button></div></div>)}
        {ready && (<div className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs ring-1 ${faceFound?"bg-emerald-500/20 text-emerald-400 ring-emerald-500/30":"bg-zinc-900/80 text-zinc-400 ring-white/10"}`}>{faceFound?"✓ Face detected — 468 landmarks active":"Position your face in the frame"}</div>)}
      </div>
      <button onClick={handleAnalyze} disabled={!ready||analyzing} className="rounded-full bg-amber-400 px-8 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-40">
        {analyzing?"Analyzing…":"✦ Analyze My Face"}
      </button>
      {!ready&&!error&&<p className="text-xs text-zinc-500 text-center">When your browser asks for camera permission, click <strong className="text-zinc-300">Allow</strong></p>}
    </div>
  );
}
