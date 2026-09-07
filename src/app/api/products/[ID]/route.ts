import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const productId = Number(id);
    if (!Number.isFinite(productId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      patch.name = name;
    }
    if (body.barcode !== undefined) {
      const barcode = String(body.barcode).trim();
      if (!barcode) return NextResponse.json({ error: "Barcode cannot be empty" }, { status: 400 });
      patch.barcode = barcode;
    }
    if (body.quantity !== undefined) {
      const quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity < 0)
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      patch.quantity = Math.floor(quantity);
    }
    if (body.buyPriceCents !== undefined) {
      const v = Number(body.buyPriceCents);
      if (!Number.isFinite(v) || v < 0)
        return NextResponse.json({ error: "Invalid buy price" }, { status: 400 });
      patch.buyPriceCents = Math.round(v);
    }
    if (body.sellPriceCents !== undefined) {
      const v = Number(body.sellPriceCents);
      if (!Number.isFinite(v) || v < 0)
        return NextResponse.json({ error: "Invalid sell price" }, { status: 400 });
      patch.sellPriceCents = Math.round(v);
    }
    if (body.expiryDate !== undefined) {
      patch.expiryDate =
        body.expiryDate && String(body.expiryDate).length >= 8
          ? String(body.expiryDate)
          : null;
    }

    const [updated] = await db
      .update(products)
      .set(patch)
      .where(eq(products.id, productId))
      .returning();

    if (!updated) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ product: updated });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("unique") || e?.code === "23505") {
      return NextResponse.json(
        { error: "A product with this barcode already exists" },
        { status: 409 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const productId = Number(id);
    if (!Number.isFinite(productId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [deleted] = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning({ id: products.id });
    if (!deleted) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
