import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { openCouponItems, openCoupons } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Replace the contents (and/or label) of an open coupon. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const couponId = Number(id);
    if (!Number.isFinite(couponId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await req.json();

    const result = await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(openCoupons)
        .where(eq(openCoupons.id, couponId))
        .limit(1);
      if (existing.length === 0) throw new Error("Open coupon not found");

      if (body.label !== undefined) {
        const label = String(body.label).trim().slice(0, 60) || "Ticket";
        await tx
          .update(openCoupons)
          .set({ label, updatedAt: new Date() })
          .where(eq(openCoupons.id, couponId));
      }

      if (Array.isArray(body.items)) {
        const rows: { couponId: number; productId: number; quantity: number }[] = [];
        for (const it of body.items) {
          const productId = Number(it.productId);
          const quantity = Math.floor(Number(it.quantity));
          if (!Number.isFinite(productId) || !Number.isFinite(quantity))
            throw new Error("Invalid coupon item");
          if (quantity > 0) rows.push({ couponId, productId, quantity });
        }
        await tx.delete(openCouponItems).where(eq(openCouponItems.couponId, couponId));
        if (rows.length > 0) await tx.insert(openCouponItems).values(rows);
        await tx
          .update(openCoupons)
          .set({ updatedAt: new Date() })
          .where(eq(openCoupons.id, couponId));
      }

      const [coupon] = await tx
        .select()
        .from(openCoupons)
        .where(eq(openCoupons.id, couponId))
        .limit(1);
      const items = await tx
        .select()
        .from(openCouponItems)
        .where(eq(openCouponItems.couponId, couponId));

      return {
        ...coupon,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      };
    });

    return NextResponse.json({ coupon: result });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to update open coupon" },
      { status: 400 }
    );
  }
}

/** Discard an open coupon without selling anything (no stock movement). */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const couponId = Number(id);
    if (!Number.isFinite(couponId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const [deleted] = await db
      .delete(openCoupons)
      .where(eq(openCoupons.id, couponId))
      .returning({ id: openCoupons.id });
    if (!deleted)
      return NextResponse.json({ error: "Open coupon not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to discard coupon" }, { status: 500 });
  }
}
