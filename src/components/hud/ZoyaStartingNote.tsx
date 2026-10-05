import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';

interface ZoyaStartingNoteProps {
  onComplete: () => void;
}

const STAR_COUNT = 48;
const ATMO_PARTICLE_COUNT = 18;
const ORBITAL_PARTICLE_COUNT = 16;

export const ZoyaStartingNote = React.memo(function ZoyaStartingNote({
  onComplete,
}: ZoyaStartingNoteProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-allocate static background starfield & subtle atmospheric dust
  const sceneData = useMemo(() => {
    const starX = new Float32Array(STAR_COUNT);
    const starY = new Float32Array(STAR_COUNT);
    const starSize = new Float32Array(STAR_COUNT);
    const starAlpha = new Float32Array(STAR_COUNT);
    const starTwinkleSpeed = new Float32Array(STAR_COUNT);
    const starPhase = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      starX[i] = Math.random();
      starY[i] = Math.random();
      starSize[i] = 0.4 + Math.random() * 0.85;
      starAlpha[i] = 0.12 + Math.random() * 0.32;
      starTwinkleSpeed[i] = 0.8 + Math.random() * 1.8;
      starPhase[i] = Math.random() * Math.PI * 2;
    }

    const atmoX = new Float32Array(ATMO_PARTICLE_COUNT);
    const atmoY = new Float32Array(ATMO_PARTICLE_COUNT);
    const atmoRadius = new Float32Array(ATMO_PARTICLE_COUNT);
    const atmoAlpha = new Float32Array(ATMO_PARTICLE_COUNT);
    const atmoSpeedY = new Float32Array(ATMO_PARTICLE_COUNT);
    const atmoSpeedX = new Float32Array(ATMO_PARTICLE_COUNT);

    for (let i = 0; i < ATMO_PARTICLE_COUNT; i++) {
      // Cluster subtly around the center area
      atmoX[i] = 0.2 + Math.random() * 0.6;
      atmoY[i] = 0.2 + Math.random() * 0.6;
      atmoRadius[i] = 1.0 + Math.random() * 1.8;
      atmoAlpha[i] = 0.08 + Math.random() * 0.16;
      atmoSpeedY[i] = -0.004 - Math.random() * 0.008;
      atmoSpeedX[i] = (Math.random() - 0.5) * 0.005;
    }

    const orbAngle = new Float32Array(ORBITAL_PARTICLE_COUNT);
    const orbSpeed = new Float32Array(ORBITAL_PARTICLE_COUNT);
    const orbRadiusX = new Float32Array(ORBITAL_PARTICLE_COUNT);
    const orbRadiusY = new Float32Array(ORBITAL_PARTICLE_COUNT);
    const orbTilt = new Float32Array(ORBITAL_PARTICLE_COUNT);
    const orbIsGold = new Uint8Array(ORBITAL_PARTICLE_COUNT);
    const orbSize = new Float32Array(ORBITAL_PARTICLE_COUNT);

    const ringRadii = [52, 78, 108, 138, 168];
    for (let i = 0; i < ORBITAL_PARTICLE_COUNT; i++) {
      const rBase = ringRadii[i % ringRadii.length];
      orbAngle[i] = (i / ORBITAL_PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      orbSpeed[i] = (i % 2 === 0 ? 1 : -1) * (0.35 + (i % 4) * 0.14);
      // Mix of horizontal perspective ellipses and circular orbits
      const isHorizontalPlane = i % 3 !== 0;
      orbRadiusX[i] = rBase;
      orbRadiusY[i] = isHorizontalPlane ? rBase * 0.28 : rBase * 0.88;
      orbTilt[i] = isHorizontalPlane ? (i % 2 === 0 ? 0.04 : -0.05) : (i * 0.4);
      orbIsGold[i] = i % 4 === 0 ? 1 : 0;
      orbSize[i] = 1.1 + (i % 3) * 0.45;
    }

    return {
      starX,
      starY,
      starSize,
      starAlpha,
      starTwinkleSpeed,
      starPhase,
      atmoX,
      atmoY,
      atmoRadius,
      atmoAlpha,
      atmoSpeedY,
      atmoSpeedX,
      orbAngle,
      orbSpeed,
      orbRadiusX,
      orbRadiusY,
      orbTilt,
      orbIsGold,
      orbSize,
    };
  }, []);

  useEffect(() => {
    const TOTAL_DURATION_MS = 3300;
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, TOTAL_DURATION_MS);

    const canvas = canvasRef.current;
    const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const updateSize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });

    const startTime = performance.now();
    let rafId: number | null = null;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
    const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      if (ctx) {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const scaleFactor = Math.min(width, height) < 500 ? 0.78 : 1.0;

        // -----------------------------------------------------------------
        // 1. DEEP SPACE BACKGROUND & ALMOST INVISIBLE SPACE HAZE
        // -----------------------------------------------------------------
        ctx.fillStyle = '#010308';
        ctx.fillRect(0, 0, width, height);

        const hazeRadius = Math.max(width, height) * 0.48;
        const bgHaze = ctx.createRadialGradient(cx, cy, 0, cx, cy, hazeRadius);
        bgHaze.addColorStop(0, 'rgba(0, 32, 64, 0.16)');
        bgHaze.addColorStop(0.45, 'rgba(2, 12, 28, 0.08)');
        bgHaze.addColorStop(1, 'rgba(1, 3, 8, 0)');
        ctx.fillStyle = bgHaze;
        ctx.fillRect(0, 0, width, height);

        // Very subtle tiny stars with slow parallax drift
        const {
          starX,
          starY,
          starSize,
          starAlpha,
          starTwinkleSpeed,
          starPhase,
          atmoX,
          atmoY,
          atmoRadius,
          atmoAlpha,
          atmoSpeedY,
          atmoSpeedX,
          orbAngle,
          orbSpeed,
          orbRadiusX,
          orbRadiusY,
          orbTilt,
          orbIsGold,
          orbSize,
        } = sceneData;

        for (let i = 0; i < STAR_COUNT; i++) {
          const sx = ((starX[i] + elapsed * 0.0008 * ((i % 3) + 1)) % 1) * width;
          const sy = starY[i] * height;
          const twinkle = 0.65 + 0.35 * Math.sin(elapsed * starTwinkleSpeed[i] + starPhase[i]);
          const alpha = starAlpha[i] * twinkle;

          ctx.fillStyle = i % 5 === 0 ? `rgba(165, 243, 252, ${alpha.toFixed(3)})` : `rgba(226, 232, 240, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(sx, sy, starSize[i], 0, Math.PI * 2);
          ctx.fill();
        }

        // Extremely subtle blue atmospheric particles
        for (let i = 0; i < ATMO_PARTICLE_COUNT; i++) {
          const ax = ((atmoX[i] + elapsed * atmoSpeedX[i] + 1) % 1) * width;
          const ay = ((atmoY[i] + elapsed * atmoSpeedY[i] + 1) % 1) * height;
          const aAlpha = atmoAlpha[i] * (0.6 + 0.4 * Math.sin(elapsed * 1.1 + i));

          const pGrad = ctx.createRadialGradient(ax, ay, 0, ax, ay, atmoRadius[i] * 2.5);
          pGrad.addColorStop(0, `rgba(56, 189, 248, ${aAlpha.toFixed(3)})`);
          pGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(ax, ay, atmoRadius[i] * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // -----------------------------------------------------------------
        // PHASE TIMINGS
        // Phase 1 (AWAKEN): 0.0s -> 1.05s
        //   - Center point ignites (0.05s -> 0.45s)
        //   - Vertical cyan light beam emerges (0.20s -> 0.95s)
        //   - Thin horizontal holographic ring forms (0.35s -> 1.05s)
        // Phase 2 (ENERGY FORMATION): 0.85s -> 2.60s
        //   - Concentric thin cyan rings & subtle gold accents appear
        //   - Small orbital particles & faint radial energy emerge
        // Phase 3 (STABILIZATION): 2.40s -> 3.30s
        // -----------------------------------------------------------------
        const pPoint = easeOutCubic((elapsed - 0.05) / 0.45);
        const pBeam = easeInOutSine((elapsed - 0.18) / 0.80);
        const pHorizRing = easeOutCubic((elapsed - 0.35) / 0.75);
        const pFormation = easeOutCubic((elapsed - 0.85) / 1.45);
        const pGoldAccents = easeOutCubic((elapsed - 1.15) / 1.35);
        const pRadialEnergy = easeInOutSine((elapsed - 1.0) / 1.3);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scaleFactor, scaleFactor);

        // -----------------------------------------------------------------
        // 2. FAINT RADIAL ENERGY & CORE ATMOSPHERIC GLOW
        // -----------------------------------------------------------------
        if (pPoint > 0.01) {
          const coreGlowRadius = 45 + pFormation * 75;
          const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, coreGlowRadius);
          coreGlow.addColorStop(0, `rgba(0, 229, 255, ${(0.22 * pPoint).toFixed(3)})`);
          coreGlow.addColorStop(0.35, `rgba(14, 165, 233, ${(0.09 * pPoint).toFixed(3)})`);
          coreGlow.addColorStop(0.7, `rgba(2, 132, 199, ${(0.03 * pFormation).toFixed(3)})`);
          coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = coreGlow;
          ctx.beginPath();
          ctx.arc(0, 0, coreGlowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Faint radial energy filaments (Phase 2)
        if (pRadialEnergy > 0.01) {
          const rayCount = 16;
          ctx.save();
          ctx.rotate(elapsed * 0.08);
          for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.2 + i * 0.9);
            const innerR = 18 + (i % 2) * 8;
            const outerR = innerR + (24 + pulse * 26) * pRadialEnergy;
            const isGoldRay = i % 4 === 0;
            const alpha = (isGoldRay ? 0.14 : 0.16) * pRadialEnergy * (0.6 + 0.4 * pulse);

            ctx.strokeStyle = isGoldRay
              ? `rgba(255, 213, 79, ${alpha.toFixed(3)})`
              : `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.65;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
            ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
            ctx.stroke();
          }
          ctx.restore();
        }

        // -----------------------------------------------------------------
        // 3. PHASE 1: THIN VERTICAL CYAN LIGHT BEAM
        // -----------------------------------------------------------------
        if (pBeam > 0.01) {
          const beamHalfHeight = (38 + pBeam * 145) * (1 + 0.03 * Math.sin(elapsed * 3.2));
          const beamAlpha = (0.65 + 0.15 * Math.sin(elapsed * 4.0)) * pBeam;

          // Soft outer vertical beam bloom
          const vBloomGrad = ctx.createLinearGradient(0, -beamHalfHeight, 0, beamHalfHeight);
          vBloomGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
          vBloomGrad.addColorStop(0.35, `rgba(0, 229, 255, ${(beamAlpha * 0.18).toFixed(3)})`);
          vBloomGrad.addColorStop(0.5, `rgba(186, 230, 253, ${(beamAlpha * 0.45).toFixed(3)})`);
          vBloomGrad.addColorStop(0.65, `rgba(0, 229, 255, ${(beamAlpha * 0.18).toFixed(3)})`);
          vBloomGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

          ctx.fillStyle = vBloomGrad;
          ctx.fillRect(-3.5, -beamHalfHeight, 7, beamHalfHeight * 2);

          // Razor-sharp vertical core line
          const vCoreGrad = ctx.createLinearGradient(0, -beamHalfHeight, 0, beamHalfHeight);
          vCoreGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
          vCoreGrad.addColorStop(0.2, `rgba(0, 229, 255, ${(beamAlpha * 0.45).toFixed(3)})`);
          vCoreGrad.addColorStop(0.5, `rgba(255, 255, 255, ${(beamAlpha * 0.95).toFixed(3)})`);
          vCoreGrad.addColorStop(0.8, `rgba(0, 229, 255, ${(beamAlpha * 0.45).toFixed(3)})`);
          vCoreGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

          ctx.strokeStyle = vCoreGrad;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(0, -beamHalfHeight);
          ctx.lineTo(0, beamHalfHeight);
          ctx.stroke();
        }

        // -----------------------------------------------------------------
        // 4. PHASE 1: THIN HORIZONTAL HOLOGRAPHIC RING (ORBITAL PLANE)
        // -----------------------------------------------------------------
        if (pHorizRing > 0.01) {
          const hRadiusX = 36 + pHorizRing * 105;
          const hRadiusY = hRadiusX * 0.22;

          // Subtle horizontal equator glow line
          const hGlowGrad = ctx.createLinearGradient(-hRadiusX * 1.15, 0, hRadiusX * 1.15, 0);
          hGlowGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
          hGlowGrad.addColorStop(0.3, `rgba(0, 229, 255, ${(0.22 * pHorizRing).toFixed(3)})`);
          hGlowGrad.addColorStop(0.5, `rgba(224, 242, 254, ${(0.48 * pHorizRing).toFixed(3)})`);
          hGlowGrad.addColorStop(0.7, `rgba(0, 229, 255, ${(0.22 * pHorizRing).toFixed(3)})`);
          hGlowGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

          ctx.strokeStyle = hGlowGrad;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(-hRadiusX * 1.15, 0);
          ctx.lineTo(hRadiusX * 1.15, 0);
          ctx.stroke();

          // Primary horizontal perspective holographic ring
          ctx.save();
          ctx.strokeStyle = `rgba(0, 229, 255, ${(0.58 * pHorizRing).toFixed(3)})`;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.ellipse(0, 0, hRadiusX, hRadiusY, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Rotating segmented inner horizontal ring
          ctx.setLineDash([18, 10, 6, 10]);
          ctx.lineDashOffset = -elapsed * 28;
          ctx.strokeStyle = `rgba(125, 211, 252, ${(0.42 * pHorizRing).toFixed(3)})`;
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.ellipse(0, 0, hRadiusX * 0.68, hRadiusY * 0.68, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // -----------------------------------------------------------------
        // 5. PHASE 2: ENERGY FORMATION — CONCENTRIC & ORBITAL RINGS
        // -----------------------------------------------------------------
        if (pFormation > 0.01) {
          // Ring A: Inner crisp cyan containment circle
          const rA = 28 * (0.7 + 0.3 * pFormation);
          ctx.save();
          ctx.rotate(elapsed * 0.45);
          ctx.strokeStyle = `rgba(186, 230, 253, ${(0.52 * pFormation).toFixed(3)})`;
          ctx.lineWidth = 0.9;
          ctx.setLineDash([14, 6, 4, 6]);
          ctx.beginPath();
          ctx.arc(0, 0, rA, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Ring B: Counter-rotating thin cyan precision ring
          const rB = 52 * (0.75 + 0.25 * pFormation);
          ctx.save();
          ctx.rotate(-elapsed * 0.32);
          ctx.strokeStyle = `rgba(0, 229, 255, ${(0.38 * pFormation).toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([36, 18, 8, 18]);
          ctx.beginPath();
          ctx.arc(0, 0, rB, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Ring C: Subtle warm gold accent ring (Phase 2 highlight)
          if (pGoldAccents > 0.01) {
            const rC = 76 * (0.8 + 0.2 * pGoldAccents);
            ctx.save();
            ctx.rotate(elapsed * 0.26);
            ctx.strokeStyle = `rgba(255, 213, 79, ${(0.34 * pGoldAccents).toFixed(3)})`;
            ctx.lineWidth = 0.85;
            ctx.setLineDash([22, 28, 6, 28]);
            ctx.beginPath();
            ctx.arc(0, 0, rC, 0, Math.PI * 2);
            ctx.stroke();

            // Tilted gold perspective ellipse
            ctx.setLineDash([30, 20]);
            ctx.lineDashOffset = elapsed * 22;
            ctx.strokeStyle = `rgba(251, 191, 36, ${(0.28 * pGoldAccents).toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.ellipse(0, 0, rC * 1.28, rC * 0.34, -0.12, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }

          // Ring D: Outer fine holographic telemetry circle
          const rD = 106 * (0.82 + 0.18 * pFormation);
          ctx.save();
          ctx.rotate(-elapsed * 0.18);
          ctx.strokeStyle = `rgba(56, 189, 248, ${(0.26 * pFormation).toFixed(3)})`;
          ctx.lineWidth = 0.7;
          ctx.setLineDash([3, 9]);
          ctx.beginPath();
          ctx.arc(0, 0, rD, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Ring E: Wide outer orbital horizon ellipse
          const rE = 168 * (0.85 + 0.15 * pFormation);
          ctx.save();
          ctx.strokeStyle = `rgba(0, 229, 255, ${(0.24 * pFormation).toFixed(3)})`;
          ctx.lineWidth = 0.75;
          ctx.setLineDash([48, 24, 10, 24]);
          ctx.lineDashOffset = -elapsed * 32;
          ctx.beginPath();
          ctx.ellipse(0, 0, rE, rE * 0.24, 0.05, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Small orbital particles gliding along the quantum rings
          for (let i = 0; i < ORBITAL_PARTICLE_COUNT; i++) {
            const curAngle = orbAngle[i] + elapsed * orbSpeed[i];
            const rx = orbRadiusX[i] * (0.75 + 0.25 * pFormation);
            const ry = orbRadiusY[i] * (0.75 + 0.25 * pFormation);
            const tilt = orbTilt[i];

            const localX = Math.cos(curAngle) * rx;
            const localY = Math.sin(curAngle) * ry;

            const px = localX * Math.cos(tilt) - localY * Math.sin(tilt);
            const py = localX * Math.sin(tilt) + localY * Math.cos(tilt);

            const isGold = orbIsGold[i] === 1;
            const particleAlpha = (isGold ? pGoldAccents : pFormation) * (0.65 + 0.35 * Math.sin(elapsed * 3 + i));

            if (particleAlpha > 0.02) {
              const pRadius = orbSize[i];
              const glow = ctx.createRadialGradient(px, py, 0, px, py, pRadius * 3.2);
              if (isGold) {
                glow.addColorStop(0, `rgba(255, 248, 225, ${particleAlpha.toFixed(3)})`);
                glow.addColorStop(0.4, `rgba(255, 213, 79, ${(particleAlpha * 0.65).toFixed(3)})`);
                glow.addColorStop(1, 'rgba(255, 213, 79, 0)');
              } else {
                glow.addColorStop(0, `rgba(224, 242, 254, ${particleAlpha.toFixed(3)})`);
                glow.addColorStop(0.4, `rgba(0, 229, 255, ${(particleAlpha * 0.7).toFixed(3)})`);
                glow.addColorStop(1, 'rgba(0, 229, 255, 0)');
              }
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(px, py, pRadius * 3.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        // -----------------------------------------------------------------
        // 6. PHASE 1 -> 3: CENTRAL SINGULARITY POINT
        // -----------------------------------------------------------------
        if (pPoint > 0.01) {
          const pulse = 1 + 0.12 * Math.sin(elapsed * 4.2);
          const innerBloomRadius = (14 + pFormation * 8) * pulse;

          const innerBloom = ctx.createRadialGradient(0, 0, 0, 0, 0, innerBloomRadius);
          innerBloom.addColorStop(0, `rgba(255, 255, 255, ${(0.98 * pPoint).toFixed(3)})`);
          innerBloom.addColorStop(0.28, `rgba(125, 211, 252, ${(0.82 * pPoint).toFixed(3)})`);
          innerBloom.addColorStop(0.65, `rgba(0, 229, 255, ${(0.32 * pPoint).toFixed(3)})`);
          innerBloom.addColorStop(1, 'rgba(0, 229, 255, 0)');

          ctx.fillStyle = innerBloom;
          ctx.beginPath();
          ctx.arc(0, 0, innerBloomRadius, 0, Math.PI * 2);
          ctx.fill();

          // Crisp brilliant white-cyan singularity core
          ctx.fillStyle = `rgba(255, 255, 255, ${pPoint.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(0, 0, 2.6 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateSize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [sceneData]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: 'transform, opacity' }}
      className="fixed inset-0 z-50 bg-[#010308] overflow-hidden select-none pointer-events-auto"
    >
      {/* Full-Screen High-DPI Quantum Core & Deep Space Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Minimal Elegant Upper-Left ZOYA Identifier */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.15 }}
        className="fixed top-6 left-6 sm:top-8 sm:left-9 z-10 flex items-center gap-2.5 pointer-events-none"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff]" />
        <span className="text-[10px] sm:text-[11px] font-light tracking-[0.55em] text-cyan-100/85 drop-shadow-[0_0_8px_rgba(0,229,255,0.4)] uppercase">
          Z O Y A
        </span>
      </motion.div>
    </motion.div>
  );
});
