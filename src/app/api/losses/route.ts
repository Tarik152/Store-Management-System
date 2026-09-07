import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { losses, products } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ALLOWED_REASONS = new Set(["expired", "damaged", "spoiled", "stolen", "other"]);

export async function GET() {
  const rows = await db.select().from(losses).orderBy(desc(losses.createdAt)).limit(300);
  return NextResponse.json({ losses: rows });
}

/** Record a loss and remove the units from stock. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const productId = Number(body.productId);
    const quantity = Math.floor(Number(body.quantity));
    const reason = ALLOWED_REASONS.has(String(body.reason))
      ? String(body.reason)
      : "other";
    const note = body.note ? String(body.note).slice(0, 500) : null;

    if (!Number.isFinite(productId))
      return NextResponse.json({ error: "Product is required" }, { status: 400 });
    if (!Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`select id, name, quantity, buy_price_cents as "buyPriceCents" from products where id = ${productId} for update`
      );
      const row = (locked.rows as any[])[0];
      if (!row) throw new Error("Product not found");
      if (row.quantity < quantity)
        throw new Error(`Only ${row.quantity} unit(s) of "${row.name}" in stock`);

      await tx
        .update(products)
        .set({ quantity: row.quantity - quantity, updatedAt: new Date() })
        .where(eq(products.id, productId));

      const [loss] = await tx
        .insert(losses)
        .values({
          productId,
          productName: row.name,
          quantity,
          unitCostCents: row.buyPriceCents,
          reason,
          note,
        })
        .returning();
      return loss;
    });

    return NextResponse.json({ loss: result }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to record loss" },
      { status: 400 }
    );
  }
}
