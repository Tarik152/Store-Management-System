import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function ensureSettings() {
  const rows = await db.select().from(settings).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db
    .insert(settings)
    .values({ expiryAlertDays: 7, lowStockThreshold: 5, currency: "$" })
    .returning();
  return created;
}

export async function GET() {
  const s = await ensureSettings();
  return NextResponse.json({ settings: s });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const current = await ensureSettings();
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (body.expiryAlertDays !== undefined) {
      const v = Math.floor(Number(body.expiryAlertDays));
      if (!Number.isFinite(v) || v < 0 || v > 365)
        return NextResponse.json({ error: "Alert days must be 0–365" }, { status: 400 });
      patch.expiryAlertDays = v;
    }
    if (body.lowStockThreshold !== undefined) {
      const v = Math.floor(Number(body.lowStockThreshold));
      if (!Number.isFinite(v) || v < 0 || v > 100000)
        return NextResponse.json({ error: "Invalid low stock threshold" }, { status: 400 });
      patch.lowStockThreshold = v;
    }
    if (body.currency !== undefined) {
      const v = String(body.currency).slice(0, 4).trim();
      if (!v) return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
      patch.currency = v;
    }

    const [updated] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.id, current.id))
      .returning();
    return NextResponse.json({ settings: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
