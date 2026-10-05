import React from 'react';
import { motion } from 'motion/react';

interface StartupCoreProps {
  isActivating: boolean;
  onClick: () => void;
  interactive?: boolean;
}

export function StartupCore({ isActivating, onClick, interactive = true }: StartupCoreProps) {
  return (
    <div 
      onClick={interactive ? onClick : undefined}
      className={`relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center select-none ${interactive ? 'cursor-pointer group' : ''}`}
      style={{ touchAction: 'manipulation' }}
    >
      {/* Outer ambient glow halo */}
      <motion.div 
        className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
        animate={{
          background: isActivating 
            ? 'radial-gradient(circle, rgba(255,200,60,0.6) 0%, rgba(0,229,255,0.4) 45%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0,229,255,0.2) 0%, rgba(0,100,140,0.1) 50%, transparent 70%)',
          scale: isActivating ? [1, 1.8, 2.5] : [0.95, 1.05, 0.95],
          opacity: isActivating ? [0.6, 1, 0] : [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: isActivating ? 1.4 : 4,
          repeat: isActivating ? 0 : Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Expanding Shockwave Energy Rings on Activation */}
      {isActivating && (
        <>
          <motion.div
            className="absolute rounded-full border border-amber-300 pointer-events-none"
            initial={{ width: 80, height: 80, opacity: 1, borderWidth: 3 }}
            animate={{ width: 600, height: 600, opacity: 0, borderWidth: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <motion.div
            className="absolute rounded-full border border-cyan-400 pointer-events-none"
            initial={{ width: 80, height: 80, opacity: 1, borderWidth: 2 }}
            animate={{ width: 800, height: 800, opacity: 0, borderWidth: 0 }}
            transition={{ duration: 1.5, delay: 0.15, ease: "easeOut" }}
          />
          <motion.div
            className="absolute rounded-full bg-cyan-300/30 blur-md pointer-events-none"
            initial={{ width: 40, height: 40, opacity: 1 }}
            animate={{ width: 700, height: 700, opacity: 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
          />
        </>
      )}

      {/* SVG Intricate Holographic Rings & Rotating Segments */}
      <svg 
        viewBox="0 0 400 400" 
        className="w-full h-full relative z-10 filter drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]"
      >
        <defs>
          <linearGradient id="cyanGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#fff4c2" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffb300" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="pureCyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#006688" stopOpacity="0.2" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ring 1 - Outermost segmented tracking ring */}
        <motion.circle
          cx="200"
          cy="200"
          r="175"
          fill="none"
          stroke="rgba(0, 229, 255, 0.25)"
          strokeWidth="1"
          strokeDasharray="4 8"
          animate={{ rotate: isActivating ? 720 : 360 }}
          transition={{ duration: isActivating ? 1.5 : 40, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 2 - Segmented Tech Caliper Arcs */}
        <motion.circle
          cx="200"
          cy="200"
          r="160"
          fill="none"
          stroke="url(#cyanGoldGrad)"
          strokeWidth="2"
          strokeDasharray="40 25 10 25 80 40"
          animate={{ rotate: isActivating ? -1080 : -360 }}
          transition={{ duration: isActivating ? 1.2 : 25, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 3 - Fine Crosshair Ticks & Markers */}
        <motion.circle
          cx="200"
          cy="200"
          r="140"
          fill="none"
          stroke="rgba(0, 229, 255, 0.4)"
          strokeWidth="1.5"
          strokeDasharray="2 12"
          animate={{ rotate: isActivating ? 540 : 360 }}
          transition={{ duration: isActivating ? 1.4 : 30, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 4 - Inner High-Density Gold Gear/Orbital Segment */}
        <motion.circle
          cx="200"
          cy="200"
          r="115"
          fill="none"
          stroke="rgba(255, 179, 0, 0.7)"
          strokeWidth="2"
          strokeDasharray="15 8 5 8"
          animate={{ rotate: isActivating ? -720 : -360 }}
          transition={{ duration: isActivating ? 1.2 : 18, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 5 - Inner Focus Circle */}
        <motion.circle
          cx="200"
          cy="200"
          r="90"
          fill="none"
          stroke="rgba(0, 229, 255, 0.6)"
          strokeWidth="1.5"
          strokeDasharray="80 15 30 15"
          animate={{ rotate: isActivating ? 1080 : 360 }}
          transition={{ duration: isActivating ? 1.0 : 15, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 6 - Tight Core Containment Ring */}
        <motion.circle
          cx="200"
          cy="200"
          r="65"
          fill="none"
          stroke="#fff4c2"
          strokeWidth="2"
          strokeDasharray="12 6"
          filter="url(#glow)"
          animate={{ rotate: isActivating ? -1440 : -360 }}
          transition={{ duration: isActivating ? 0.9 : 10, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Radial Target lines */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <motion.line
            key={deg}
            x1="200"
            y1="40"
            x2="200"
            y2="55"
            stroke="rgba(0, 229, 255, 0.5)"
            strokeWidth="1.5"
            transform={`rotate(${deg} 200 200)`}
            animate={{
              opacity: isActivating ? [0.4, 1, 0] : [0.3, 0.8, 0.3],
            }}
            transition={{ duration: 2, repeat: Infinity, delay: deg * 0.005 }}
          />
        ))}

        {/* Orbiting Satellite Nodes */}
        <motion.g
          animate={{ rotate: isActivating ? 1440 : 360 }}
          transition={{ duration: isActivating ? 1.0 : 8, repeat: isActivating ? 0 : Infinity, ease: "linear" }}
          style={{ transformOrigin: 'center' }}
        >
          <circle cx="200" cy="85" r="3.5" fill="#fff4c2" filter="url(#glow)" />
          <circle cx="200" cy="315" r="2.5" fill="#00e5ff" filter="url(#glow)" />
          <circle cx="85" cy="200" r="3" fill="#ffb300" filter="url(#glow)" />
          <circle cx="315" cy="200" r="3" fill="#00e5ff" filter="url(#glow)" />
        </motion.g>

        {/* Central Glowing Reactor Core */}
        <motion.circle
          cx="200"
          cy="200"
          r={isActivating ? 48 : 38}
          fill="url(#cyanGoldGrad)"
          filter="url(#glow)"
          animate={{
            scale: isActivating ? [1, 1.4, 3] : [0.95, 1.05, 0.95],
            opacity: isActivating ? [1, 1, 0] : [0.85, 1, 0.85],
          }}
          transition={{
            duration: isActivating ? 1.2 : 2.5,
            repeat: isActivating ? 0 : Infinity,
            ease: "easeInOut"
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Blazing Center Singularity Point */}
        <motion.circle
          cx="200"
          cy="200"
          r="16"
          fill="#ffffff"
          filter="url(#glow)"
          animate={{
            scale: isActivating ? [1, 2, 4] : [0.9, 1.1, 0.9],
            opacity: isActivating ? [1, 1, 0] : [0.9, 1, 0.9],
          }}
          transition={{
            duration: isActivating ? 1.2 : 1.5,
            repeat: isActivating ? 0 : Infinity,
            ease: "easeInOut"
          }}
          style={{ transformOrigin: 'center' }}
        />
      </svg>

      {/* Interactive hover border hint */}
      {interactive && !isActivating && (
        <motion.div
          className="absolute -inset-4 rounded-full border border-cyan-400/20 group-hover:border-cyan-400/60 transition-colors pointer-events-none"
          animate={{ rotate: 360, scale: [0.98, 1.02, 0.98] }}
          transition={{
            rotate: { duration: 50, repeat: Infinity, ease: "linear" },
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
        />
      )}
    </div>
  );
}
