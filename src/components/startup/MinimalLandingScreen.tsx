import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { playStartupActivationSound, unlockAudioContext } from '../../utils/sfx';

interface MinimalLandingScreenProps {
  onActivated: () => void;
}

const PARTICLE_COUNT = 35;

const RING_CONFIGS = [
  { speedIdle: 360 / 50, speedExpand: 540 / 1.4, scaleExpand: 1.6 },
  { speedIdle: -360 / 32, speedExpand: -720 / 1.3, scaleExpand: 1.8 },
  { speedIdle: 360 / 40, speedExpand: 540 / 1.3, scaleExpand: 2.0 },
  { speedIdle: -360 / 22, speedExpand: -900 / 1.2, scaleExpand: 2.3 },
  { speedIdle: 360 / 16, speedExpand: 1080 / 1.1, scaleExpand: 2.6 },
  { speedIdle: -360 / 12, speedExpand: -1200 / 1.0, scaleExpand: 3.0 },
];

export const MinimalLandingScreen = React.memo(function MinimalLandingScreen({
  onActivated,
}: MinimalLandingScreenProps) {
  const [isExpanding, setIsExpanding] = useState(false);
  const isExpandingRef = useRef(false);
  const expandStartTimeRef = useRef<number | null>(null);
  const hasTriggeredActivationRef = useRef(false);
  const activationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const ringRefs = useRef<Array<SVGCircleElement | null>>([]);
  const ticksGroupRef = useRef<SVGGElement | null>(null);
  const energyCoreRef = useRef<SVGCircleElement | null>(null);
  const singularityRef = useRef<SVGCircleElement | null>(null);
  const hoverRingRef = useRef<HTMLDivElement | null>(null);

  // Pre-allocate typed arrays once for all 35 particles (zero per-frame GC allocations)
  const particleData = useMemo(() => {
    const x = new Float32Array(PARTICLE_COUNT);
    const y = new Float32Array(PARTICLE_COUNT);
    const size = new Float32Array(PARTICLE_COUNT);
    const duration = new Float32Array(PARTICLE_COUNT);
    const delay = new Float32Array(PARTICLE_COUNT);
    const baseOpacity = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      x[i] = Math.random();
      y[i] = Math.random();
      size[i] = Math.random() * 1.5 + 0.5;
      duration[i] = Math.random() * 8 + 6;
      delay[i] = Math.random() * 4;
      baseOpacity[i] = Math.random() * 0.4 + 0.15;
    }
    return { x, y, size, duration, delay, baseOpacity };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;

    // Pre-render a tiny offscreen glowing cyan particle sprite once so we never compute box-shadow/blur per frame
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 16;
    spriteCanvas.height = 16;
    const sCtx = spriteCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(8, 8, 0.5, 8, 8, 8);
      grad.addColorStop(0, 'rgba(165, 243, 252, 1)');
      grad.addColorStop(0.35, 'rgba(0, 229, 255, 0.75)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 16, 16);
    }

    let width = window.innerWidth;
    let height = window.innerHeight;
    const updateSize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });

    const ringAngles = new Float32Array(RING_CONFIGS.length);
    let lastTimestamp = performance.now();
    const startTimestamp = lastTimestamp;

    // Single authoritative requestAnimationFrame loop driving particles, rings, halo, and core
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimestamp) / 1000);
      lastTimestamp = now;
      const elapsedSec = (now - startTimestamp) / 1000;

      const expanding = isExpandingRef.current;
      let expandProgress = 0;
      if (expanding && expandStartTimeRef.current !== null) {
        expandProgress = Math.min(1, (now - expandStartTimeRef.current) / 1300);
      }
      // Smooth cubic easeOut for expansion
      const easeOut = 1 - Math.pow(1 - expandProgress, 3);

      // 1. Update 6 concentric SVG rings via GPU-friendly transform
      for (let i = 0; i < RING_CONFIGS.length; i++) {
        const el = ringRefs.current[i];
        if (!el) continue;
        const cfg = RING_CONFIGS[i];
        const currentSpeed = expanding ? cfg.speedExpand : cfg.speedIdle;
        ringAngles[i] = (ringAngles[i] + currentSpeed * dt) % 360;
        const currentScale = expanding ? 1 + (cfg.scaleExpand - 1) * easeOut : 1;
        el.style.transform = `rotate(${ringAngles[i].toFixed(2)}deg) scale(${currentScale.toFixed(3)})`;
      }

      // 2. Update radial ticks opacity
      if (ticksGroupRef.current) {
        const tickOpacity = expanding
          ? Math.max(0, 0.85 * (1 - easeOut))
          : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(elapsedSec * 2.5));
        ticksGroupRef.current.style.opacity = tickOpacity.toFixed(3);
      }

      // 3. Update central energy core & singularity via GPU transform/opacity
      if (energyCoreRef.current) {
        const coreScale = expanding
          ? Math.max(0.35, 1 - 0.6 * easeOut)
          : 1 + 0.04 * Math.sin(elapsedSec * 2.1);
        const coreOpacity = expanding
          ? Math.max(0, 0.9 * (1 - easeOut))
          : 0.9 + 0.1 * Math.sin(elapsedSec * 2.1);
        energyCoreRef.current.style.transform = `scale(${coreScale.toFixed(3)})`;
        energyCoreRef.current.style.opacity = coreOpacity.toFixed(3);
      }

      if (singularityRef.current) {
        const singScale = expanding
          ? Math.max(0, 1 - easeOut)
          : 1 + 0.1 * Math.sin(elapsedSec * 3.14);
        const singOpacity = expanding
          ? Math.max(0, 1 - easeOut)
          : 0.92 + 0.08 * Math.sin(elapsedSec * 3.14);
        singularityRef.current.style.transform = `scale(${singScale.toFixed(3)})`;
        singularityRef.current.style.opacity = singOpacity.toFixed(3);
      }

      // 4. Update ambient halo & hover indicator ring
      if (haloRef.current) {
        const haloScale = expanding
          ? 1 + 1.8 * easeOut
          : 1 + 0.05 * Math.sin(elapsedSec * 1.4);
        const haloOpacity = expanding
          ? Math.max(0, 0.85 * (1 - easeOut))
          : 0.55 + 0.15 * Math.sin(elapsedSec * 1.4);
        haloRef.current.style.transform = `translate3d(0,0,0) scale(${haloScale.toFixed(3)})`;
        haloRef.current.style.opacity = haloOpacity.toFixed(3);
      }

      if (hoverRingRef.current && !expanding) {
        const hoverAngle = (elapsedSec * 9) % 360;
        hoverRingRef.current.style.transform = `translate3d(0,0,0) rotate(${hoverAngle.toFixed(1)}deg)`;
      }

      // 5. Render floating micro-particles on single 2D canvas
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        const { x, y, size, duration, delay, baseOpacity } = particleData;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const px = x[i] * width;
          let py = y[i] * height;
          let alpha = baseOpacity[i];
          let drawRadius = size[i] * 3.5;

          if (expanding) {
            py -= easeOut * 150;
            const scaleMult = expandProgress < 0.45
              ? 1 + (expandProgress / 0.45) * 2.2
              : Math.max(0, 3.2 * (1 - (expandProgress - 0.45) / 0.55));
            drawRadius *= scaleMult;
            alpha = Math.min(0.95, baseOpacity[i] * 1.8) * (1 - easeOut);
          } else {
            const cycle = ((elapsedSec + delay[i]) % duration[i]) / duration[i];
            const wave = Math.sin(cycle * Math.PI);
            py -= cycle * 25;
            alpha = baseOpacity[i] * wave;
          }

          if (alpha > 0.01 && drawRadius > 0.2) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(
              spriteCanvas,
              px - drawRadius,
              py - drawRadius,
              drawRadius * 2,
              drawRadius * 2
            );
          }
        }
        ctx.globalAlpha = 1;
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (activationTimerRef.current !== null) {
        clearTimeout(activationTimerRef.current);
        activationTimerRef.current = null;
      }
    };
  }, [particleData]);

  const handleClickCore = () => {
    if (hasTriggeredActivationRef.current || isExpandingRef.current) return;
    hasTriggeredActivationRef.current = true;
    isExpandingRef.current = true;
    expandStartTimeRef.current = performance.now();
    setIsExpanding(true);

    // Unlock shared AudioContext and play cinematic startup sound once on user gesture
    unlockAudioContext()
      .then(() => {
        playStartupActivationSound();
      })
      .catch((e) => {
        console.warn('Audio activation error:', e);
      });

    // Allow the outward ring expansion and particle warp to progress before transitioning
    activationTimerRef.current = setTimeout(() => {
      activationTimerRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      onActivated();
    }, 1350);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000103] overflow-hidden select-none"
      style={{ willChange: 'transform, opacity' }}
      exit={{
        opacity: 0,
        scale: 1.04,
      }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Deep atmosphere gradient vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0, 25, 45, 0.35) 0%, rgba(0, 4, 10, 0.8) 55%, #000103 100%)',
        }}
      />

      {/* Single-loop Canvas for Subtle Floating Micro Particles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Center Interactive Zoya Core */}
      <div
        onClick={handleClickCore}
        className="relative z-10 flex flex-col items-center justify-center cursor-pointer group"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
          {/* Subtle Ambient Cyan/Blue Glow Halo (GPU transform/opacity only, no live filter repaint) */}
          <div
            ref={haloRef}
            className="absolute -inset-8 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(0,229,255,0.24) 0%, rgba(56,189,248,0.12) 40%, rgba(30,58,138,0.05) 62%, transparent 75%)',
              willChange: 'transform, opacity',
              transform: 'translate3d(0,0,0)',
            }}
          />

          {/* Outward Ring Expansion Ripples on Click (Pure GPU scale & opacity, zero width/height reflows) */}
          <AnimatePresence>
            {isExpanding && (
              <>
                <motion.div
                  className="absolute w-20 h-20 rounded-full border border-cyan-400/80 pointer-events-none"
                  style={{ willChange: 'transform, opacity' }}
                  initial={{ scale: 1, opacity: 0.95 }}
                  animate={{ scale: 9.2, opacity: 0 }}
                  transition={{ duration: 1.15, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute w-20 h-20 rounded-full border border-blue-400/60 pointer-events-none"
                  style={{ willChange: 'transform, opacity' }}
                  initial={{ scale: 1, opacity: 0.85 }}
                  animate={{ scale: 11.5, opacity: 0 }}
                  transition={{ duration: 1.35, delay: 0.08, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute w-20 h-20 rounded-full pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,229,255,0.28) 0%, rgba(0,229,255,0.08) 55%, transparent 75%)',
                    willChange: 'transform, opacity',
                  }}
                  initial={{ scale: 0.8, opacity: 0.85 }}
                  animate={{ scale: 8.0, opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </>
            )}
          </AnimatePresence>

          {/* Concentric Thin Complicated Rings (Driven by single rAF loop) */}
          <svg viewBox="0 0 400 400" className="w-full h-full relative z-10">
            <defs>
              <radialGradient id="coreCyanGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                <stop offset="45%" stopColor="#7dd3fc" stopOpacity="0.9" />
                <stop offset="80%" stopColor="#00e5ff" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
              </radialGradient>

              <radialGradient id="coreOuterBloom" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#00e5ff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Ring 1 - Outermost segmented tracking ring */}
            <circle
              ref={(el) => {
                ringRefs.current[0] = el;
              }}
              cx="200"
              cy="200"
              r="175"
              fill="none"
              stroke="rgba(0, 229, 255, 0.22)"
              strokeWidth="0.8"
              strokeDasharray="4 8"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Ring 2 - Thin Caliper Arcs */}
            <circle
              ref={(el) => {
                ringRefs.current[1] = el;
              }}
              cx="200"
              cy="200"
              r="155"
              fill="none"
              stroke="rgba(0, 229, 255, 0.48)"
              strokeWidth="1.2"
              strokeDasharray="50 30 15 30 90 45"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Ring 3 - Fine Ticks */}
            <circle
              ref={(el) => {
                ringRefs.current[2] = el;
              }}
              cx="200"
              cy="200"
              r="135"
              fill="none"
              stroke="rgba(125, 211, 252, 0.32)"
              strokeWidth="1"
              strokeDasharray="2 10"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Ring 4 - Inner Segmented Core Boundary */}
            <circle
              ref={(el) => {
                ringRefs.current[3] = el;
              }}
              cx="200"
              cy="200"
              r="110"
              fill="none"
              stroke="rgba(0, 229, 255, 0.58)"
              strokeWidth="1.5"
              strokeDasharray="20 10 8 10"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Ring 5 - Inner Focus Circle */}
            <circle
              ref={(el) => {
                ringRefs.current[4] = el;
              }}
              cx="200"
              cy="200"
              r="85"
              fill="none"
              stroke="rgba(186, 230, 253, 0.62)"
              strokeWidth="1.2"
              strokeDasharray="70 20 25 20"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Ring 6 - Tight Core Containment Ring */}
            <circle
              ref={(el) => {
                ringRefs.current[5] = el;
              }}
              cx="200"
              cy="200"
              r="60"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="1.5"
              strokeDasharray="10 5"
              style={{ transformOrigin: '200px 200px', willChange: 'transform' }}
            />

            {/* Radial Ticks */}
            <g ref={ticksGroupRef} style={{ willChange: 'opacity' }}>
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <line
                  key={deg}
                  x1="200"
                  y1="45"
                  x2="200"
                  y2="55"
                  stroke="rgba(0, 229, 255, 0.45)"
                  strokeWidth="1"
                  transform={`rotate(${deg} 200 200)`}
                />
              ))}
            </g>

            {/* Soft Pre-Composited Core Glow Halo */}
            <circle cx="200" cy="200" r="54" fill="url(#coreOuterBloom)" />

            {/* Central Energy Core */}
            <circle
              ref={energyCoreRef}
              cx="200"
              cy="200"
              r="38"
              fill="url(#coreCyanGradient)"
              style={{ transformOrigin: '200px 200px', willChange: 'transform, opacity' }}
            />

            {/* Central Pure Singularity Point */}
            <circle
              ref={singularityRef}
              cx="200"
              cy="200"
              r="12"
              fill="#ffffff"
              style={{ transformOrigin: '200px 200px', willChange: 'transform, opacity' }}
            />
          </svg>

          {/* Hover reaction indicator ring */}
          {!isExpanding && (
            <div
              ref={hoverRingRef}
              className="absolute -inset-3 rounded-full border border-cyan-400/0 group-hover:border-cyan-400/40 transition-colors pointer-events-none"
              style={{ willChange: 'transform' }}
            />
          )}
        </div>

        {/* Minimal Instruction */}
        <motion.div
          className="mt-12 flex flex-col items-center pointer-events-none"
          style={{ willChange: 'transform, opacity' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: isExpanding ? 0 : 0.7,
            y: isExpanding ? -10 : 0,
          }}
          transition={{ duration: isExpanding ? 0.35 : 0.9, delay: isExpanding ? 0 : 0.2 }}
        >
          <span className="text-[11px] sm:text-[13px] font-mono tracking-[0.45em] text-cyan-200 uppercase drop-shadow-[0_0_8px_rgba(0,229,255,0.4)] group-hover:text-cyan-100 group-hover:tracking-[0.5em] transition-all">
            INITIALIZE ZOYA
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/80 animate-ping mt-3" />
        </motion.div>
      </div>
    </motion.div>
  );
});
