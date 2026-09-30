import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Mic,
  MicOff,
  Tv,
  MonitorOff,
  Sparkles,
  Send,
  Trash2,
  Clock,
  Radio,
  Volume2,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
  Maximize2,
  Minimize2,
  Activity,
  Video,
  PhoneOff,
  Cpu,
  Zap,
  HardDrive,
  Box,
  Fan,
  ShoppingCart,
  Printer,
  Wrench,
  Search,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Check,
  RotateCcw,
  Sparkle,
} from 'lucide-react';
import { Product, ProductCategory, PCBuildParts, StoreSettings } from '../types';
import { formatPkr } from '../utils/formatters';
import { optimizeBuildForBudget } from '../utils/budgetOptimizer';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

export interface GeminiLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  products?: Product[];
  build?: PCBuildParts;
  setBuild?: React.Dispatch<React.SetStateAction<PCBuildParts>>;
  selectedVariants?: Record<string, string>;
  setSelectedVariants?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onAddToCart?: (product: Product, variantId?: string) => void;
  onAddBuildToCart?: (customRig: boolean) => void;
  onOpenQuotation?: () => void;
  onOpenCart?: () => void;
  storeSettings?: StoreSettings;
}

export interface LiveChatTurn {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  timestamp: string;
  suggestion?: import('../types').AISuggestionResponse;
}

const STORAGE_KEY = 'apex_apex_rig_ai_history';

interface BuildSlotDef {
  key: keyof PCBuildParts;
  title: string;
  category: ProductCategory;
  icon: any;
  required?: boolean;
}

const BUILD_SLOTS: BuildSlotDef[] = [
  { key: 'Processor', title: 'Processor (CPU)', category: 'Processor', icon: Cpu, required: true },
  { key: 'Motherboard', title: 'Motherboard', category: 'Motherboard', icon: Layers, required: true },
  { key: 'CPU Cooler', title: 'CPU Cooler', category: 'CPU Cooler', icon: Fan },
  { key: 'RAM', title: 'Memory (RAM)', category: 'RAM', icon: Layers, required: true },
  { key: 'Graphic Card', title: 'Graphic Card (GPU)', category: 'Graphic Card', icon: Tv },
  { key: 'Storage', title: 'Storage (NVMe SSD)', category: 'Storage', icon: HardDrive, required: true },
  { key: 'Power Supply', title: 'Power Supply (PSU)', category: 'Power Supply', icon: Zap, required: true },
  { key: 'Casing', title: 'Casing / Chassis', category: 'Casing', icon: Box, required: true },
  { key: 'Casing Fans', title: 'Casing Fans', category: 'Casing Fans', icon: Fan },
  { key: 'Monitor', title: 'Gaming Monitor', category: 'Monitor', icon: Tv },
];

// Helper: Convert Float32 audio samples from microphone to 16-bit linear PCM base64 string
function floatTo16BitPCMBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// Helper: Convert base64 PCM 24000Hz 16-bit to AudioBuffer with byte-safe direct channel decoding
function base64PCMToAudioBuffer(
  ctx: AudioContext,
  base64: string,
  sampleRate = 24000
): AudioBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const sampleCount = Math.floor(len / 2);
  const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    const byte1 = binary.charCodeAt(i * 2);
    const byte2 = binary.charCodeAt(i * 2 + 1);
    let val = (byte2 << 8) | byte1;
    if (val >= 0x8000) val -= 0x10000;
    channelData[i] = val / 32768.0;
  }
  return audioBuffer;
}

export const GeminiLiveModal: React.FC<GeminiLiveModalProps> = ({
  isOpen,
  onClose,
  products = INITIAL_PRODUCTS,
  build: propBuild,
  setBuild: propSetBuild,
  selectedVariants: propSelectedVariants,
  setSelectedVariants: propSetSelectedVariants,
  onAddBuildToCart,
  onOpenQuotation,
  onOpenCart,
  storeSettings,
}) => {
  // Local fallback state if not provided
  const [localBuild, setLocalBuild] = useState<PCBuildParts>({});
  const [localVariants, setLocalVariants] = useState<Record<string, string>>({});

  const currentBuild = propBuild || localBuild;
  const setCurrentBuild = propSetBuild || setLocalBuild;
  const currentVariants = propSelectedVariants || localVariants;
  const setCurrentVariants = propSetSelectedVariants || setLocalVariants;

  // Active stage tab: 'builder' (Interactive In-App Workspace), 'screenshare' (Desktop capture), 'camera' (Live Webcam), 'voice' (Visualizer)
  const [activeStageTab, setActiveStageTab] = useState<'builder' | 'screenshare' | 'camera' | 'voice'>('builder');

  // Connection states
  const [connectionStatus, setConnectionStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to connect');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const isMicMutedRef = useRef(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const isAiSpeakingRef = useRef(false);
  const setAiSpeaking = (speaking: boolean) => {
    isAiSpeakingRef.current = speaking;
    setIsAiSpeaking(speaking);
  };
  const [isListening, setIsListening] = useState(false);

  // Live Screen Sharing & Camera States
  const [isDesktopSharing, setIsDesktopSharing] = useState(false);
  const [isCameraSharing, setIsCameraSharing] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [framesStreamedCount, setFramesStreamedCount] = useState(0);
  const [hasPermissionsPolicyBlock, setHasPermissionsPolicyBlock] = useState(false);
  const [isTheaterView, setIsTheaterView] = useState(false);
  const [cartSuccessMessage, setCartSuccessMessage] = useState<string | null>(null);

  // Component Picker State inside Modal
  const [activePickingSlot, setActivePickingSlot] = useState<BuildSlotDef | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [budgetInput, setBudgetInput] = useState('');

  // Chat & History states
  const [chatHistory, setChatHistory] = useState<LiveChatTurn[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'init-1',
        sender: 'gemini',
        text: 'Assalam-o-Alaikum! Apex Rig AI Live Hardware Architect is active. Build and customize your rig in the interactive workspace, share your camera or screen, ask for budget setups, and I will generate optimized component tables for you!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });
  const [showHistory, setShowHistory] = useState(true);
  const [textInput, setTextInput] = useState('');

  // Live transcript accumulator
  const [liveModelText, setLiveModelText] = useState('');
  const [liveUserText, setLiveUserText] = useState('');

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const desktopStreamRef = useRef<MediaStream | null>(null);
  const desktopVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameStreamIntervalRef = useRef<any>(null);
  const scheduledSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Active parts array and calculations
  const activeParts = useMemo(() => {
    return Object.entries(currentBuild as Record<string, Product | undefined | null>).filter(
      (entry): entry is [string, Product] => Boolean(entry[1])
    );
  }, [currentBuild]);

  const totalBuildPrice = useMemo(() => {
    return activeParts.reduce((acc, [_, prod]) => {
      const variantId = currentVariants[prod.id];
      const variant = prod.variants?.find((v) => v.id === variantId);
      return acc + (variant?.price || prod.price);
    }, 0);
  }, [activeParts, currentVariants]);

  const estimatedWattage = useMemo(() => {
    let wattage = 100;
    const cpuTdp = currentBuild.Processor?.specifications?.tdpWatts || (currentBuild.Processor?.name.includes('i9') ? 250 : 125);
    const gpuTdp = currentBuild['Graphic Card']?.specifications?.tdpWatts || (currentBuild['Graphic Card']?.name.includes('5090') ? 450 : currentBuild['Graphic Card']?.name.includes('4070') ? 220 : 180);
    if (currentBuild.Processor) wattage += cpuTdp;
    if (currentBuild['Graphic Card']) wattage += gpuTdp;
    return wattage;
  }, [currentBuild]);

  const psuWattage = currentBuild['Power Supply']?.specifications?.psuWattage || 0;
  const isPsuAdequate = !psuWattage || psuWattage >= estimatedWattage + 100;

  const cpuSocket = currentBuild.Processor?.specifications?.socket || currentBuild.Processor?.specs?.socket;
  const moboSocket = currentBuild.Motherboard?.specifications?.socket || currentBuild.Motherboard?.specs?.socket;
  const isSocketCompatible = !cpuSocket || !moboSocket || cpuSocket === moboSocket;

  const moboRam = currentBuild.Motherboard?.specifications?.ramType || currentBuild.Motherboard?.specs?.ramType;
  const ramType = currentBuild.RAM?.specifications?.ramType || currentBuild.RAM?.specs?.ramType;
  const isRamCompatible = !moboRam || !ramType || moboRam.includes(ramType) || ramType.includes(moboRam);

  // Persist chat history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    } catch {}
  }, [chatHistory]);

  // Auto-scroll
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, liveModelText, liveUserText]);

  // Clean stop for audio output playback
  const stopAllAudioPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    scheduledSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
    isAiSpeakingRef.current = false;
    setIsAiSpeaking(false);
  }, []);

  // Send visual frame to Apex Rig AI API (for desktop or camera sharing)
  const sendVisualFrame = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    let targetVideo: HTMLVideoElement | null = null;
    if (activeStageTab === 'screenshare' && desktopVideoRef.current && desktopVideoRef.current.videoWidth > 0) {
      targetVideo = desktopVideoRef.current;
    } else if (activeStageTab === 'camera' && cameraVideoRef.current && cameraVideoRef.current.videoWidth > 0) {
      targetVideo = cameraVideoRef.current;
    }

    if (targetVideo && targetVideo.videoWidth > 0) {
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const canvas = offscreenCanvasRef.current;
      canvas.width = 1024;
      canvas.height = 576;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(targetVideo, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = dataUrl.split(',')[1];
        if (base64) {
          wsRef.current.send(JSON.stringify({ image: base64 }));
          setFramesStreamedCount((c) => c + 1);
        }
      }
    }
  }, [activeStageTab]);

  // Synchronize build context to Apex Rig AI on changes (pure structured data, 0 frame overhead)
  const sendBuildContextToLive = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const partsSummary = activeParts
      .map(([cat, p]) => {
        const variantId = currentVariants[p.id];
        const v = p.variants?.find((vr) => vr.id === variantId);
        const price = v ? v.price : p.price;
        return `• ${cat}: ${p.name} ${v ? `(${v.name})` : ''} - Rs ${price.toLocaleString()} PKR`;
      })
      .join('\n');

    const updateMsg = `[LIVE PC BUILDER STATE UPDATE]\n${
      partsSummary || 'No components selected currently.'
    }\nTotal Price: Rs ${totalBuildPrice.toLocaleString()} PKR\nEstimated Power Load: ~${estimatedWattage}W\nPSU Headroom: ${
      psuWattage ? `${psuWattage}W (${isPsuAdequate ? 'Adequate' : 'Underpowered'})` : 'No PSU chosen'
    }\nSocket Compatibility: ${cpuSocket ? `${cpuSocket} (${isSocketCompatible ? 'Compatible' : 'Mismatch'})` : 'Pending'}\nRAM Generation: ${moboRam ? `${moboRam} (${isRamCompatible ? 'Compatible' : 'Mismatch'})` : 'Pending'}`;

    try {
      wsRef.current.send(JSON.stringify({ context: updateMsg }));
    } catch {}
  }, [activeParts, currentVariants, totalBuildPrice, estimatedWattage, psuWattage, isPsuAdequate, cpuSocket, isSocketCompatible, moboRam, isRamCompatible]);

  // Sync state whenever build or variant changes
  useEffect(() => {
    sendBuildContextToLive();
  }, [currentBuild, currentVariants, sendBuildContextToLive]);

  // Frame streaming interval management (active when user is sharing desktop screen or camera)
  useEffect(() => {
    if (frameStreamIntervalRef.current) {
      clearInterval(frameStreamIntervalRef.current);
      frameStreamIntervalRef.current = null;
    }

    if (connectionStatus === 'connected' && (
      (activeStageTab === 'screenshare' && isDesktopSharing) ||
      (activeStageTab === 'camera' && isCameraSharing)
    )) {
      frameStreamIntervalRef.current = setInterval(() => {
        sendVisualFrame();
      }, 1500);
    }

    return () => {
      if (frameStreamIntervalRef.current) {
        clearInterval(frameStreamIntervalRef.current);
        frameStreamIntervalRef.current = null;
      }
    };
  }, [activeStageTab, isDesktopSharing, isCameraSharing, connectionStatus, sendVisualFrame]);

  // Mic Toggle Handler
  const toggleMic = async () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    isMicMutedRef.current = nextMuted;

    if (!nextMuted) {
      try {
        if (inputAudioCtxRef.current && inputAudioCtxRef.current.state === 'suspended') {
          await inputAudioCtxRef.current.resume();
        }
        if (outputAudioCtxRef.current && outputAudioCtxRef.current.state === 'suspended') {
          await outputAudioCtxRef.current.resume();
        }

        const tracks = micStreamRef.current ? micStreamRef.current.getAudioTracks() : [];
        if (!micStreamRef.current || tracks.length === 0 || tracks.every((t) => t.readyState === 'ended')) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          micStreamRef.current = stream;

          if (inputAudioCtxRef.current) {
            const micSource = inputAudioCtxRef.current.createMediaStreamSource(stream);
            const processor = inputAudioCtxRef.current.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              if (isMicMutedRef.current) return;
              const channelData = e.inputBuffer.getChannelData(0);

              // Calculate audio energy (RMS)
              let sum = 0;
              for (let i = 0; i < channelData.length; i++) {
                sum += channelData[i] * channelData[i];
              }
              const rms = Math.sqrt(sum / channelData.length);

              // Ignore low-level acoustic speaker bleed when AI is speaking to prevent self-interruption loops
              if (isAiSpeakingRef.current && rms < 0.04) {
                return;
              }
              // Skip silence
              if (rms < 0.005) {
                return;
              }

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const base64Audio = floatTo16BitPCMBase64(channelData);
                wsRef.current.send(JSON.stringify({ audio: base64Audio }));
              }
            };
            micSource.connect(processor);
            processor.connect(inputAudioCtxRef.current.destination);
          }
        } else {
          tracks.forEach((t) => {
            t.enabled = true;
          });
        }
        setStatusMessage('Microphone unmuted and listening.');
      } catch (err: any) {
        console.warn('Could not unmute microphone:', err);
        setIsMicMuted(true);
        isMicMutedRef.current = true;
        setStatusMessage('Microphone permission denied or device busy.');
      }
    } else {
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setStatusMessage('Microphone muted.');
    }
  };

  // Main Live Session Starter
  const startLiveSession = async () => {
    stopLiveSession();
    setConnectionStatus('connecting');
    setStatusMessage('Connecting to Apex Rig AI Live API...');

    try {
      isMicMutedRef.current = false;
      setIsMicMuted(false);

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      if (inputCtx.state === 'suspended') {
        inputCtx.resume().catch(() => {});
      }
      if (outputCtx.state === 'suspended') {
        outputCtx.resume().catch(() => {});
      }

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        micStreamRef.current = micStream;
      } catch (micErr) {
        console.warn('Microphone access denied or unavailable:', micErr);
        setStatusMessage('Microphone access restricted. Interactive workspace is ready.');
        setIsMicMuted(true);
        isMicMutedRef.current = true;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setStatusMessage('Live session connected. Voice & interactive builder active.');
        setIsListening(true);

        const initialRigContext = `Active Hardware Rig in Pakistan PKR:\n${
          activeParts.map(([k, p]) => `${k}: ${p.name} (Rs ${p.price})`).join(', ') || 'No parts yet'
        }\nTotal: Rs ${totalBuildPrice.toLocaleString()} PKR.`;
        ws.send(JSON.stringify({ context: initialRigContext }));

        if (micStream && inputCtx) {
          const micSource = inputCtx.createMediaStreamSource(micStream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);

          processor.onaudioprocess = (e) => {
            if (isMicMutedRef.current) return;
            const channelData = e.inputBuffer.getChannelData(0);

            // Calculate audio energy (RMS)
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
              sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / channelData.length);

            // Ignore low-level acoustic speaker bleed when AI is speaking to prevent self-interruption loops
            if (isAiSpeakingRef.current && rms < 0.04) {
              return;
            }
            // Skip silence
            if (rms < 0.005) {
              return;
            }

            if (ws.readyState === WebSocket.OPEN) {
              const base64Audio = floatTo16BitPCMBase64(channelData);
              ws.send(JSON.stringify({ audio: base64Audio }));
            }
          };

          micSource.connect(processor);
          processor.connect(inputCtx.destination);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.interrupted) {
            stopAllAudioPlayback();
            setLiveModelText('');
            return;
          }

          if (msg.error) {
            setStatusMessage(`Notice: ${msg.error}`);
            return;
          }

          if (msg.audio && outputAudioCtxRef.current) {
            setAiSpeaking(true);
            const ctx = outputAudioCtxRef.current;
            if (ctx.state === 'suspended') {
              ctx.resume().catch(() => {});
            }
            const buffer = base64PCMToAudioBuffer(ctx, msg.audio, 24000);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);

            const currentTime = ctx.currentTime;
            let startTime = nextStartTimeRef.current;

            // Jitter buffer lead-in (60ms) if queue was empty or underran, preventing choppy gap clicks
            if (startTime < currentTime) {
              startTime = currentTime + 0.06;
            }

            source.start(startTime);
            nextStartTimeRef.current = startTime + buffer.duration;

            scheduledSourcesRef.current.push(source);
            source.onended = () => {
              scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== source);
              if (scheduledSourcesRef.current.length === 0) {
                setAiSpeaking(false);
              }
            };
          }

          if (msg.text) {
            setLiveModelText((prev) => prev + msg.text);
          }
          if (msg.userInputText) {
            setLiveUserText(msg.userInputText);
          }

          if (msg.turnComplete) {
            const finalBot = (msg.transcript || liveModelText).trim();
            const finalUser = (msg.userInputFinal || liveUserText).trim();

            if (finalUser) {
              setChatHistory((prev) => [
                ...prev,
                {
                  id: `u-${Date.now()}`,
                  sender: 'user',
                  text: finalUser,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }

            if (finalBot) {
              // Extract potential suggestion data if the AI is describing a build
              const suggestionResult = getBuildSuggestion(finalBot);
              
              setChatHistory((prev) => [
                ...prev,
                {
                  id: `g-${Date.now()}`,
                  sender: 'gemini',
                  text: finalBot,
                  suggestion: suggestionResult?.suggestion,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
              ]);
            }

            setLiveModelText('');
            setLiveUserText('');
          }
        } catch (err) {
          console.warn('Error processing WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        setStatusMessage('Live WebSocket notice. Ready to retry.');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setStatusMessage('Live session disconnected.');
        setIsListening(false);
      };
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage(err?.message || 'Could not access audio or connect.');
    }
  };

  // Teardown Live Session
  const stopLiveSession = () => {
    stopAllAudioPlayback();
    if (frameStreamIntervalRef.current) {
      clearInterval(frameStreamIntervalRef.current);
      frameStreamIntervalRef.current = null;
    }
    stopDesktopShare();
    stopCameraShare();

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    setConnectionStatus('disconnected');
    setIsListening(false);
    setIsAiSpeaking(false);
  };

  // Effect to ensure video plays when camera stream is active and tab is selected
  useEffect(() => {
    if (activeStageTab === 'camera' && isCameraSharing && cameraStreamRef.current && cameraVideoRef.current) {
      if (cameraVideoRef.current.srcObject !== cameraStreamRef.current) {
        cameraVideoRef.current.srcObject = cameraStreamRef.current;
        cameraVideoRef.current.play().catch(err => {
          console.warn('Auto-play blocked or failed:', err);
        });
      }
    }
  }, [activeStageTab, isCameraSharing]);

  // Start Camera Stream
  const startCameraShare = async () => {
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacingMode === 'environment' ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("Retrying camera with simpler constraints...");
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      cameraStreamRef.current = stream;
      setIsCameraSharing(true);
      setActiveStageTab('camera');
      setStatusMessage('Vision Stream active. Apex Rig AI is analyzing the scene.');

      // Wait for React to render the video element if it's just been selected
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.onloadedmetadata = () => {
            cameraVideoRef.current?.play().catch(e => console.warn("Camera play error:", e));
          };
          // Force play in case onloadedmetadata already fired or was skipped
          cameraVideoRef.current.play().catch(e => console.warn("Camera manual play error:", e));
        }
      }, 500); // Increased delay for stability

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopCameraShare();
        };
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      // Try fallback to any available camera if preferred mode fails
      if (cameraFacingMode === 'environment') {
        setCameraFacingMode('user');
        setStatusMessage('Rear camera unavailable, trying front camera...');
        // We'll let the next click or a retry logic handle it
      } else {
        setStatusMessage('Camera access restricted or device busy.');
      }
      setIsCameraSharing(false);
    }
  };

  // Stop Camera Share
  const stopCameraShare = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setIsCameraSharing(false);
    if (activeStageTab === 'camera') {
      setActiveStageTab('builder');
    }
  };

  // Toggle Camera Facing Mode (Environment / User)
  const toggleCameraFacing = async () => {
    const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(nextMode);
    if (isCameraSharing) {
      try {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Failed to switch camera mode:', err);
      }
    }
  };

  // Start Native Desktop Screen Capture
  const startDesktopShare = async () => {
    try {
      setHasPermissionsPolicyBlock(false);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });

      desktopStreamRef.current = stream;
      setIsDesktopSharing(true);
      setActiveStageTab('screenshare');
      setStatusMessage('Desktop screensharing active. Apex Rig AI is viewing your screen.');

      if (desktopVideoRef.current) {
        desktopVideoRef.current.srcObject = stream;
        desktopVideoRef.current.play().catch(() => {});
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopDesktopShare();
        };
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setStatusMessage('Desktop screen capture cancelled by user.');
      } else {
        setHasPermissionsPolicyBlock(true);
        setStatusMessage('Screen capture restricted in iframe. Use dedicated tab.');
      }
    }
  };

  // Stop Desktop Share
  const stopDesktopShare = () => {
    if (desktopStreamRef.current) {
      desktopStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      desktopStreamRef.current = null;
    }
    if (desktopVideoRef.current) {
      desktopVideoRef.current.srcObject = null;
    }
    setIsDesktopSharing(false);
    if (activeStageTab === 'screenshare') {
      setActiveStageTab('builder');
    }
  };

  // Open / Close when modal toggles
  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      stopLiveSession();
    }
    return () => {
      stopLiveSession();
    };
  }, [isOpen]);

  // Handle slot product selection
  const handleSelectSlotProduct = (slot: BuildSlotDef, product: Product) => {
    setCurrentBuild((prev) => ({
      ...prev,
      [slot.key]: product,
    }));

    if (product.variants && product.variants.length > 0) {
      setCurrentVariants((prev) => ({
        ...prev,
        [product.id]: product.variants![0].id,
      }));
    }
    setActivePickingSlot(null);
    setPickerSearch('');
  };

  // Handle slot product removal
  const handleRemoveSlotProduct = (slotKey: keyof PCBuildParts) => {
    setCurrentBuild((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  // Preset Loaders
  const loadPreset = (type: 'esports' | '1440p' | '4k') => {
    let budget = 180000;
    if (type === '1440p') budget = 420000;
    if (type === '4k') budget = 750000;

    const result = optimizeBuildForBudget(products, { targetBudget: budget });
    if (result && result.recommendedCategoryParts) {
      const nextBuild: PCBuildParts = {};
      const nextVariants: Record<string, string> = {};
      result.recommendedCategoryParts.forEach((rec) => {
        const found = products.find((p) => p.id === rec.productId || p.name === rec.productName);
        if (found) {
          nextBuild[rec.category as keyof PCBuildParts] = found;
          if (found.variants && found.variants.length > 0) {
            nextVariants[found.id] = found.variants[0].id;
          }
        }
      });
      setCurrentBuild(nextBuild);
      setCurrentVariants(nextVariants);
    }
  };

  const handleBudgetOptimize = (e: React.FormEvent) => {
    e.preventDefault();
    const budgetNum = parseInt(budgetInput.replace(/\D/g, ''), 10);
    if (isNaN(budgetNum) || budgetNum < 50000) return;

    const result = optimizeBuildForBudget(products, { targetBudget: budgetNum });
    if (result && result.recommendedCategoryParts) {
      const nextBuild: PCBuildParts = {};
      const nextVariants: Record<string, string> = {};
      result.recommendedCategoryParts.forEach((rec) => {
        const found = products.find((p) => p.id === rec.productId || p.name === rec.productName);
        if (found) {
          nextBuild[rec.category as keyof PCBuildParts] = found;
          if (found.variants && found.variants.length > 0) {
            nextVariants[found.id] = found.variants[0].id;
          }
        }
      });
      setCurrentBuild(nextBuild);
      setCurrentVariants(nextVariants);
    }
  };

  // Add all build to cart
  const handleAddToCartClick = () => {
    if (onAddBuildToCart) {
      onAddBuildToCart(true);
    }
    setCartSuccessMessage('Custom Rig added to cart successfully!');
    setTimeout(() => setCartSuccessMessage(null), 3500);
  };

  // Helper to extract budget and generate build suggestion if asked
  const getBuildSuggestion = (query: string) => {
    const lower = query.toLowerCase();
    let targetBudget = 0;
    
    // Check for k/lac/lakh suffixes
    if (lower.includes('150k') || lower.includes('1.5 lac') || lower.includes('1.5 lakh') || lower.includes('150000') || lower.includes('150,000')) {
      targetBudget = 150000;
    } else if (lower.includes('200k') || lower.includes('2 lac') || lower.includes('2 lakh') || lower.includes('200000') || lower.includes('200,000')) {
      targetBudget = 200000;
    } else if (lower.includes('250k') || lower.includes('2.5 lac') || lower.includes('250000') || lower.includes('250,000')) {
      targetBudget = 250000;
    } else if (lower.includes('300k') || lower.includes('3 lac') || lower.includes('300000') || lower.includes('300,000')) {
      targetBudget = 300000;
    } else if (lower.includes('350k') || lower.includes('3.5 lac') || lower.includes('350000')) {
      targetBudget = 350000;
    } else if (lower.includes('400k') || lower.includes('4 lac') || lower.includes('400000')) {
      targetBudget = 400000;
    } else if (lower.includes('500k') || lower.includes('5 lac')) {
      targetBudget = 500000;
    } else {
      // Try to match a larger number directly
      const numMatch = lower.match(/(\d+[\d,]*)/);
      if (numMatch) {
        let val = parseInt(numMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(val)) {
          // If it's a small number like 100, 150, 200, it might be in 'k' context
          if (val < 1000 && (lower.includes(val + 'k') || lower.includes(val + ' k'))) {
            val = val * 1000;
          } else if (val < 100 && (lower.includes(val + ' lac') || lower.includes(val + ' lakh'))) {
            val = val * 100000;
          }
          
          if (val >= 40000 && val <= 2500000) {
            targetBudget = val;
          }
        }
      }
    }

    if (targetBudget > 0 || lower.includes('build') || lower.includes('suggest') || lower.includes('pc') || lower.includes('specs') || lower.includes('rig')) {
      const budget = targetBudget || 200000;
      return { suggestion: optimizeBuildForBudget(products, { targetBudget: budget }), budget };
    }
    return null;
  };

  const checkForBuildSuggestion = (query: string) => {
    const result = getBuildSuggestion(query);
    if (result && result.suggestion && result.suggestion.recommendedCategoryParts.length > 0) {
      setTimeout(() => {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `g-sug-${Date.now()}`,
            sender: 'gemini',
            text: `I've generated a performance-optimized PC build for a Rs. ${result.budget.toLocaleString()} PKR budget. You can review the component breakdown below and apply it to your builder with one click!`,
            suggestion: result.suggestion,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 600);
    }
  };

  // Send voice query to Apex Rig AI
  const askApexRigAI = (prompt: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: prompt }));
    setChatHistory((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        sender: 'user',
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    checkForBuildSuggestion(prompt);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !wsRef.current) return;
    const query = textInput.trim();
    wsRef.current.send(JSON.stringify({ text: query }));

    setChatHistory((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}`,
        sender: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    checkForBuildSuggestion(query);
    setTextInput('');
  };

  const handleClearHistory = () => {
    setChatHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Filtered products for active slot picker
  const slotPickerProducts = useMemo(() => {
    if (!activePickingSlot) return [];
    let list = products.filter((p) => {
      if (p.category === activePickingSlot.category) return true;
      if (activePickingSlot.key === 'Casing Fans' && (p.category === 'Casing Fans' || p.category === 'PC Case Fans')) return true;
      return false;
    });

    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand?.toLowerCase().includes(q));
    }
    return list;
  }, [activePickingSlot, products, pickerSearch]);

  const popoutTabUrl = `${window.location.origin}${window.location.pathname}?apex_rig_ai=true&screenshare=true`;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in"
      data-gemini-live-modal="true"
    >
      <div
        className={`relative w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
          isTheaterView
            ? 'w-[98vw] h-[96vh] max-w-none'
            : 'max-w-7xl h-[92vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              {connectionStatus === 'connected' && (
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-900"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight">
                  Apex Rig AI
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : connectionStatus === 'connecting'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {connectionStatus}
                </span>

                {connectionStatus === 'connected' && (
                  activeStageTab === 'builder' ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      Live Builder Synced
                    </span>
                  ) : activeStageTab === 'camera' && isCameraSharing ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                      Live Vision Stream
                    </span>
                  ) : activeStageTab === 'screenshare' && isDesktopSharing ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      Desktop Streaming
                    </span>
                  ) : activeStageTab === 'voice' ? (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Voice Mode
                    </span>
                  ) : null
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{statusMessage}</span>
                {activeStageTab === 'screenshare' && isDesktopSharing && framesStreamedCount > 0 && (
                  <span className="text-indigo-400 font-mono text-[11px]">
                    • {framesStreamedCount} frames sent
                  </span>
                )}
                {activeStageTab === 'camera' && isCameraSharing && framesStreamedCount > 0 && (
                  <span className="text-emerald-400 font-mono text-[11px]">
                    • {framesStreamedCount} vision frames sent
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Mode Tabs & Action Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
              <button
                onClick={() => setActiveStageTab('builder')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeStageTab === 'builder'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Live In-App Builder</span>
              </button>
              <button
                onClick={() => {
                  setActiveStageTab('camera');
                  if (!isCameraSharing) {
                    startCameraShare();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeStageTab === 'camera'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Live Vision</span>
              </button>
              <button
                onClick={() => {
                  if (!isDesktopSharing) startDesktopShare();
                  setActiveStageTab('screenshare');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeStageTab === 'screenshare'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Desktop Share</span>
              </button>
              <button
                onClick={() => setActiveStageTab('voice')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeStageTab === 'voice'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Voice Visualizer</span>
              </button>
            </div>

            {/* Disconnect / Connect quick toggle */}
            {connectionStatus === 'connected' || connectionStatus === 'connecting' ? (
              <button
                onClick={stopLiveSession}
                className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Disconnect from Apex Rig AI session"
              >
                <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            ) : (
              <button
                onClick={startLiveSession}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Connect to Apex Rig AI session"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Connect</span>
              </button>
            )}

            {/* Theater / Fullscreen toggle */}
            <button
              onClick={() => setIsTheaterView(!isTheaterView)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title={isTheaterView ? 'Exit Theater View' : 'Theater View'}
            >
              {isTheaterView ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Retained history toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">History ({chatHistory.length})</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Close modal */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {cartSuccessMessage && (
          <div className="bg-emerald-600/90 text-white px-6 py-2 text-xs font-bold flex items-center justify-between animate-fade-in shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{cartSuccessMessage}</span>
            </div>
            {onOpenCart && (
              <button
                onClick={onOpenCart}
                className="underline hover:text-emerald-200 text-xs font-black cursor-pointer"
              >
                View Cart & Checkout
              </button>
            )}
          </div>
        )}

        {/* Main Content Stage */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* LEFT: Live Interactive Workspace Stage */}
          <div className="flex-1 flex flex-col bg-slate-950 border-r border-slate-800 relative overflow-hidden min-h-0 min-w-0">
            {/* STAGE TAB 1: REAL INTERACTIVE LIVE IN-APP PC BUILDER */}
            {activeStageTab === 'builder' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {/* Top Quick Bar: Telemetry, Presets, Budget Optimizer */}
                <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Presets:</span>
                    <button
                      onClick={() => loadPreset('esports')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      🎮 Esports 1080p (Rs 180k)
                    </button>
                    <button
                      onClick={() => loadPreset('1440p')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      ⚡ 1440p High-FPS (Rs 420k)
                    </button>
                    <button
                      onClick={() => loadPreset('4k')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      🔥 4K Ultra Workstation
                    </button>
                  </div>

                  {/* Budget Auto Optimizer */}
                  <form onSubmit={handleBudgetOptimize} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      placeholder="Budget (e.g. 350000)"
                      className="w-36 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Auto-Build
                    </button>
                  </form>
                </div>

                {/* Compatibility & Hardware Telemetry Bar */}
                <div className="px-5 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Total Price:</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {formatPkr(totalBuildPrice)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-400">Estimated Power:</span>
                      <span className="font-mono font-bold text-white">~{estimatedWattage}W</span>
                      {psuWattage > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPsuAdequate ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {isPsuAdequate ? `${psuWattage}W PSU (Good)` : `${psuWattage}W PSU (Underpowered)`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compatibility Badges */}
                  <div className="flex items-center gap-2">
                    {isSocketCompatible ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                        <Check className="w-3 h-3" /> Socket Match ({cpuSocket || 'Compatible'})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-bold">
                        <AlertTriangle className="w-3 h-3" /> Socket Mismatch ({cpuSocket} vs {moboSocket})
                      </span>
                    )}

                    {isRamCompatible ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold">
                        <Check className="w-3 h-3" /> RAM Match
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[11px] font-bold">
                        <AlertTriangle className="w-3 h-3" /> Check RAM Generation
                      </span>
                    )}
                  </div>
                </div>

                {/* PC Builder Component Slots Grid */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {BUILD_SLOTS.map((slot) => {
                      const part = currentBuild[slot.key];
                      const Icon = slot.icon;
                      const variantId = part ? currentVariants[part.id] : undefined;
                      const activeVariant = part?.variants?.find((v) => v.id === variantId) || part?.variants?.[0];
                      const displayPrice = activeVariant ? activeVariant.price : part ? part.price : 0;

                      return (
                        <div
                          key={slot.key}
                          className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between ${
                            part
                              ? 'bg-slate-900/90 border-indigo-500/30 shadow-lg shadow-indigo-950/20 hover:border-indigo-500/60'
                              : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  part
                                    ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-400'
                                    : 'bg-slate-800 text-slate-500'
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>

                              <div className="text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {slot.title}
                                  </span>
                                  {slot.required && (
                                    <span className="text-[9px] px-1 rounded bg-slate-800 text-indigo-400 font-bold">
                                      Core
                                    </span>
                                  )}
                                </div>

                                {part ? (
                                  <div className="mt-0.5 space-y-1">
                                    <h4 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                                      {part.name}
                                    </h4>

                                    {/* Specs tags */}
                                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                                      {part.brand && (
                                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                                          {part.brand}
                                        </span>
                                      )}
                                      {part.specifications?.socket && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                                          {part.specifications.socket}
                                        </span>
                                      )}
                                      {part.specifications?.ramType && (
                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                                          {part.specifications.ramType}
                                        </span>
                                      )}
                                      {part.specifications?.psuWattage && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                                          {part.specifications.psuWattage}W
                                        </span>
                                      )}
                                    </div>

                                    {/* Variants selector if available */}
                                    {part.variants && part.variants.length > 0 && (
                                      <div className="pt-1 flex items-center gap-1.5">
                                        <span className="text-[10px] text-slate-500">Option:</span>
                                        <select
                                          value={variantId || part.variants[0].id}
                                          onChange={(e) => {
                                            const vId = e.target.value;
                                            setCurrentVariants((prev) => ({
                                              ...prev,
                                              [part.id]: vId,
                                            }));
                                          }}
                                          className="bg-slate-950 border border-slate-700 text-[11px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500"
                                        >
                                          {part.variants.map((v) => (
                                            <option key={v.id} value={v.id}>
                                              {v.name} ({formatPkr(v.price)})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-500 italic mt-1">
                                    No component selected for this slot
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Price / Action */}
                            <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                              {part ? (
                                <>
                                  <div className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono">
                                    {formatPkr(displayPrice)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setActivePickingSlot(slot)}
                                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Change
                                    </button>
                                    <button
                                      onClick={() => handleRemoveSlotProduct(slot.key)}
                                      className="p-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 rounded-lg transition-colors cursor-pointer"
                                      title="Remove from build"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => setActivePickingSlot(slot)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Select Part</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Quick Query Chips */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-bold text-slate-400 block mb-2">
                      💡 Ask Apex Rig AI about this current configuration:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          askApexRigAI(
                            'Please analyze this PC build for bottlenecks, socket compatibility, and 1440p gaming performance.'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Analyze Bottlenecks</span>
                      </button>
                      <button
                        onClick={() =>
                          askApexRigAI(
                            'Is the power supply wattage and cooler sufficient for this CPU and GPU build?'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Check Power & PSU Headroom</span>
                      </button>
                      <button
                        onClick={() =>
                          askApexRigAI(
                            'Suggest any cost-effective upgrades or alternatives to optimize price to performance in PKR.'
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Suggest Cost Optimization</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Workspace Action Dock */}
                <div className="p-4 bg-slate-900/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentBuild({});
                        setCurrentVariants({});
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Build</span>
                    </button>
                    {onOpenQuotation && (
                      <button
                        onClick={onOpenQuotation}
                        disabled={activeParts.length === 0}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Quotation</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Grand Total ({activeParts.length} items):</div>
                      <div className="text-base font-black text-emerald-400 font-mono">
                        {formatPkr(totalBuildPrice)}
                      </div>
                    </div>

                    <button
                      onClick={handleAddToCartClick}
                      disabled={activeParts.length === 0}
                      className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Add Full Rig to Cart</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STAGE TAB: CAMERA SHARE */}
            {activeStageTab === 'camera' && (
              <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden min-h-0 min-w-0">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-slate-950"
                />

                {!isCameraSharing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/90">
                    <Video className="w-12 h-12 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">Share Live Camera with Apex Rig AI</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Point your camera at PC hardware, boxes, ports, cables or components to ask questions directly.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={startCameraShare}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                      >
                        Start Camera Share
                      </button>
                      <button
                        onClick={() => setActiveStageTab('builder')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                      >
                        Back to Live In-App Builder
                      </button>
                    </div>
                  </div>
                )}

                {isCameraSharing && (
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Live Camera Shared to Apex Rig AI ({cameraFacingMode === 'environment' ? 'Rear Camera' : 'Front Camera'})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleCameraFacing}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
                      >
                        Flip Camera
                      </button>
                      <button
                        onClick={stopCameraShare}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                      >
                        Stop Camera
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE TAB 2: DESKTOP SCREEN SHARE */}
            {activeStageTab === 'screenshare' && (
              <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden min-h-0 min-w-0">
                <video
                  ref={desktopVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-slate-950"
                />

                {!isDesktopSharing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950/90">
                    <Tv className="w-12 h-12 text-indigo-400" />
                    <h3 className="text-lg font-bold text-white">Share Your Desktop Screen</h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      Share any game benchmark, 3D benchmark, PC part list, or browser window with Apex Rig AI.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={startDesktopShare}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
                      >
                        Start Desktop Share
                      </button>
                      <button
                        onClick={() => setActiveStageTab('builder')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                      >
                        Back to Live In-App Builder
                      </button>
                    </div>
                  </div>
                )}

                {isDesktopSharing && (
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between p-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Live Desktop Screen Shared to Apex Rig AI (1 FPS)
                    </span>
                    <button
                      onClick={stopDesktopShare}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
                    >
                      Stop Sharing
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STAGE TAB 3: VOICE VISUALIZER */}
            {activeStageTab === 'voice' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-950 to-slate-900 text-center">
                <div
                  className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 ${
                    connectionStatus === 'disconnected'
                      ? 'bg-rose-950/40 border-2 border-rose-500/30 text-rose-400'
                      : isAiSpeaking
                      ? 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-2xl shadow-purple-500/50 ring-8 ring-purple-500/20 scale-110'
                      : isListening && !isMicMuted
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-500/25'
                      : isMicMuted
                      ? 'bg-rose-950/70 border-2 border-rose-500/40 text-rose-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {connectionStatus === 'disconnected' ? (
                    <PhoneOff className="w-12 h-12 text-rose-400" />
                  ) : isAiSpeaking ? (
                    <Volume2 className="w-14 h-14 text-white animate-bounce" />
                  ) : isListening && !isMicMuted ? (
                    <Mic className="w-14 h-14 text-white animate-pulse" />
                  ) : (
                    <MicOff className="w-12 h-12 text-rose-400" />
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mt-5">Apex Rig AI Real-Time Voice Stage</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Speak naturally about any PC part, pricing, or gaming benchmarks in Pakistan.
                </p>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => setActiveStageTab('builder')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                  >
                    Open Live In-App Builder
                  </button>
                  <button
                    onClick={startDesktopShare}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                  >
                    Share Desktop Screen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Live Voice Transcripts & Conversation Channel */}
          <div
            className={`flex flex-col bg-slate-900/95 overflow-hidden transition-all duration-300 ${
              isTheaterView ? 'hidden' : 'w-full md:w-96 border-t md:border-t-0 border-slate-800'
            }`}
          >
            {/* Header of transcripts channel */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/50 shrink-0 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-300">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                Live Voice Stream
              </span>
              {chatHistory.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-slate-500 hover:text-rose-400 flex items-center gap-1 text-[11px] transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex gap-2.5 ${turn.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {turn.sender === 'gemini' && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed space-y-2 ${
                      turn.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 border border-slate-700/80 text-slate-200 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{turn.text}</p>

                    {/* Structured Component Suggestion Table */}
                    {turn.suggestion && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-slate-700/60">
                        <div className="flex items-center justify-between text-[11px] font-bold text-amber-400">
                          <span>{turn.suggestion.summary}</span>
                          <span className="font-mono text-emerald-400">
                            {formatPkr(turn.suggestion.estimatedTotalPkr)}
                          </span>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/80">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                                <th className="p-1.5">Component</th>
                                <th className="p-1.5">Part Name</th>
                                <th className="p-1.5 text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                              {turn.suggestion.recommendedCategoryParts.map((part) => (
                                <tr key={part.category} className="hover:bg-slate-800/40">
                                  <td className="p-1.5 text-indigo-300 font-medium whitespace-nowrap">
                                    {part.category}
                                  </td>
                                  <td className="p-1.5 text-slate-200 font-medium truncate max-w-[140px]" title={part.productName}>
                                    {part.productName}
                                  </td>
                                  <td className="p-1.5 text-emerald-400 font-mono text-right whitespace-nowrap">
                                    {formatPkr(part.price)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Fill in Parts Button */}
                        <button
                          onClick={() => {
                            if (turn.suggestion?.recommendedCategoryParts) {
                              const nextBuild: PCBuildParts = {};
                              const nextVariants: Record<string, string> = {};
                              turn.suggestion.recommendedCategoryParts.forEach((rec) => {
                                const found = products.find(
                                  (p) => p.id === rec.productId || p.name === rec.productName
                                );
                                if (found) {
                                  // Correctly map category names to PCBuildParts keys
                                  const categoryKey = found.category as keyof PCBuildParts;
                                  nextBuild[categoryKey] = found;
                                  if (found.variants && found.variants.length > 0) {
                                    // If a specific variant price was suggested, try to match it
                                    const bestVariant = found.variants.find(v => v.price === rec.price) || found.variants[0];
                                    nextVariants[found.id] = bestVariant.id;
                                  }
                                }
                              });
                              
                              if (Object.keys(nextBuild).length > 0) {
                                setCurrentBuild(nextBuild);
                                setCurrentVariants(nextVariants);
                                setActiveStageTab('builder');
                                setCartSuccessMessage('Hardware configuration applied to In-App Builder!');
                                setTimeout(() => setCartSuccessMessage(null), 4000);
                              }
                            }
                          }}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer ring-1 ring-emerald-400/30"
                        >
                          <Wrench className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Apply in Live Builder</span>
                        </button>
                      </div>
                    )}

                    <span className="text-[10px] opacity-60 block text-right">{turn.timestamp}</span>
                  </div>
                </div>
              ))}

              {/* In-progress Real-time Live Transcriptions */}
              {(liveUserText || liveModelText) && (
                <div className="space-y-2 pt-1">
                  {liveUserText && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-none bg-indigo-600/50 border border-indigo-400/40 p-2.5 text-xs text-white italic animate-pulse">
                        <span>You: &quot;{liveUserText}&quot;</span>
                      </div>
                    </div>
                  )}
                  {liveModelText && (
                    <div className="flex justify-start gap-2">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                      </div>
                      <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-slate-800/90 border border-purple-500/30 p-2.5 text-xs text-slate-200">
                        <p>{liveModelText}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={historyEndRef} />
            </div>

            {/* Quick Text Input for quiet typing */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
              <form onSubmit={handleSendText} className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ask Apex Rig AI or type hardware query..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || connectionStatus !== 'connected'}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Global Bottom Mic & Control Dock */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mic Toggle Button */}
            <button
              onClick={toggleMic}
              disabled={connectionStatus === 'disconnected'}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs transition-all shadow-md ${
                connectionStatus === 'disconnected'
                  ? 'bg-slate-800/80 text-slate-500 border border-slate-700/50 opacity-60 cursor-not-allowed'
                  : isMicMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 ring-1 ring-rose-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
              }`}
            >
              {isMicMuted || connectionStatus === 'disconnected' ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4 text-white" />}
              <span>{connectionStatus === 'disconnected' ? 'Mic (Offline)' : isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            {/* Switch Stage View Tabs (Mobile/Tablet visible) */}
            <button
              onClick={() => setActiveStageTab(activeStageTab === 'builder' ? 'screenshare' : 'builder')}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{activeStageTab === 'builder' ? 'Screenshare' : 'In-App Builder'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="hidden sm:inline">Pakistan PKR Real-time Inventory</span>
            <span>•</span>
            <span className="text-indigo-400 font-semibold">Apex Rig AI Live Ready</span>
          </div>
        </div>
      </div>

      {/* COMPONENT PICKER MODAL (WHEN USER CLICKS TO ADD / CHANGE PART) */}
      {activePickingSlot && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <activePickingSlot.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Select {activePickingSlot.title}</h3>
                  <p className="text-[11px] text-slate-400">Choose from in-stock genuine components</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActivePickingSlot(null);
                  setPickerSearch('');
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="py-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder={`Search ${activePickingSlot.category} by brand, model, specs...`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {slotPickerProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No components found matching &ldquo;{pickerSearch}&rdquo; in {activePickingSlot.category}.
                </div>
              ) : (
                slotPickerProducts.map((prod) => {
                  const isCurrent = currentBuild[activePickingSlot.key]?.id === prod.id;
                  return (
                    <div
                      key={prod.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        isCurrent
                          ? 'bg-indigo-950/40 border-indigo-500 text-white'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={prod.image}
                          alt={prod.name}
                          className="w-12 h-12 rounded-xl object-cover bg-slate-900 shrink-0 border border-slate-800"
                        />
                        <div className="text-left">
                          <h4 className="text-xs font-bold text-white line-clamp-1">{prod.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                            {prod.brand && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                                {prod.brand}
                              </span>
                            )}
                            {prod.specifications?.socket && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                                {prod.specifications.socket}
                              </span>
                            )}
                            {prod.specifications?.ramType && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                                {prod.specifications.ramType}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold ${
                                (prod.stockCount ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {(prod.stockCount ?? 0) > 0 ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-black text-emerald-400 font-mono">
                          {formatPkr(prod.price)}
                        </span>
                        <button
                          onClick={() => handleSelectSlotProduct(activePickingSlot, prod)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20"
                        >
                          {isCurrent ? 'Selected' : 'Choose'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
