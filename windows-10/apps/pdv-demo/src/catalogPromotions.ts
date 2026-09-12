import { normalizeQuantityPriceRules, type QuantityPriceRule } from "./quantityPricing";

export type CatalogProductKind = "standard" | "parent" | "variant";

export type PromotionGroup = {
  id: string;
  name: string;
  quantityPriceRules: QuantityPriceRule[];
  active?: boolean;
};

export type PromotionCatalogProduct = {
  productCode: string;
  productName: string;
  itemType: "unit" | "weight";
  unitPrice: number;
  quantityPriceRules?: QuantityPriceRule[];
  productKind?: CatalogProductKind;
  parentProductCode?: string;
  variantLabel?: string;
  promotionGroupId?: string;
};

export type PromotionSaleItem = {
  id: string;
  productCode: string;
  productName: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  source?: string;
  regularTotalPrice?: number;
  promotionDiscount?: number;
  pricingLabel?: string;
};

export type EffectivePromotion = {
  key: string;
  label: string;
  source: "product" | "parent" | "group";
  quantityPriceRules: QuantityPriceRule[];
};

export type GroupedQuantityPricingResult = {
  regularTotal: number;
  totalPrice: number;
  savings: number;
  bundledQuantity: number;
  appliedRules: Array<QuantityPriceRule & { applications: number }>;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export function isSellableCatalogProduct(product: PromotionCatalogProduct): boolean {
  return (product.productKind ?? "standard") !== "parent";
}

export function normalizePromotionGroups(value: unknown): PromotionGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: PromotionGroup[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Partial<PromotionGroup>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    groups.push({ id, name, active: candidate.active !== false, quantityPriceRules: normalizeQuantityPriceRules(candidate.quantityPriceRules) });
  }
  return groups;
}

export function resolveEffectivePromotion(
  product: PromotionCatalogProduct,
  products: PromotionCatalogProduct[],
  groups: PromotionGroup[]
): EffectivePromotion | null {
  if (product.itemType !== "unit" || !isSellableCatalogProduct(product)) return null;

  if ((product.productKind ?? "standard") === "variant" && product.parentProductCode) {
    const parent = products.find((item) => item.productCode === product.parentProductCode && (item.productKind ?? "standard") === "parent");
    const rules = normalizeQuantityPriceRules(parent?.quantityPriceRules);
    if (parent && rules.length) return { key: `parent:${parent.productCode}`, label: parent.productName, source: "parent", quantityPriceRules: rules };
  }

  if (product.promotionGroupId) {
    const group = groups.find((item) => item.id === product.promotionGroupId && item.active !== false);
    const rules = normalizeQuantityPriceRules(group?.quantityPriceRules);
    if (group && rules.length) return { key: `group:${group.id}`, label: group.name, source: "group", quantityPriceRules: rules };
  }

  const ownRules = normalizeQuantityPriceRules(product.quantityPriceRules);
  return ownRules.length ? { key: `product:${product.productCode}`, label: product.productName, source: "product", quantityPriceRules: ownRules } : null;
}

export function calculateGroupedQuantityPrice(unitPrices: number[], rules: QuantityPriceRule[] | undefined): GroupedQuantityPricingResult {
  const prices = unitPrices.filter((value) => Number.isFinite(value) && value >= 0).map(toCents).sort((a, b) => a - b);
  const regularCents = prices.reduce((sum, value) => sum + value, 0);
  const normalizedRules = normalizeQuantityPriceRules(rules);
  if (!prices.length || !normalizedRules.length) {
    return { regularTotal: fromCents(regularCents), totalPrice: fromCents(regularCents), savings: 0, bundledQuantity: 0, appliedRules: [] };
  }

  const count = prices.length;
  const cheapestPrefix = Array<number>(count + 1).fill(0);
  for (let index = 0; index < count; index += 1) cheapestPrefix[index + 1] = cheapestPrefix[index] + prices[index];

  const bundleCost = Array<number>(count + 1).fill(Number.POSITIVE_INFINITY);
  const previous: Array<{ count: number; rule: QuantityPriceRule } | null> = Array(count + 1).fill(null);
  bundleCost[0] = 0;

  for (let bundled = 1; bundled <= count; bundled += 1) {
    for (const rule of normalizedRules) {
      if (rule.quantity > bundled || !Number.isFinite(bundleCost[bundled - rule.quantity])) continue;
      const candidate = bundleCost[bundled - rule.quantity] + toCents(rule.bundlePrice);
      if (candidate < bundleCost[bundled]) {
        bundleCost[bundled] = candidate;
        previous[bundled] = { count: bundled - rule.quantity, rule };
      }
    }
  }

  let bestTotal = regularCents;
  let bestBundledQuantity = 0;
  for (let bundled = 1; bundled <= count; bundled += 1) {
    if (!Number.isFinite(bundleCost[bundled])) continue;
    const regularRemainderCount = count - bundled;
    const candidate = bundleCost[bundled] + cheapestPrefix[regularRemainderCount];
    if (candidate < bestTotal) {
      bestTotal = candidate;
      bestBundledQuantity = bundled;
    }
  }

  const applications = new Map<string, QuantityPriceRule & { applications: number }>();
  let cursor = bestBundledQuantity;
  while (cursor > 0 && previous[cursor]) {
    const step = previous[cursor]!;
    const key = `${step.rule.quantity}:${toCents(step.rule.bundlePrice)}`;
    const existing = applications.get(key);
    applications.set(key, existing ? { ...existing, applications: existing.applications + 1 } : { ...step.rule, applications: 1 });
    cursor = step.count;
  }

  return {
    regularTotal: fromCents(regularCents),
    totalPrice: fromCents(bestTotal),
    savings: fromCents(regularCents - bestTotal),
    bundledQuantity: bestBundledQuantity,
    appliedRules: [...applications.values()].sort((a, b) => a.quantity - b.quantity)
  };
}

function buildPricingLabel(promotion: EffectivePromotion, pricing: GroupedQuantityPricingResult): string | undefined {
  if (pricing.savings <= 0 || !pricing.appliedRules.length) return undefined;
  const rules = pricing.appliedRules.map((rule) => `${rule.applications > 1 ? `${rule.applications}x ` : ""}${rule.quantity} por ${fromCents(toCents(rule.bundlePrice)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" + ");
  const prefix = promotion.source === "group" ? `Grupo ${promotion.label}` : promotion.source === "parent" ? `${promotion.label} (variações)` : promotion.label;
  return `${prefix}: ${rules}`;
}

export function repricePromotionSaleItems<TItem extends PromotionSaleItem, TProduct extends PromotionCatalogProduct>(
  items: TItem[],
  products: TProduct[],
  groups: PromotionGroup[]
): TItem[] {
  const byCode = new Map(products.map((product) => [product.productCode, product]));
  const resetItems = items.map((item) => {
    const product = byCode.get(item.productCode);
    if (!product || product.itemType !== "unit" || item.unitLabel !== "UN" || !Number.isInteger(item.quantity) || item.quantity < 0) return item;
    const regularTotal = fromCents(toCents(item.unitPrice) * item.quantity);
    return { ...item, totalPrice: regularTotal, regularTotalPrice: regularTotal, promotionDiscount: 0, pricingLabel: undefined } as TItem;
  });

  const buckets = new Map<string, { promotion: EffectivePromotion; indexes: number[] }>();
  resetItems.forEach((item, index) => {
    const product = byCode.get(item.productCode);
    if (!product || product.itemType !== "unit" || item.unitLabel !== "UN" || !Number.isInteger(item.quantity) || item.quantity <= 0) return;
    const promotion = resolveEffectivePromotion(product, products, groups);
    if (!promotion) return;
    const current = buckets.get(promotion.key) ?? { promotion, indexes: [] };
    current.indexes.push(index);
    buckets.set(promotion.key, current);
  });

  const next = [...resetItems];
  for (const { promotion, indexes } of buckets.values()) {
    const unitPrices: number[] = [];
    for (const index of indexes) {
      const item = next[index];
      for (let count = 0; count < item.quantity; count += 1) unitPrices.push(item.unitPrice);
    }
    const pricing = calculateGroupedQuantityPrice(unitPrices, promotion.quantityPriceRules);
    if (pricing.savings <= 0) continue;

    const lineRegularCents = indexes.map((index) => toCents(next[index].unitPrice) * next[index].quantity);
    const regularCents = lineRegularCents.reduce((sum, value) => sum + value, 0);
    const savingsCents = toCents(pricing.savings);
    let allocated = 0;
    const label = buildPricingLabel(promotion, pricing);

    indexes.forEach((index, position) => {
      const regularLine = lineRegularCents[position];
      const discount = position === indexes.length - 1
        ? savingsCents - allocated
        : Math.min(regularLine, Math.floor((savingsCents * regularLine) / Math.max(regularCents, 1)));
      allocated += discount;
      next[index] = {
        ...next[index],
        totalPrice: fromCents(regularLine - discount),
        regularTotalPrice: fromCents(regularLine),
        promotionDiscount: fromCents(discount),
        pricingLabel: label
      } as TItem;
    });
  }

  return next;
}

export function describeProductPromotion(product: PromotionCatalogProduct, products: PromotionCatalogProduct[], groups: PromotionGroup[]): string {
  const promotion = resolveEffectivePromotion(product, products, groups);
  if (!promotion) return "-";
  const rules = promotion.quantityPriceRules.map((rule) => `${rule.quantity} por ${rule.bundlePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join(" | ");
  if (promotion.source === "parent") return `Herdado de ${promotion.label}: ${rules}`;
  if (promotion.source === "group") return `Grupo ${promotion.label}: ${rules}`;
  return rules;
}
