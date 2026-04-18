import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are a YouTube Niche Search Expert. A user will give you a natural language prompt defining what kind of longform YouTube channels they want to find. 
Your job is to translate their intent into structured search filters.

IMPORTANT: The user wants to find "Longform" niches, so make sure to target non-Shorts content if applicable.
If the user mentions an "RPM of $X or higher", you must infer what kind of YouTube niches typically have that RPM (e.g., $5+ RPM might be Finance, Tech, Software, Business, Real Estate, E-commerce, Health). Generate an array of 5-10 specific broad and long-tail YouTube search queries (e.g., "personal finance for beginners", "how to start dropshipping", "crypto news today") that belong to those niches and are highly searched.

Calculate any dates relative to today: ${new Date().toISOString().slice(0, 10)}.

Output a valid JSON object matching this schema:
{
  "queries": ["query1", "query2", ...], // Up to 10 youtube search queries that match the intent
  "filters": {
    "minViews": number | null, // e.g. 1000000
    "maxViews": number | null,
    "firstVideoUploadedAfter": string | null, // ISO date string. e.g. for "started in the last 60 days", calculate date 60 days ago.
    "publishedAfter": string | null, // ISO date string. e.g. for "got views in 30 days", we use publishedAfter to target recently uploaded videos.
    "publishedBefore": string | null,
    "videoDuration": "long" | "medium" | "short" // Always use "long" unless specified otherwise
  }
}
Return ONLY valid JSON (no markdown wrapping).`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\nUser Prompt: " + prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const responseText = result.response.text();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json({ data: parsedData });
  } catch (error: any) {
    console.error("AI Parse Prompt Error:", error);
    return NextResponse.json({ error: error.message || "Failed to parse prompt" }, { status: 500 });
  }
}
