/** Pure, accent-insensitive search used by checkout and the product picker. */
export type PdvSearchableProduct = {
  productCode: string;
  barcode?: string;
  productName: string;
  brand?: string;
  category?: string;
  active?: boolean;
};

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

export type PdvProductSearchIndex<T extends PdvSearchableProduct> = {
  exact: Map<string, T[]>;
  entries: Array<{ product: T; haystack: string }>;
};

/** Normalize each product once per catalog revision, not once for every typed character. */
export function buildPdvProductSearchIndex<T extends PdvSearchableProduct>(products: readonly T[]): PdvProductSearchIndex<T> {
  const exact = new Map<string, T[]>();
  const entries: Array<{ product: T; haystack: string }> = [];
  for (const product of products) {
    if (product.active === false) continue;
    const keys = [product.productCode, product.barcode ?? "", product.productName]
      .map(normalize).filter(Boolean);
    for (const key of new Set(keys)) {
      const items = exact.get(key) ?? [];
      items.push(product);
      exact.set(key, items);
    }
    entries.push({
      product,
      haystack: normalize([
        product.productName, product.brand ?? "", product.category ?? "",
        product.productCode, product.barcode ?? ""
      ].join(" "))
    });
  }
  return { exact, entries };
}

export function findPdvProductsIndexed<T extends PdvSearchableProduct>(
  index: PdvProductSearchIndex<T>, rawQuery: string, limit = Number.POSITIVE_INFINITY
): T[] {
  const query = normalize(rawQuery);
  if (!query || limit <= 0) return [];
  const max = Math.max(0, limit);
  const exact = index.exact.get(query);
  if (exact?.length) return exact.slice(0, max);
  const terms = query.split(/\s+/).filter(Boolean);
  const results: T[] = [];
  for (const entry of index.entries) {
    if (terms.every((term) => entry.haystack.includes(term))) {
      results.push(entry.product);
      if (results.length >= max) break;
    }
  }
  return results;
}

export function findPdvProducts<T extends PdvSearchableProduct>(products: readonly T[], rawQuery: string): T[] {
  return findPdvProductsIndexed(buildPdvProductSearchIndex(products), rawQuery);
}

/** Gross margin on sales price (not markup on acquisition cost); null = unknown cost. */
export function calculatePdvGrossMargin(salePrice: number, costPrice?: number): number | null {
  if (costPrice === undefined || !Number.isFinite(costPrice) || costPrice < 0 ||
      !Number.isFinite(salePrice) || salePrice <= 0) return null;
  return Math.round(((salePrice - costPrice) / salePrice) * 10000) / 100;
}

/** Inline suggestions exclude numeric/scanner input; scan is bounded to first N matches. */
export function checkoutSuggestionsIndexed<T extends PdvSearchableProduct>(
  index: PdvProductSearchIndex<T>, rawQuery: string, limit = 8
): T[] {
  const query = rawQuery.trim();
  if (query.length < 2 || !/[^0-9]/.test(query)) return [];
  return findPdvProductsIndexed(index, query, Math.max(0, limit));
}

/** Backward-compatible convenience API for one-off searches and existing callers. */
export function checkoutSuggestions<T extends PdvSearchableProduct>(
  products: readonly T[], rawQuery: string, limit = 8
): T[] {
  const query = rawQuery.trim();
  if (query.length < 2 || !/[^0-9]/.test(query)) return [];
  return checkoutSuggestionsIndexed(buildPdvProductSearchIndex(products), query, limit);
}
