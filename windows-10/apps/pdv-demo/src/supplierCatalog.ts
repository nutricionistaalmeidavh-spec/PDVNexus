/** Product supplier refers to the canonical commercial ledger, never to a duplicate text registry. */
export type PdvSupplierIdentity = { id: string; name: string };
export type PdvSupplierLinkedProduct = { supplierId?: string };

export function resolveProductSupplier<T extends PdvSupplierIdentity>(
  supplierId: string | undefined, suppliers: readonly T[]
): T | null {
  return supplierId ? suppliers.find(supplier => supplier.id === supplierId) ?? null : null;
}

/** Captures the name in the sale line so later supplier edits do not rewrite history. */
export function supplierSnapshotForProduct(
  product: PdvSupplierLinkedProduct, suppliers: readonly PdvSupplierIdentity[]
): { supplierId?: string; supplierName?: string } {
  if (!product.supplierId) return {};
  const supplier = resolveProductSupplier(product.supplierId, suppliers);
  return { supplierId: product.supplierId, supplierName: supplier?.name ?? "Não informado" };
}
