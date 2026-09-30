import { Product, ProductCategory } from '../types';

// Hardware synonyms and alias mapping
export const SYNONYM_MAP: Record<string, string[]> = {
  // Processors / CPUs
  cpu: ['processor', 'cpu', 'ryzen', 'intel core', 'core i5', 'core i7', 'core i9', 'threadripper'],
  processor: ['processor', 'cpu', 'ryzen', 'intel core', 'amd', 'intel'],
  processors: ['processor', 'cpu', 'ryzen', 'intel core'],
  intel: ['intel', 'processor', 'core', 'lga1700', 'lga1851'],
  amd: ['amd', 'ryzen', 'am4', 'am5', 'processor'],
  ryzen: ['ryzen', 'amd', 'processor', 'cpu'],

  // Graphics Cards / GPUs
  gpu: ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon', 'vga', 'video card'],
  gpus: ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon'],
  'graphic card': ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon'],
  'graphic cards': ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon'],
  'graphics card': ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon'],
  'graphics cards': ['graphic card', 'graphics card', 'gpu', 'geforce', 'rtx', 'radeon'],
  rtx: ['rtx', 'geforce', 'graphic card', 'nvidia'],
  gtx: ['gtx', 'geforce', 'graphic card', 'nvidia'],
  nvidia: ['nvidia', 'geforce', 'rtx', 'gtx', 'graphic card'],
  geforce: ['geforce', 'nvidia', 'rtx', 'graphic card'],
  radeon: ['radeon', 'amd', 'rx', 'graphic card'],
  vga: ['graphic card', 'graphics card', 'gpu'],

  // Motherboards
  motherboard: ['motherboard', 'mainboard', 'mobo', 'board', 'b650', 'z790', 'b760', 'x670', 'am5', 'lga1700'],
  motherboards: ['motherboard', 'mainboard', 'mobo'],
  mobo: ['motherboard', 'mainboard', 'mobo', 'b650', 'z790', 'am5'],
  mainboard: ['motherboard', 'mainboard', 'mobo'],

  // RAM / Memory
  ram: ['ram', 'memory', 'ddr4', 'ddr5', 'dimm'],
  rams: ['ram', 'memory', 'ddr4', 'ddr5'],
  memory: ['ram', 'memory', 'ddr4', 'ddr5'],
  ddr5: ['ddr5', 'ram', 'memory'],
  ddr4: ['ddr4', 'ram', 'memory'],

  // Storage / SSD / HDD
  storage: ['storage', 'ssd', 'nvme', 'm.2', 'hdd', 'hard drive', 'solid state'],
  ssd: ['ssd', 'storage', 'nvme', 'm.2', 'solid state'],
  ssds: ['ssd', 'storage', 'nvme', 'm.2'],
  nvme: ['nvme', 'ssd', 'm.2', 'storage'],
  hdd: ['hdd', 'hard drive', 'storage'],

  // Power Supplies
  psu: ['power supply', 'psu', 'power', 'watt', 'gold', 'modular'],
  psus: ['power supply', 'psu'],
  'power supply': ['power supply', 'psu', 'watt'],
  'power supplies': ['power supply', 'psu'],

  // Casings / Chassis
  casing: ['casing', 'case', 'chassis', 'cabinet', 'tower'],
  casings: ['casing', 'case', 'chassis'],
  case: ['casing', 'case', 'chassis'],
  cases: ['casing', 'case', 'chassis'],
  chassis: ['casing', 'case', 'chassis'],

  // Coolers / AIO
  cooler: ['cpu cooler', 'cooler', 'aio', 'liquid cooler', 'air cooler', 'thermal solution'],
  coolers: ['cpu cooler', 'cooler', 'aio', 'liquid cooler'],
  'cpu cooler': ['cpu cooler', 'cooler', 'aio', 'liquid cooler', 'air cooler'],
  aio: ['aio', 'liquid cooler', 'cpu cooler', 'water cooler', '360mm', '240mm'],
  'liquid cooler': ['liquid cooler', 'aio', 'cpu cooler'],

  // Monitors
  monitor: ['monitor', 'screen', 'display', 'gaming monitor', 'hz', 'ips'],
  monitors: ['monitor', 'screen', 'display'],
  screen: ['monitor', 'screen', 'display'],
  display: ['monitor', 'screen', 'display'],

  // Peripherals
  mouse: ['gaming mouse', 'mouse'],
  keyboard: ['gaming keyboard', 'keyboard', 'mechanical keyboard'],
  headset: ['gaming headset', 'headset', 'headphones', 'earphone'],
  headphones: ['gaming headset', 'headset', 'headphones'],
};

// Common typos and phonetic auto-corrections
export const TYPO_DICTIONARY: Record<string, string> = {
  rysen: 'ryzen',
  ryzon: 'ryzen',
  prossesor: 'processor',
  prossor: 'processor',
  procesor: 'processor',
  proccesor: 'processor',
  intelcore: 'intel core',
  grafic: 'graphic',
  grafics: 'graphics',
  grafix: 'graphics',
  graphix: 'graphics',
  nividia: 'nvidia',
  navidia: 'nvidia',
  geforce: 'geforce',
  geforc: 'geforce',
  moniter: 'monitor',
  moneter: 'monitor',
  moterboard: 'motherboard',
  mothrboard: 'motherboard',
  motrboard: 'motherboard',
  mboard: 'motherboard',
  corsear: 'corsair',
  corser: 'corsair',
  suply: 'supply',
  suppy: 'supply',
  liqued: 'liquid',
  gamming: 'gaming',
  gamin: 'gaming',
  cabel: 'cable',
  cabels: 'cables',
  keybord: 'keyboard',
  keybaord: 'keyboard',
  headfone: 'headphone',
  headfones: 'headphones',
  heaset: 'headset',
  gigabite: 'gigabyte',
  kingstone: 'kingston',
  sessoni: 'seasonic',
  termaltake: 'thermaltake',
  deepcol: 'deepcool',
  asusrog: 'asus rog',
};

// Levenshtein distance for fuzzy matching
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Tokenize search query and expand synonyms
export function normalizeQuery(query: string): {
  original: string;
  normalized: string;
  tokens: string[];
  expandedTerms: string[];
  correctedQuery?: string;
  hasTypoCorrection: boolean;
} {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return {
      original: query,
      normalized: '',
      tokens: [],
      expandedTerms: [],
      hasTypoCorrection: false,
    };
  }

  // Tokenize
  const rawTokens = trimmed.split(/[\s,+/_-]+/).filter(Boolean);
  let hasTypoCorrection = false;
  const correctedTokens: string[] = [];

  for (const token of rawTokens) {
    if (TYPO_DICTIONARY[token]) {
      correctedTokens.push(TYPO_DICTIONARY[token]);
      hasTypoCorrection = true;
    } else {
      // Check 1-2 edit distance against dictionary keys
      let foundFuzzy = false;
      if (token.length >= 4) {
        for (const [typo, correct] of Object.entries(TYPO_DICTIONARY)) {
          if (levenshteinDistance(token, typo) <= 1) {
            correctedTokens.push(correct);
            hasTypoCorrection = true;
            foundFuzzy = true;
            break;
          }
        }
      }
      if (!foundFuzzy) {
        correctedTokens.push(token);
      }
    }
  }

  const normalized = correctedTokens.join(' ');
  const correctedQuery = hasTypoCorrection ? normalized : undefined;

  // Build expanded terms using synonyms
  const expandedSet = new Set<string>(correctedTokens);

  // Check phrase synonyms
  if (SYNONYM_MAP[normalized]) {
    for (const s of SYNONYM_MAP[normalized]) {
      expandedSet.add(s);
    }
  }

  // Check token synonyms
  for (const token of correctedTokens) {
    if (SYNONYM_MAP[token]) {
      for (const s of SYNONYM_MAP[token]) {
        expandedSet.add(s);
      }
    }
  }

  return {
    original: query,
    normalized,
    tokens: correctedTokens,
    expandedTerms: Array.from(expandedSet),
    correctedQuery,
    hasTypoCorrection,
  };
}

// Relevance score calculation for a product
export function calculateProductRelevance(
  product: Product,
  queryData: ReturnType<typeof normalizeQuery>
): number {
  if (product.isDeleted) return -1;
  const { normalized, tokens, expandedTerms } = queryData;

  if (!normalized) return 1;

  const nameLower = (product.name || '').toLowerCase();
  const brandLower = (product.brand || '').toLowerCase();
  const categoryLower = (product.category || '').toLowerCase();
  const skuLower = (product.sku || '').toLowerCase();
  const descLower = (product.description || '').toLowerCase();

  // Combine specs into a searchable string
  const specs = product.specs || {};
  const specsText = [
    specs.socket,
    specs.chipset,
    specs.ramType,
    specs.vramGb ? `${specs.vramGb}gb` : '',
    specs.gpuChipset,
    specs.storageType,
    specs.storageCapacity,
    specs.psuWattage ? `${specs.psuWattage}w` : '',
    specs.coolerType,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;

  // 1. Exact matches (highest authority)
  if (nameLower === normalized) score += 2000;
  else if (nameLower.startsWith(normalized)) score += 1000;
  else if (nameLower.includes(normalized)) score += 600;

  // 2. Brand match
  if (brandLower === normalized) score += 500;
  else if (brandLower.includes(normalized)) score += 250;

  // 3. Category match
  if (categoryLower === normalized) score += 600;
  else if (categoryLower.includes(normalized)) score += 300;

  // 4. SKU match
  if (skuLower === normalized) score += 800;
  else if (skuLower.includes(normalized)) score += 400;

  // 5. Token match across all fields
  let matchedTokensCount = 0;
  for (const token of tokens) {
    let tokenMatched = false;

    if (nameLower.includes(token)) {
      score += 180;
      tokenMatched = true;
    }
    if (brandLower.includes(token)) {
      score += 120;
      tokenMatched = true;
    }
    if (categoryLower.includes(token)) {
      score += 140;
      tokenMatched = true;
    }
    if (skuLower.includes(token)) {
      score += 150;
      tokenMatched = true;
    }
    if (specsText.includes(token)) {
      score += 100;
      tokenMatched = true;
    }
    if (descLower.includes(token)) {
      score += 40;
      tokenMatched = true;
    }

    // Check fuzzy match on name tokens if word is long enough
    if (!tokenMatched && token.length >= 4) {
      const nameWords = nameLower.split(/[\s,+/_-]+/);
      for (const nw of nameWords) {
        if (nw.length >= 4 && levenshteinDistance(token, nw) <= 1) {
          score += 90;
          tokenMatched = true;
          break;
        }
      }
    }

    if (tokenMatched) {
      matchedTokensCount++;
    }
  }

  // 6. Synonym and expanded terms match
  for (const term of expandedTerms) {
    if (tokens.includes(term)) continue; // already checked

    if (categoryLower.includes(term) || term.includes(categoryLower)) {
      score += 160;
    }
    if (nameLower.includes(term)) {
      score += 100;
    }
    if (brandLower.includes(term)) {
      score += 80;
    }
    if (specsText.includes(term)) {
      score += 70;
    }
  }

  // If user typed multiple tokens, require at least a significant overlap
  // to avoid displaying "wrong product"
  if (tokens.length >= 2) {
    const matchRatio = matchedTokensCount / tokens.length;
    if (matchRatio < 0.5 && score < 300) {
      // Failed to match enough criteria: discard to avoid wrong product
      return 0;
    }
    // High match boost
    score += matchedTokensCount * 50;
  } else if (tokens.length === 1 && matchedTokensCount === 0 && score < 100) {
    return 0;
  }

  // Hardware model number precision check:
  // e.g. If user typed "4070", and product has "4060" or "4080", don't accidentally match
  for (const token of tokens) {
    const isModelNumber = /^\d{3,4}(?:xt|ti|super)?$/i.test(token);
    if (isModelNumber) {
      if (nameLower.includes(token) || skuLower.includes(token)) {
        score += 350; // huge boost for exact model match
      } else {
        // user specified a model number like 4070, but this product doesn't have it
        score -= 200;
      }
    }
  }

  // In-stock bonus so users see ready-to-ship components first
  if ((product.stockCount ?? 0) > 0 || product.inStock) {
    score += 15;
  }

  return Math.max(0, score);
}

// Search and rank products with Google-like accuracy
export function searchProducts(products: Product[], query: string): {
  results: Product[];
  didYouMean?: string;
  matchedCount: number;
} {
  const queryData = normalizeQuery(query);
  if (!queryData.normalized) {
    return {
      results: products.filter((p) => !p.isDeleted),
      matchedCount: products.length,
    };
  }

  const scored = products
    .map((product) => ({
      product,
      score: calculateProductRelevance(product, queryData),
    }))
    .filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return {
    results: scored.map((s) => s.product),
    didYouMean: queryData.hasTypoCorrection ? queryData.correctedQuery : undefined,
    matchedCount: scored.length,
  };
}

export interface GoogleSearchSuggestion {
  type: 'query' | 'category' | 'brand' | 'product';
  text: string;
  highlightedPrefix?: string;
  suggestedSuffix?: string;
  category?: ProductCategory;
  brand?: string;
  product?: Product;
  count?: number;
  iconType?: string;
}

// Generate Google-style instant auto-complete suggestions
export function generateGoogleSuggestions(
  query: string,
  products: Product[]
): {
  suggestions: GoogleSearchSuggestion[];
  didYouMean?: string;
} {
  const queryData = normalizeQuery(query);
  const { normalized, tokens, correctedQuery, hasTypoCorrection } = queryData;

  if (!normalized || normalized.length < 1) {
    // Return trending/popular hardware queries for empty or initial focus
    const popularQueries = [
      'RTX 4070 Super',
      'Ryzen 7 7800X3D',
      'DDR5 32GB RAM',
      'B650 Motherboard',
      'Samsung 990 Pro 2TB',
      '1000W Gold Power Supply',
      '240Hz Gaming Monitor',
      'Lian Li Casing',
    ];

    return {
      suggestions: popularQueries.map((text) => ({
        type: 'query',
        text,
        highlightedPrefix: '',
        suggestedSuffix: text,
      })),
    };
  }

  const suggestions: GoogleSearchSuggestion[] = [];
  const seenTexts = new Set<string>();

  // 1. Direct matched categories
  const categoryCounts: Record<string, number> = {};
  for (const p of products) {
    if (p.isDeleted) continue;
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  }

  for (const [cat, count] of Object.entries(categoryCounts)) {
    const catLower = cat.toLowerCase();
    const queryDataMatchesCat =
      catLower.includes(normalized) ||
      tokens.some((t) => catLower.includes(t)) ||
      queryData.expandedTerms.some((et) => catLower.includes(et));

    if (queryDataMatchesCat && !seenTexts.has(`cat:${cat}`)) {
      seenTexts.add(`cat:${cat}`);
      suggestions.push({
        type: 'category',
        text: cat,
        category: cat as ProductCategory,
        count,
      });
      if (suggestions.length >= 2) break;
    }
  }

  // 2. Direct matched brands
  const brandCounts: Record<string, number> = {};
  for (const p of products) {
    if (p.isDeleted || !p.brand) continue;
    brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  }

  for (const [brand, count] of Object.entries(brandCounts)) {
    const brandLower = brand.toLowerCase();
    if (brandLower.includes(normalized) && !seenTexts.has(`brand:${brand}`)) {
      seenTexts.add(`brand:${brand}`);
      suggestions.push({
        type: 'brand',
        text: brand,
        brand,
        count,
      });
      if (suggestions.length >= 4) break;
    }
  }

  // 3. Google-style Query Auto-Completions
  // Extract distinct product phrases and popular combinations
  const phraseCandidates: string[] = [];
  for (const p of products) {
    if (p.isDeleted) continue;
    phraseCandidates.push(p.name);
    if (p.brand) phraseCandidates.push(`${p.brand} ${p.category}`);
  }

  for (const phrase of phraseCandidates) {
    const phraseLower = phrase.toLowerCase();
    const matchIndex = phraseLower.indexOf(normalized);

    if (matchIndex !== -1 && !seenTexts.has(phraseLower)) {
      seenTexts.add(phraseLower);

      // Split into prefix and completion suffix like Google
      const prefix = phrase.slice(0, matchIndex + normalized.length);
      const suffix = phrase.slice(matchIndex + normalized.length);

      suggestions.push({
        type: 'query',
        text: phrase,
        highlightedPrefix: prefix,
        suggestedSuffix: suffix,
      });

      if (suggestions.filter((s) => s.type === 'query').length >= 4) {
        break;
      }
    }
  }

  // 4. Top ranked direct product previews (Rich Results)
  const ranked = searchProducts(products, query);
  const topProducts = ranked.results.slice(0, 4);

  for (const prod of topProducts) {
    suggestions.push({
      type: 'product',
      text: prod.name,
      product: prod,
      category: prod.category,
    });
  }

  return {
    suggestions: suggestions.slice(0, 10),
    didYouMean: hasTypoCorrection ? correctedQuery : undefined,
  };
}
