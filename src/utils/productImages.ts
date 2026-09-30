export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Processor: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80',
  Motherboard: 'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80',
  'Graphic Card': 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=800&auto=format&fit=crop&q=80',
  RAM: 'https://images.unsplash.com/photo-1562976540-1502c2145186?w=800&auto=format&fit=crop&q=80',
  Storage: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&auto=format&fit=crop&q=80',
  'Power Supply': 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80',
  Casing: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80',
  'CPU Cooler': 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80',
  'PC Case Fans': 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&auto=format&fit=crop&q=80',
  Monitor: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80',
  'Gaming Mouse': 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&auto=format&fit=crop&q=80',
  'Gaming Keyboard': 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
  'Gaming Headset': 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
  Default: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&auto=format&fit=crop&q=80',
};

export function getProductFallbackImage(category?: string, _name?: string, _brand?: string): string {
  if (!category) return CATEGORY_FALLBACK_IMAGES.Default;
  return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.Default;
}

export function handleProductImageError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  category?: string,
  _name?: string,
  _brand?: string
): void {
  const target = event.currentTarget;
  const fallback = getProductFallbackImage(category);
  if (target.src !== fallback) {
    target.src = fallback;
  }
}
