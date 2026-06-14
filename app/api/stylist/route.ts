import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { StylistRequest, StylistResponse, StylistRecommendation, FaceAnalysis } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidAnalysis(a: unknown): a is FaceAnalysis {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.faceShape === "string" && typeof x.skinToneHex === "string" && typeof x.seasonalTone === "string";
}

const SYSTEM_PROMPT = `You are a professional color and style consultant for an AI fashion app.
You receive facial geometry data and a skin-tone hex code.
Return ONLY valid JSON (no markdown, no prose, no code fences) matching exactly:
{
  "summary": "2 sentence personalized style summary",
  "colorPalette": [
    { "name": "Color Name", "hex": "#RRGGBB", "reason": "why this suits them" }
  ],
  "styleAdvice": ["tip 1", "tip 2", "tip 3"],
  "avoid": ["thing to avoid 1", "thing to avoid 2"]
}
Give 4 palette colors, 3 style tips, 2 things to avoid. Be specific to the face shape and seasonal tone.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[stylist] ANTHROPIC_API_KEY is not set");
      return NextResponse.json({ error: "Stylist not configured. API key missing." }, { status: 500 });
    }

    const body = (await req.json()) as StylistRequest;
    if (!isValidAnalysis(body?.analysis)) {
      return NextResponse.json({ error: "Invalid face analysis payload." }, { status: 400 });
    }

    const { faceShape, skinToneHex, seasonalTone, metrics } = body.analysis;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Face shape: ${faceShape}
Skin tone hex: ${skinToneHex}
Seasonal color tone: ${seasonalTone}
Pupillary distance: ${metrics.pupillaryDistance}
Face width to height ratio: ${metrics.faceWidthRatio}
Please recommend optimal styling colors and advice for this person.`,
      }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let recommendation: StylistRecommendation;
    try {
      recommendation = JSON.parse(text);
    } catch {
      console.error("[stylist] JSON parse failed:", text);
      return NextResponse.json({ error: "Stylist returned invalid response." }, { status: 502 });
    }

    const payload: StylistResponse = { recommendation };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[stylist] error:", err);
    return NextResponse.json({ error: "Stylist engine failed. Try again." }, { status: 500 });
  }
}
