import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function rowToFlip(r: Record<string, unknown>) {
  return {
    id: r.id,
    eventName: r.event_name,
    eventDate: r.event_date,
    venue: r.venue,
    section: r.section,
    row: r.row,
    quantity: r.quantity,
    buyPlatform: r.buy_platform,
    buyPrice: Number(r.buy_price),
    buyerFee: Number(r.buyer_fee),
    deliveryFee: Number(r.delivery_fee),
    buyAllIn: Number(r.buy_all_in),
    listPrice: Number(r.list_price),
    sellerFee: Number(r.seller_fee),
    status: r.status,
    purchasedAt: r.purchased_at,
    soldAt: r.sold_at,
    soldPrice: r.sold_price ? Number(r.sold_price) : null,
    profit: r.profit ? Number(r.profit) : null,
    roi: r.roi ? Number(r.roi) : null,
    notes: r.notes,
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const sql = getDb();

    // Get existing flip
    const existing = await sql`SELECT * FROM mc_flips WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Flip not found" }, { status: 404 });
    }

    const flip = existing[0];
    let soldPrice = body.soldPrice !== undefined ? body.soldPrice : flip.sold_price;
    let profit = flip.profit;
    let roi = flip.roi;
    let soldAt = flip.sold_at;
    let status = body.status || flip.status;

    // If marking sold, compute profit & ROI
    if (body.soldPrice !== undefined && body.soldPrice !== null) {
      const qty = Number(flip.quantity);
      const sellerFee = Number(flip.seller_fee) || 0.15;
      const soldRevenue = body.soldPrice * (1 - sellerFee) * qty;
      const totalCost = Number(flip.buy_all_in) * qty;
      profit = soldRevenue - totalCost;
      roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
      soldAt = new Date().toISOString();
      status = profit >= 0 ? "sold" : "loss";
    }

    await sql`UPDATE mc_flips SET
      event_name = ${body.eventName ?? flip.event_name},
      event_date = ${body.eventDate ?? flip.event_date},
      venue = ${body.venue ?? flip.venue},
      section = ${body.section ?? flip.section},
      row = ${body.row ?? flip.row},
      quantity = ${body.quantity ?? flip.quantity},
      buy_platform = ${body.buyPlatform ?? flip.buy_platform},
      buy_price = ${body.buyPrice ?? flip.buy_price},
      buyer_fee = ${body.buyerFee ?? flip.buyer_fee},
      delivery_fee = ${body.deliveryFee ?? flip.delivery_fee},
      buy_all_in = ${body.buyAllIn ?? flip.buy_all_in},
      list_price = ${body.listPrice ?? flip.list_price},
      seller_fee = ${body.sellerFee ?? flip.seller_fee},
      status = ${status},
      sold_at = ${soldAt},
      sold_price = ${soldPrice},
      profit = ${profit},
      roi = ${roi},
      notes = ${body.notes ?? flip.notes}
      WHERE id = ${id}`;

    const updated = await sql`SELECT * FROM mc_flips WHERE id = ${id}`;
    return NextResponse.json(rowToFlip(updated[0]));
  } catch (e) {
    console.error("PATCH /api/flips/[id] error:", e);
    return NextResponse.json({ error: "Failed to update flip" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sql = getDb();
    const result = await sql`DELETE FROM mc_flips WHERE id = ${id} RETURNING id`;
    if (result.length === 0) {
      return NextResponse.json({ error: "Flip not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/flips/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete flip" }, { status: 500 });
  }
}
