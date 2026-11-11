import assert from "node:assert/strict";
import test from "node:test";
import { buildRamuzaAtena2Load, encodeRamuzaWindows1252 } from "../packages/modules/balanca/src/ramuzaAtena2.js";

const produto = { productCode: "00021", productName: "Picanha Bovina", unitPrice: 79.9, itemType: "weight" as const, shelfLifeDays: 3, category: "Acougue" };

test("gera CADTXT.TXT Filizola com 39 bytes e SETORTXT.TXT com 25 bytes", () => {
  const result = buildRamuzaAtena2Load([produto]);
  assert.equal(result.productCount, 1);
  assert.equal(result.sectorCount, 1);
  assert.equal(result.productsFile.filename, "CADTXT.TXT");
  assert.equal(result.sectorsFile.filename, "SETORTXT.TXT");
  assert.equal(result.productsFile.text, `000021P${"Picanha Bovina".padEnd(22, " ")}0007990003\r\n`);
  assert.equal(result.sectorsFile.text, `${"ACOUGUE".padEnd(12, " ")}0000210001000\r\n`);
  assert.equal(result.productsFile.bytes.length, 41);
  assert.equal(result.sectorsFile.bytes.length, 27);
});

test("gera texto em Windows-1252, incluindo acentos, sem gravar UTF-8", () => {
  const bytes = encodeRamuzaWindows1252("PÃO – CAFÉ");
  assert.deepEqual(Array.from(bytes), [80, 195, 79, 32, 150, 32, 67, 65, 70, 201]);
  assert.throws(() => encodeRamuzaWindows1252("🥩"), /Windows-1252/);
});

test("valida duplicatas, codigo numerico, preco e validade antes da carga", () => {
  assert.throws(() => buildRamuzaAtena2Load([produto, { ...produto, productCode: "21" }]), /duplicado/);
  assert.throws(() => buildRamuzaAtena2Load([{ ...produto, productCode: "ABC" }]), /codigo/);
  assert.throws(() => buildRamuzaAtena2Load([{ ...produto, unitPrice: -1 }]), /preco/);
  assert.throws(() => buildRamuzaAtena2Load([{ ...produto, unitPrice: 100000 }]), /preco/);
  assert.throws(() => buildRamuzaAtena2Load([{ ...produto, shelfLifeDays: 1000 }]), /validade/);
});

test("preserva catalogo e exporta somente produtos ativos e pesaveis por padrao", () => {
  const lista = [
    produto,
    { ...produto, productCode: "00022", itemType: "unit" as const },
    { ...produto, productCode: "00023", active: false }
  ];
  const original = JSON.stringify(lista);
  const result = buildRamuzaAtena2Load(lista);
  assert.equal(result.productCount, 1);
  assert.equal(JSON.stringify(lista), original);
  const comUnidades = buildRamuzaAtena2Load(lista, { includeUnitProducts: true });
  assert.equal(comUnidades.productCount, 2);
  assert.match(comUnidades.productsFile.text, /000022U/);
});

test("produz arquivos deterministas e rejeita catalogo vazio", () => {
  const x = buildRamuzaAtena2Load([produto, { ...produto, productCode: "00023", category: "Hortifruti" }]);
  const y = buildRamuzaAtena2Load([{ ...produto, productCode: "00023", category: "Hortifruti" }, produto]);
  assert.deepEqual(x.productsFile.bytes, y.productsFile.bytes);
  assert.deepEqual(x.sectorsFile.bytes, y.sectorsFile.bytes);
  assert.throws(() => buildRamuzaAtena2Load([]), /nenhum produto/);
});
