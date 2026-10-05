import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Stars } from '@react-three/drei';
import { AssistantState } from '../../types';

interface GalaxyEnvironmentProps {
  outputAnalyser?: AnalyserNode | null;
  state?: AssistantState;
}

export function GalaxyEnvironment({ outputAnalyser, state }: GalaxyEnvironmentProps) {
  const starsGroupRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Points>(null);
  const nebulaParticlesRef = useRef<THREE.Points>(null);

  // Frequency analysis buffers & smoothed values
  const freqBufferRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256));
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const rotationAccY = useRef(0);
  const rotationAccX = useRef(0);

  // Thousands of tiny subtle white stars and slow-drifting digital dust
  const cosmicDust = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);
    const radii = new Float32Array(count);

    const colorWhite = new THREE.Color('#ffffff');
    const colorCyan = new THREE.Color('#7dd3fc');
    const colorDeepCyan = new THREE.Color('#0284c7');

    for (let i = 0; i < count; i++) {
      const radius = 6 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;
      radii[i] = radius;

      const mixVal = Math.random();
      const col = mixVal < 0.65 
        ? colorWhite.clone().lerp(colorCyan, Math.random() * 0.4) 
        : colorCyan.clone().lerp(colorDeepCyan, Math.random() * 0.5);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    return { positions, originalPositions, colors, radii, count };
  }, []);

  // Dense outer orbital nebula particle cloud
  const nebulaCloud = useMemo(() => {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);

    const colorElectric = new THREE.Color('#38bdf8');
    const colorAqua = new THREE.Color('#00e5ff');
    const colorCore = new THREE.Color('#e0f2fe');

    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.7 + Math.PI / 2;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = (radius * 0.45) * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      const col = Math.random() > 0.4 
        ? colorElectric.clone().lerp(colorAqua, Math.random()) 
        : colorAqua.clone().lerp(colorCore, Math.random() * 0.5);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    return { positions, originalPositions, colors, count };
  }, []);

  useFrame((stateObj, delta) => {
    const time = stateObj.clock.elapsedTime;
    let targetBass = 0;
    let targetMid = 0;
    let targetTreble = 0;

    // Process outputAnalyser frequency data when Zoya is speaking
    if (state === 'SPEAKING' && outputAnalyser) {
      try {
        if (freqBufferRef.current.length !== outputAnalyser.frequencyBinCount) {
          freqBufferRef.current = new Uint8Array(outputAnalyser.frequencyBinCount);
        }
        outputAnalyser.getByteFrequencyData(freqBufferRef.current);

        const bins = freqBufferRef.current;
        const totalBins = bins.length;

        // 1. Bass / Low Frequency Band (~20Hz - 250Hz): Bins 1 - 8
        let bassSum = 0;
        const bassEnd = Math.min(8, totalBins - 1);
        for (let i = 1; i <= bassEnd; i++) {
          bassSum += bins[i];
        }
        targetBass = bassSum / ((bassEnd) * 255.0);

        // 2. Mid / Vocal Speech Band (~250Hz - 2500Hz): Bins 9 - 45
        let midSum = 0;
        const midEnd = Math.min(45, totalBins - 1);
        for (let i = 9; i <= midEnd; i++) {
          midSum += bins[i];
        }
        targetMid = midSum / ((midEnd - 9 + 1) * 255.0);

        // 3. Treble / High Harmonic Band (~2500Hz - 8000Hz+): Bins 46 - 128
        let trebleSum = 0;
        const trebleEnd = Math.min(128, totalBins - 1);
        for (let i = 46; i <= trebleEnd; i++) {
          trebleSum += bins[i];
        }
        targetTreble = trebleSum / ((trebleEnd - 46 + 1) * 255.0);
      } catch (e) {
        // Safe fallback
      }
    }

    // Voice-sync smoothing factors for each frequency band
    bassRef.current += (targetBass - bassRef.current) * 0.12;
    midRef.current += (targetMid - midRef.current) * 0.15;
    trebleRef.current += (targetTreble - trebleRef.current) * 0.18;

    const bass = bassRef.current;
    const mid = midRef.current;
    const treble = trebleRef.current;

    // Base rotational speed + frequency band speed multipliers during speech:
    // Treble increases high-speed shimmer rotation, Bass imparts deep vortex drive
    const dynamicRotSpeedY = 0.015 + bass * 0.12 + treble * 0.22;
    const dynamicRotSpeedX = 0.005 + mid * 0.06 + treble * 0.08;

    rotationAccY.current += dynamicRotSpeedY * delta;
    rotationAccX.current += dynamicRotSpeedX * delta;

    // 1. Cosmic Background Dust Particle Cloud
    if (dustRef.current) {
      dustRef.current.rotation.y = rotationAccY.current;
      dustRef.current.rotation.x = rotationAccX.current;

      const pMat = dustRef.current.material as THREE.PointsMaterial;
      // Adjust density and visible intensity based on vocal mid-frequencies
      pMat.size = 0.035 + mid * 0.04 + bass * 0.03;
      pMat.opacity = THREE.MathUtils.clamp(0.65 + mid * 0.35, 0.4, 1.0);
    }

    // 2. Dense Outer Orbital Nebula Cloud
    if (nebulaParticlesRef.current) {
      // Swirl in counter-direction responsive to treble and mid frequencies
      nebulaParticlesRef.current.rotation.y = -rotationAccY.current * 1.6;
      nebulaParticlesRef.current.rotation.z = Math.sin(time * 0.5) * 0.1 + treble * 0.3;

      const posArray = nebulaParticlesRef.current.geometry.attributes.position.array as Float32Array;
      const { originalPositions, count } = nebulaCloud;

      // Radial displacement and harmonic frequency excitation
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const ox = originalPositions[idx];
        const oy = originalPositions[idx + 1];
        const oz = originalPositions[idx + 2];

        const freqFactor = 1.0 + (bass * 0.22 + mid * 0.15) * Math.sin(time * 4.0 + i);
        posArray[idx] = ox * freqFactor;
        posArray[idx + 1] = oy * (1.0 + mid * 0.35 * Math.cos(time * 3.0 + i));
        posArray[idx + 2] = oz * freqFactor;
      }
      nebulaParticlesRef.current.geometry.attributes.position.needsUpdate = true;

      const nMat = nebulaParticlesRef.current.material as THREE.PointsMaterial;
      // Particle density & radiance scales with vocal harmonics
      nMat.size = 0.028 + mid * 0.05 + treble * 0.04;
      nMat.opacity = THREE.MathUtils.clamp(0.5 + mid * 0.45 + treble * 0.15, 0.3, 0.98);
    }

    // 3. Background Starfield Parallax
    if (starsGroupRef.current) {
      starsGroupRef.current.rotation.y = time * -0.004 - bass * 0.015;
    }
  });

  return (
    <group name="galaxy-environment-root">
      {/* Background Star Layers (Deep dark space, thousands of tiny white stars) */}
      <group ref={starsGroupRef} name="galaxy-stars-group">
        <Stars 
          radius={80} 
          depth={50} 
          count={6000} 
          factor={2.8} 
          saturation={0} 
          fade 
          speed={0.5} 
        />
        <Stars 
          radius={160} 
          depth={90} 
          count={4000} 
          factor={4.0} 
          saturation={0} 
          fade 
          speed={0.3} 
        />
      </group>

      {/* Cosmic Deep Dust Particles */}
      <points ref={dustRef} name="galaxy-cosmic-dust">
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={cosmicDust.count}
            array={cosmicDust.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={cosmicDust.count}
            array={cosmicDust.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          vertexColors
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Dense Reactive Nebula Particle Cloud */}
      <points ref={nebulaParticlesRef} name="galaxy-nebula-cloud">
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={nebulaCloud.count}
            array={nebulaCloud.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={nebulaCloud.count}
            array={nebulaCloud.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.032}
          vertexColors
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Deep space ambient lighting */}
      <ambientLight intensity={0.15} color="#38bdf8" />
    </group>
  );
}
