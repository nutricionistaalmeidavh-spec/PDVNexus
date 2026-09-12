import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuantityPrice, normalizeQuantityPriceRules } from "../apps/pdv-demo/src/quantityPricing.js";
import { calculateGroupedQuantityPrice, repricePromotionSaleItems, resolveEffectivePromotion, type PromotionCatalogProduct, type PromotionGroup } from "../apps/pdv-demo/src/catalogPromotions.js";

test("aplica a melhor combinacao entre preco unitario e multiplas faixas", () => {
  const rules = [{ quantity: 3, bundlePrice: 10 }, { quantity: 6, bundlePrice: 18 }];
  const cases = new Map([
    [1, 3.99], [2, 7.98], [3, 10], [4, 13.99], [5, 17.98],
    [6, 18], [7, 21.99], [8, 25.98], [9, 28], [12, 36]
  ]);

  for (const [quantity, expected] of cases) {
    assert.equal(calculateQuantityPrice(quantity, 3.99, rules).totalPrice, expected);
  }
});

test("nao escolhe faixa pior do que combinar faixas menores", () => {
  const result = calculateQuantityPrice(6, 3.99, [{ quantity: 3, bundlePrice: 10 }, { quantity: 6, bundlePrice: 21 }]);
  assert.equal(result.totalPrice, 20);
  assert.deepEqual(result.appliedBundles, [{ quantity: 3, bundlePrice: 10, count: 2 }]);
});

test("mantem preco normal quando nao existe combo aplicavel", () => {
  assert.equal(calculateQuantityPrice(2, 3.99, [{ quantity: 3, bundlePrice: 10 }]).totalPrice, 7.98);
});

test("normaliza duplicatas pela menor faixa cadastrada", () => {
  assert.deepEqual(normalizeQuantityPriceRules([
    { quantity: 3, bundlePrice: 10.5 },
    { quantity: 3, bundlePrice: 10 },
    { quantity: 1, bundlePrice: 1 },
    { quantity: 6, bundlePrice: 18 }
  ]), [{ quantity: 3, bundlePrice: 10 }, { quantity: 6, bundlePrice: 18 }]);
});

const promotionProducts: PromotionCatalogProduct[] = [
  { productCode: "TANG", productName: "Tang", itemType: "unit", unitPrice: 3.99, productKind: "parent", quantityPriceRules: [{ quantity: 3, bundlePrice: 10 }] },
  { productCode: "LAR", productName: "Tang Laranja", itemType: "unit", unitPrice: 3.99, productKind: "variant", parentProductCode: "TANG" },
  { productCode: "UVA", productName: "Tang Uva", itemType: "unit", unitPrice: 3.99, productKind: "variant", parentProductCode: "TANG" },
  { productCode: "LIM", productName: "Tang Limao", itemType: "unit", unitPrice: 3.99, productKind: "variant", parentProductCode: "TANG" },
  { productCode: "A", productName: "Refri A", itemType: "unit", unitPrice: 5, promotionGroupId: "REFRI" },
  { productCode: "B", productName: "Refri B", itemType: "unit", unitPrice: 7, promotionGroupId: "REFRI" },
  { productCode: "C", productName: "Refri C", itemType: "unit", unitPrice: 8, promotionGroupId: "REFRI" }
];
const promotionGroups: PromotionGroup[] = [{ id: "REFRI", name: "Refrigerantes", quantityPriceRules: [{ quantity: 3, bundlePrice: 15 }] }];
const saleItem = (productCode: string, quantity: number, unitPrice: number) => ({ id: productCode, productCode, productName: productCode, unitLabel: "UN", quantity, unitPrice, totalPrice: quantity * unitPrice, source: "catalog" });

test("soma sabores diferentes da mesma familia na promocao sem misturar os SKUs", () => {
  const result = repricePromotionSaleItems([saleItem("LAR", 1, 3.99), saleItem("UVA", 1, 3.99), saleItem("LIM", 1, 3.99)], promotionProducts, promotionGroups);
  assert.equal(Number(result.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)), 10);
  assert.deepEqual(result.map((item) => item.productCode), ["LAR", "UVA", "LIM"]);
  assert.equal(Number(result.reduce((sum, item) => sum + (item.promotionDiscount ?? 0), 0).toFixed(2)), 1.97);
});

test("soma produtos independentes do mesmo grupo promocional", () => {
  const result = repricePromotionSaleItems([saleItem("A", 1, 5), saleItem("B", 1, 7), saleItem("C", 1, 8)], promotionProducts, promotionGroups);
  assert.equal(Number(result.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)), 15);
  assert.equal(Number(result.reduce((sum, item) => sum + (item.promotionDiscount ?? 0), 0).toFixed(2)), 5);
});

test("grupo com precos diferentes preserva o menor preco final", () => {
  const pricing = calculateGroupedQuantityPrice([2, 5, 7, 8], [{ quantity: 3, bundlePrice: 15 }]);
  assert.equal(pricing.regularTotal, 22);
  assert.equal(pricing.totalPrice, 17);
  assert.equal(pricing.savings, 5);
});

test("promocao nunca aumenta o total e variante prioriza regra do produto principal", () => {
  assert.equal(calculateGroupedQuantityPrice([3, 3, 3], [{ quantity: 3, bundlePrice: 12 }]).totalPrice, 9);
  const variant = { ...promotionProducts[1], promotionGroupId: "REFRI" };
  const resolved = resolveEffectivePromotion(variant, [promotionProducts[0], variant, ...promotionProducts.slice(2)], promotionGroups);
  assert.equal(resolved?.source, "parent");
  assert.equal(resolved?.key, "parent:TANG");
});
