import { Product, PCBuildParts } from '../types';

export function mapPrebuiltToBuilderParts(
  prebuiltProduct: Product,
  allProducts: Product[]
): {
  build: PCBuildParts;
  variants: Record<string, string>;
} {
  const build: PCBuildParts = {};
  const variants: Record<string, string> = {};

  const categories: (keyof PCBuildParts)[] = [
    'Processor',
    'Motherboard',
    'RAM',
    'Graphic Card',
    'Storage',
    'Power Supply',
    'Casing',
    'CPU Cooler',
  ];

  for (const cat of categories) {
    const matched = allProducts.find((p) => p.category === cat && !p.isDeleted);
    if (matched) {
      build[cat] = matched;
      if (matched.variants && matched.variants.length > 0) {
        variants[matched.id] = matched.variants[0].id;
      }
    }
  }

  return { build, variants };
}
