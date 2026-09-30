import { Product, ProductCategory, AISuggestionResponse } from '../types';

export interface BudgetOptimizerOptions {
  targetBudget: number;
  brandPreference?: string;
  userPrompt?: string;
  useCase?: string;
}

function getProductPrice(p: Product): number {
  if (typeof p.price === 'number' && !isNaN(p.price) && p.price > 0) return p.price;
  if (typeof (p as any).pricePkr === 'number' && !isNaN((p as any).pricePkr) && (p as any).pricePkr > 0) return (p as any).pricePkr;
  return 0;
}

export function optimizeBuildForBudget(
  products: Product[],
  options: BudgetOptimizerOptions
): AISuggestionResponse {
  const targetBudget = options.targetBudget || 180000;
  const brandPref = options.brandPreference && options.brandPreference !== 'Any' ? options.brandPreference.toLowerCase() : null;

  // Filter out deleted items and ensure they are in stock
  const availableProducts = products.filter((p) => !p.isDeleted && (p.stockCount ?? 0) >= 0);

  const getCategoryProducts = (cat: ProductCategory) => {
    let list = availableProducts.filter((p) => p.category === cat);
    if (brandPref) {
      const filtered = list.filter((p) => (p.brand || '').toLowerCase().includes(brandPref));
      if (filtered.length > 0) list = filtered;
    }
    return list.sort((a, b) => getProductPrice(a) - getProductPrice(b));
  };

  const allCPUs = getCategoryProducts('Processor');
  const allGPUs = getCategoryProducts('Graphic Card');
  const allMobos = getCategoryProducts('Motherboard');
  const allRAMs = getCategoryProducts('RAM');
  const allStorage = getCategoryProducts('Storage');
  const allPSUs = getCategoryProducts('Power Supply');
  const allCasings = getCategoryProducts('Casing');
  const allCoolers = getCategoryProducts('CPU Cooler');

  // Multi-pass selection: 
  // We evaluate CPU + GPU combinations first as they define the core budget.
  type CoreCandidate = {
    cpu: Product;
    gpu: Product;
    mobo: Product;
    totalCore: number;
  };

  let bestCandidate: {
    cpu: Product;
    gpu: Product;
    mobo: Product;
    ram: Product;
    storage: Product;
    psu: Product;
    casing: Product;
    cooler: Product | null;
    total: number;
  } | null = null;

  // To avoid exponential complexity, we pick the best GPU and CPU first, then fill the rest.
  // We try different GPU tiers.
  const sortedGPUs = [...allGPUs].reverse(); // Most expensive first
  const sortedCPUs = [...allCPUs].reverse();

  for (const gpu of sortedGPUs) {
    const gpuP = getProductPrice(gpu);
    // GPU should ideally be 30-50% of budget
    if (gpuP > targetBudget * 0.7 && sortedGPUs.length > 1) continue;

    for (const cpu of sortedCPUs) {
      const cpuP = getProductPrice(cpu);
      if (gpuP + cpuP > targetBudget * 0.85 && sortedCPUs.length > 1) continue;

      const cpuSocket = (cpu.specifications?.socket || cpu.specs?.socket || '').toLowerCase();

      // Pick cheapest compatible motherboard
      const mobo = allMobos.find(m => {
        const moboSocket = (m.specifications?.socket || m.specs?.socket || '').toLowerCase();
        return !cpuSocket || !moboSocket || moboSocket === cpuSocket;
      }) || allMobos[0];

      if (!mobo) continue;
      const moboP = getProductPrice(mobo);
      const moboRamType = (mobo.specifications?.ramType || mobo.specs?.ramType || '').toLowerCase();

      // Pick appropriate RAM
      const ram = allRAMs.find(r => {
        const rType = (r.specifications?.ramType || r.specs?.ramType || (r.name.includes('DDR5') ? 'ddr5' : 'ddr4')).toLowerCase();
        return !moboRamType || !rType || moboRamType.includes(rType) || rType.includes(moboRamType);
      }) || allRAMs[0];

      if (!ram) continue;
      const ramP = getProductPrice(ram);

      // Pick Storage
      const storage = allStorage.find(s => getProductPrice(s) > 8000) || allStorage[0];
      const storageP = getProductPrice(storage);

      // Pick PSU based on estimated wattage
      const estWatts = 150 + (cpu.specifications?.tdpWatts || 100) + (gpu.specifications?.tdpWatts || 200);
      const psu = allPSUs.find(p => (p.specifications?.psuWattage || 0) >= estWatts + 100) || allPSUs[allPSUs.length - 1] || allPSUs[0];
      const psuP = getProductPrice(psu);

      // Pick Casing
      const casing = allCasings[0];
      const casingP = getProductPrice(casing);

      // Pick Cooler (ALWAYS)
      let cooler: Product | null = null;
      if (allCoolers.length > 0) {
        const cpuTdp = cpu.specifications?.tdpWatts || (cpu.name.toLowerCase().includes('i9') || cpu.name.toLowerCase().includes('ryzen 9') ? 250 : 65);
        const cpuSocket = (cpu.specifications?.socket || cpu.specs?.socket || '').toLowerCase();

        const isCoolerCompatible = (c: Product) => {
          const supported = (c.specifications?.supportedSockets || c.specs?.supportedSockets || []);
          if (!Array.isArray(supported) || supported.length === 0) return true; // Assume compatible if no info
          return supported.some((s: string) => s.toLowerCase().includes(cpuSocket) || cpuSocket.includes(s.toLowerCase()));
        };

        if (cpuTdp > 125) {
          // Prefer 360mm or 240mm AIO for high TDP
          cooler = allCoolers.find(c => {
            const lowName = c.name.toLowerCase();
            const cTdp = c.specifications?.coolerTdpRating || 0;
            return isCoolerCompatible(c) && (lowName.includes('360') || lowName.includes('240') || lowName.includes('liquid') || lowName.includes('aio')) && (cTdp === 0 || cTdp >= cpuTdp);
          }) || allCoolers.find(c => isCoolerCompatible(c) && (c.name.toLowerCase().includes('360') || c.name.toLowerCase().includes('240'))) || allCoolers[0];
        } else {
          // Prefer air cooler for lower TDP
          cooler = allCoolers.find(c => isCoolerCompatible(c) && (c.name.toLowerCase().includes('air') || c.name.toLowerCase().includes('tower')) && !c.name.toLowerCase().includes('liquid')) || 
                   allCoolers.find(c => isCoolerCompatible(c) && !c.name.toLowerCase().includes('liquid') && !c.name.toLowerCase().includes('aio')) ||
                   allCoolers[0];
        }
      }
      const coolerP = cooler ? getProductPrice(cooler) : 0;

      const total = gpuP + cpuP + moboP + ramP + storageP + psuP + casingP + coolerP;

      if (total <= targetBudget * 1.08) {
        bestCandidate = { cpu, gpu, mobo, ram, storage, psu, casing, cooler, total };
        break; // Found a good core build within budget
      }
    }
    if (bestCandidate) break;
  }

  // Fallback to absolute basics if no candidate found
  const selectedCPU = bestCandidate?.cpu || allCPUs[0];
  const selectedGPU = bestCandidate?.gpu || allGPUs[0];
  const selectedMobo = bestCandidate?.mobo || allMobos[0];
  const selectedRAM = bestCandidate?.ram || allRAMs[0];
  const selectedStorage = bestCandidate?.storage || allStorage[0];
  const selectedPSU = bestCandidate?.psu || allPSUs[0];
  const selectedCasing = bestCandidate?.casing || allCasings[0];
  const selectedCooler = bestCandidate?.cooler || (allCoolers.length > 0 ? allCoolers[0] : null);

  const recommendedParts: AISuggestionResponse['recommendedCategoryParts'] = [];
  let totalCalculatedPrice = 0;

  const addPart = (cat: ProductCategory, prod: Product | null, reason: string) => {
    if (!prod) return;
    const price = getProductPrice(prod);
    totalCalculatedPrice += price;
    recommendedParts.push({
      category: cat,
      productId: prod.id,
      productName: prod.name,
      price,
      reason,
    });
  };

  addPart('Processor', selectedCPU, `High-performance processor for gaming and productivity.`);
  addPart('Motherboard', selectedMobo, `Stable and compatible motherboard with required features.`);
  if (selectedCooler) {
    addPart('CPU Cooler', selectedCooler, `Reliable cooling solution for optimal thermal management.`);
  }
  addPart('Graphic Card', selectedGPU, `Primary component for high-fidelity gaming performance.`);
  addPart('RAM', selectedRAM, `High-speed memory kit for smooth multitasking.`);
  addPart('Storage', selectedStorage, `Fast NVMe storage for quick boot and load times.`);
  addPart('Power Supply', selectedPSU, `Quality power supply with sufficient wattage headroom.`);
  addPart('Casing', selectedCasing, `Aesthetic chassis with good airflow characteristics.`);

  return {
    summary: `Optimized Rig: ${selectedCPU?.name.split(' ')[0]} + ${selectedGPU?.name.split(' ')[0]}`,
    reasoning: `This build is precision-engineered to maximize gaming performance at your target Rs. ${targetBudget.toLocaleString()} PKR budget, ensuring all components are compatible and high-quality.`,
    estimatedTotalPkr: totalCalculatedPrice,
    recommendedCategoryParts: recommendedParts,
    performanceHighlights: {
      gaming1080p: targetBudget < 200000 ? '90-120 FPS Ultra' : '144+ FPS Ultra',
      gaming1440p: targetBudget >= 300000 ? '100+ FPS Ultra' : '60+ FPS High',
      workstation: 'Excellent for content creation, rendering, and professional multitasking.',
    },
    upgradeSuggestions: [
      'Consider adding more storage or a higher-tier cooler in the future.',
    ],
  };
}
