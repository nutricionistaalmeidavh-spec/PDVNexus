import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../apps/pdv-demo/src/PdvDemoApp.tsx",import.meta.url),"utf8");
function style(name){const start=ui.indexOf(name+": {");assert.ok(start>=0,"estilo "+name+" ausente");return ui.slice(start,start+550).split("},")[0];}
test("21 seletores de negocio possuem nome acessivel especifico",()=>{
 const all=[...ui.matchAll(/<select\s+aria-label="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(all.length,21);
 assert.ok(all.every(x=>x.length>12));
 assert.equal(new Set(all).size,21);
});
test("historicos e tabelas com rolagem sao navegaveis pelo teclado",()=>{
 assert.equal((ui.match(/role="region" tabIndex=\{0\} aria-label="[^"]+" style=\{styles\.tableScroll\}/g)||[]).length,9);
 assert.match(ui,/role="region" tabIndex=\{0\} aria-label="Tabela de produtos e variações" style=\{styles\.productTableScroll\}/);
});
test("caixa usa fonte legivel para estado vazio, busca, categorias e status",()=>{
 for(const [name,minimum] of [
  ["cashierEmptyState",14],["cashierSearchInput",15],["cashierEyebrow",11],
  ["cashierStatusTile",12],["categoryButton",12],["productTile",12],["productBadge",11]
 ]){
  const value=Number(style(name).match(/fontSize: "(\d+)px"/)?.[1]);
  assert.ok(value>=minimum,name+" deve ter no minimo "+minimum+"px");
 }
 assert.match(style("cashierEmptyState"),/color: "#334155"/);
 assert.match(style("cashierSurface"),/maxWidth: "1440px"/);
});

test("ajustes de leitura atingem a folha CSS final, nao apenas estilos inline sobrescritos",()=>{
 const entry=readFileSync(new URL("../apps/pdv-demo/src/main.tsx",import.meta.url),"utf8");
 const css=readFileSync(new URL("../apps/pdv-demo/src/pdv-cashier-legibility-fix.css",import.meta.url),"utf8");
 assert.match(entry,/import "\.\/pdv-cashier-legibility-fix\.css"/);
 assert.match(css,/P0 accessibility and readability: final CSS layer/);
 assert.match(css,/min-height: 34px !important/);
 assert.match(css,/font-size: 12px !important/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/outline: 3px solid #f59e0b/);
});
