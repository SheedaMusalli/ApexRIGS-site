export function generateProductSKU(
  item: { name?: string; brand?: string; category?: string; sku?: string },
  productsDB: any[] = []
): string {
  if (item.sku && item.sku.trim()) return item.sku.trim().toUpperCase();

  const brand = (item.brand || 'APX').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const cat = (item.category || 'GEN').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  const nameParts = (item.name || 'ITEM')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);

  const identifier = (nameParts.slice(0, 3).join('-') || 'PROD').toUpperCase();
  let baseSku = `APX-${cat}-${brand}-${identifier}`.slice(0, 32);

  let candidate = baseSku;
  let counter = 1;
  while (productsDB.some((p: any) => p.sku === candidate)) {
    candidate = `${baseSku}-${counter}`;
    counter++;
  }

  return candidate;
}

export function generateSerialNumber(
  product: { sku?: string; id?: string; name?: string; brand?: string; category?: string; [key: string]: any },
  index: number = 1
): string {
  const prefix = (product.sku || product.id || 'APX').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random}-${String(index).padStart(2, '0')}`;
}

export function generateSequentialSerialNumbers(
  product: { sku?: string; id?: string; name?: string; brand?: string; category?: string; [key: string]: any },
  count: number
): string[] {
  const list: string[] = [];
  for (let i = 1; i <= count; i++) {
    list.push(generateSerialNumber(product, i));
  }
  return list;
}

export function generateVariantSku(baseSku: string, variantName: string): string {
  const clean = variantName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase();
  return `${baseSku}-${clean}`;
}

export function generateVariantSuffix(variantName: string): string {
  return '-' + variantName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase();
}

export function getProductEan(product: { ean?: string; id?: string; sku?: string }): string {
  if (product.ean && product.ean.trim()) return product.ean.trim();
  const numStr = (product.id || product.sku || '100000000000').replace(/\D/g, '');
  const padded = (numStr + '1234567890123').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(padded[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checksum = (10 - (sum % 10)) % 10;
  return `${padded}${checksum}`;
}
