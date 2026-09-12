import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuantityPrice, normalizeQuantityPriceRules } from "../apps/pdv-demo/src/quantityPricing.js";

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
