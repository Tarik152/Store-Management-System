import "dotenv/config";
import pg from "pg";

/**
 * One-off backfill: creates historical purchase coupons for products that
 * already exist in the catalogue, so the Buys page reflects how the current
 * stock originally entered the store. Safe to run once; it exits if the
 * purchases table already has rows.
 */

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const SUPPLIERS = [
  "Metro Wholesale",
  "FreshFields Dairy",
  "Golden Grain Co.",
  "Sunrise Beverages",
];

async function main() {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query("select count(*)::int as c from purchases");
    if (existing[0].c > 0) {
      console.log(`Purchases already present (${existing[0].c}) — nothing to backfill.`);
      return;
    }

    const { rows: products } = await client.query(
      `select id, name, barcode, quantity, buy_price_cents, sell_price_cents, expiry_date
       from products order by id`
    );
    if (products.length === 0) {
      console.log("No products to backfill.");
      return;
    }

    await client.query("BEGIN");

    // Reconstruct how much of each product originally came in:
    // current stock + units sold + units lost.
    const { rows: sold } = await client.query(
      `select product_id, sum(quantity)::int as qty from sale_items
       where product_id is not null group by product_id`
    );
    const { rows: lost } = await client.query(
      `select product_id, sum(quantity)::int as qty from losses
       where product_id is not null group by product_id`
    );
    const soldMap = new Map(sold.map((r) => [r.product_id, r.qty]));
    const lostMap = new Map(lost.map((r) => [r.product_id, r.qty]));

    // Split the catalogue into 4 deliveries spread over the past 3 weeks
    const chunkSize = Math.ceil(products.length / 4);
    let purchaseNumber = 5001;
    let created = 0;

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const daysAgo = 20 - (i / chunkSize) * 6;
      const purchasedAt = new Date();
      purchasedAt.setDate(purchasedAt.getDate() - Math.round(daysAgo));
      purchasedAt.setHours(rand(7, 11), rand(0, 59), 0, 0);

      const lines = chunk.map((p) => {
        const received =
          p.quantity + (soldMap.get(p.id) ?? 0) + (lostMap.get(p.id) ?? 0);
        return { p, received: Math.max(received, 1) };
      });

      const totalCost = lines.reduce(
        (a, l) => a + l.received * l.p.buy_price_cents,
        0
      );
      const itemCount = lines.reduce((a, l) => a + l.received, 0);

      const { rows: purchaseRows } = await client.query(
        `insert into purchases (purchase_number, supplier, note, item_count, total_cost_cents, purchased_at)
         values ($1,$2,$3,$4,$5,$6) returning id`,
        [
          purchaseNumber++,
          SUPPLIERS[created % SUPPLIERS.length],
          "Opening stock delivery",
          itemCount,
          totalCost,
          purchasedAt,
        ]
      );
      const purchaseId = purchaseRows[0].id;

      for (const { p, received } of lines) {
        await client.query(
          `insert into purchase_items
             (purchase_id, product_id, product_name, barcode, quantity, unit_cost_cents, unit_sell_cents, expiry_date, is_new_product)
           values ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
          [
            purchaseId,
            p.id,
            p.name,
            p.barcode,
            received,
            p.buy_price_cents,
            p.sell_price_cents,
            p.expiry_date,
          ]
        );
      }
      created++;
    }

    await client.query("COMMIT");
    console.log(`Backfilled ${created} purchase coupons for ${products.length} products.`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
