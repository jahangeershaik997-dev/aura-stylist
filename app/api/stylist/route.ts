import { NextRequest, NextResponse } from "next/server";
import type { StylistRequest, StylistResponse, StylistRecommendation, FaceAnalysis } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValid(a: unknown): a is FaceAnalysis {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.faceShape === "string" && typeof x.skinToneHex === "string";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured." }, { status: 500 });
    }

    const body = (await req.json()) as StylistRequest;
    if (!isValid(body?.analysis)) {
      return NextResponse.json({ error: "Invalid analysis payload." }, { status: 400 });
    }

    const { faceShape, skinToneHex, seasonalTone, metrics } = body.analysis;

    // Use native fetch instead of Anthropic SDK to avoid Node 24 punycode issue
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `You are a professional color and style consultant for a fashion AI app.
Return ONLY valid JSON with no markdown, no code fences, no extra text:
{
  "summary": "2 sentence personalized style summary",
  "colorPalette": [
    { "name": "Color Name", "hex": "#RRGGBB", "reason": "why this suits them" }
  ],
  "styleAdvice": ["tip 1", "tip 2", "tip 3"],
  "avoid": ["avoid 1", "avoid 2"]
}
Give exactly 4 palette colors with real hex codes, 3 style tips, 2 things to avoid.`,
        messages: [{
          role: "user",
          content: `Analyze this person:
Face shape: ${faceShape}
Skin tone: ${skinToneHex}
Seasonal tone: ${seasonalTone}
Face width/height ratio: ${metrics?.faceWidthRatio ?? "unknown"}
Pupillary distance: ${metrics?.pupillaryDistance ?? "unknown"}

Give personalized style recommendations.`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[stylist] Anthropic API error:", response.status, err);
      return NextResponse.json({ error: `Anthropic API error: ${response.status}` }, { status: 502 });
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    let recommendation: StylistRecommendation;
    try {
      recommendation = JSON.parse(text);
    } catch {
      console.error("[stylist] JSON parse failed:", text.slice(0, 200));
      return NextResponse.json({ error: "Stylist returned invalid format." }, { status: 502 });
    }

    const payload: StylistResponse = { recommendation };
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });

  } catch (err) {
    console.error("[stylist] error:", err);
    return NextResponse.json({ error: "Stylist engine failed. Try again." }, { status: 500 });
  }
}
