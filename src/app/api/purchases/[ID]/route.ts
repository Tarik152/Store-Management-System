import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, purchaseItems, purchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const purchaseId = Number(id);
  if (!Number.isFinite(purchaseId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);
  if (!purchase)
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });

  const items = await db
    .select()
    .from(purchaseItems)
    .where(eq(purchaseItems.purchaseId, purchaseId));
  return NextResponse.json({ purchase: { ...purchase, items } });
}

/** Update the header of a purchase coupon (supplier / note / date). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const purchaseId = Number(id);
    if (!Number.isFinite(purchaseId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const patch: Record<string, unknown> = {};
    if (body.supplier !== undefined)
      patch.supplier = body.supplier ? String(body.supplier).trim().slice(0, 120) : null;
    if (body.note !== undefined)
      patch.note = body.note ? String(body.note).trim().slice(0, 500) : null;
    if (body.purchasedAt !== undefined) {
      const d = new Date(body.purchasedAt);
      if (Number.isNaN(d.getTime()))
        return NextResponse.json({ error: "Invalid date" }, { status: 400 });
      patch.purchasedAt = d;
    }

    if (Object.keys(patch).length === 0)
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const [updated] = await db
      .update(purchases)
      .set(patch)
      .where(eq(purchases.id, purchaseId))
      .returning();
    if (!updated)
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    return NextResponse.json({ purchase: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update purchase" }, { status: 500 });
  }
}

/**
 * Cancel a purchase coupon: every received unit is pulled back out of stock.
 * Refused if the goods have already been sold or written off.
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const purchaseId = Number(id);
    if (!Number.isFinite(purchaseId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await db.transaction(async (tx) => {
      const [purchase] = await tx
        .select()
        .from(purchases)
        .where(eq(purchases.id, purchaseId))
        .limit(1);
      if (!purchase) throw new Error("Purchase not found");

      const items = await tx
        .select()
        .from(purchaseItems)
        .where(eq(purchaseItems.purchaseId, purchaseId));

      for (const it of items) {
        if (it.productId === null) continue;
        const locked = (
          await tx.execute(
            sql`select id, name, quantity from products where id = ${it.productId} for update`
          )
        ).rows as any[];
        if (locked.length === 0) continue;
        const row = locked[0];
        if (Number(row.quantity) < it.quantity)
          throw new Error(
            `Cannot cancel: only ${row.quantity} of "${row.name}" left in stock, ${it.quantity} were received. Some units were already sold or lost.`
          );
        await tx
          .update(products)
          .set({
            quantity: Number(row.quantity) - it.quantity,
            updatedAt: new Date(),
          })
          .where(eq(products.id, it.productId));
      }

      await tx.delete(purchases).where(eq(purchases.id, purchaseId));
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to cancel purchase" },
      { status: 400 }
    );
  }
}
