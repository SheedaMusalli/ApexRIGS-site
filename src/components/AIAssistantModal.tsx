import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Send,
  Cpu,
  Mic,
  MicOff,
  Volume2,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  ShoppingCart,
} from 'lucide-react';
import { Product, PCBuildParts, AISuggestionResponse } from '../types';
import { formatPkr } from '../utils/formatters';
import { optimizeBuildForBudget } from '../utils/budgetOptimizer';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  currentBuild: PCBuildParts;
  onApplyBuildToBuilder: (newBuild: PCBuildParts, newVariants: Record<string, string>) => void;
  onNavigateToBuilder: () => void;
  onAddBuildToCart?: (suggestion: AISuggestionResponse) => void;
  initialVoiceMode?: boolean;
}

interface ChatEntry {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  suggestion?: AISuggestionResponse;
  timestamp: string;
}

const playSoftNotificationTone = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // AI Studio-style gentle dual-chime notification tone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Harmonic soft chord D5 -> A5 and A5 -> D6
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    osc2.frequency.setValueAtTime(880, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.32);
    osc2.stop(now + 0.42);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 550);
  } catch {
    // Ignore audio autoplay restrictions
  }
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  products,
  currentBuild,
  onApplyBuildToBuilder,
  onNavigateToBuilder,
  onAddBuildToCart,
  initialVoiceMode = false,
}) => {
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Assalam-o-Alaikum! Looking to put together a build? Tell me your budget in PKR, what games or software you plan to run (like 1440p gaming or video editing), or any specific parts you want, and I'll find a compatible setup from our catalog.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    const userMsg: ChatEntry = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: promptText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      // Extract numbers if budget was mentioned (e.g. 180k, 250000, 2 lac, 3 lakh)
      let extractedBudget = 200000;
      const lower = promptText.toLowerCase();
      const numMatch = lower.match(/(\d+[\d,]*)/);
      if (lower.includes('150k') || lower.includes('1.5 lac') || lower.includes('1.5 lakh')) {
        extractedBudget = 150000;
      } else if (lower.includes('200k') || lower.includes('2 lac') || lower.includes('2 lakh')) {
        extractedBudget = 200000;
      } else if (lower.includes('250k') || lower.includes('2.5 lac')) {
        extractedBudget = 250000;
      } else if (lower.includes('300k') || lower.includes('3 lac')) {
        extractedBudget = 300000;
      } else if (lower.includes('400k') || lower.includes('4 lac')) {
        extractedBudget = 400000;
      } else if (numMatch) {
        const parsed = parseInt(numMatch[1].replace(/,/g, ''), 10);
        if (parsed > 40000 && parsed < 5000000) extractedBudget = parsed;
        else if (parsed <= 1000) extractedBudget = parsed * 1000; // e.g. "250" -> 250k
      }

      let suggestion: AISuggestionResponse | null = null;
      let replyText = '';

      // Try calling server's build assistant API
      try {
        const res = await fetch('/api/ai/build-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: promptText,
            targetBudgetPkr: extractedBudget,
            preferredBrand: lower.includes('intel') ? 'Intel' : lower.includes('amd') ? 'AMD' : undefined,
            useCase: lower.includes('edit') || lower.includes('render') ? 'content_creation' : 'gaming',
          }),
        });

        if (res.ok) {
          suggestion = await res.json();
          replyText = suggestion?.summary || 'Here is the recommended custom build matching your requirements:';
        }
      } catch {
        // Fallback to local optimizer
      }

      if (!suggestion) {
        suggestion = optimizeBuildForBudget(products, {
          targetBudget: extractedBudget,
          userPrompt: promptText,
        });
        replyText = suggestion.summary || `Optimized ${formatPkr(extractedBudget)} PC Build generated.`;
      }

      const botMsg: ChatEntry = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        suggestion,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      playSoftNotificationTone();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'assistant',
          text: "I couldn't generate the build at this moment. You can still customize your rig manually in our PC Builder.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToBuilder = (suggestion: AISuggestionResponse) => {
    const newBuild: PCBuildParts = {};
    const newVariants: Record<string, string> = {};

    suggestion.recommendedCategoryParts.forEach((rec) => {
      const matched = products.find((p) => p.id === rec.productId);
      if (matched) {
        newBuild[matched.category] = matched;
        if (rec.variantId) {
          newVariants[matched.id] = rec.variantId;
        } else if (matched.variants && matched.variants.length > 0) {
          newVariants[matched.id] = matched.variants[0].id;
        }
      }
    });

    onApplyBuildToBuilder(newBuild, newVariants);
    onNavigateToBuilder();
    onClose();
  };

  const handlePresetClick = (preset: string) => {
    handleSendPrompt(preset);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8 flex flex-col h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">ApexRig Build Assistant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Current in-store inventory & pricing at Hafeez Centre
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/30 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-slate-500 font-medium whitespace-nowrap">Try:</span>
          <button
            onClick={() => handlePresetClick('Best gaming rig under 150k PKR for 1080p')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            Esports 150K PKR
          </button>
          <button
            onClick={() => handlePresetClick('1440p gaming build under 250,000 PKR with RTX 4060 or 4070')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            1440p Gaming 250K PKR
          </button>
          <button
            onClick={() => handlePresetClick('High-end workstation for 4K video editing and Blender 400K PKR')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
          >
            4K Workstation 400K PKR
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800/80 border border-slate-700/80 text-slate-200 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>

                {/* If AI returned a build recommendation */}
                {msg.suggestion && msg.suggestion.recommendedCategoryParts && (
                  <div className="mt-3 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3.5 space-y-3 text-slate-200">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Suggested Rig Configuration
                      </span>
                      <span className="font-black text-emerald-400 text-sm">
                        {formatPkr(msg.suggestion.estimatedTotalPkr)}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {msg.suggestion.recommendedCategoryParts.map((part, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-medium w-28 truncate">
                            {part.category}:
                          </span>
                          <span className="text-white truncate flex-1 px-1">
                            {part.productName}
                          </span>
                          <span className="font-semibold text-emerald-400 shrink-0">
                            {formatPkr(part.price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {msg.suggestion.reasoning && (
                      <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 leading-normal">
                        {msg.suggestion.reasoning}
                      </p>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={() => handleApplyToBuilder(msg.suggestion!)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all hover:scale-[1.01]"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Apply to PC Builder
                      </button>
                      {onAddBuildToCart && (
                        <button
                          onClick={() => {
                            onAddBuildToCart(msg.suggestion!);
                            onClose();
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-all hover:scale-[1.01]"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          Add Components to Cart
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <span className="text-[10px] opacity-60 block text-right">{msg.timestamp}</span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center">
                <Cpu className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl rounded-bl-none p-3.5 text-xs text-slate-300 flex items-center gap-2">
                <span className="animate-pulse">Checking catalog parts and verifying component compatibility...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt(inputPrompt);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask about components, target budget in PKR, or specific games..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !inputPrompt.trim()}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
