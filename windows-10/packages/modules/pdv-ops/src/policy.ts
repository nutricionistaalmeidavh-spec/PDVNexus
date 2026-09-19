export interface PdvQuantityPriceRule {
  quantity: number;
  bundlePrice: number;
}

export function resolvePdvPrice(input: {
  baseUnitPrice: number;
  quantity: number;
  quantityRules?: PdvQuantityPriceRule[];
  promotionUnitPrice?: number;
  manualUnitPrice?: number;
  manualOverrideAuthorized?: boolean;
}) {
  const quantity = Math.max(0, input.quantity);
  const baseUnitPrice = Math.max(0, input.baseUnitPrice);
  let total = quantity * baseUnitPrice;
  let label = "Preço padrão";

  const validRules = (input.quantityRules ?? [])
    .filter((rule) => rule.quantity > 0 && rule.bundlePrice >= 0)
    .sort((left, right) => right.quantity - left.quantity);
  const rule = validRules.find((candidate) => quantity >= candidate.quantity);
  if (rule) {
    const bundles = Math.floor(quantity / rule.quantity);
    const remainder = quantity % rule.quantity;
    total = bundles * rule.bundlePrice + remainder * baseUnitPrice;
    label = `${rule.quantity} por ${rule.bundlePrice.toFixed(2)}`;
  }

  if (Number.isFinite(input.promotionUnitPrice) && (input.promotionUnitPrice ?? -1) >= 0) {
    const promotionalTotal = quantity * Number(input.promotionUnitPrice);
    if (promotionalTotal < total) {
      total = promotionalTotal;
      label = "Promoção";
    }
  }

  if (input.manualOverrideAuthorized && Number.isFinite(input.manualUnitPrice) && (input.manualUnitPrice ?? -1) >= 0) {
    total = quantity * Number(input.manualUnitPrice);
    label = "Preço autorizado";
  }

  return {
    total: Math.round(total * 100) / 100,
    unitPrice: quantity > 0 ? Math.round((total / quantity) * 10000) / 10000 : baseUnitPrice,
    label
  };
}

export function mergePdvSettings<T extends Record<string, unknown>>(defaults: T, stored?: Partial<T> | null, patch?: Partial<T> | null): T {
  return { ...defaults, ...(stored ?? {}), ...(patch ?? {}) };
}

export type PdvRole = "cashier" | "manager" | "admin";
export type PdvPermission = "sale" | "discount" | "manual-price" | "cancel-sale" | "stock-adjustment" | "cash-withdrawal" | "cash-close" | "settings" | "users" | "reports" | "import";

const ROLE_PERMISSIONS: Record<PdvRole, ReadonlySet<PdvPermission>> = {
  cashier: new Set(["sale", "reports"]),
  manager: new Set(["sale", "discount", "manual-price", "cancel-sale", "stock-adjustment", "cash-withdrawal", "cash-close", "reports", "import"]),
  admin: new Set(["sale", "discount", "manual-price", "cancel-sale", "stock-adjustment", "cash-withdrawal", "cash-close", "settings", "users", "reports", "import"])
};

export function canPdvRole(role: PdvRole, permission: PdvPermission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function requirePdvPermission(role: PdvRole, permission: PdvPermission) {
  if (!canPdvRole(role, permission)) throw new Error(`Permissão '${permission}' negada para ${role}`);
}

export interface PdvInventoryProduct {
  productCode: string;
  productName: string;
  stock: number;
  minStock?: number;
}

export function applyPdvInventoryDelta<T extends PdvInventoryProduct>(input: {
  products: T[];
  productCode: string;
  delta: number;
  allowNegative?: boolean;
}) {
  let before = 0;
  let after = 0;
  let found = false;
  const products = input.products.map((product) => {
    if (product.productCode !== input.productCode) return product;
    found = true;
    before = product.stock;
    after = Math.round((product.stock + input.delta) * 1000) / 1000;
    if (!input.allowNegative && after < 0) throw new Error(`Estoque insuficiente para ${product.productName}`);
    return { ...product, stock: after };
  });
  if (!found) throw new Error(`Produto não encontrado: ${input.productCode}`);
  return { products, before, after };
}
