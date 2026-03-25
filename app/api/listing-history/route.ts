import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — return price history for a flip
export async function GET(req: NextRequest) {
  try {
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const flipId = searchParams.get("flip_id");
    const platform = searchParams.get("platform");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!flipId) {
      return NextResponse.json({ error: "flip_id is required" }, { status: 400 });
    }

    let rows;
    if (platform) {
      rows = await sql`
        SELECT * FROM mc_listing_price_history 
        WHERE flip_id = ${flipId} AND platform = ${platform}
        ORDER BY checked_at DESC 
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM mc_listing_price_history 
        WHERE flip_id = ${flipId}
        ORDER BY checked_at DESC 
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ history: rows });
  } catch (e) {
    console.error("GET /api/listing-history error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — add a price check/adjustment record
export async function POST(req: NextRequest) {
  try {
    const sql = getDb();
    const body = await req.json();
    const {
      flip_id,
      platform,
      our_price,
      competitor_floor,
      competitor_listing_id,
      action, // "check" | "adjusted" | "no_change" | "error"
      old_price,
      new_price,
      reason,
    } = body;

    if (!flip_id || !platform) {
      return NextResponse.json({ error: "flip_id and platform are required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO mc_listing_price_history 
        (flip_id, platform, our_price, competitor_floor, competitor_listing_id, action, old_price, new_price, reason)
      VALUES 
        (${flip_id}, ${platform}, ${our_price ?? null}, ${competitor_floor ?? null}, ${competitor_listing_id ?? null}, ${action ?? "check"}, ${old_price ?? null}, ${new_price ?? null}, ${reason ?? null})
      RETURNING *
    `;

    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("POST /api/listing-history error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
