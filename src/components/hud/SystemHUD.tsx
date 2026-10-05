import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantState } from '../../types';
import { VoiceVisualizer } from '../VoiceVisualizer';
import { CommandHUD } from './CommandHUD';
import { SpeechSubtitleHUD } from './SpeechSubtitleHUD';
import { HudMessage } from '../../hooks/useVoiceAssistant';

interface SystemHUDProps {
  state: AssistantState;
  logs: string[];
  pipelineStage: number;
  analyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  isConnected: boolean;
  isMicActive?: boolean;
  micWarning?: string | null;
  requestMicAccess?: () => Promise<boolean>;
  sendTextPrompt?: (text: string) => void;
  hudMessages: HudMessage[];
  toggleConnection: () => void;
}

export function SystemHUD({
  state,
  logs,
  pipelineStage,
  analyser,
  outputAnalyser,
  isConnected,
  isMicActive = false,
  micWarning = null,
  requestMicAccess,
  sendTextPrompt,
  hudMessages,
  toggleConnection
}: SystemHUDProps) {
  const [time, setTime] = useState(new Date());
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [network, setNetwork] = useState({ online: navigator.onLine, type: 'SECURE' });
  const [memory, setMemory] = useState<{ used: number; total: number } | null>(null);
  const [promptText, setPromptText] = useState('');
  const [isRequestingMic, setIsRequestingMic] = useState(false);

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Network updater
  useEffect(() => {
    const updateNet = () => {
      const conn = (navigator as any).connection;
      setNetwork({
        online: navigator.onLine,
        type: conn ? `${conn.effectiveType?.toUpperCase() || 'NET'} (${conn.downlink || 10}Mb/s)` : 'ONLINE'
      });
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
    return () => {
      window.removeEventListener('online', updateNet);
      window.removeEventListener('offline', updateNet);
    };
  }, []);

  // Battery updater
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        setBattery({ level: Math.round(batt.level * 100), charging: batt.charging });
        batt.addEventListener('levelchange', () => setBattery({ level: Math.round(batt.level * 100), charging: batt.charging }));
        batt.addEventListener('chargingchange', () => setBattery({ level: Math.round(batt.level * 100), charging: batt.charging }));
      }).catch(() => {});
    }
  }, []);

  // Memory updater
  useEffect(() => {
    const updateMem = () => {
      const mem = (performance as any).memory;
      if (mem) {
        setMemory({
          used: Math.round(mem.usedJSHeapSize / (1024 * 1024)),
          total: Math.round(mem.jsHeapSizeLimit / (1024 * 1024))
        });
      }
    };
    const interval = setInterval(updateMem, 3000);
    updateMem();
    return () => clearInterval(interval);
  }, []);

  const handleMicClick = async () => {
    if (requestMicAccess && !isRequestingMic) {
      setIsRequestingMic(true);
      await requestMicAccess();
      setIsRequestingMic(false);
    }
  };

  const handleSendPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptText.trim() || !sendTextPrompt) return;
    sendTextPrompt(promptText.trim());
    setPromptText('');
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 font-mono text-cyan-400 select-none flex flex-col justify-between p-3 sm:p-6 overflow-hidden">
      
      {/* ================= TOP BAR (IDENTITY & CHRONOMETER) ================= */}
      <div className="w-full flex items-start justify-between z-50">
        {/* Left identity logo */}
        <div className="flex flex-col pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-[0.4em] text-cyan-300 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]">
              ZOYA
            </span>
            <span className="text-[8px] px-1.5 py-0.5 rounded border border-cyan-500/40 text-cyan-300 tracking-widest bg-cyan-950/40">
              AI v4.8
            </span>
          </div>
          <span className="text-[7.5px] tracking-[0.3em] text-cyan-500/80 uppercase mt-0.5">
            PERSONAL ARTIFICIAL INTELLIGENCE
          </span>
        </div>

        {/* Center Live Clock */}
        <div className="hidden sm:flex flex-col items-center pointer-events-auto">
          <div className="px-4 py-1.5 rounded border border-cyan-500/30 bg-[#001018]/60 backdrop-blur-md flex flex-col items-center">
            <div className="text-sm sm:text-lg font-bold tracking-[0.2em] text-cyan-200">
              {time.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div className="text-[8px] tracking-[0.25em] text-cyan-600 uppercase">
              {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Right Status Badge & Connect Toggle */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Mic Quick Action */}
          {isConnected && (
            <button
              onClick={handleMicClick}
              title={isMicActive ? "Microphone Active" : "Click to Grant / Enable Microphone"}
              className={`px-2.5 py-1.5 rounded border text-[8.5px] font-mono tracking-widest uppercase transition-all duration-300 cursor-pointer backdrop-blur-md flex items-center gap-1.5 ${
                isMicActive
                  ? 'border-cyan-400/50 bg-cyan-950/40 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                  : 'border-amber-500/80 bg-amber-950/50 text-amber-300 hover:border-amber-300 shadow-[0_0_12px_rgba(255,179,0,0.3)] animate-pulse'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isMicActive ? 'bg-cyan-400' : 'bg-amber-400'}`} />
              <span>{isRequestingMic ? 'PROMPTING...' : isMicActive ? 'MIC ON' : 'ALLOW MIC'}</span>
            </button>
          )}

          <button
            onClick={toggleConnection}
            className={`px-3 py-1.5 rounded border text-[9px] font-mono tracking-[0.25em] uppercase transition-all duration-300 cursor-pointer backdrop-blur-md flex items-center gap-2 ${
              state !== 'DISCONNECTED' && state !== 'ERROR'
                ? 'border-amber-400 bg-amber-950/40 text-amber-200 shadow-[0_0_15px_rgba(255,179,0,0.3)] hover:border-red-400'
                : 'border-cyan-400/50 bg-cyan-950/30 text-cyan-300 hover:border-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
            }`}
          >
            <span 
              className={`w-1.5 h-1.5 rounded-full ${
                state !== 'DISCONNECTED' && state !== 'ERROR' ? 'bg-amber-400 animate-ping' : 'bg-cyan-400'
              }`} 
            />
            <span>{state === 'DISCONNECTED' ? 'CONNECT' : state === 'CONNECTING' ? 'SYNCING...' : 'DISCONNECT'}</span>
          </button>
        </div>
      </div>

      {/* ================= MICROPHONE WARNING BANNER (IF DENIED/BLOCKED) ================= */}
      {micWarning && isConnected && !isMicActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xl mx-auto z-50 pointer-events-auto mt-2 px-3 py-2 rounded border border-amber-500/60 bg-[#001018]/90 backdrop-blur-md text-amber-200 flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(255,179,0,0.2)] text-[9px] sm:text-[10px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold">INFO:</span>
            <span>Microphone is in standby. Click &quot;Allow Mic&quot; to speak, or use the Command Console below.</span>
          </div>
          <button
            onClick={handleMicClick}
            className="px-2.5 py-1 rounded border border-amber-400 bg-amber-900/40 text-amber-100 font-bold uppercase tracking-wider hover:bg-amber-800/60 transition-colors whitespace-nowrap cursor-pointer"
          >
            Enable Mic
          </button>
        </motion.div>
      )}

      {/* ================= MIDDLE SECTION (LEFT / RIGHT FLOATING PANELS) ================= */}
      <div className="w-full flex-1 flex justify-between items-center my-2 sm:my-4 relative">
        
        {/* LEFT COLUMN PANELS */}
        <div className="flex flex-col gap-3 w-[150px] sm:w-[240px] pointer-events-auto z-40">
          
          {/* SYS.NET Panel */}
          <HudPanel title="SYS.NET">
            <div className="flex flex-col gap-1 text-[8px] sm:text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">STATUS</span>
                <span className={`font-bold ${network.online ? 'text-cyan-300' : 'text-red-400'}`}>
                  {network.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">PROTOCOL</span>
                <span className="text-cyan-400 truncate max-w-[120px]">{network.type}</span>
              </div>
            </div>
          </HudPanel>

          {/* SYS.VOICE Panel & Visualizer */}
          <HudPanel title="SYS.VOICE">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[8px] sm:text-[9px]">
                <span className="text-cyan-600">AUDIO MATRIX</span>
                <span className="text-amber-300 font-bold tracking-wider">{state}</span>
              </div>
              <div className="flex justify-between items-center text-[7.5px] text-cyan-500">
                <span>INPUT: {isMicActive ? 'MIC STREAM' : 'MANUAL / STANDBY'}</span>
                {!isMicActive && isConnected && (
                  <button onClick={handleMicClick} className="text-amber-300 hover:underline cursor-pointer">
                    [ENABLE]
                  </button>
                )}
              </div>
              <div className="w-full h-8 flex items-center justify-center">
                <VoiceVisualizer analyser={analyser} outputAnalyser={outputAnalyser} isActive={isConnected} state={state} />
              </div>
            </div>
          </HudPanel>

          {/* Holographic Command Message Stream */}
          {hudMessages.length > 0 && (
            <div className="mt-2">
              <CommandHUD messages={hudMessages} pipelineStage={pipelineStage} />
            </div>
          )}
        </div>

        {/* RIGHT COLUMN PANELS */}
        <div className="flex flex-col gap-3 w-[150px] sm:w-[240px] pointer-events-auto z-40">
          
          {/* SYS.DEVICE Panel */}
          <HudPanel title="SYS.DEVICE">
            <div className="flex flex-col gap-1 text-[8px] sm:text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">PLATFORM</span>
                <span className="text-cyan-300 truncate max-w-[110px]">{navigator.platform || 'WEB/ANDROID'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">BATTERY</span>
                <span className="text-cyan-300">
                  {battery ? `${battery.level}% ${battery.charging ? '[CHG]' : ''}` : 'AC POWER'}
                </span>
              </div>
            </div>
          </HudPanel>

          {/* SYS.PERF Panel */}
          <HudPanel title="SYS.PERF">
            <div className="flex flex-col gap-1 text-[8px] sm:text-[10px]">
              <div className="flex justify-between items-center">
                <span className="text-cyan-600">HEAP USAGE</span>
                <span className="text-cyan-300">
                  {memory ? `${memory.used}MB / ${memory.total}MB` : 'DYNAMIC HEAP'}
                </span>
              </div>
              {memory && (
                <div className="w-full h-1 bg-cyan-950 rounded overflow-hidden border border-cyan-800/40 mt-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 to-amber-300"
                    style={{ width: `${Math.min(100, (memory.used / memory.total) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </HudPanel>

          {/* SYS.FEED Logs */}
          <HudPanel title="SYS.FEED">
            <div className="h-[60px] sm:h-[80px] flex flex-col justify-end overflow-hidden text-[7px] sm:text-[8.5px] leading-tight text-cyan-300/80">
              {logs.slice(-3).map((log, i) => (
                <div key={i} className="truncate tracking-wide flex gap-1 items-center">
                  <span className="text-cyan-700">›</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </HudPanel>
        </div>
      </div>

      {/* ================= BOTTOM BAR (SUBTITLE & QUICK COMMAND INPUT) ================= */}
      <div className="w-full flex flex-col items-center gap-2 pointer-events-auto z-50 max-w-2xl mx-auto">
        <SpeechSubtitleHUD state={state} />

        {/* Cyberpunk Text Input & Quick Chips */}
        {isConnected && sendTextPrompt && (
          <div className="w-full flex flex-col gap-1.5 px-2">
            {/* Quick Action Chips */}
            <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
              {[
                "Who are you?",
                "System status check",
                "Open YouTube",
                "Remember: my name is Commander"
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => sendTextPrompt(chip)}
                  className="text-[8px] px-2 py-0.5 rounded border border-cyan-800/60 bg-cyan-950/40 hover:border-cyan-400/80 hover:bg-cyan-900/50 text-cyan-300/80 hover:text-cyan-100 whitespace-nowrap transition-colors cursor-pointer"
                >
                  › {chip}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendPrompt} className="relative w-full flex items-center">
              <input
                type="text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="TYPE OR SPEAK COMMAND TO ZOYA..."
                className="w-full bg-[#000f18]/80 border border-cyan-500/40 rounded px-3 py-1.5 text-[10px] sm:text-[11px] text-cyan-200 placeholder:text-cyan-700 font-mono tracking-wider focus:outline-none focus:border-amber-400 focus:shadow-[0_0_12px_rgba(255,179,0,0.25)]"
              />
              <button
                type="submit"
                disabled={!promptText.trim()}
                className="absolute right-1 px-3 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-700 border border-cyan-400/40 text-[9px] text-cyan-200 uppercase tracking-widest disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              >
                EXECUTE
              </button>
            </form>
          </div>
        )}

        <div className="flex items-center gap-4 text-[7.5px] sm:text-[8px] text-cyan-600 tracking-[0.3em] uppercase">
          <span>SECURE PROTOCOL // 256-BIT</span>
          <span className="w-1 h-1 rounded-full bg-cyan-600" />
          <span>NEURAL SYNAPSE ACTIVE</span>
        </div>
      </div>

    </div>
  );
}

function HudPanel({
  title,
  children,
  defaultOpen = true
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  return (
    <div className="relative p-2.5 sm:p-3.5 rounded border border-cyan-500/25 bg-[#000e17]/75 backdrop-blur-md shadow-[0_0_12px_rgba(0,229,255,0.08)]">
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-400/80" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-cyan-400/80" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-cyan-400/80" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400/80" />

      {/* Scanline line */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00e5ff 2px, #00e5ff 4px)' }} 
      />

      {/* Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer pb-1.5 mb-1.5 border-b border-cyan-500/20"
      >
        <span className="text-[8px] sm:text-[9.5px] font-bold tracking-[0.25em] text-cyan-300">
          {title}
        </span>
        <span className="text-[8px] text-cyan-600 hover:text-cyan-300 transition-colors">
          {isOpen ? '[-]' : '[+]'}
        </span>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
