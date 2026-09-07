import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateEan13, ean13ChecksumDigit } from "@/lib/barcode";

export const dynamic = "force-dynamic";

/** POST → returns a unique, valid EAN-13 in-store barcode (prefix 20x). */
export async function POST() {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = generateEan13();
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.barcode, candidate))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ barcode: candidate });
    }
  }
  return NextResponse.json(
    { error: "Could not allocate a unique barcode, try again" },
    { status: 500 }
  );
}
