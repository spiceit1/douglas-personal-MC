import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — return all watches
export async function GET() {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM mc_ticket_watch ORDER BY created_at DESC`;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("GET /api/ticket-watch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST — add new watch
export async function POST(req: NextRequest) {
  try {
    const sql = getDb();
    const body = await req.json();
    const {
      event_name,
      venue,
      event_date,
      section_filter = "Floor GA",
      quantity = 2,
      max_price_per_ticket,
      alert_email,
      alert_telegram = true,
      notes,
    } = body;

    if (!event_name) {
      return NextResponse.json({ error: "event_name is required" }, { status: 400 });
    }

    const rows = await sql`
      INSERT INTO mc_ticket_watch
        (event_name, venue, event_date, section_filter, quantity, max_price_per_ticket, alert_email, alert_telegram, notes)
      VALUES
        (${event_name}, ${venue ?? null}, ${event_date ?? null}, ${section_filter}, ${quantity}, ${max_price_per_ticket ?? null}, ${alert_email ?? null}, ${alert_telegram}, ${notes ?? null})
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (e) {
    console.error("POST /api/ticket-watch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — update a watch
export async function PATCH(req: NextRequest) {
  try {
    const sql = getDb();
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Build dynamic update
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const allowed = [
      "event_name", "venue", "event_date", "section_filter", "quantity",
      "max_price_per_ticket", "alert_email", "alert_telegram", "status",
      "notes", "last_checked_at", "last_cheapest_price", "last_cheapest_platform",
      "last_cheapest_url", "price_history",
    ];

    for (const key of allowed) {
      if (key in fields) {
        updates.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    const query = `UPDATE mc_ticket_watch SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`;
    const rows = await sql.query(query, values);
    return NextResponse.json(rows[0] ?? null);
  } catch (e) {
    console.error("PATCH /api/ticket-watch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE — remove a watch
export async function DELETE(req: NextRequest) {
  try {
    const sql = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await sql`DELETE FROM mc_ticket_watch WHERE id = ${parseInt(id)}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/ticket-watch error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
