// ============================================================================
// app/api/stylist/route.ts — AI Stylist engine. The ANTHROPIC_API_KEY lives
// ONLY here, in the serverless runtime. The browser never sees it.
// POST /api/stylist  body: { analysis: FaceAnalysis }
// ============================================================================
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  StylistRequest,
  StylistResponse,
  StylistRecommendation,
  FaceAnalysis,
} from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";

function isValidAnalysis(a: unknown): a is FaceAnalysis {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return (
    typeof x.faceShape === "string" &&
    typeof x.skinToneHex === "string" &&
    typeof x.seasonalTone === "string"
  );
}

const SYSTEM_PROMPT = `You are a professional color and style consultant.
You receive measured facial geometry and a sampled skin-tone hex code.
Return ONLY valid JSON (no markdown, no prose, no code fences) matching:
{
  "summary": string,
  "colorPalette": [{ "name": string, "hex": string, "reason": string }],
  "styleAdvice": string[],
  "avoid": string[]
}
Give 4-5 palette colors with real hex codes, 3-4 concrete style tips, and 2-3 things to avoid. Be specific to the provided face shape and seasonal tone.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Stylist engine not configured." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as StylistRequest;
    if (!isValidAnalysis(body?.analysis)) {
      return NextResponse.json(
        { error: "Invalid face analysis payload." },
        { status: 400 }
      );
    }

    const { faceShape, skinToneHex, seasonalTone, metrics } = body.analysis;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Face shape: ${faceShape}
Skin tone hex: ${skinToneHex}
Seasonal color tone: ${seasonalTone}
Metrics: ${JSON.stringify(metrics)}
Recommend optimal styling colors and advice.`,
        },
      ],
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
      return NextResponse.json(
        { error: "Stylist returned an unparseable response." },
        { status: 502 }
      );
    }

    const payload: StylistResponse = { recommendation };
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/stylist] failure:", err);
    return NextResponse.json(
      { error: "Stylist engine failed. Try again." },
      { status: 500 }
    );
  }
}
