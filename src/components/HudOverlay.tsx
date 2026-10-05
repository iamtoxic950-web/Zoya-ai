import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface HudMessage {
  id: string;
  title: string;
  content: React.ReactNode;
  duration?: number; // how long it stays visible
}

export function HudOverlay({ messages }: { messages: HudMessage[] }) {
  return (
    <div className="flex flex-col justify-center items-end gap-6 w-full max-w-[300px]">
      <AnimatePresence>
        {messages.map((msg, index) => {
          // Keep max 3 visible, but we handle that in the hook.
          // Or we slice here:
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: 20, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, y: -20, scale: 1.05 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative w-full"
              style={{ background: 'transparent' }}
            >
              {/* Scanlines */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-20" 
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 179, 0, 0.3) 2px, rgba(255, 179, 0, 0.3) 4px)'
                }}
              />
              
              <h3 className="text-amber-400 text-xs font-mono tracking-[0.2em] uppercase mb-2 border-b border-amber-500/30 pb-1 font-bold shadow-amber">
                {msg.title}
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-400"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-400"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-400"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400"></div>
              </h3>
              <div className="text-slate-100 font-mono text-sm tracking-wide">
                {msg.content}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
