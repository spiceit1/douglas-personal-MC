import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    // Try common workspace locations
    const candidates = [
      process.env.HEARTBEAT_MD_PATH,
      path.join(process.env.WORKSPACE_PATH ?? "", "HEARTBEAT.md"),
      path.join(process.env.HOME ?? "", ".openclaw", "workspace", "HEARTBEAT.md"),
      "/Users/douglasdweck/.openclaw/workspace/HEARTBEAT.md",
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        return NextResponse.json({ content, path: p });
      }
    }

    return NextResponse.json({ content: "HEARTBEAT.md not found. Set HEARTBEAT_MD_PATH env var to the full path." });
  } catch (e: unknown) {
    return NextResponse.json({ content: `Error reading HEARTBEAT.md: ${e instanceof Error ? e.message : String(e)}` });
  }
}
