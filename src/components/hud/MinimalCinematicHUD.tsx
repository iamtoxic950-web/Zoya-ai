import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Bell } from 'lucide-react';
import { AssistantState, ReminderItem } from '../../types';
import { VoiceVisualizer } from '../VoiceVisualizer';
import { SpeechSubtitleHUD } from './SpeechSubtitleHUD';
import { HudMessage } from '../../hooks/useVoiceAssistant';

interface MinimalCinematicHUDProps {
  state: AssistantState;
  logs?: string[];
  pipelineStage?: number;
  analyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  isConnected: boolean;
  isMicActive?: boolean;
  micWarning?: string | null;
  liveTranscript?: string;
  isTranscriptFinal?: boolean;
  requestMicAccess?: () => Promise<boolean>;
  sendTextPrompt?: (text: string) => void;
  hudMessages: HudMessage[];
  toggleConnection: () => void;
  onOpenMenu?: () => void;
  dueReminder?: ReminderItem | null;
  onDismissDueReminder?: () => void;
  onOpenReminders?: () => void;
}

export function MinimalCinematicHUD({
  state,
  analyser,
  outputAnalyser,
  isConnected,
  isMicActive,
  requestMicAccess,
  liveTranscript = '',
  hudMessages,
  toggleConnection,
  onOpenMenu,
  dueReminder,
  onDismissDueReminder,
  onOpenReminders
}: MinimalCinematicHUDProps) {
  const isWorking = state !== 'DISCONNECTED' && state !== 'ERROR';

  const handlePrimaryStatusClick = () => {
    if (isConnected && !isMicActive && requestMicAccess) {
      requestMicAccess();
    } else {
      toggleConnection();
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 font-mono text-cyan-300 select-none flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
      
      {/* ================= TOP BAR (MINIMALIST BRANDING, STATUS & MENU BUTTON) ================= */}
      <div className="w-full flex items-center justify-between z-50">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <span className="text-lg sm:text-xl font-bold tracking-[0.3em] text-cyan-100 drop-shadow-[0_0_15px_rgba(0,229,255,0.7)] flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isWorking ? 'bg-cyan-400 shadow-[0_0_10px_#00e5ff] animate-pulse' : 'bg-cyan-700'}`} />
            ZOYA
          </span>
          <button
            type="button"
            onClick={handlePrimaryStatusClick}
            className="text-[8px] px-2.5 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 tracking-widest bg-cyan-950/20 backdrop-blur-md uppercase cursor-pointer hover:border-cyan-400/60 hover:text-cyan-200 transition-colors"
          >
            {state === 'DISCONNECTED' ? 'OFFLINE' : state === 'CONNECTING' ? 'SYNCING...' : state}
          </button>
        </div>

        {/* Clean Menu Button */}
        {onOpenMenu && (
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={onOpenMenu}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-[#00101f]/75 hover:bg-cyan-950/60 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-all backdrop-blur-md cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.12)]"
              title="Open Zoya Menu"
            >
              <Menu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">MENU</span>
            </button>
          </div>
        )}
      </div>

      {/* ================= DUE REMINDER NOTIFICATION BANNER ================= */}
      <AnimatePresence>
        {dueReminder && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#001428]/95 border border-cyan-400/60 text-cyan-100 flex items-center gap-3 shadow-[0_0_30px_rgba(0,229,255,0.3)] backdrop-blur-xl pointer-events-auto max-w-[90vw]"
          >
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Bell className="w-3.5 h-3.5 text-cyan-300 animate-bounce" />
            </div>

            <div className="text-left font-sans">
              <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold">
                Reminder Alert
              </div>
              <div className="text-xs font-semibold text-cyan-100 truncate max-w-xs">
                {dueReminder.title}
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-2 font-mono">
              {onOpenReminders && (
                <button
                  onClick={onOpenReminders}
                  className="px-2.5 py-1 text-[9px] uppercase tracking-wider bg-cyan-950/80 border border-cyan-400/50 hover:bg-cyan-900 rounded-lg text-cyan-200 cursor-pointer"
                >
                  View
                </button>
              )}
              {onDismissDueReminder && (
                <button
                  onClick={onDismissDueReminder}
                  className="px-2 py-1 text-[9px] uppercase tracking-wider text-cyan-500 hover:text-cyan-200 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CLEAN TOAST NOTIFICATIONS (NON-INTRUSIVE) ================= */}
      <div className="w-full flex justify-center pointer-events-none z-40 my-auto">
        <AnimatePresence>
          {hudMessages.slice(-1).map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="px-3.5 py-1.5 rounded-full bg-[#00101d]/90 border border-cyan-400/50 text-[10px] text-cyan-200 flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.25)] backdrop-blur-md pointer-events-auto"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-cyan-300 tracking-wider uppercase text-[8.5px]">{msg.title}:</span>
              <span className="text-cyan-100">{msg.content}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ================= BOTTOM VOICE-FIRST STATUS & WAVEFORM ================= */}
      <div className="w-full flex flex-col items-center gap-2 pointer-events-none z-50 max-w-md mx-auto pb-1 sm:pb-2">
        
        {/* Real-time Live Speech Subtitle */}
        {liveTranscript ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-1.5 rounded-full bg-[#00101d]/85 border border-cyan-400/40 text-[11px] text-cyan-100 flex items-center gap-2 shadow-[0_0_12px_rgba(0,229,255,0.15)] backdrop-blur-md max-w-full"
          >
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 uppercase tracking-widest">
              VOICE
            </span>
            <span className="truncate italic">"{liveTranscript}"</span>
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          </motion.div>
        ) : (
          <SpeechSubtitleHUD state={state} />
        )}

        {/* Minimal Audio Waveform */}
        {isConnected && (
          <div className="w-36 h-3 flex items-center justify-center opacity-75">
            <VoiceVisualizer 
              analyser={analyser} 
              outputAnalyser={outputAnalyser} 
              isActive={isConnected} 
              state={state} 
            />
          </div>
        )}
      </div>

    </div>
  );
}
