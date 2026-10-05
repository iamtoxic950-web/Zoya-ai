import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantState } from '../types';

interface StartupOverlayProps {
  onComplete: () => void;
  appState: AssistantState;
  isBooting: boolean;
}

export function StartupOverlay({ onComplete, appState, isBooting }: StartupOverlayProps) {
  const [phase, setPhase] = useState<'INIT' | 'AUDIO' | 'VOICE' | 'MEMORY' | 'LIVE' | 'CORE' | 'ONLINE'>('INIT');

  useEffect(() => {
    if (!isBooting) return;
    
    // Simulate initial fast checks
    const t1 = setTimeout(() => setPhase('AUDIO'), 800);
    const t2 = setTimeout(() => setPhase('VOICE'), 1600);
    const t3 = setTimeout(() => setPhase('MEMORY'), 2400);
    const t4 = setTimeout(() => setPhase('LIVE'), 3200);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isBooting]);

  useEffect(() => {
    if (phase === 'LIVE' && appState === 'CONNECTING') {
      // Waiting for connection to complete
    } else if (phase === 'LIVE' && (appState === 'LISTENING' || appState === 'THINKING' || appState === 'SPEAKING')) {
      setPhase('CORE');
      setTimeout(() => {
        setPhase('ONLINE');
        setTimeout(() => {
          onComplete();
        }, 1500);
      }, 1000);
    } else if (phase === 'LIVE' && appState === 'ERROR') {
      // Auto complete if error so user can see it
      onComplete();
    }
  }, [appState, phase, onComplete]);
  
  // If user hasn't clicked connect yet, we auto progress for the cinematic effect
  useEffect(() => {
    if (phase === 'LIVE' && appState === 'DISCONNECTED') {
       const t = setTimeout(() => {
         setPhase('CORE');
         setTimeout(() => {
           setPhase('ONLINE');
           setTimeout(() => {
             onComplete();
           }, 1500);
         }, 1000);
       }, 2000);
       return () => clearTimeout(t);
    }
  }, [phase, appState, onComplete]);

  return (
    <AnimatePresence>
      {isBooting && (
        <motion.div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#010308] overflow-hidden"
          exit={{ opacity: 0, scale: 1.1, filter: 'brightness(2)' }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          {/* Subtle Deep Space Atmosphere */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,30,60,0.2)_0%,rgba(0,0,0,1)_100%)] pointer-events-none" />
          
          {/* Faint Technical Grid */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgwVjB6bTM5IDM5VjFoLTM4djM4aDM4eiIgZmlsbD0icmdiYSgwLCAyNTUsIDI1NSwgMC4wMikiIGZpbGwtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==')] opacity-30 pointer-events-none" />

          {/* Particles */}
          <div className="absolute inset-0 pointer-events-none">
             {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-cyan-500 rounded-full"
                  initial={{ 
                    x: Math.random() * window.innerWidth, 
                    y: Math.random() * window.innerHeight,
                    opacity: Math.random() * 0.5 + 0.1
                  }}
                  animate={{
                    y: [null, Math.random() * window.innerHeight],
                    opacity: [null, Math.random() * 0.5 + 0.1]
                  }}
                  transition={{
                    duration: Math.random() * 10 + 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
             ))}
          </div>

          <div className="relative z-10 flex flex-col items-center">
             <motion.div 
               className="w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center relative mb-12"
               animate={{ rotate: 360, boxShadow: phase === 'ONLINE' ? '0 0 40px rgba(0,255,255,0.5)' : '0 0 10px rgba(0,255,255,0.1)' }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
             >
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 blur-sm" />
                <div className="absolute inset-0 border-t-2 border-cyan-400 rounded-full animate-spin" style={{ animationDuration: '2s' }} />
             </motion.div>

             <div className="font-mono text-cyan-400 text-sm tracking-widest text-left space-y-3 w-80">
                <p className="text-cyan-200 mb-6 font-bold text-center">INITIALIZING ZOYA...</p>
                
                <BootLine label="AUDIO SYSTEM" status={phase !== 'INIT' ? 'ONLINE' : '...'} active={phase !== 'INIT'} />
                <BootLine label="VOICE ENGINE" status={['VOICE', 'MEMORY', 'LIVE', 'CORE', 'ONLINE'].includes(phase) ? 'ONLINE' : '...'} active={['VOICE', 'MEMORY', 'LIVE', 'CORE', 'ONLINE'].includes(phase)} />
                <BootLine label="MEMORY SYSTEM" status={['MEMORY', 'LIVE', 'CORE', 'ONLINE'].includes(phase) ? 'ONLINE' : '...'} active={['MEMORY', 'LIVE', 'CORE', 'ONLINE'].includes(phase)} />
                <BootLine 
                  label="LIVE SESSION" 
                  status={appState === 'CONNECTING' ? 'CONNECTING' : (['CORE', 'ONLINE'].includes(phase) || appState === 'LISTENING') ? 'CONNECTED' : '...'} 
                  active={['LIVE', 'CORE', 'ONLINE'].includes(phase)} 
                />
                <BootLine label="AI CORE" status={['CORE', 'ONLINE'].includes(phase) ? 'ONLINE' : '...'} active={['CORE', 'ONLINE'].includes(phase)} />
             </div>

             <AnimatePresence>
               {phase === 'ONLINE' && (
                 <motion.div
                   initial={{ opacity: 0, y: 10, scale: 0.9 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   className="mt-12 text-2xl font-bold text-white tracking-[0.3em] uppercase"
                   style={{ textShadow: '0 0 20px rgba(0,255,255,0.8)' }}
                 >
                   ZOYA CORE ONLINE
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
          
          {/* Scanline */}
          <motion.div 
            className="absolute top-0 left-0 right-0 h-1 bg-cyan-500/20"
            animate={{ y: ['0vh', '100vh'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BootLine({ label, status, active }: { label: string, status: string, active: boolean }) {
  return (
    <div className={`flex justify-between ${active ? 'opacity-100' : 'opacity-40'} transition-opacity duration-500`}>
      <span>{label}</span>
      <span className="text-cyan-200/50">........</span>
      <span className={status === 'ONLINE' || status === 'CONNECTED' ? 'text-cyan-300' : status === 'CONNECTING' ? 'text-yellow-300 animate-pulse' : 'text-cyan-600'}>
        {status}
      </span>
    </div>
  );
}
