import React, { useEffect, useRef } from 'react';
import { AssistantState } from '../types';

interface Props {
  state: AssistantState;
  isBooting: boolean;
}

export function AILivingEnvironment({ state, isBooting }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Configuration
    const fogOrbs = [
      { x: 0.3, y: 0.3, vx: 0.0005, vy: 0.0007, r: 0.6, color: [0, 180, 255] },
      { x: 0.7, y: 0.6, vx: -0.0006, vy: 0.0004, r: 0.7, color: [0, 100, 200] },
      { x: 0.5, y: 0.8, vx: 0.0004, vy: -0.0005, r: 0.8, color: [0, 200, 220] },
    ];

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      life: number;
      maxLife: number;
      opacity: number;
      isSpark: boolean;
      orbitAngle?: number;
      orbitRadius?: number;
      orbitSpeed?: number;
      isOrbiting: boolean;
    }

    const particles: Particle[] = [];
    const MAX_PARTICLES = 150;

    const createParticle = (isSpark = false): Particle => {
      const isOrbiting = Math.random() > 0.7;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5 - (isSpark ? 1 : 0.2), // Sparks go up
        size: isSpark ? Math.random() * 1.5 + 1 : Math.random() * 2 + 0.5,
        life: 0,
        maxLife: isSpark ? 100 + Math.random() * 100 : 300 + Math.random() * 500,
        opacity: isSpark ? 0.8 : Math.random() * 0.3 + 0.1,
        isSpark,
        isOrbiting,
        orbitAngle: isOrbiting ? Math.random() * Math.PI * 2 : undefined,
        orbitRadius: isOrbiting ? 100 + Math.random() * 200 : undefined,
        orbitSpeed: isOrbiting ? (Math.random() * 0.01 + 0.005) * (Math.random() > 0.5 ? 1 : -1) : undefined,
      };
    };

    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles.push(createParticle());
      particles[i].life = Math.random() * particles[i].maxLife; // random initial life
    }

    interface Wave {
      radius: number;
      maxRadius: number;
      opacity: number;
      speed: number;
    }
    const waves: Wave[] = [];

    // Micro details
    let time = 0;
    let lastSparkTime = 0;
    let lastWaveTime = 0;
    
    // Core Lighting State
    let targetCoreGlow = 0.2;
    let currentCoreGlow = 0.2;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let isReducedMotion = mediaQuery.matches;
    const updateMotion = (e: MediaQueryListEvent) => { isReducedMotion = e.matches; };
    mediaQuery.addEventListener('change', updateMotion);

    const render = () => {
      // Pause when hidden
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      if (isBooting) {
         ctx.clearRect(0, 0, width, height);
         animationFrameId = requestAnimationFrame(render);
         return;
      }
      
      const st = stateRef.current;
      const speedMultiplier = isReducedMotion ? 0.2 : 1;
      
      time += speedMultiplier;
      
      // Update targets based on state
      if (st === 'SPEAKING') {
        targetCoreGlow = 0.6 + Math.sin(time * 0.1) * 0.1;
      } else if (st === 'THINKING') {
        targetCoreGlow = 0.4 + Math.sin(time * 0.05) * 0.2;
      } else if (st === 'LISTENING') {
        targetCoreGlow = 0.3 + Math.sin(time * 0.02) * 0.1;
      } else {
        targetCoreGlow = 0.15 + Math.sin(time * 0.02) * 0.05; // Idle breathing
      }
      
      currentCoreGlow += (targetCoreGlow - currentCoreGlow) * 0.05;

      ctx.clearRect(0, 0, width, height);
      
      const cx = width / 2;
      const cy = height / 2 - 20; // roughly match orb position

      // 1. Draw Volumetric Fog
      fogOrbs.forEach(orb => {
        orb.x += orb.vx * speedMultiplier;
        orb.y += orb.vy * speedMultiplier;
        
        if (orb.x < 0 || orb.x > 1) orb.vx *= -1;
        if (orb.y < 0 || orb.y > 1) orb.vy *= -1;
        
        const px = orb.x * width;
        const py = orb.y * height;
        const radius = orb.r * Math.max(width, height);
        
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        const intensity = 0.05 + currentCoreGlow * 0.02;
        grad.addColorStop(0, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, ${intensity})`);
        grad.addColorStop(1, `rgba(${orb.color[0]}, ${orb.color[1]}, ${orb.color[2]}, 0)`);
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      });

      // 2. Core Ambient Illumination
      const coreLightRadius = (300 + currentCoreGlow * 200);
      const coreGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, coreLightRadius);
      coreGrad.addColorStop(0, `rgba(0, 200, 255, ${currentCoreGlow * 0.4})`);
      coreGrad.addColorStop(1, `rgba(0, 100, 200, 0)`);
      ctx.fillStyle = coreGrad;
      ctx.fillRect(0, 0, width, height);

      // 3. Energy Waves
      if (st === 'SPEAKING' || st === 'THINKING') {
        if (time - lastWaveTime > (st === 'SPEAKING' ? 60 : 120)) {
          waves.push({ radius: 50, maxRadius: Math.max(width, height) * 0.8, opacity: 0.3 * currentCoreGlow, speed: st === 'SPEAKING' ? 3 : 1.5 });
          lastWaveTime = time;
        }
      }

      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.radius += w.speed * speedMultiplier;
        w.opacity -= w.opacity * 0.01 * speedMultiplier;
        
        if (w.opacity <= 0.01 || w.radius > w.maxRadius) {
          waves.splice(i, 1);
          continue;
        }
        
        ctx.beginPath();
        ctx.arc(cx, cy, w.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 220, 255, ${w.opacity})`;
        ctx.lineWidth = 1 + w.radius * 0.005;
        ctx.stroke();
      }

      // 4. Sparks (Micro details)
      if (Math.random() > (st === 'SPEAKING' ? 0.95 : 0.99)) {
        if (time - lastSparkTime > 30) {
          if (particles.length < MAX_PARTICLES + 20) {
            particles.push(createParticle(true));
          } else {
            // Replace an existing normal particle
            const idx = Math.floor(Math.random() * MAX_PARTICLES);
            particles[idx] = createParticle(true);
          }
          lastSparkTime = time;
        }
      }

      // 5. Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += speedMultiplier;
        
        if (p.life > p.maxLife) {
          particles[i] = createParticle(false);
          continue;
        }
        
        let px = p.x;
        let py = p.y;
        
        if (p.isOrbiting && p.orbitAngle !== undefined && p.orbitRadius !== undefined && p.orbitSpeed !== undefined) {
           p.orbitAngle += p.orbitSpeed * (1 + currentCoreGlow);
           // Slight inward/outward wobble
           const wobble = Math.sin(time * 0.05 + p.life * 0.1) * 20;
           px = cx + Math.cos(p.orbitAngle) * (p.orbitRadius + wobble);
           py = cy + Math.sin(p.orbitAngle) * (p.orbitRadius + wobble);
           // Move center slowly
           p.x += p.vx * 0.5 * speedMultiplier;
           p.y += p.vy * 0.5 * speedMultiplier;
        } else {
           p.x += p.vx * (1 + currentCoreGlow * 2) * speedMultiplier;
           p.y += p.vy * (1 + currentCoreGlow * 2) * speedMultiplier;
           px = p.x;
           py = p.y;
        }
        
        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Fade in and out
        let currentOpacity = p.opacity;
        const halfLife = p.maxLife / 2;
        if (p.life < 30) {
          currentOpacity = (p.life / 30) * p.opacity;
        } else if (p.life > p.maxLife - 30) {
          currentOpacity = ((p.maxLife - p.life) / 30) * p.opacity;
        }
        
        // Near orb lighting boost
        const distToCenter = Math.hypot(px - cx, py - cy);
        let lightBoost = 0;
        if (distToCenter < 200) {
           lightBoost = (1 - distToCenter / 200) * currentCoreGlow;
        }

        ctx.beginPath();
        ctx.arc(px, py, p.size + lightBoost * 2, 0, Math.PI * 2);
        
        if (p.isSpark) {
          ctx.fillStyle = `rgba(150, 240, 255, ${currentOpacity})`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
        } else {
          ctx.fillStyle = `rgba(0, 200, 255, ${currentOpacity + lightBoost * 0.5})`;
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      mediaQuery.removeEventListener('change', updateMotion);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isBooting]);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#000508] transition-opacity duration-1000" style={{ opacity: isBooting ? 0 : 1 }}>
      {/* Layer 1: Animated gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#000510] via-[#001018] to-[#000000] opacity-80 animate-gradient" />
      
      {/* Layer 2, 3, Energy, Micro Details: Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Layer 4: Scanlines */}
      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] animate-scan" />
      
      {/* Layer 5: Noise */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-screen" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
    </div>
  );
}
