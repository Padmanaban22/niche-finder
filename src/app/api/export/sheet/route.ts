import { NextResponse } from "next/server";
import { exportToGoogleSheet } from "@/lib/google-sheets";

const GOOGLE_DRIVE_FOLDER_ID = "121HMHvifajY9S0GGWVb_zdoAsGJL3JzY";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, rows } = body;

    if (!query) {
      return NextResponse.json({ error: "Search query string is required" }, { status: 400 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No data to save" }, { status: 400 });
    }

    // Format IST Date: +05:30
    const now = new Date();
    const istTime = new Date(now.getTime() + (330 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(istTime.getUTCDate()).padStart(2, "0");
    const hour = String(istTime.getUTCHours()).padStart(2, "0");
    const minute = String(istTime.getUTCMinutes()).padStart(2, "0");
    
    const dateStr = `${year}-${month}-${day}_${hour}-${minute}-IST`;
    const sanitizedQuery = query.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
    const fileName = `${dateStr}_${sanitizedQuery}`;

    const sheetUrl = await exportToGoogleSheet(fileName, rows, GOOGLE_DRIVE_FOLDER_ID);

    return NextResponse.json({ success: true, url: sheetUrl });
  } catch (error: any) {
    console.error("Error creating Google Sheet:", error);
    return NextResponse.json({ error: error.message || "Failed to save to Google Sheets" }, { status: 500 });
  }
}
