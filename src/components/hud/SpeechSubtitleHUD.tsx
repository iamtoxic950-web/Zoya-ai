import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantState } from '../../types';

interface SpeechSubtitleHUDProps {
  state: AssistantState;
}

function getSubtitleForState(state: AssistantState): string | null {
  switch (state) {
    case 'LISTENING':
      return 'LISTENING // AWAITING AUDIO STREAM...';
    case 'THINKING':
      return 'NEURAL PROCESSING // ANALYZING INTENT...';
    case 'SPEAKING':
      return 'ZOYA VOCAL MATRIX ACTIVE';
    case 'INTERRUPTED':
      return 'VOICE INTERRUPTED // LISTENING FOR NEW INPUT...';
    case 'IDLE':
      return 'READY // AWAITING VOICE INPUT...';
    case 'CONNECTING':
      return null;
    case 'ERROR':
      return 'DIAGNOSTIC ALERT // CONNECTION INTERRUPTED';
    case 'DISCONNECTED':
    default:
      return 'STANDBY // TAP TO COMMENCE VOICE SESSION';
  }
}

export function SpeechSubtitleHUD({ state }: SpeechSubtitleHUDProps) {
  const subtitle = getSubtitleForState(state);

  return (
    <div className="flex flex-col items-center pointer-events-none font-mono">
      <AnimatePresence mode="wait">
        {subtitle && (
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: 0.3 }}
            className="relative px-4 py-1.5 rounded-full border border-cyan-400/30 bg-[#001018]/70 backdrop-blur-sm flex items-center gap-2.5 shadow-[0_0_15px_rgba(0,229,255,0.15)]"
          >
            {/* Status Indicator Pip */}
            <span
              className={`w-2 h-2 rounded-full ${
                state === 'SPEAKING'
                  ? 'bg-white animate-ping shadow-[0_0_8px_#ffffff]'
                  : state === 'LISTENING'
                  ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#ffd54f]'
                  : state === 'THINKING'
                  ? 'bg-purple-400 animate-bounce shadow-[0_0_8px_#c084fc]'
                  : state === 'ERROR'
                  ? 'bg-red-500 animate-ping'
                  : 'bg-cyan-700'
              }`}
            />

            <span className="text-[9px] sm:text-[11px] font-bold tracking-[0.25em] text-cyan-200 uppercase whitespace-nowrap">
              {subtitle}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
