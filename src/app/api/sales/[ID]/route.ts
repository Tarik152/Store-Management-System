import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, saleItems, sales } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const saleId = Number(id);
  if (!Number.isFinite(saleId))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
  if (!sale) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  return NextResponse.json({ sale: { ...sale, items } });
}

/**
 * Modify an already-closed coupon.
 * Stock is reconciled by the delta of every line, historical unit prices are
 * preserved for lines that already existed, and totals/change are recomputed.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const saleId = Number(id);
    if (!Number.isFinite(saleId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const incoming: { productId: number; quantity: number }[] = Array.isArray(body.items)
      ? body.items
      : [];

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1);
      if (!sale) throw new Error("Coupon not found");

      const existing = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId));

      // Lines whose product was deleted from the catalogue stay frozen.
      const orphans = existing.filter((l) => l.productId === null);
      const editable = existing.filter((l) => l.productId !== null);

      const oldMap = new Map<number, (typeof editable)[number]>();
      for (const l of editable) oldMap.set(l.productId as number, l);

      const newMap = new Map<number, number>();
      for (const it of incoming) {
        const pid = Number(it.productId);
        const qty = Math.floor(Number(it.quantity));
        if (!Number.isFinite(pid) || !Number.isFinite(qty) || qty < 0)
          throw new Error("Invalid coupon item");
        if (qty > 0) newMap.set(pid, (newMap.get(pid) ?? 0) + qty);
      }

      if (newMap.size === 0 && orphans.length === 0)
        throw new Error("A coupon needs at least one item — void it instead");

      const pids = Array.from(new Set<number>([...oldMap.keys(), ...newMap.keys()]));
      const resolved: {
        productId: number;
        productName: string;
        barcode: string;
        quantity: number;
        unitBuyCents: number;
        unitSellCents: number;
      }[] = [];

      for (const pid of pids) {
        const prev = oldMap.get(pid);
        const oldQty = prev?.quantity ?? 0;
        const newQty = newMap.get(pid) ?? 0;
        const delta = newQty - oldQty;

        const locked = await tx.execute(
          sql`select id, name, barcode, quantity, buy_price_cents as "buyPriceCents", sell_price_cents as "sellPriceCents" from products where id = ${pid} for update`
        );
        const row = (locked.rows as any[])[0];

        if (!row && delta > 0)
          throw new Error("One of the products no longer exists in the catalogue");

        if (row && delta !== 0) {
          if (delta > 0 && row.quantity < delta)
            throw new Error(
              `Not enough stock for "${row.name}" — ${row.quantity} left, ${delta} more needed`
            );
          await tx
            .update(products)
            .set({ quantity: row.quantity - delta, updatedAt: new Date() })
            .where(eq(products.id, pid));
        }

        if (newQty > 0) {
          resolved.push({
            productId: pid,
            productName: prev?.productName ?? row.name,
            barcode: prev?.barcode ?? row.barcode,
            quantity: newQty,
            // keep the price the customer actually paid on existing lines
            unitBuyCents: prev?.unitBuyCents ?? row.buyPriceCents,
            unitSellCents: prev?.unitSellCents ?? row.sellPriceCents,
          });
        }
      }

      for (const l of editable) {
        await tx.delete(saleItems).where(eq(saleItems.id, l.id));
      }
      if (resolved.length > 0) {
        await tx.insert(saleItems).values(resolved.map((r) => ({ ...r, saleId })));
      }

      const allLines = [
        ...orphans.map((o) => ({
          quantity: o.quantity,
          unitBuyCents: o.unitBuyCents,
          unitSellCents: o.unitSellCents,
        })),
        ...resolved,
      ];
      const totalCents = allLines.reduce((a, l) => a + l.quantity * l.unitSellCents, 0);
      const totalCostCents = allLines.reduce((a, l) => a + l.quantity * l.unitBuyCents, 0);
      const itemCount = allLines.reduce((a, l) => a + l.quantity, 0);

      let received: number | null = sale.amountReceivedCents;
      if (body.amountReceivedCents !== undefined) {
        received =
          body.amountReceivedCents === null
            ? null
            : Math.round(Number(body.amountReceivedCents));
      }
      if (received !== null) {
        if (!Number.isFinite(received) || received < 0)
          throw new Error("Invalid amount received");
        if (received < totalCents)
          throw new Error(
            "The amount received no longer covers the total — update the cash given"
          );
      }

      const [updated] = await tx
        .update(sales)
        .set({
          itemCount,
          totalCents,
          totalCostCents,
          amountReceivedCents: received,
          changeCents: received === null ? null : received - totalCents,
        })
        .where(eq(sales.id, saleId))
        .returning();

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      return { ...updated, items };
    });

    return NextResponse.json({ sale: result });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to modify coupon" },
      { status: 400 }
    );
  }
}

/** Void a coupon entirely and put every unit back on the shelf. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const saleId = Number(id);
    if (!Number.isFinite(saleId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1);
      if (!sale) throw new Error("Coupon not found");

      const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
      for (const it of items) {
        if (it.productId === null) continue;
        await tx
          .update(products)
          .set({
            quantity: sql`${products.quantity} + ${it.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, it.productId));
      }
      await tx.delete(sales).where(eq(sales.id, saleId));
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to void coupon" },
      { status: 400 }
    );
  }
}
