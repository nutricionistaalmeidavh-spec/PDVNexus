/** Pure, accent-insensitive product lookup used by keyboard checkout and visual picker. */
export type PdvSearchableProduct = {
  productCode: string;
  barcode?: string;
  productName: string;
  brand?: string;
  producer?: string;
  category?: string;
  active?: boolean;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

export function findPdvProducts<T extends PdvSearchableProduct>(products: readonly T[], rawQuery: string): T[] {
  const query = normalize(rawQuery);
  if (!query) return [];
  const enabled = products.filter((product) => product.active !== false);
  const exact = enabled.filter((product) =>
    normalize(product.productCode) === query ||
    normalize(product.barcode ?? "") === query ||
    normalize(product.productName) === query
  );
  if (exact.length > 0) return exact;
  const terms = query.split(/\s+/).filter(Boolean);
  return enabled.filter((product) => {
    const haystack = normalize([
      product.productName, product.brand ?? "", product.producer ?? "", product.category ?? "",
      product.productCode, product.barcode ?? ""
    ].join(" "));
    return terms.every((term) => haystack.includes(term));
  });
}

/** Gross margin on sales price (not markup on acquisition cost); null = unknown cost. */
export function calculatePdvGrossMargin(salePrice: number, costPrice?: number): number | null {
  if (costPrice === undefined || !Number.isFinite(costPrice) || costPrice < 0 ||
      !Number.isFinite(salePrice) || salePrice <= 0) return null;
  return Math.round(((salePrice - costPrice) / salePrice) * 10000) / 100;
}
