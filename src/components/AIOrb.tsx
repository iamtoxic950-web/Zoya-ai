import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { AssistantState } from '../types';

interface AIOrbProps {
  pipelineStage?: number;
  analyser?: AnalyserNode | null;
  outputAnalyser?: AnalyserNode | null;
  isBooting?: boolean;
  state: AssistantState;
  onClick: () => void;
}

// Helper functions for colors
function hexToRgb(hex: string) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return [r, g, b];
}

function lerpColor(c1: number[], c2: number[], factor: number) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * factor),
    Math.round(c1[1] + (c2[1] - c1[1]) * factor),
    Math.round(c1[2] + (c2[2] - c1[2]) * factor)
  ];
}

function lerp(start: number, end: number, factor: number) {
  return start + (end - start) * factor;
}

// Generate particles once outside
const NUM_PARTICLES = 350;
const particles = Array.from({ length: NUM_PARTICLES }).map(() => ({
  angle: Math.random() * Math.PI * 2,
  radius: 60 + Math.random() * 220,
  speed: (Math.random() * 0.002 + 0.0005) * (Math.random() > 0.5 ? 1 : -1),
  size: Math.random() * 1.5 + 0.5,
  alpha: Math.random() * 0.5 + 0.1,
  oscSpeed: Math.random() * 0.002 + 0.001,
  oscOffset: Math.random() * Math.PI * 2
}));

// Initial rings setup
const rings = [
  { r: 75, speed: 0.005, dir: 1, dash: [4, 8], width: 1.5, alpha: 0.6, angle: 0 },
  { r: 95, speed: 0.003, dir: -1, dash: [20, 10, 2, 10], width: 2, alpha: 0.5, angle: 0 },
  { r: 115, speed: 0.007, dir: 1, dash: [2, 4], width: 1, alpha: 0.4, angle: 0 },
  { r: 140, speed: 0.002, dir: -1, dash: [50, 15], width: 2.5, alpha: 0.7, angle: 0 },
  { r: 165, speed: 0.004, dir: 1, dash: [10, 20, 30, 20], width: 1.5, alpha: 0.5, angle: 0 }
];

export function AIOrb({ state, onClick, isBooting = false, analyser, outputAnalyser, pipelineStage = -1 }: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  let coreColors = ['#cbd5e1', '#64748b', '#1e293b'];
  
  switch (state) {
    case 'CONNECTING':
      coreColors = ['#fef08a', '#facc15', '#a16207'];
      break;
    case 'LISTENING':
      coreColors = ['#bfdbfe', '#60a5fa', '#1d4ed8'];
      break;
    case 'THINKING':
      coreColors = ['#e9d5ff', '#c084fc', '#7e22ce'];
      break;
    case 'SPEAKING':
      coreColors = ['#ffffff', '#f1f5f9', '#cbd5e1'];
      break;
    case 'ERROR':
      coreColors = ['#fca5a5', '#ef4444', '#7f1d1d'];
      break;
    case 'DISCONNECTED':
    default:
      coreColors = ['#cbd5e1', '#64748b', '#1e293b'];
      break;
  }

  const stateRef = useRef(state);
  const colorRef = useRef(coreColors);
  const analyserRef = useRef(analyser);
  const outputAnalyserRef = useRef(outputAnalyser);
  const dataArrayRef = useRef(new Uint8Array(256));
  const bootRef = useRef(isBooting);
  const pipelineStageRef = useRef(pipelineStage);
  const bootStartTimeRef = useRef(-1);

  useEffect(() => {
    bootRef.current = isBooting;
  }, [isBooting]);

  useEffect(() => {
    pipelineStageRef.current = pipelineStage;
  }, [pipelineStage]);

  useEffect(() => {
    stateRef.current = state;
    colorRef.current = coreColors;
    analyserRef.current = analyser;
    outputAnalyserRef.current = outputAnalyser;
  }, [state, coreColors, analyser, outputAnalyser]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        // We set canvas internal resolution
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    let animationFrameId: number;
    let current = {
      color0: hexToRgb('#cbd5e1'),
      color1: hexToRgb('#64748b'),
      color2: hexToRgb('#1e293b'),
      glowAlpha: 0.2,
      orbScale: 1.0,
      particleSpeed: 1.0,
      ringSpeed: 1.0, smoothedAmplitude: 0, timeOffsets: Array(10).fill(0).map(() => Math.random() * 100)};

    const render = (time: number) => {
      if (bootStartTimeRef.current === -1) {
        bootStartTimeRef.current = time;
      }
      const st = stateRef.current;
      const tColors = colorRef.current;
      const isBootingCurrent = bootRef.current;
      
      const bootElapsed = time - bootStartTimeRef.current;
      const bootProgress = isBootingCurrent ? Math.min(1, Math.max(0, bootElapsed / 4500)) : 1.0;
      
      let targetGlow = 0.5;
      let targetScale = 1.0;
      let targetParticle = 1.0;
      let targetRing = 1.0;
      let simAmplitude = 0;
      
      let rawAmplitude = 0;
      const dataArray = dataArrayRef.current;
      if (st === 'SPEAKING' && outputAnalyserRef.current) {
        if (outputAnalyserRef.current.fftSize !== dataArray.length) {
          dataArrayRef.current = new Uint8Array(outputAnalyserRef.current.fftSize);
        }
        outputAnalyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += Math.abs(dataArrayRef.current[i] - 128);
        }
        rawAmplitude = sum / dataArrayRef.current.length / 128.0; // 0 to 1
      } else if (st === 'LISTENING' && analyserRef.current) {
        if (analyserRef.current.fftSize !== dataArray.length) {
          dataArrayRef.current = new Uint8Array(analyserRef.current.fftSize);
        }
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += Math.abs(dataArrayRef.current[i] - 128);
        }
        rawAmplitude = sum / dataArrayRef.current.length / 128.0;
      }
      
      // Amplify and clamp it
      rawAmplitude = Math.min(1, rawAmplitude * 3.0);
      current.smoothedAmplitude = lerp(current.smoothedAmplitude, rawAmplitude, 0.2);
      

      

      if (isBootingCurrent) {
        // Boot sequence rules
        targetGlow = 0; // Starts faint
        targetScale = 1.0;
        targetParticle = 1.0;
        targetRing = 1.0;
      } else if (st === 'DISCONNECTED') {
        targetGlow = 0.15;
        targetRing = 0.2;
        targetParticle = 0.2;
      } else if (st === 'CONNECTING') {
        targetGlow = 0.5;
        targetScale = 1.05;
        targetRing = 2.0;
        targetParticle = 1.5;
      } else if (st === 'LISTENING') {
        const amp = current.smoothedAmplitude;
        targetGlow = 0.7 + amp * 0.4;
        targetScale = 1.08 + amp * 0.15;
        targetRing = 1.0 + amp * 1.5;
        targetParticle = 1.5 + amp * 2.0;
      } else if (st === 'THINKING') {
        const pStage = pipelineStageRef.current;
        if (pStage === 1 || pStage === 2) {
          // Intent / Context
          targetGlow = 0.5;
          targetScale = 1.0;
          targetRing = 2.5;
          targetParticle = 1.0;
        } else if (pStage === 3) {
          // Memory
          targetGlow = 0.6;
          targetScale = 1.02;
          targetRing = 1.0;
          targetParticle = 4.0;
        } else if (pStage === 4 || pStage === 5) {
          // Reasoning / Response
          targetGlow = 0.8;
          targetScale = 1.05;
          targetRing = 1.5;
          targetParticle = 1.5;
        } else if (pStage === 6) {
          // Action Execution
          targetGlow = 1.2;
          targetScale = 1.1;
          targetRing = 2.0;
          targetParticle = 2.0;
        } else if (pStage === 7) {
          // Completed Flash
          targetGlow = 2.0;
          targetScale = 1.15;
          targetRing = 3.0;
          targetParticle = 3.0;
        } else {
          targetGlow = 0.6;
          targetScale = 1.02;
          targetRing = 1.5;
          targetParticle = 1.2;
        }
      } else if (st === 'SPEAKING') {
        const amp = current.smoothedAmplitude;
        targetGlow = 0.6 + amp * 0.8;
        targetScale = 1.05 + amp * 0.25;
        targetRing = 1.2 + amp * 3.0;
        targetParticle = 1.5 + amp * 4.0;
      } else if (st === 'ERROR') {
        targetGlow = 0.4;
        targetRing = 0.5;
        targetParticle = 0.5;
      }

      // 5. When idle/base state: subtle breathing every ~4s
      // We apply this on top of the target values so it doesn't interrupt voice reactions
      const breath = Math.sin(time / 600);
      if (st !== 'SPEAKING' && st !== 'LISTENING' && st !== 'CONNECTING') {
         targetScale *= (1 + breath * 0.02);
         targetGlow += (breath * 0.08);
      } else if (st === 'LISTENING') {
         // Slightly faster/deeper breath when listening idle
         const listenBreath = Math.sin(time / 400);
         targetScale *= (1 + listenBreath * 0.03);
         targetGlow += (listenBreath * 0.1);
      }


      // Smooth interpolations (easing)
      current.color0 = lerpColor(current.color0, hexToRgb(tColors[0]), 0.05);
      current.color1 = lerpColor(current.color1, hexToRgb(tColors[1]), 0.05);
      current.color2 = lerpColor(current.color2, hexToRgb(tColors[2]), 0.05);
      
      current.glowAlpha = lerp(current.glowAlpha, targetGlow, 0.08);
      current.orbScale = lerp(current.orbScale, targetScale, 0.1);
      current.particleSpeed = lerp(current.particleSpeed, targetParticle, 0.05);
      current.ringSpeed = lerp(current.ringSpeed, targetRing, 0.05);

      // We don't use canvas.getBoundingClientRect() every frame for performance,
      // instead we use canvas.width / dpr
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const cx = width / 2;
      const cy = height / 2;
      const baseScale = Math.min(width, height) / 600; 
      
      // Boot animations
      let bootScale = 1;
      let bootCoreAlpha = 1;
      let ringOpacities = [1, 1, 1, 1, 1];
      let particleOpacity = 1;
      let glowBloom = current.glowAlpha;

      if (isBootingCurrent) {
        // 2. Faint blue glow slowly appears (0 to 0.2)
        // 3. Orb fades in gradually (0.1 to 0.4)
        // 4. Rings initialize one by one (0.3 to 0.7)
        // 5. Small particles slowly appear (0.6 to 1.0)
        // 8. Subtle camera zoom (0.8 scale to 1.0)
        // 9. Soft bloom effect increases
        
        bootScale = lerp(0.9, 1.0, Math.pow(bootProgress, 0.5));
        
        glowBloom = lerp(0, 0.5, Math.min(1, bootProgress / 0.3)); 
        if (bootProgress > 0.8) {
           glowBloom = lerp(0.5, 0.2, (bootProgress - 0.8) / 0.2); // settles
        }

        bootCoreAlpha = Math.max(0, Math.min(1, (bootProgress - 0.1) / 0.3));
        
        ringOpacities = rings.map((_, i) => {
          const start = 0.3 + i * 0.08;
          return Math.max(0, Math.min(1, (bootProgress - start) / 0.2));
        });

        particleOpacity = Math.max(0, Math.min(1, (bootProgress - 0.6) / 0.4));
      }

      current.orbScale = current.orbScale * bootScale; // apply boot zoom

      const s = current.orbScale * baseScale;

      ctx.clearRect(0, 0, width, height);

      // 4. Soft blue/white glow around the orb
      const maxGlowRadius = (220 + current.smoothedAmplitude * 50) * s;
      const glowGrad = ctx.createRadialGradient(cx, cy, 20 * s, cx, cy, maxGlowRadius);
      glowGrad.addColorStop(0, `rgba(255, 255, 255, ${glowBloom * 0.8})`);
      glowGrad.addColorStop(0.3, `rgba(${current.color0.join(',')}, ${glowBloom * 0.5})`);
      glowGrad.addColorStop(1, `rgba(${current.color1.join(',')}, 0)`);
      
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2 & 3. Draw 5 independent rings
      rings.forEach((ring, index) => {
        // Organic micro movements and voice reactivity for rings
        const ringRipple = st === 'SPEAKING' ? Math.sin(time * 0.005 + index) * current.smoothedAmplitude * 8 : 0;
        const dynamicRadius = (ring.r + ringRipple) * s;
        
        ring.angle += ring.speed * ring.dir * current.ringSpeed;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ring.angle);
        ctx.beginPath();
        ctx.arc(0, 0, dynamicRadius, 0, Math.PI * 2);
        ctx.lineWidth = ring.width * s;
        
        const ringOp = ringOpacities[index] || 1;
        ctx.strokeStyle = `rgba(${current.color0.join(',')}, ${ring.alpha * (0.5 + glowBloom * 0.5) * ringOp})`;
        
        ctx.setLineDash(ring.dash.map(d => d * s));
        ctx.stroke();
        ctx.restore();
      });

      // 5. Draw 300+ floating particles
      particles.forEach(p => {
        p.angle += p.speed * current.particleSpeed;
        let activeRadius = p.radius;
        if (pipelineStageRef.current === 3) {
           const inwardOffset = (time * 0.1 + p.oscOffset * 50) % 200;
           activeRadius = 240 - inwardOffset;
        }
        const currentRadius = (activeRadius + Math.sin(time * p.oscSpeed + p.oscOffset) * (15 + current.smoothedAmplitude * 40)) * s;
        const px = cx + Math.cos(p.angle) * currentRadius;
        const py = cy + Math.sin(p.angle) * currentRadius;
        
        ctx.beginPath();
        ctx.arc(px, py, p.size * s, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${current.color0.join(',')}, ${p.alpha * Math.min(1, glowBloom * 1.5) * particleOpacity})`;
        ctx.fill();
      });

      // 1. Premium futuristic energy core (Solid)
      // The center energy core should pulse naturally with every syllable.
      const coreRadius = (45 + current.smoothedAmplitude * 20) * s;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, `rgba(${current.color0.join(',')}, ${bootCoreAlpha})`);
      coreGrad.addColorStop(0.8, `rgba(${current.color1.join(',')}, ${0.8 * bootCoreAlpha})`);
      coreGrad.addColorStop(1, `rgba(${current.color2.join(',')}, 0)`);

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div 
       className="relative flex items-center justify-center cursor-pointer w-[300px] h-[300px] sm:w-[500px] sm:h-[500px]" 
       onClick={onClick}
    >
       <canvas ref={canvasRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] pointer-events-none" />
       
       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center mix-blend-screen w-full h-full">
          <div className="relative">
            <motion.p 
              className="text-[40px] sm:text-[60px] font-bold tracking-[0.2em] uppercase text-transparent whitespace-nowrap"
              style={{
                backgroundImage: `radial-gradient(${coreColors[0]} 1px, transparent 1px)`,
                backgroundSize: '4px 4px',
                WebkitBackgroundClip: 'text',
                WebkitTextStroke: `1px ${coreColors[0]}`,
                textShadow: `0 0 10px ${coreColors[0]}`,
                fontFamily: 'monospace'
              }}
              animate={{ opacity: (!isBooting && (state === 'DISCONNECTED' || state === 'CONNECTING' || state === 'ERROR')) ? 0.9 : 0 }}
            >ZOYA</motion.p>
          </div>
       </div>
       <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <p className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.4em] uppercase opacity-80" style={{ color: coreColors[0], textShadow: `0 0 8px rgba(255,255,255,0.5)` }}>
            {!isBooting && (state === 'DISCONNECTED' ? 'SYSTEM OFFLINE' : state)}
          </p>
       </div>
    </div>
  );
}
