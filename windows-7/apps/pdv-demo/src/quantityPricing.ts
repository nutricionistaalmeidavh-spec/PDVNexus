export type QuantityPriceRule = {
  quantity: number;
  bundlePrice: number;
};

export type AppliedQuantityPriceRule = QuantityPriceRule & {
  count: number;
};

export type QuantityPricingResult = {
  quantity: number;
  unitPrice: number;
  regularTotal: number;
  totalPrice: number;
  savings: number;
  appliedBundles: AppliedQuantityPriceRule[];
};

function toCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(value: number) {
  return Number((value / 100).toFixed(2));
}

export function normalizeQuantityPriceRules(rules: QuantityPriceRule[] | undefined): QuantityPriceRule[] {
  const bestByQuantity = new Map<number, number>();

  for (const rule of rules ?? []) {
    const quantity = Math.floor(Number(rule.quantity));
    const bundlePrice = Number(rule.bundlePrice);
    if (!Number.isFinite(quantity) || quantity < 2 || !Number.isFinite(bundlePrice) || bundlePrice <= 0) continue;
    const current = bestByQuantity.get(quantity);
    if (current === undefined || bundlePrice < current) bestByQuantity.set(quantity, bundlePrice);
  }

  return [...bestByQuantity.entries()]
    .map(([quantity, bundlePrice]) => ({ quantity, bundlePrice: fromCents(toCents(bundlePrice)) }))
    .sort((a, b) => a.quantity - b.quantity || a.bundlePrice - b.bundlePrice);
}

export function calculateQuantityPrice(
  quantity: number,
  unitPrice: number,
  rules: QuantityPriceRule[] | undefined
): QuantityPricingResult {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error("Quantidade para combo deve ser um inteiro maior ou igual a zero.");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Preco unitario invalido para combo.");

  const normalizedRules = normalizeQuantityPriceRules(rules);
  const unitPriceCents = toCents(unitPrice);
  const options = [
    { quantity: 1, priceCents: unitPriceCents, ruleIndex: -1 },
    ...normalizedRules.map((rule, ruleIndex) => ({ quantity: rule.quantity, priceCents: toCents(rule.bundlePrice), ruleIndex }))
  ];

  const bestCost = new Array<number>(quantity + 1).fill(Number.POSITIVE_INFINITY);
  const choice = new Array<number>(quantity + 1).fill(-1);
  bestCost[0] = 0;

  for (let currentQuantity = 1; currentQuantity <= quantity; currentQuantity += 1) {
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const option = options[optionIndex];
      if (option.quantity > currentQuantity) continue;
      const previousCost = bestCost[currentQuantity - option.quantity];
      if (!Number.isFinite(previousCost)) continue;
      const candidateCost = previousCost + option.priceCents;
      const selectedOption = choice[currentQuantity] >= 0 ? options[choice[currentQuantity]] : undefined;
      if (
        candidateCost < bestCost[currentQuantity]
        || (candidateCost === bestCost[currentQuantity] && option.quantity > (selectedOption?.quantity ?? 0))
      ) {
        bestCost[currentQuantity] = candidateCost;
        choice[currentQuantity] = optionIndex;
      }
    }
  }

  const ruleCounts = new Array<number>(normalizedRules.length).fill(0);
  let remaining = quantity;
  while (remaining > 0) {
    const selected = options[choice[remaining]];
    if (!selected) throw new Error("Nao foi possivel calcular o preco por quantidade.");
    if (selected.ruleIndex >= 0) ruleCounts[selected.ruleIndex] += 1;
    remaining -= selected.quantity;
  }

  const regularTotalCents = unitPriceCents * quantity;
  const totalPriceCents = bestCost[quantity];
  return {
    quantity,
    unitPrice: fromCents(unitPriceCents),
    regularTotal: fromCents(regularTotalCents),
    totalPrice: fromCents(totalPriceCents),
    savings: fromCents(Math.max(regularTotalCents - totalPriceCents, 0)),
    appliedBundles: normalizedRules
      .map((rule, index) => ({ ...rule, count: ruleCounts[index] }))
      .filter((rule) => rule.count > 0)
  };
}

export function formatQuantityPriceRules(rules: QuantityPriceRule[] | undefined) {
  return normalizeQuantityPriceRules(rules)
    .map((rule) => `${rule.quantity} por ${rule.bundlePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
    .join(" · ");
}

export function formatAppliedQuantityPrice(result: QuantityPricingResult) {
  return result.appliedBundles
    .map((rule) => `${rule.count > 1 ? `${rule.count}x ` : ""}${rule.quantity} por ${rule.bundlePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
    .join(" + ");
}
