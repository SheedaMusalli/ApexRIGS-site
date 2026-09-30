import { Product, StoreSettings, CartItem } from '../types';

export interface OrderPricingResult {
  items: any[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

export function priceStoreOrder(
  rawItems: any[],
  productsDB: Product[],
  storeSettings: StoreSettings,
  paymentMethod?: string
): OrderPricingResult {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  const items = rawItems.map((item: any) => {
    const prodId = item.productId || item.product?.id || item.id;
    const dbProduct = productsDB.find((p) => p.id === prodId || p.name === item.name);
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);

    let unitPrice = 0;
    const variantId = item.variantId || item.selectedVariant?.id;
    const variantName = item.variantColor || item.variantName || item.selectedVariant?.name;

    if (dbProduct) {
      if (variantId || variantName) {
        const variant = dbProduct.variants?.find(
          (v) => (variantId && v.id === variantId) || (variantName && (v.name === variantName || v.color === variantName))
        );
        unitPrice = Number(variant?.price ?? (variant as any)?.pricePkr ?? dbProduct.price ?? (dbProduct as any)?.pricePkr ?? 0);
      } else {
        unitPrice = Number(dbProduct.price ?? (dbProduct as any)?.pricePkr ?? 0);
      }
    }

    // Fallback to item's own price if not found in dbProduct or if dbProduct had 0
    if (!unitPrice || unitPrice <= 0) {
      unitPrice = Number(item.price ?? item.unitPrice ?? item.product?.price ?? (item.product as any)?.pricePkr ?? 0);
    }

    return {
      ...item,
      price: unitPrice,
      unitPrice,
      quantity,
      totalPrice: unitPrice * quantity,
    };
  });

  const subtotal = items.reduce((acc, it) => acc + (it.price || it.unitPrice || 0) * it.quantity, 0);
  const threshold = storeSettings?.freeShippingThreshold ?? 100000;
  const defaultFee = storeSettings?.defaultShippingFee ?? 1500;
  const shippingFee = subtotal >= threshold ? 0 : defaultFee;
  const discount = 0;
  const total = Math.max(0, subtotal + shippingFee - discount);

  return {
    items,
    subtotal,
    shippingFee,
    discount,
    total,
  };
}
