import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { openCouponItems, openCoupons } from "@/db/schema";
import { asc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const MAX_OPEN_COUPONS = 10;

export async function GET() {
  const coupons = await db.select().from(openCoupons).orderBy(asc(openCoupons.id));
  const items = coupons.length
    ? await db.select().from(openCouponItems)
    : [];

  const byCoupon = new Map<number, { productId: number; quantity: number }[]>();
  for (const it of items) {
    const arr = byCoupon.get(it.couponId) ?? [];
    arr.push({ productId: it.productId, quantity: it.quantity });
    byCoupon.set(it.couponId, arr);
  }

  return NextResponse.json({
    maxOpen: MAX_OPEN_COUPONS,
    coupons: coupons.map((c) => ({ ...c, items: byCoupon.get(c.id) ?? [] })),
  });
}

/** Open a brand-new empty coupon (up to MAX_OPEN_COUPONS at once). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const created = await db.transaction(async (tx) => {
      const [{ count }] = (
        await tx.execute(sql`select count(*)::int as count from open_coupons`)
      ).rows as any[];

      if (Number(count) >= MAX_OPEN_COUPONS) {
        throw new Error(
          `You can keep at most ${MAX_OPEN_COUPONS} coupons open — close or discard one first`
        );
      }

      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 60)
          : `Ticket ${Number(count) + 1}`;

      const [row] = await tx.insert(openCoupons).values({ label }).returning();
      return row;
    });

    return NextResponse.json({ coupon: { ...created, items: [] } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to open a coupon" },
      { status: 400 }
    );
  }
}
