export type ProductDTO = {
  id: number;
  name: string;
  barcode: string;
  quantity: number;
  buyPriceCents: number;
  sellPriceCents: number;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleDTO = {
  id: number;
  couponNumber: number;
  status: string;
  itemCount: number;
  totalCostCents: number;
  totalCents: number;
  amountReceivedCents: number | null;
  changeCents: number | null;
  closedAt: string;
  items?: SaleItemDTO[];
};

export type SaleItemDTO = {
  id: number;
  saleId: number;
  productId: number | null;
  productName: string;
  barcode: string;
  quantity: number;
  unitBuyCents: number;
  unitSellCents: number;
};

export type PurchaseItemDTO = {
  id: number;
  purchaseId: number;
  productId: number | null;
  productName: string;
  barcode: string;
  quantity: number;
  unitCostCents: number;
  unitSellCents: number;
  expiryDate: string | null;
  isNewProduct: boolean;
};

export type PurchaseDTO = {
  id: number;
  purchaseNumber: number;
  supplier: string | null;
  note: string | null;
  itemCount: number;
  totalCostCents: number;
  purchasedAt: string;
  items: PurchaseItemDTO[];
};

/** A line being drafted in the Buys screen before the coupon is saved. */
export type DraftBuyLine = {
  key: string;
  productId: number | null;
  name: string;
  barcode: string;
  quantity: number;
  buyPriceCents: number;
  sellPriceCents: number;
  expiryDate: string | null;
  isNew: boolean;
};

export type OpenCouponDTO = {
  id: number;
  label: string;
  createdAt: string;
  items: { productId: number; quantity: number }[];
};

export type LossDTO = {
  id: number;
  productId: number | null;
  productName: string;
  quantity: number;
  unitCostCents: number;
  reason: string;
  note: string | null;
  createdAt: string;
};

export type SettingsDTO = {
  id: number;
  expiryAlertDays: number;
  lowStockThreshold: number;
  currency: string;
  updatedAt: string;
};

export type InsightDTO = {
  id: string;
  type: "expiry" | "low-stock" | "loss" | "profit" | "stale";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  action?: string;
  productId?: number;
  createdAt: string;
};

export type StatsDTO = {
  currency: string;
  totals: {
    couponsClosed: number;
    productsSold: number;
    soldCostCents: number;
    soldRevenueCents: number;
    profitCents: number;
    lossValueCents: number;
    lossUnits: number;
    lossEvents: number;
    purchaseSpendCents: number;
    purchaseCount: number;
    purchaseUnits: number;
    productCount: number;
    stockUnits: number;
    stockCostCents: number;
    stockRetailCents: number;
    marginPct: number;
  };
  series: { date: string; label: string; revenue: number; profit: number }[];
  topProducts: { name: string; units: number; revenue: number; profit: number }[];
  expiring: {
    id: number;
    name: string;
    barcode: string;
    quantity: number;
    daysLeft: number;
    expiryDate: string;
    valueCents: number;
    status: "expired" | "expiring";
  }[];
  lowStock: { id: number; name: string; quantity: number; barcode: string }[];
  recentSales: {
    id: number;
    couponNumber: number;
    itemCount: number;
    totalCents: number;
    closedAt: string;
  }[];
};
