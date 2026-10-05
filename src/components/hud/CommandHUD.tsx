import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HudMessage } from '../../hooks/useVoiceAssistant';

interface CommandHUDProps {
  messages: HudMessage[];
  pipelineStage: number;
}

export function CommandHUD({ messages, pipelineStage }: CommandHUDProps) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-sm pointer-events-auto">
      <AnimatePresence>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -20, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative p-3.5 rounded border border-amber-400/40 bg-[#000d14]/85 backdrop-blur-md shadow-[0_0_15px_rgba(255,179,0,0.15)] font-mono text-cyan-200"
          >
            {/* Corner Brackets */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-amber-400" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-amber-400" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-amber-400" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-amber-400" />

            {/* Scanlines */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-10 rounded" 
              style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #ffb300 2px, #ffb300 4px)' }} 
            />

            {/* Header / Title */}
            <div className="flex items-center justify-between border-b border-amber-500/25 pb-1.5 mb-2">
              <span className="text-[10px] font-bold tracking-[0.25em] text-amber-300 uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                {msg.title}
              </span>
              <span className="text-[8px] text-cyan-400/70 tracking-widest uppercase">
                SEQ // EXEC
              </span>
            </div>

            {/* Content */}
            <div className="text-xs sm:text-sm font-mono tracking-wide text-slate-100 leading-relaxed">
              {msg.content}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
