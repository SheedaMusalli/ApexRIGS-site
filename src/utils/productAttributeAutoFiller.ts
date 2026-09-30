import { Product } from '../types';

export function generateAccurateProductAttributes(product: Product): {
  specifications: Record<string, any>;
  customAttributes?: Record<string, any>;
} {
  const specs = { ...(product.specifications || {}) };
  const custom = { ...(product.customAttributes || {}) };
  return {
    specifications: specs,
    customAttributes: custom,
  };
}
