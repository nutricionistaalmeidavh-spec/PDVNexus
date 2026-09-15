import assert from "node:assert/strict";
import test from "node:test";
import {
  decorateReceiptWithSaleObservation,
  mergeSaleObservationsIntoSnapshot,
  saveSaleObservationDraft
} from "../apps/pdv-demo/src/saleObservation.js";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  get length() { return this.values.size; }
}

function installWindowStorage() {
  const storage = new MemoryStorage();
  (globalThis as typeof globalThis & { window: { localStorage: Storage } }).window = {
    localStorage: storage as unknown as Storage
  };
  return storage;
}

const receipt = [
  "PDV Nexus",
  "CUPOM NAO FISCAL",
  "------------------------------------------",
  "Venda: 000321",
  "Data: 14/09/2026 21:00",
  "Operador: Caixa",
  "Cliente: Cliente Teste",
  "------------------------------------------",
  "TOTAL                              10,00",
  "------------------------------------------",
  "Obrigado pela preferencia",
  ""
].join("\n");

test("observacao interna fica vinculada a venda sem aparecer no cupom", () => {
  installWindowStorage();
  saveSaleObservationDraft({
    saleNumber: "000321",
    customerId: "CLI-321",
    customerName: "Cliente Teste",
    note: "Entregar pela portaria lateral",
    printOnReceipt: false
  });

  const merged = mergeSaleObservationsIntoSnapshot(JSON.stringify({
    completedSales: [{ number: "000321", customerId: "CLI-321" }],
    extensions: { cancelledSales: [] }
  }));
  const snapshot = JSON.parse(merged.snapshotJson) as { completedSales: Array<Record<string, unknown>> };

  assert.equal(snapshot.completedSales[0].observation, "Entregar pela portaria lateral");
  assert.equal(snapshot.completedSales[0].printObservation, false);
  assert.equal(decorateReceiptWithSaleObservation(receipt), receipt);
});

test("observacao marcada para impressao aparece uma vez no cupom nao fiscal", () => {
  installWindowStorage();
  saveSaleObservationDraft({
    saleNumber: "000321",
    customerId: "CLI-321",
    customerName: "Cliente Teste",
    note: "Separar 2 caixas. Cliente retira amanha as 10h.",
    printOnReceipt: true
  });

  const decorated = decorateReceiptWithSaleObservation(receipt);
  assert.match(decorated, /OBSERVACOES DA VENDA/);
  assert.match(decorated, /Separar 2 caixas/);
  assert.equal(decorated.match(/OBSERVACOES DA VENDA/g)?.length, 1);
  assert.equal(decorateReceiptWithSaleObservation(decorated), decorated);
});

test("observacao impressa fica limitada a 120 caracteres e quatro linhas em bobina 58mm", () => {
  installWindowStorage();
  const separator58 = "-".repeat(32);
  const receipt58 = receipt.replaceAll("-".repeat(42), separator58);
  saveSaleObservationDraft({
    saleNumber: "000321",
    customerId: "CLI-321",
    customerName: "Cliente Teste",
    note: "X".repeat(500),
    printOnReceipt: true
  });

  const decorated = decorateReceiptWithSaleObservation(receipt58);
  const sectionBody = decorated.split("OBSERVACOES DA VENDA\n")[1]?.split(`\n${separator58}`)[0] ?? "";
  const observationLines = sectionBody.trim().split("\n");

  assert.equal(observationLines.length, 4);
  assert.equal(observationLines.join("").length, 120);
  assert.ok(observationLines.every((line) => line.length <= 32));
});
