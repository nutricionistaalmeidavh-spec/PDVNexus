import assert from "node:assert/strict";
import test from "node:test";
import { findPdvProducts, calculatePdvGrossMargin } from "../apps/pdv-demo/src/productSearch";
import { completePdvSale } from "../packages/database/src/pdv";

const products = [
  { productCode: "10001", barcode: "7891234567895", productName: "Café Pilão Tradicional", category: "Mercearia", brand: "Pilão", active: true },
  { productCode: "10002", barcode: "7891234567888", productName: "Café Extraforte", category: "Mercearia", brand: "Outra", active: true },
  { productCode: "10003", barcode: "7891234567871", productName: "Leite Integral", category: "Laticínios", brand: "Campo", active: true },
  { productCode: "10004", barcode: "7891234567864", productName: "Café Inativo", category: "Mercearia", active: false }
];

test("busca por código de barras e código exatos tem prioridade sobre nome parcial", () => {
  assert.deepEqual(findPdvProducts(products, "7891234567895").map(item => item.productCode), ["10001"]);
  assert.deepEqual(findPdvProducts(products, "10002").map(item => item.productCode), ["10002"]);
});

test("busca por parte do nome ignora acentos, diferencia ambiguidades e produtos inativos", () => {
  assert.deepEqual(findPdvProducts(products, "pilao").map(item => item.productCode), ["10001"]);
  assert.deepEqual(findPdvProducts(products, "café").map(item => item.productCode), ["10001", "10002"]);
  assert.deepEqual(findPdvProducts(products, "campo").map(item => item.productCode), ["10003"]);
  assert.deepEqual(findPdvProducts(products, "naoexiste"), []);
});

test("margem bruta usa custo de aquisição e não inventa custo desconhecido", () => {
  assert.equal(calculatePdvGrossMargin(50, 35), 30);
  assert.equal(calculatePdvGrossMargin(40, 50), -25);
  assert.equal(calculatePdvGrossMargin(100, undefined), null);
});

test("histórico de vendas persiste para além das 100 últimas vendas", () => {
  const previous = Array.from({ length: 250 }, (_, i) => ({ number: "ANT-" + i }));
  const result = completePdvSale({
    finalizedAt: "2026-11-06 20:30",
    completedSales: previous,
    products: [{ productCode: "TESTE", productName: "Produto", stock: 500 }],
    customer: { id: "CLI", name: "Cliente", creditLimit: 0, creditUsed: 0 },
    sale: {
      number: "NOVA",
      discountPercent: 0,
      items: [{ productCode: "TESTE", productName: "Produto", quantity: 1, unitPrice: 10 }],
      payments: [{ method: "DINHEIRO", amount: 10 }]
    }
  });
  assert.equal(result.completedSales.length, 251);
  assert.equal(result.completedSales[250].number, "ANT-249");
});
