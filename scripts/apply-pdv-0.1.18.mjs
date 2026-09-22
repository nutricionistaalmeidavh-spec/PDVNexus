import fs from "node:fs";

const appPaths = [
  "windows-10/apps/pdv-demo/src/PdvDemoApp.tsx",
  "windows-7/apps/pdv-demo/src/PdvDemoApp.tsx"
];

const quantityFunction = `  const adjustSaleItemQuantity = (itemId: string, delta: -1 | 1) => {
    const visibleItem = sale?.items.find((item) => item.id === itemId);
    if (!visibleItem || visibleItem.source !== "catalog" || visibleItem.unitLabel !== "UN") return;
    const product = catalogProducts.find((item) => item.productCode === visibleItem.productCode);
    if (!product) return setLastEvent(\`Produto \${visibleItem.productName} não foi encontrado no catálogo.\`);
    const nextQuantity = Math.max(0, Math.floor(visibleItem.quantity + delta));
    if (nextQuantity > product.stock) return setLastEvent(\`Estoque insuficiente para \${product.productName}. Disponível: \${product.stock}.\`);
    setSale((current) => {
      if (!current) return current;
      const target = current.items.find((item) => item.id === itemId);
      if (!target || target.source !== "catalog" || target.unitLabel !== "UN") return current;
      const adjustedQuantity = Math.max(0, Math.floor(target.quantity + delta));
      if (adjustedQuantity > product.stock) return current;
      const items = adjustedQuantity === 0
        ? current.items.filter((item) => item.id !== itemId)
        : current.items.map((item) => item.id === itemId ? {
            ...item,
            quantity: adjustedQuantity,
            totalPrice: roundCurrency(item.unitPrice * adjustedQuantity),
            regularTotalPrice: roundCurrency(item.unitPrice * adjustedQuantity),
            promotionDiscount: 0,
            pricingLabel: undefined
          } : item);
      return { ...current, items: repricePromotionSaleItems(items, catalogProducts, promotionGroups) };
    });
    setLastEvent(nextQuantity === 0 ? \`\${visibleItem.productName} removido da venda.\` : \`Quantidade de \${visibleItem.productName} ajustada para \${nextQuantity}.\`);
  };
`;

const oldOrderItems = `<div style={styles.orderItems}>{(sale?.items ?? []).map((item) => <div key={item.id} style={styles.orderItem}><div><strong>{item.productName}</strong><span>{item.quantity.toFixed(item.unitLabel === "KG" ? 3 : 0)} {item.unitLabel} x {formatCurrency(item.unitPrice)}</span>{item.pricingLabel ? <small style={styles.promoText}>{item.pricingLabel} · economia {formatCurrency(item.promotionDiscount ?? 0)}</small> : null}</div><strong>{formatCurrency(item.totalPrice)}</strong></div>)}`;

const newOrderItems = `<div style={styles.orderItems}>{(sale?.items ?? []).map((item) => <div key={item.id} style={styles.orderItem}><div><strong>{item.productName}</strong><span>{item.quantity.toFixed(item.unitLabel === "KG" ? 3 : 0)} {item.unitLabel} x {formatCurrency(item.unitPrice)}</span>{item.pricingLabel ? <small style={styles.promoText}>{item.pricingLabel} · economia {formatCurrency(item.promotionDiscount ?? 0)}</small> : null}</div><div style={{ display: "grid", gap: "5px", justifyItems: "end" }}>{item.source === "catalog" && item.unitLabel === "UN" ? <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><button type="button" aria-label={\`Diminuir quantidade de \${item.productName}\`} onClick={() => adjustSaleItemQuantity(item.id, -1)} style={{ width: "28px", height: "28px", border: "1px solid #cbd5e1", borderRadius: "5px", background: "#ffffff", cursor: "pointer", fontWeight: 900 }}>−</button><strong style={{ minWidth: "20px", textAlign: "center" }}>{item.quantity.toFixed(0)}</strong><button type="button" aria-label={\`Aumentar quantidade de \${item.productName}\`} onClick={() => adjustSaleItemQuantity(item.id, 1)} disabled={item.quantity >= (catalogProducts.find((product) => product.productCode === item.productCode)?.stock ?? 0)} style={{ width: "28px", height: "28px", border: "1px solid #cbd5e1", borderRadius: "5px", background: "#ffffff", cursor: "pointer", fontWeight: 900 }}>+</button></div> : null}<strong>{formatCurrency(item.totalPrice)}</strong></div></div>)}`;

for (const appPath of appPaths) {
  let source = fs.readFileSync(appPath, "utf8");
  if (!source.includes("const adjustSaleItemQuantity")) {
    const marker = "  const addWeightedSaleItem = ";
    const index = source.indexOf(marker);
    if (index < 0) throw new Error(`Marcador de quantidade não encontrado em ${appPath}`);
    source = source.slice(0, index) + quantityFunction + source.slice(index);
  }
  if (source.includes(oldOrderItems)) {
    source = source.replace(oldOrderItems, newOrderItems);
  } else if (!source.includes("Diminuir quantidade")) {
    throw new Error(`Linha do carrinho não encontrada em ${appPath}`);
  }
  fs.writeFileSync(appPath, source);
}

const releasePath = "pdv-release.json";
const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
release.version = "0.1.18";
fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);

const publishPath = ".github/workflows/publish-pdv-release.yml";
let publish = fs.readFileSync(publishPath, "utf8");
if (!publish.includes("Protect published version from overwrite")) {
  const marker = "      - name: Check Drive synchronization credential\n";
  if (!publish.includes(marker)) throw new Error("Marcador do workflow de publicação não encontrado.");
  const guard = `      - name: Protect published version from overwrite
        if: steps.gates.outputs.ready == 'true' && steps.existing.outputs.exists == 'true' && steps.existing.outputs.draft != 'true'
        shell: bash
        run: |
          echo "::error::${{ steps.version.outputs.tag }} já foi publicada. Incremente pdv-release.json antes de gerar novos instaladores."
          exit 1

`;
  publish = publish.replace(marker, guard + marker);
  fs.writeFileSync(publishPath, publish);
}

console.log("PDV 0.1.18 patch aplicado em Windows 10, Windows 7 e pipeline de release.");
