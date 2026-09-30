import React, { useState, useEffect, useMemo } from 'react';
import {
  Gamepad2,
  Plus,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Flame,
  X,
  Tv,
  Cpu,
  Layers,
  HardDrive,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { BottleneckGame, generateAllGamesDatabase } from '../data/bottleneckGames';

export const AdminGamesManager: React.FC = () => {
  const [games, setGames] = useState<BottleneckGame[]>(() => generateAllGamesDatabase());
  const [customGames, setCustomGames] = useState<BottleneckGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State for Adding a New Game
  const [formTitle, setFormTitle] = useState('');
  const [formGenre, setFormGenre] = useState('Action RPG');
  const [formYear, setFormYear] = useState(new Date().getFullYear().toString());
  const [formTier, setFormTier] = useState<BottleneckGame['tier']>('Heavy AAA');
  const [formSettings, setFormSettings] = useState('Low, Medium, High, Ultra');
  const [formMinCpu, setFormMinCpu] = useState('Intel Core i5-10400 / AMD Ryzen 5 3600');
  const [formMinGpu, setFormMinGpu] = useState('NVIDIA GeForce GTX 1660 Super / Radeon RX 5600 XT');
  const [formMinRam, setFormMinRam] = useState('16');
  const [formRecCpu, setFormRecCpu] = useState('Intel Core i7-12700 / AMD Ryzen 7 5700X');
  const [formRecGpu, setFormRecGpu] = useState('NVIDIA GeForce RTX 3070 / Radeon RX 6700 XT');
  const [formRecRam, setFormRecRam] = useState('16');
  const [formUltraCpu, setFormUltraCpu] = useState('Intel Core i7-14700K / AMD Ryzen 7 7800X3D');
  const [formUltraGpu, setFormUltraGpu] = useState('NVIDIA GeForce RTX 4080 Super / RTX 5080');
  const [formUltraRam, setFormUltraRam] = useState('32');
  const [formStorage, setFormStorage] = useState('100');
  const [formDirectX, setFormDirectX] = useState('DirectX 12');

  const fetchGames = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bottleneck-games');
      if (res.ok) {
        const data = await res.json();
        const custom: BottleneckGame[] = data.games || [];
        setCustomGames(custom);
        const defaults = generateAllGamesDatabase();
        const customIds = new Set(custom.map((g) => g.id));
        setGames([...custom, ...defaults.filter((d) => !customIds.has(d.id))]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleAddGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

      const newGamePayload = {
        title: formTitle.trim(),
        genre: formGenre.trim(),
        releaseYear: parseInt(formYear, 10) || new Date().getFullYear(),
        image: '', // No images as requested
        tier: formTier,
        supportedSettings: formSettings.split(',').map(s => s.trim()).filter(Boolean),
        minCpu: formMinCpu.trim(),
      minGpu: formMinGpu.trim(),
      minRamGb: parseInt(formMinRam, 10) || 16,
      recCpu: formRecCpu.trim(),
      recGpu: formRecGpu.trim(),
      recRamGb: parseInt(formRecRam, 10) || 16,
      ultraCpu: formUltraCpu.trim(),
      ultraGpu: formUltraGpu.trim(),
      ultraRamGb: parseInt(formUltraRam, 10) || 32,
      cpuScoreReqMin: formTier === 'Ultra/Ray Tracing' ? 45 : formTier === 'Heavy AAA' ? 38 : 25,
      cpuScoreReqRec: formTier === 'Ultra/Ray Tracing' ? 75 : formTier === 'Heavy AAA' ? 65 : 45,
      cpuScoreReqUltra: formTier === 'Ultra/Ray Tracing' ? 95 : formTier === 'Heavy AAA' ? 88 : 70,
      gpuScoreReqMin: formTier === 'Ultra/Ray Tracing' ? 48 : formTier === 'Heavy AAA' ? 40 : 25,
      gpuScoreReqRec: formTier === 'Ultra/Ray Tracing' ? 78 : formTier === 'Heavy AAA' ? 68 : 45,
      gpuScoreReqUltra: formTier === 'Ultra/Ray Tracing' ? 98 : formTier === 'Heavy AAA' ? 90 : 70,
      vramReqGbMin: formTier === 'Ultra/Ray Tracing' ? 8 : 6,
      vramReqGbRec: formTier === 'Ultra/Ray Tracing' ? 12 : 8,
      vramReqGbUltra: 16,
      storageGb: parseInt(formStorage, 10) || 100,
      directX: formDirectX,
    };

    try {
      const res = await fetch('/api/bottleneck-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGamePayload),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomGames((prev) => [data.game, ...prev]);
        setGames((prev) => [data.game, ...prev]);
        setIsAddModalOpen(false);
        setNotification(`Game "${formTitle}" added to PC Bottleneck Calculator successfully!`);
        setTimeout(() => setNotification(null), 4000);
        // Reset form
        setFormTitle('');
      }
    } catch {
      setNotification('Failed to save game. Please try again.');
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      const res = await fetch(`/api/bottleneck-games/${gameId}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomGames((prev) => prev.filter((g) => g.id !== gameId));
        setGames((prev) => prev.filter((g) => g.id !== gameId));
        setDeleteConfirmId(null);
        setNotification('Game deleted successfully.');
        setTimeout(() => setNotification(null), 3000);
      }
    } catch {
      setNotification('Error deleting game.');
    }
  };

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (selectedTier !== 'All' && g.tier !== selectedTier) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          g.title.toLowerCase().includes(q) ||
          g.genre.toLowerCase().includes(q) ||
          g.releaseYear.toString().includes(q)
        );
      }
      return true;
    });
  }, [games, selectedTier, search]);

  return (
    <div className="space-y-4">
      {/* Top Bar with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-amber-400" />
            PC Bottleneck Calculator Games Database
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage games and add newly announced or launched PC titles with their hardware specifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add New Game</span>
          </button>

          <button
            onClick={fetchGames}
            disabled={loading}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 transition-colors"
            title="Refresh game list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search game titles (Wukong, GTA, Cyberpunk, Battlefield...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none text-white focus:outline-none w-full text-xs placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Tier:</span>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="bg-slate-900 border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs outline-none"
          >
            <option value="All">All Tiers ({games.length})</option>
            <option value="Ultra/Ray Tracing">Ultra / Ray Tracing</option>
            <option value="Heavy AAA">Heavy AAA</option>
            <option value="Mid-Range AAA">Mid-Range AAA</option>
            <option value="Esports/Light">Esports & Light</option>
          </select>
        </div>
      </div>

      {/* Games Table List */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
              <th className="p-3">Game Title</th>
              <th className="p-3">Genre & Year</th>
              <th className="p-3">Tier</th>
              <th className="p-3">Recommended CPU & GPU</th>
              <th className="p-3">RAM & Storage</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredGames.slice(0, 100).map((game) => (
              <tr key={game.id} className="hover:bg-white/5 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <Gamepad2 className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">{game.title}</span>
                      {game.isCustom && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                          Custom Added
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 text-slate-300">
                  <span>{game.genre}</span>
                  <span className="text-slate-500 block text-[11px] font-mono">({game.releaseYear})</span>
                </td>
                <td className="p-3">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      game.tier === 'Ultra/Ray Tracing'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : game.tier === 'Heavy AAA'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {game.tier}
                  </span>
                </td>
                <td className="p-3 text-slate-300 text-[11px] max-w-xs truncate">
                  <div className="text-slate-200 font-medium truncate" title={game.recCpu}>
                    CPU: {game.recCpu}
                  </div>
                  <div className="text-slate-400 truncate" title={game.recGpu}>
                    GPU: {game.recGpu}
                  </div>
                </td>
                <td className="p-3 text-slate-300 text-[11px] font-mono">
                  <div>RAM: {game.recRamGb} GB</div>
                  <div className="text-slate-500">{game.storageGb} GB ({game.directX})</div>
                </td>
                <td className="p-3 text-right">
                  {game.isCustom ? (
                    deleteConfirmId === game.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDeleteGame(game.id)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(game.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
                        title="Delete custom game"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-500">Verified System</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Game Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 font-bold">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Game to Bottleneck Calculator</h3>
                  <p className="text-xs text-slate-400">
                    Input official published system requirements for newly launched or upcoming titles.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddGameSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-bold uppercase block mb-1">Game Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doom: The Dark Ages"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase block mb-1">Release Year</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase block mb-1">Genre</label>
                  <input
                    type="text"
                    placeholder="e.g. FPS / Action RPG / Open World"
                    value={formGenre}
                    onChange={(e) => setFormGenre(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase block mb-1">Engine Tier</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-amber-400"
                  >
                    <option value="Ultra/Ray Tracing">Ultra / Ray Tracing</option>
                    <option value="Heavy AAA">Heavy AAA</option>
                    <option value="Mid-Range AAA">Mid-Range AAA</option>
                    <option value="Esports/Light">Esports / Light</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold uppercase block mb-1">Available Quality Settings (Comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Low, Medium, High, Ultra, Cinematic"
                  value={formSettings}
                  onChange={(e) => setFormSettings(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none focus:border-amber-400"
                />
              </div>

              {/* Requirements Sections */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-black uppercase text-amber-400 block">Recommended Specifications (Target 1440p / 60+ FPS)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 text-[10px] block">Recommended CPU</label>
                    <input
                      type="text"
                      value={formRecCpu}
                      onChange={(e) => setFormRecCpu(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block">Recommended GPU</label>
                    <input
                      type="text"
                      value={formRecGpu}
                      onChange={(e) => setFormRecGpu(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block">RAM (GB)</label>
                    <input
                      type="number"
                      value={formRecRam}
                      onChange={(e) => setFormRecRam(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-black uppercase text-rose-400 block">Ultra / Ray Tracing Specifications</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 text-[10px] block">Ultra CPU</label>
                    <input
                      type="text"
                      value={formUltraCpu}
                      onChange={(e) => setFormUltraCpu(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block">Ultra GPU</label>
                    <input
                      type="text"
                      value={formUltraGpu}
                      onChange={(e) => setFormUltraGpu(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-[10px] block">Ultra RAM (GB)</label>
                    <input
                      type="number"
                      value={formUltraRam}
                      onChange={(e) => setFormUltraRam(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase block mb-1">Storage Size (GB)</label>
                  <input
                    type="number"
                    value={formStorage}
                    onChange={(e) => setFormStorage(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase block mb-1">DirectX / API</label>
                  <input
                    type="text"
                    value={formDirectX}
                    onChange={(e) => setFormDirectX(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-white/10 text-white outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                >
                  Save Game to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
