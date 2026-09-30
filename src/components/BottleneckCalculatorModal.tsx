import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Gauge,
  Tv,
  Cpu,
  Zap,
  HardDrive,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Gamepad2,
  ArrowUpRight,
  TrendingUp,
  Layers,
  Info,
  ChevronRight,
  Sliders,
  Check,
} from 'lucide-react';
import { Product, PCBuildParts } from '../types';
import { BottleneckGame, generateAllGamesDatabase } from '../data/bottleneckGames';
import { calculateGameBottleneck, BottleneckResult } from '../utils/bottleneckCalculator';

interface BottleneckCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  build: PCBuildParts;
  products: Product[];
  onSelectComponent?: (category: keyof PCBuildParts, product: Product) => void;
}

export const BottleneckCalculatorModal: React.FC<BottleneckCalculatorModalProps> = ({
  isOpen,
  onClose,
  build,
  products,
  onSelectComponent,
}) => {
  const [games, setGames] = useState<BottleneckGame[]>(() => generateAllGamesDatabase());
  const [selectedGameId, setSelectedGameId] = useState<string>('game-bmw');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [resolution, setResolution] = useState<'1080p' | '1440p' | '4K'>('1440p');
  const [quality, setQuality] = useState<string>('High');

  const selectedGame = useMemo(() => {
    return games.find((g) => g.id === selectedGameId) || games[0] || null;
  }, [games, selectedGameId]);

  const bottleneckResult: BottleneckResult | null = useMemo(() => {
    if (!selectedGame) return null;
    return calculateGameBottleneck(selectedGame, {
      cpuProduct: build.Processor,
      gpuProduct: build['Graphic Card'],
      ramProduct: build.RAM,
      resolution,
      quality,
    });
  }, [selectedGame, build, resolution, quality]);

  // Synchronize quality setting when game changes if needed
  useEffect(() => {
    if (selectedGame && selectedGame.supportedSettings) {
      const settings = selectedGame.supportedSettings;
      if (!settings.includes(quality)) {
        // Try to find a reasonable fallback in the new list
        if (settings.includes('High')) setQuality('High');
        else if (settings.includes('Medium')) setQuality('Medium');
        else if (settings.includes('Balanced')) setQuality('Balanced');
        else setQuality(settings[0]);
      }
    }
  }, [selectedGameId, selectedGame]);

  // Load custom backend games from API if available
  useEffect(() => {
    fetch('/api/bottleneck-games')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.games) && data.games.length > 0) {
          const defaultList = generateAllGamesDatabase();
          const customIds = new Set(data.games.map((g: any) => g.id));
          const combined = [...data.games, ...defaultList.filter((g) => !customIds.has(g.id))];
          setGames(combined);
        }
      })
      .catch(() => {});
  }, []);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedGenre !== 'All' && !g.genre.toLowerCase().includes(selectedGenre.toLowerCase())) {
        return false;
      }
      if (selectedTier !== 'All' && g.tier !== selectedTier) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          g.genre.toLowerCase().includes(q) ||
          g.releaseYear.toString().includes(q)
        );
      }
      return true;
    });
  }, [games, searchQuery, selectedGenre, selectedTier]);

  // Unique genres for filter
  const genres = useMemo(() => {
    const set = new Set<string>();
    games.forEach((g) => {
      const parts = g.genre.split(/[\/,]/).map((s) => s.trim());
      parts.forEach((p) => {
        if (p) set.add(p);
      });
    });
    return Array.from(set).slice(0, 15);
  }, [games]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Gauge className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight uppercase">
                  Apex PC Bottleneck & FPS Calculator
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                  {games.length} Games Database
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Analyze real-time CPU & GPU balance, estimated FPS, and resolution bottlenecks for your PC build.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body: 2-Column Split */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          
          {/* Left Column: Game Browser & Selector (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-slate-950/40 p-4 overflow-hidden">
            {/* Search & Filters */}
            <div className="space-y-3 shrink-0 mb-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search games (Wukong, CS2, Cyberpunk...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 text-[11px]">
                <button
                  onClick={() => { setSelectedTier('All'); setSelectedGenre('All'); }}
                  className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                    selectedTier === 'All' && selectedGenre === 'All'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  All ({games.length})
                </button>
                <button
                  onClick={() => setSelectedTier('Ultra/Ray Tracing')}
                  className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                    selectedTier === 'Ultra/Ray Tracing'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Ray Tracing AAA
                </button>
                <button
                  onClick={() => setSelectedTier('Heavy AAA')}
                  className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                    selectedTier === 'Heavy AAA'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Heavy AAA
                </button>
                <button
                  onClick={() => setSelectedTier('Esports/Light')}
                  className={`px-3 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                    selectedTier === 'Esports/Light'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Esports & Light
                </button>
              </div>
            </div>

            {/* Games List Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {filteredGames.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No games found matching "{searchQuery}".
                </div>
              ) : (
                filteredGames.map((g) => {
                  const isSelected = g.id === selectedGameId;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setSelectedGameId(g.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                        }`}>
                          <Gamepad2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate">{g.title}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            <span className="font-mono">{g.releaseYear}</span>
                            <span>•</span>
                            <span className="truncate">{g.genre}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            g.tier === 'Ultra/Ray Tracing'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : g.tier === 'Heavy AAA'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {g.tier.split('/')[0]}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Bottleneck Calculation & Performance Gauge (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full overflow-y-auto custom-scrollbar p-5 space-y-5 bg-slate-900/50">
            {selectedGame && bottleneckResult ? (
              <>
                {/* Active Build Hardware Snapshot */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      Current Rig Under Test
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        {build.Processor?.name || 'Standard 6-Core CPU (Select in Builder)'}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                        <Tv className="w-3.5 h-3.5 text-emerald-400" />
                        {build['Graphic Card']?.name || 'Dedicated GPU (Select in Builder)'}
                      </span>
                    </div>
                  </div>

                  {/* Resolution & Quality Switches */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                      {(['1080p', '1440p', '4K'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setResolution(r)}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            resolution === r
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                      {(selectedGame?.supportedSettings || ['Low', 'Medium', 'High', 'Ultra']).map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuality(q)}
                          className={`px-2.5 py-1 rounded-lg transition-all ${
                            quality === q
                              ? 'bg-amber-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {q === 'Ray Tracing' ? 'RT' : q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Main FPS & Bottleneck Dial Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Estimated FPS Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 relative overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Estimated FPS
                      </span>
                      <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                    </div>
                    <div className="my-3 text-center">
                      <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        ~{bottleneckResult.estimatedFpsAvg}
                        <span className="text-sm font-semibold text-slate-400 ml-1">FPS</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        {bottleneckResult.estimatedFpsMin} Min - {bottleneckResult.estimatedFpsMax} Max
                      </div>
                    </div>
                    <div className="text-[10px] text-indigo-300 text-center font-semibold bg-indigo-500/10 py-1 rounded-lg">
                      {resolution} • {quality} Settings
                    </div>
                  </div>

                  {/* Bottleneck Percentage Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Bottleneck Ratio
                      </span>
                      <Gauge className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="my-3 text-center">
                      <div
                        className={`text-3xl sm:text-4xl font-black tracking-tight ${
                          bottleneckResult.overallBottleneckPct <= 10
                            ? 'text-emerald-400'
                            : bottleneckResult.overallBottleneckPct <= 25
                            ? 'text-cyan-400'
                            : bottleneckResult.overallBottleneckPct <= 38
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {bottleneckResult.overallBottleneckPct}%
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-semibold">
                        {bottleneckResult.limitingComponent}
                      </div>
                    </div>
                    <div
                      className={`text-[10px] text-center font-bold py-1 rounded-lg ${
                        bottleneckResult.overallBottleneckPct <= 10
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : bottleneckResult.overallBottleneckPct <= 25
                          ? 'bg-cyan-500/10 text-cyan-300'
                          : 'bg-amber-500/10 text-amber-300'
                      }`}
                    >
                      {bottleneckResult.ratingText}
                    </div>
                  </div>

                  {/* Game Load Tier Card */}
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Game Engine Tier
                      </span>
                      <Gamepad2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="my-3 text-center">
                      <div className="text-lg font-black text-white">{selectedGame.tier}</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        DirectX: {selectedGame.directX}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-300 text-center font-mono bg-slate-900 py-1 rounded-lg">
                      Storage: {selectedGame.storageGb} GB
                    </div>
                  </div>
                </div>

                {/* Component Load Balance Bars */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    Component Hardware Utilization Index
                  </h4>

                  {/* CPU Meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5 font-semibold">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        Processor Capacity
                      </span>
                      <span className="font-mono text-indigo-300">{bottleneckResult.cpuScore}/100</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, bottleneckResult.cpuScore)}%` }}
                      />
                    </div>
                  </div>

                  {/* GPU Meter */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5 font-semibold">
                        <Tv className="w-3.5 h-3.5 text-emerald-400" />
                        Graphic Card Capacity
                      </span>
                      <span className="font-mono text-emerald-300">{bottleneckResult.gpuScore}/100</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, bottleneckResult.gpuScore)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Analysis & Upgrade Insight */}
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Apex Architect Assessment & Advice</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {bottleneckResult.recommendation}
                  </p>
                </div>

                {/* Official Game Requirements Comparison Table */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    {selectedGame.title} Specifications Matrix
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Minimum (1080p Low)</span>
                      <p className="text-slate-200 font-semibold">{selectedGame.minCpu}</p>
                      <p className="text-slate-400">{selectedGame.minGpu}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{selectedGame.minRamGb}GB RAM</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">Recommended (1080p/1440p High)</span>
                      <p className="text-slate-200 font-semibold">{selectedGame.recCpu}</p>
                      <p className="text-slate-400">{selectedGame.recGpu}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{selectedGame.recRamGb}GB RAM</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Ultra / Ray Tracing</span>
                      <p className="text-slate-200 font-semibold">{selectedGame.ultraCpu || 'High-End 8-Core CPU'}</p>
                      <p className="text-slate-400">{selectedGame.ultraGpu || 'RTX 4080 / RX 7900 XT'}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{selectedGame.ultraRamGb || 32}GB RAM</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Bottom Footer Action */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Select parts in PC Builder to test any CPU and GPU pairing in real-time.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
          >
            Back to PC Builder
          </button>
        </div>
      </div>
    </div>
  );
};
