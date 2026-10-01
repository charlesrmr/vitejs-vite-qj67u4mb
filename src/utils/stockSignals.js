export function reconcileNoSaleStock(salesKeysInput, stockItems = []) {
  const salesKeys = salesKeysInput instanceof Set
    ? salesKeysInput
    : new Set((salesKeysInput || []).filter(Boolean));

  if (!salesKeys.size) return null;

  const items = [];
  let totalStockValue = 0;
  let hasStockValue = false;

  for (const item of stockItems || []) {
    const key = String(item?.key || '').trim();
    const stockValue = Number.isFinite(item?.stockValue) ? item.stockValue : null;
    const stockQty = Number.isFinite(item?.stockQty) ? item.stockQty : null;
    const hasStock =
      (stockValue !== null && stockValue > 0) ||
      (stockQty !== null && stockQty > 0);

    if (!key || !hasStock || salesKeys.has(key)) continue;

    if (stockValue !== null && stockValue > 0) {
      totalStockValue += stockValue;
      hasStockValue = true;
    }

    items.push({
      nom: item?.nom || key,
      fam: item?.fam || '—',
      ca: 0,
      stock: stockQty ?? stockValue ?? 0,
      valeur_stock: stockValue,
    });
  }

  return {
    items,
    stockValue: hasStockValue ? Math.round(totalStockValue) : null,
  };
}
