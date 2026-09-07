import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, purchaseItems, purchases } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(purchases)
    .orderBy(desc(purchases.purchasedAt))
    .limit(200);

  const items = rows.length ? await db.select().from(purchaseItems) : [];
  const byPurchase = new Map<number, typeof items>();
  for (const it of items) {
    const arr = byPurchase.get(it.purchaseId) ?? [];
    arr.push(it);
    byPurchase.set(it.purchaseId, arr);
  }

  return NextResponse.json({
    purchases: rows.map((p) => ({ ...p, items: byPurchase.get(p.id) ?? [] })),
  });
}

type IncomingLine = {
  productId?: number | null;
  name?: string;
  barcode?: string;
  quantity?: number;
  buyPriceCents?: number;
  sellPriceCents?: number;
  expiryDate?: string | null;
};

/**
 * Record a purchase coupon. Goods physically enter the store here:
 * known barcodes are restocked (with refreshed prices / expiry),
 * unknown barcodes create the product automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lines: IncomingLine[] = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0)
      return NextResponse.json({ error: "The purchase has no lines" }, { status: 400 });

    const supplier =
      typeof body.supplier === "string" && body.supplier.trim()
        ? body.supplier.trim().slice(0, 120)
        : null;
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 500)
        : null;
    const purchasedAt = body.purchasedAt ? new Date(body.purchasedAt) : new Date();
    if (Number.isNaN(purchasedAt.getTime()))
      return NextResponse.json({ error: "Invalid purchase date" }, { status: 400 });

    // ---- validate before touching anything --------------------------------
    const clean = lines.map((l, idx) => {
      const name = String(l.name ?? "").trim();
      const barcode = String(l.barcode ?? "").trim();
      const hasProductId = l.productId !== null && l.productId !== undefined;
      const quantity = Math.floor(Number(l.quantity));
      const buyPriceCents = Math.round(Number(l.buyPriceCents));
      const sellPriceCents = Math.round(Number(l.sellPriceCents));
      const expiryDate =
        l.expiryDate && String(l.expiryDate).length >= 8 ? String(l.expiryDate) : null;

      // A restock identifies the article by id; the barcode is then optional.
      if (!barcode && !hasProductId)
        throw new Error(`Line ${idx + 1}: barcode is required for a new article`);
      if (!name && !hasProductId)
        throw new Error(`Line ${idx + 1}: product name is required`);
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new Error(`Line ${idx + 1}: quantity must be at least 1`);
      if (!Number.isFinite(buyPriceCents) || buyPriceCents < 0)
        throw new Error(`Line ${idx + 1}: invalid buy price`);
      if (!Number.isFinite(sellPriceCents) || sellPriceCents < 0)
        throw new Error(`Line ${idx + 1}: invalid sell price`);

      return {
        productId:
          l.productId === null || l.productId === undefined ? null : Number(l.productId),
        name,
        barcode,
        quantity,
        buyPriceCents,
        sellPriceCents,
        expiryDate,
      };
    });

    const result = await db.transaction(async (tx) => {
      let totalCostCents = 0;
      let itemCount = 0;
      const snapshots: {
        productId: number;
        productName: string;
        barcode: string;
        quantity: number;
        unitCostCents: number;
        unitSellCents: number;
        expiryDate: string | null;
        isNewProduct: boolean;
      }[] = [];

      for (const l of clean) {
        // Resolve by explicit id first, else by barcode (restock), else create.
        const found = (
          await tx.execute(
            l.productId !== null
              ? sql`select id, name, barcode, quantity from products where id = ${l.productId} for update`
              : sql`select id, name, barcode, quantity from products where barcode = ${l.barcode} for update`
          )
        ).rows as any[];

        let productId: number;
        let isNewProduct = false;

        if (found.length > 0) {
          productId = Number(found[0].id);
          // Fall back to the stored values when the client omitted them.
          l.name = l.name || String(found[0].name);
          l.barcode = l.barcode || String(found[0].barcode);
          await tx.execute(
            sql`update products set
                  name = ${l.name},
                  quantity = ${Number(found[0].quantity) + l.quantity},
                  buy_price_cents = ${l.buyPriceCents},
                  sell_price_cents = ${l.sellPriceCents},
                  expiry_date = ${l.expiryDate},
                  updated_at = now()
                where id = ${productId}`
          );
        } else {
          if (!l.barcode || !l.name)
            throw new Error("A new article needs both a name and a barcode");
          const [created] = await tx
            .insert(products)
            .values({
              name: l.name,
              barcode: l.barcode,
              quantity: l.quantity,
              buyPriceCents: l.buyPriceCents,
              sellPriceCents: l.sellPriceCents,
              expiryDate: l.expiryDate,
            })
            .returning({ id: products.id });
          productId = created.id;
          isNewProduct = true;
        }

        totalCostCents += l.buyPriceCents * l.quantity;
        itemCount += l.quantity;
        snapshots.push({
          productId,
          productName: l.name,
          barcode: l.barcode,
          quantity: l.quantity,
          unitCostCents: l.buyPriceCents,
          unitSellCents: l.sellPriceCents,
          expiryDate: l.expiryDate,
          isNewProduct,
        });
      }

      const [{ maxNumber }] = (
        await tx.execute(
          sql`select coalesce(max(purchase_number), 5000) as "maxNumber" from purchases`
        )
      ).rows as any[];

      const [purchase] = await tx
        .insert(purchases)
        .values({
          purchaseNumber: Number(maxNumber) + 1,
          supplier,
          note,
          itemCount,
          totalCostCents,
          purchasedAt,
        })
        .returning();

      await tx
        .insert(purchaseItems)
        .values(snapshots.map((s) => ({ ...s, purchaseId: purchase.id })));

      return { ...purchase, items: snapshots };
    });

    return NextResponse.json({ purchase: result }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "23505")
      return NextResponse.json(
        { error: "Duplicate barcode in this purchase — merge the lines" },
        { status: 409 }
      );
    return NextResponse.json(
      { error: e?.message ?? "Failed to record the purchase" },
      { status: 400 }
    );
  }
}
