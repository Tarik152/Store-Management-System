import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { desc, ilike, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = await db
      .select()
      .from(products)
      .where(or(ilike(products.name, like), ilike(products.barcode, like)))
      .orderBy(desc(products.updatedAt))
      .limit(200);
  } else {
    rows = await db
      .select()
      .from(products)
      .orderBy(desc(products.updatedAt))
      .limit(500);
  }
  return NextResponse.json({ products: rows });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const barcode = String(body.barcode ?? "").trim();
    const quantity = Number(body.quantity);
    const buyPriceCents = Number(body.buyPriceCents);
    const sellPriceCents = Number(body.sellPriceCents);
    const expiryDate =
      body.expiryDate && String(body.expiryDate).length >= 8
        ? String(body.expiryDate)
        : null;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!barcode) return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
    if (!Number.isFinite(quantity) || quantity < 0)
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    if (!Number.isFinite(buyPriceCents) || buyPriceCents < 0)
      return NextResponse.json({ error: "Invalid buy price" }, { status: 400 });
    if (!Number.isFinite(sellPriceCents) || sellPriceCents < 0)
      return NextResponse.json({ error: "Invalid sell price" }, { status: 400 });

    const [created] = await db
      .insert(products)
      .values({
        name,
        barcode,
        quantity: Math.floor(quantity),
        buyPriceCents: Math.round(buyPriceCents),
        sellPriceCents: Math.round(sellPriceCents),
        expiryDate,
      })
      .returning();
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message ?? "").includes("unique") || e?.code === "23505") {
      return NextResponse.json(
        { error: "A product with this barcode already exists" },
        { status: 409 }
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
