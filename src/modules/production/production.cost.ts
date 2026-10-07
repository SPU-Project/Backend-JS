export interface RawMaterialCostItem {
  rawMaterialId: number;
  qty: number;
  unitPrice: number;
}

export interface PackagingCostItem {
  namaKemasan: string;
  harga: number;
}

export interface OverheadCostItem {
  namaOverhead: string;
  harga: number;
}

export interface RecipeCostBreakdown {
  rawMaterialCost: number;
  packagingCost: number;
  overheadCost: number;
  totalHpp: number;
}

/**
 * Pure function to calculate accurate HPP (Cost of Goods Sold).
 * Guaranteed idempotent and eliminates cumulative calculation bug (B1).
 */
export function calculateRecipeCost(
  rawMaterials: RawMaterialCostItem[],
  packaging: PackagingCostItem[],
  overheads: OverheadCostItem[]
): RecipeCostBreakdown {
  const rawMaterialCost = rawMaterials.reduce((sum, item) => {
    return sum + Number(item.qty) * Number(item.unitPrice);
  }, 0);

  const packagingCost = packaging.reduce((sum, item) => {
    return sum + Number(item.harga);
  }, 0);

  const overheadCost = overheads.reduce((sum, item) => {
    return sum + Number(item.harga);
  }, 0);

  const totalHpp = Number((rawMaterialCost + packagingCost + overheadCost).toFixed(3));

  return {
    rawMaterialCost: Number(rawMaterialCost.toFixed(3)),
    packagingCost: Number(packagingCost.toFixed(3)),
    overheadCost: Number(overheadCost.toFixed(3)),
    totalHpp,
  };
}

export interface MarginTier {
  percentage: number;
  sellingPrice: number;
  profit: number;
}

/**
 * Calculates dynamic selling prices and margins on the fly.
 * Replaces hardcoded duplicate columns (margin20..100).
 */
export function calculateMarginTiers(hpp: number): MarginTier[] {
  const percentages = [20, 30, 40, 50, 60, 70, 80, 90, 100];
  return percentages.map((pct) => {
    const sellingPrice = Number((hpp * (1 + pct / 100)).toFixed(3));
    const profit = Number((sellingPrice - hpp).toFixed(3));
    return {
      percentage: pct,
      sellingPrice,
      profit,
    };
  });
}
