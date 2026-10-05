import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StartupCore } from './StartupCore';
import { playStartupActivationSound } from '../../utils/sfx';

interface StartupScreenProps {
  onActivated: () => void;
}

export function StartupScreen({ onActivated }: StartupScreenProps) {
  const [step, setStep] = useState<number>(0);
  const [displayText, setDisplayText] = useState<string>('');
  const [subText, setSubText] = useState<string>('');
  const [readyForTap, setReadyForTap] = useState<boolean>(false);
  const [isActivating, setIsActivating] = useState<boolean>(false);

  // Background ambient floating dust particles
  const backgroundParticles = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.8,
      duration: Math.random() * 10 + 8,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.5 + 0.2,
    }));
  }, []);

  // Text Reveal Sequence
  useEffect(() => {
    // Stage 1: Initializing
    const t1 = setTimeout(() => {
      setStep(1);
      typeText('INITIALIZING...', setDisplayText);
    }, 400);

    // Stage 2: Neural Core Online
    const t2 = setTimeout(() => {
      setStep(2);
      typeText('NEURAL CORE ONLINE', setDisplayText);
      setSubText('SYS.VERSION 4.8 // PROTOCOL ACTIVE');
    }, 1800);

    // Stage 3: Zoya System Boot
    const t3 = setTimeout(() => {
      setStep(3);
      typeText('ZOYA', setDisplayText);
      setSubText('PERSONAL ARTIFICIAL INTELLIGENCE');
      setReadyForTap(true);
    }, 3200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Simple typing character-reveal helper
  function typeText(target: string, setter: React.Dispatch<React.SetStateAction<string>>) {
    let current = '';
    let idx = 0;
    setter('');
    const interval = setInterval(() => {
      if (idx < target.length) {
        current += target[idx];
        setter(current);
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 45);
  }

  const handleActivate = async () => {
    if (isActivating) return;
    setIsActivating(true);

    // 1. Play original futuristic startup sound
    try {
      playStartupActivationSound();
    } catch (e) {
      console.warn("Audio play error:", e);
    }

    // 2. Allow activation shockwave animation to bloom before transitioning
    setTimeout(() => {
      onActivated();
    }, 1200);
  };

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000206] overflow-hidden select-none"
      exit={{ 
        opacity: 0, 
        scale: 1.25, 
        filter: 'blur(12px) brightness(1.8)' 
      }}
      transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Deep atmosphere gradient vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 45, 75, 0.25) 0%, rgba(0, 10, 20, 0.7) 50%, #000206 100%)'
        }}
      />

      {/* Floating Micro Dust Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {backgroundParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-cyan-300"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              boxShadow: '0 0 6px rgba(0,229,255,0.8)'
            }}
            initial={{ opacity: 0, y: 0 }}
            animate={{
              opacity: [0, p.opacity, 0],
              y: [-10, -40],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Fine technical background grid */}
      <div 
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(to right, rgba(0,229,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,229,255,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Center Startup Core */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <StartupCore 
          isActivating={isActivating} 
          onClick={handleActivate}
          interactive={readyForTap || step >= 1}
        />

        {/* Futuristic Status Text */}
        <div className="mt-8 flex flex-col items-center min-h-[90px] font-mono tracking-widest text-center">
          <motion.div 
            className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-amber-200 to-cyan-300 drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]"
            animate={{ opacity: isActivating ? [1, 0] : 1 }}
            transition={{ duration: 0.3 }}
          >
            {displayText}
            {!isActivating && <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse" />}
          </motion.div>

          {subText && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.7, y: 0 }}
              className="text-[9px] sm:text-xs text-cyan-400/80 uppercase tracking-[0.3em] mt-2 font-mono"
            >
              {subText}
            </motion.div>
          )}

          {/* Action Prompt when ready */}
          <AnimatePresence>
            {readyForTap && !isActivating && (
              <motion.button
                onClick={handleActivate}
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="mt-6 px-6 py-2.5 rounded-full border border-cyan-400/50 bg-cyan-950/40 text-cyan-200 text-xs font-mono tracking-[0.3em] uppercase backdrop-blur-md shadow-[0_0_20px_rgba(0,229,255,0.2)] hover:border-amber-300 hover:shadow-[0_0_25px_rgba(255,200,60,0.4)] transition-all cursor-pointer flex items-center gap-2 group"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400 group-hover:bg-amber-300 animate-ping" />
                <span>TAP CORE TO ACTIVATE</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Screen edge HUD corner frames */}
      <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-cyan-500/40 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-cyan-500/40 pointer-events-none" />

      {/* Tiny corner telemetry */}
      <div className="absolute bottom-6 left-12 text-[8px] font-mono text-cyan-600 tracking-widest pointer-events-none">
        BOOT.SEQ // STANDBY
      </div>
      <div className="absolute bottom-6 right-12 text-[8px] font-mono text-cyan-600 tracking-widest pointer-events-none">
        QUANTUM ENCRYPTION: SECURE
      </div>
    </motion.div>
  );
}
