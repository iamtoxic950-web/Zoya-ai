import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playPanelMaterializeSound } from '../../utils/sfx';

interface Props {
  onComplete: () => void;
}

const INIT_MODULES = [
  { id: 'SYS.TIME', label: 'TEMPORAL CHRONOMETER', desc: 'Syncing UTC time-matrix' },
  { id: 'SYS.NET', label: 'QUANTUM DATA LINK', desc: 'Encrypted socket open' },
  { id: 'SYS.DEVICE', label: 'HARDWARE TELEMETRY', desc: 'Processor bridges active' },
  { id: 'SYS.PERF', label: 'MEMORY ALLOCATION', desc: 'Dynamic heap initialized' },
  { id: 'SYS.NOTIF', label: 'EVENT DISPATCHER', desc: 'Signal protocols verified' },
  { id: 'SYS.VOICE', label: 'NEURAL AUDIO ENGINE', desc: 'Spectral VAD online' },
  { id: 'SYS.CORE', label: 'ZOYA AI KERNEL', desc: 'Core consciousness online' },
];

export function HolographicInitialization({ onComplete }: Props) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < INIT_MODULES.length) {
        const mod = INIT_MODULES[current];
        setActiveStep(current);
        setCompletedSteps(prev => [...prev, mod.id]);
        
        try {
          playPanelMaterializeSound();
        } catch (e) {
          // ignore
        }
        
        current++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          onComplete();
        }, 800);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-6 sm:p-10 font-mono select-none">
      {/* Top HUD progress */}
      <div className="flex justify-between items-center w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-cyan-400 text-xs tracking-[0.3em] uppercase">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>HOLOGRAPHIC INITIALIZATION IN PROGRESS</span>
        </div>
        <div className="text-amber-300 text-xs tracking-widest">
          {Math.round((completedSteps.length / INIT_MODULES.length) * 100)}%
        </div>
      </div>

      {/* Center Materializing Telemetry Cards */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-4xl">
          {INIT_MODULES.map((item, idx) => {
            const isUnlocked = completedSteps.includes(item.id);
            const isCurrent = activeStep === idx;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.85, y: 15 }}
                animate={{
                  opacity: isUnlocked ? 1 : 0.15,
                  scale: isUnlocked ? 1 : 0.85,
                  y: isUnlocked ? 0 : 15,
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={`relative p-3.5 rounded border transition-all duration-300 ${
                  isCurrent 
                    ? 'border-amber-300 bg-amber-950/30 shadow-[0_0_15px_rgba(255,200,60,0.3)]' 
                    : isUnlocked
                    ? 'border-cyan-400/40 bg-cyan-950/20 shadow-[0_0_10px_rgba(0,229,255,0.1)]'
                    : 'border-cyan-900/30 bg-black/40'
                }`}
              >
                {/* Corner bracket accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400" />

                {/* Scanline line */}
                {isCurrent && (
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[2px] bg-amber-300"
                    animate={{ y: [0, 60] }}
                    transition={{ duration: 0.45, repeat: Infinity, ease: "linear" }}
                  />
                )}

                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-cyan-300 tracking-wider">
                    {item.id}
                  </span>
                  <span className={`text-[8px] tracking-widest uppercase ${isUnlocked ? 'text-amber-300 font-bold' : 'text-cyan-800'}`}>
                    {isUnlocked ? 'ONLINE' : 'STANDBY'}
                  </span>
                </div>
                <div className="text-[9px] text-cyan-200/90 tracking-wide font-sans truncate">
                  {item.label}
                </div>
                <div className="text-[7.5px] text-cyan-500/70 tracking-widest mt-1 uppercase truncate">
                  {item.desc}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Loading Bar */}
      <div className="w-full max-w-5xl mx-auto flex flex-col gap-1.5">
        <div className="flex justify-between text-[8px] text-cyan-500 tracking-[0.25em]">
          <span>CALIBRATING OPTICAL SUBSYSTEMS</span>
          <span>ESTABLISHING NEURAL INTERFACE</span>
        </div>
        <div className="w-full h-1 bg-cyan-950 border border-cyan-800/50 rounded overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-400 via-amber-300 to-cyan-300"
            initial={{ width: '0%' }}
            animate={{ width: `${(completedSteps.length / INIT_MODULES.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}
