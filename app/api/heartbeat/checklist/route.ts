import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const sql = getDb();
    // Store HEARTBEAT.md content in the DB so it works on any deployment
    const rows = await sql`SELECT value FROM mc_settings WHERE key = 'heartbeat_md' LIMIT 1`;
    if (rows.length > 0) {
      return NextResponse.json({ content: rows[0].value });
    }
    return NextResponse.json({ content: "No HEARTBEAT.md content found in DB.\n\nRun this to sync it:\nInsert into mc_settings (key, value) the contents of your HEARTBEAT.md file." });
  } catch (e: unknown) {
    return NextResponse.json({ content: `Error: ${e instanceof Error ? e.message : String(e)}` });
  }
}
