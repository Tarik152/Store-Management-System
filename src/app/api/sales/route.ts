import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { openCoupons, products, saleItems, sales } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(sales)
    .orderBy(desc(sales.closedAt))
    .limit(200);

  const items = rows.length
    ? await db
        .select()
        .from(saleItems)
        .where(
          sql`${saleItems.saleId} in (${sql.join(
            rows.map((r) => sql`${r.id}`),
            sql`, `
          )})`
        )
    : [];

  const bySale = new Map<number, typeof items>();
  for (const it of items) {
    const arr = bySale.get(it.saleId) ?? [];
    arr.push(it);
    bySale.set(it.saleId, arr);
  }

  return NextResponse.json({
    sales: rows.map((s) => ({ ...s, items: bySale.get(s.id) ?? [] })),
  });
}

/** Close a coupon: create sale + items, decrement stock atomically. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: { productId: number; quantity: number }[] = Array.isArray(body.items)
      ? body.items
      : [];
    if (items.length === 0)
      return NextResponse.json({ error: "Coupon has no items" }, { status: 400 });

    const amountReceivedCents =
      body.amountReceivedCents === null || body.amountReceivedCents === undefined
        ? null
        : Math.round(Number(body.amountReceivedCents));
    if (amountReceivedCents !== null && (!Number.isFinite(amountReceivedCents) || amountReceivedCents < 0))
      return NextResponse.json({ error: "Invalid amount received" }, { status: 400 });

    for (const it of items) {
      if (
        !Number.isFinite(Number(it.productId)) ||
        !Number.isFinite(Number(it.quantity)) ||
        Number(it.quantity) <= 0
      ) {
        return NextResponse.json({ error: "Invalid coupon item" }, { status: 400 });
      }
    }

    const result = await db.transaction(async (tx) => {
      let totalCents = 0;
      let totalCostCents = 0;
      let itemCount = 0;
      const snapshots: {
        productId: number;
        productName: string;
        barcode: string;
        quantity: number;
        unitBuyCents: number;
        unitSellCents: number;
      }[] = [];

      for (const it of items) {
        const pid = Number(it.productId);
        const qty = Math.floor(Number(it.quantity));

        // Lock the row for update so concurrent coupons can't oversell
        const locked = await tx.execute(
          sql`select id, name, barcode, quantity, buy_price_cents as "buyPriceCents", sell_price_cents as "sellPriceCents" from products where id = ${pid} for update`
        );
        const row = (locked.rows as any[])[0];
        if (!row) throw new Error(`Product ${pid} not found`);
        if (row.quantity < qty)
          throw new Error(`Not enough stock for "${row.name}" (have ${row.quantity}, need ${qty})`);

        await tx
          .update(products)
          .set({ quantity: row.quantity - qty, updatedAt: new Date() })
          .where(eq(products.id, pid));

        totalCents += row.sellPriceCents * qty;
        totalCostCents += row.buyPriceCents * qty;
        itemCount += qty;
        snapshots.push({
          productId: pid,
          productName: row.name,
          barcode: row.barcode,
          quantity: qty,
          unitBuyCents: row.buyPriceCents,
          unitSellCents: row.sellPriceCents,
        });
      }

      if (amountReceivedCents !== null && amountReceivedCents < totalCents)
        throw new Error(`Insufficient payment: received is less than the total`);

      const [{ maxCoupon }] = (await tx.execute(
        sql`select coalesce(max(coupon_number), 1000) as "maxCoupon" from sales`
      )).rows as any[];

      const [sale] = await tx
        .insert(sales)
        .values({
          couponNumber: Number(maxCoupon) + 1,
          status: "closed",
          itemCount,
          totalCents,
          totalCostCents,
          amountReceivedCents,
          changeCents:
            amountReceivedCents === null ? null : amountReceivedCents - totalCents,
        })
        .returning();

      await tx.insert(saleItems).values(
        snapshots.map((s) => ({ ...s, saleId: sale.id }))
      );

      // If this basket came from a parked/open coupon, retire it now.
      const openCouponId = Number(body.openCouponId);
      if (Number.isFinite(openCouponId)) {
        await tx.delete(openCoupons).where(eq(openCoupons.id, openCouponId));
      }

      return sale;
    });

    return NextResponse.json({ sale: result }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to close coupon" },
      { status: 400 }
    );
  }
}
