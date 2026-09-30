import { BottleneckGame } from '../data/bottleneckGames';
import { Product } from '../types';

export interface BottleneckResult {
  game: BottleneckGame;
  resolution: '1080p' | '1440p' | '4K';
  quality: string;
  cpuScore: number;
  gpuScore: number;
  cpuBottleneckPct: number;
  gpuBottleneckPct: number;
  overallBottleneckPct: number;
  limitingComponent: 'Processor (CPU)' | 'Graphic Card (GPU)' | 'Balanced Rig' | 'Memory (RAM)';
  estimatedFpsMin: number;
  estimatedFpsAvg: number;
  estimatedFpsMax: number;
  ratingText: string;
  ratingColor: 'emerald' | 'cyan' | 'amber' | 'rose';
  recommendation: string;
  hardwareSummary: {
    cpuName: string;
    gpuName: string;
    ramGb: number;
  };
}

// Evaluate CPU performance index (0 to 100)
export function evaluateCpuScore(cpuProduct?: Product | null, customCpuName?: string): { score: number; name: string } {
  const name = cpuProduct?.name || customCpuName || 'Core i5-12400F';
  const lower = name.toLowerCase();

  let score = 50;

  // Ultra enthusiast modern CPUs
  if (lower.includes('9800x3d') || lower.includes('9950x') || lower.includes('14900k') || lower.includes('14900ks') || lower.includes('7950x3d') || lower.includes('7800x3d')) {
    score = 100; // Peak gaming performance
  } else if (lower.includes('14700k') || lower.includes('13900k') || lower.includes('7900x3d') || lower.includes('7950x') || lower.includes('9900x') || lower.includes('9700x')) {
    score = 97;
  } else if (lower.includes('13700k') || lower.includes('14600k') || lower.includes('7700x') || lower.includes('7700') || lower.includes('5800x3d') || lower.includes('5700x3d') || lower.includes('9600x')) {
    score = 92;
  } else if (lower.includes('13600k') || lower.includes('12900k') || lower.includes('7600x') || lower.includes('7600') || lower.includes('7500f') || lower.includes('ryzen 5 7500f') || lower.includes('14500') || lower.includes('14400')) {
    score = 88; // 7500F and 7600 are very strong
  } else if (lower.includes('12700k') || lower.includes('12700') || lower.includes('12600k') || lower.includes('5800x') || lower.includes('5700x') || lower.includes('13400')) {
    score = 82;
  } else if (lower.includes('12400') || lower.includes('12400f') || lower.includes('5600x') || lower.includes('5600') || lower.includes('ryzen 5 5600') || lower.includes('11700') || lower.includes('10700')) {
    score = 78; // 5600 is still great
  } else if (lower.includes('11400') || lower.includes('10400') || lower.includes('3600x') || lower.includes('3600') || lower.includes('5500') || lower.includes('4500')) {
    score = 65;
  } else if (lower.includes('9700k') || lower.includes('8700k') || lower.includes('2600') || lower.includes('1600') || lower.includes('9400f')) {
    score = 52;
  } else if (lower.includes('7700k') || lower.includes('6700k') || lower.includes('i7 4790') || lower.includes('i5 8400') || lower.includes('1200')) {
    score = 42;
  } else if (lower.includes('i5 4570') || lower.includes('i5 3470') || lower.includes('i5 2500') || lower.includes('fx-8350') || lower.includes('core 2')) {
    score = 28;
  }

  return { score, name };
}

// Evaluate GPU performance index (0 to 100)
export function evaluateGpuScore(gpuProduct?: Product | null, customGpuName?: string): { score: number; name: string; vramGb: number } {
  const name = gpuProduct?.name || customGpuName || 'GeForce RTX 4060 8GB';
  const lower = name.toLowerCase();

  let score = 55;
  let vramGb = 8;

  // Ultra enthusiast GPUs
  if (lower.includes('5090') || lower.includes('4090')) {
    score = 100;
    vramGb = lower.includes('5090') ? 32 : 24;
  } else if (lower.includes('5080') || lower.includes('4080 super') || lower.includes('4080') || lower.includes('7900 xtx')) {
    score = 94;
    vramGb = lower.includes('7900 xtx') ? 24 : 16;
  } else if (lower.includes('5070 ti') || lower.includes('4070 ti super') || lower.includes('7900 xt') || lower.includes('3090 ti') || lower.includes('3090')) {
    score = 90;
    vramGb = lower.includes('3090') ? 24 : lower.includes('7900 xt') ? 20 : 16;
  } else if (lower.includes('5070') || lower.includes('4070 ti') || lower.includes('4070 super') || lower.includes('7900 gre') || lower.includes('3080 ti') || lower.includes('7800 xt')) {
    score = 88; // 5070 is high tier
    vramGb = lower.includes('7800 xt') || lower.includes('7900 gre') ? 16 : 12;
  } else if (lower.includes('4070') || lower.includes('3080') || lower.includes('6800 xt') || lower.includes('6800')) {
    score = 84; 
    vramGb = lower.includes('6800') || lower.includes('6800 xt') ? 16 : 12;
  } else if (lower.includes('4060 ti') || lower.includes('3070 ti') || lower.includes('3070') || lower.includes('6750 xt') || lower.includes('6700 xt') || lower.includes('7700 xt')) {
    score = 75;
    vramGb = lower.includes('6700 xt') || lower.includes('7700 xt') ? 12 : lower.includes('16gb') ? 16 : 8;
  } else if (lower.includes('4060') || lower.includes('3060 ti') || lower.includes('2080 ti') || lower.includes('6650 xt') || lower.includes('7600 xt') || lower.includes('7600')) {
    score = 65;
    vramGb = lower.includes('7600 xt') ? 16 : 8;
  } else if (lower.includes('3060') || lower.includes('2080') || lower.includes('2070 super') || lower.includes('6600 xt') || lower.includes('6600') || lower.includes('5700 xt')) {
    score = 58;
    vramGb = lower.includes('12gb') || lower.includes('3060') ? 12 : 8;
  } else if (lower.includes('2060 super') || lower.includes('2060') || lower.includes('1080 ti') || lower.includes('1080') || lower.includes('5600 xt') || lower.includes('arc a770')) {
    score = 48;
    vramGb = 8;
  } else if (lower.includes('1660 super') || lower.includes('1660 ti') || lower.includes('1660') || lower.includes('1070') || lower.includes('rx 590') || lower.includes('rx 580')) {
    score = 38;
    vramGb = lower.includes('rx 580') || lower.includes('rx 590') || lower.includes('1070') ? 8 : 6;
  } else if (lower.includes('1650 super') || lower.includes('1650') || lower.includes('1060') || lower.includes('rx 570') || lower.includes('rx 5500')) {
    score = 28;
    vramGb = lower.includes('1060') ? 6 : 4;
  } else if (lower.includes('1050 ti') || lower.includes('1050') || lower.includes('970') || lower.includes('960') || lower.includes('rx 460') || lower.includes('rx 550')) {
    score = 18;
    vramGb = 4;
  } else if (lower.includes('750 ti') || lower.includes('gt 1030') || lower.includes('radeon vega') || lower.includes('intel uhd') || lower.includes('intel iris')) {
    score = 10;
    vramGb = 2;
  }

  return { score, name, vramGb };
}

// Calculate comprehensive bottleneck analysis
export function calculateGameBottleneck(
  game: BottleneckGame,
  options: {
    cpuProduct?: Product | null;
    gpuProduct?: Product | null;
    ramProduct?: Product | null;
    resolution: '1080p' | '1440p' | '4K';
    quality: string;
  }
): BottleneckResult {
  const { cpuProduct, gpuProduct, ramProduct, resolution, quality } = options;

  const { score: cpuScore, name: cpuName } = evaluateCpuScore(cpuProduct);
  const { score: gpuScore, name: gpuName, vramGb } = evaluateGpuScore(gpuProduct);

  let ramGb = 16;
  if (ramProduct) {
    const rName = ramProduct.name.toLowerCase();
    if (rName.includes('64gb') || rName.includes('64 gb') || rName.includes('32gbx2')) ramGb = 64;
    else if (rName.includes('32gb') || rName.includes('32 gb') || rName.includes('16gbx2')) ramGb = 32;
    else if (rName.includes('16gb') || rName.includes('16 gb') || rName.includes('8gbx2')) ramGb = 16;
    else if (rName.includes('8gb') || rName.includes('8 gb')) ramGb = 8;
  }

  // Target demand by resolution & quality
  let resMultiplier = 1.0;
  let gpuResWeight = 1.0;
  let cpuResWeight = 1.0;

  if (resolution === '1080p') {
    resMultiplier = 1.0;
    gpuResWeight = 0.7; // 1080p is much easier for modern GPUs
    cpuResWeight = 1.05; // 1080p is slightly more CPU bound
  } else if (resolution === '1440p') {
    resMultiplier = 1.2;
    gpuResWeight = 1.0;
    cpuResWeight = 1.0;
  } else if (resolution === '4K') {
    resMultiplier = 1.7;
    gpuResWeight = 1.4;
    cpuResWeight = 0.9; // 4K is heavily GPU bound
  }

  let qualityMult = 1.0;
  const qLower = quality.toLowerCase();
  if (qLower === 'low' || qLower === 'very low' || qLower === 'faster') qualityMult = 0.6;
  else if (qLower === 'medium' || qLower === 'balanced' || qLower === 'normal') qualityMult = 0.8;
  else if (qLower === 'high') qualityMult = 1.0;
  else if (qLower === 'ultra' || qLower === 'very high' || qLower === 'best looking' || qLower === 'maximum' || qLower === 'epic') qualityMult = 1.25;
  else if (qLower === 'ray tracing' || qLower === 'cinematic' || qLower === 'extreme') qualityMult = 1.5;

  const isUltra = qLower.includes('ultra') || qLower.includes('cinematic') || qLower.includes('extreme') || qLower.includes('ray tracing') || qLower.includes('epic') || qLower.includes('maximum');
  const isLow = qLower.includes('low') || qLower === 'faster' || qLower === 'very low';

  const gameCpuReq = (isUltra ? game.cpuScoreReqUltra : isLow ? game.cpuScoreReqMin : game.cpuScoreReqRec) * cpuResWeight;
  const gameGpuReq = (isUltra ? game.gpuScoreReqUltra : isLow ? game.gpuScoreReqMin : game.gpuScoreReqRec) * gpuResWeight * qualityMult;

  // Bottleneck differential
  const cpuCapacity = cpuScore / Math.max(1, gameCpuReq);
  const gpuCapacity = gpuScore / Math.max(1, gameGpuReq);

  let cpuBottleneckPct = 0;
  let gpuBottleneckPct = 0;
  let limitingComponent: BottleneckResult['limitingComponent'] = 'Balanced Rig';

  // Bottleneck logic: Only report significant disparities
  if (cpuCapacity < gpuCapacity) {
    const diff = Math.min(65, Math.round(((gpuCapacity - cpuCapacity) / gpuCapacity) * 100));
    // 20% is the threshold for "noticeable" CPU disparity
    if (diff > 20) {
      cpuBottleneckPct = diff;
      limitingComponent = 'Processor (CPU)';
    }
  } else if (gpuCapacity < cpuCapacity) {
    const diff = Math.min(65, Math.round(((cpuCapacity - gpuCapacity) / cpuCapacity) * 100));
    // 15% is the threshold for "noticeable" GPU disparity
    if (diff > 15) {
      gpuBottleneckPct = diff;
      limitingComponent = 'Graphic Card (GPU)';
    }
  }

  if (ramGb < game.minRamGb) {
    limitingComponent = 'Memory (RAM)';
  }

  const overallBottleneckPct = Math.max(cpuBottleneckPct, gpuBottleneckPct);

  // Compute Base FPS estimation - realistic baseline for modern systems
  const effectiveCapacity = Math.min(cpuCapacity, gpuCapacity);
  let baseFps = 100 * effectiveCapacity;

  // Modulate based on tier
  if (game.tier === 'Esports/Light') {
    baseFps = Math.round(baseFps * 2.4); // Realistic 2.4x multiplier for esports
  } else if (game.tier === 'Mid-Range AAA') {
    baseFps = Math.round(baseFps * 1.4);
  } else if (game.tier === 'Ultra/Ray Tracing' || game.tier === 'Heavy AAA') {
    baseFps = Math.round(baseFps * 1.0);
  }

  const estimatedFpsAvg = Math.max(20, Math.round(baseFps));
  const estimatedFpsMin = Math.max(15, Math.round(estimatedFpsAvg * 0.75));
  const estimatedFpsMax = Math.round(estimatedFpsAvg * 1.2);

  // Determine Rating & Insights
  let ratingText = 'Optimal Balance & High FPS';
  let ratingColor: BottleneckResult['ratingColor'] = 'emerald';
  let recommendation = `This hardware pairing is well matched for ${game.title} at ${resolution} ${quality} settings. Minimal frame drop and smooth frametimes.`;

  // For very high FPS scenarios in light games, bottleneck matters less
  const isHighRefreshReady = estimatedFpsAvg > 240;

  if (overallBottleneckPct <= 18 || (isHighRefreshReady && overallBottleneckPct < 35)) {
    ratingText = isHighRefreshReady ? 'Overkill Performance' : 'Perfect Balance (Zero Bottleneck)';
    ratingColor = 'emerald';
    recommendation = isHighRefreshReady 
      ? `Both components are delivering extreme performance for ${game.title}. Any technical bottleneck is irrelevant at these framerates.`
      : `Both your ${cpuName.split(' ')[0]} and ${gpuName.split(' ')[0]} are functioning with full efficiency for ${game.title}. This is an elite pairing.`;
  } else if (overallBottleneckPct <= 35) {
    const isGpu = limitingComponent === 'Graphic Card (GPU)';
    ratingText = isGpu ? 'Healthy GPU Saturation' : `Minor CPU Bottleneck (${overallBottleneckPct}%)`;
    ratingColor = isGpu ? 'emerald' : 'cyan';
    recommendation = isGpu 
      ? `Your GPU is the primary limiter, which is ideal for a gaming rig. You are getting 100% of the value from your graphics card.`
      : `Great overall gameplay experience. The minor CPU variance will not cause noticeable stuttering in ${game.title}.`;
  } else if (overallBottleneckPct <= 55) {
    const isGpu = limitingComponent === 'Graphic Card (GPU)';
    ratingText = isGpu ? 'GPU Bound (Optimal for 4K)' : `Noticeable CPU Bottleneck (${overallBottleneckPct}%)`;
    ratingColor = isGpu ? 'cyan' : 'amber';
    recommendation = isGpu
      ? `Your high-end CPU is ahead of the GPU at this resolution. This is common in 1440p/4K and ensures perfect 1% low frametimes.`
      : `Your GPU has more power than your CPU can feed. Consider bumping up to a higher resolution or upgrading your processor for smoother performance.`;
  } else {
    ratingText = `Significant ${limitingComponent === 'Processor (CPU)' ? 'CPU' : 'GPU'} Bottleneck (${overallBottleneckPct}%)`;
    ratingColor = 'rose';
    recommendation = limitingComponent === 'Processor (CPU)'
      ? `Significant CPU throttle detected. Upgrading to a modern processor (e.g. Ryzen 7 7800X3D or Core i7-14700K) will unlock maximum GPU performance.`
      : `Your graphic card is heavily saturated for ${game.title} at ${resolution} ${quality}. Consider lowering settings or a GPU upgrade for better FPS.`;
  }

  return {
    game,
    resolution,
    quality,
    cpuScore,
    gpuScore,
    cpuBottleneckPct,
    gpuBottleneckPct,
    overallBottleneckPct,
    limitingComponent,
    estimatedFpsMin,
    estimatedFpsAvg,
    estimatedFpsMax,
    ratingText,
    ratingColor,
    recommendation,
    hardwareSummary: {
      cpuName,
      gpuName,
      ramGb,
    },
  };
}
