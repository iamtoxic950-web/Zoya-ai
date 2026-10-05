import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AssistantState } from '../types';

// Procedural 3D Simplex noise for smooth holographic displacement
const noiseGLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0);
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const JarvisCoreShader = {
  uniforms: {
    time: { value: 0 },
    amplitude: { value: 0 },
    colorCore: { value: new THREE.Color('#ffffff') },
    colorMid: { value: new THREE.Color('#00e5ff') },
    colorEdge: { value: new THREE.Color('#0284c7') },
    modePulse: { value: 1.0 }
  },
  vertexShader: `
    ${noiseGLSL}
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vNoise;
    uniform float time;
    uniform float amplitude;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      
      float n1 = snoise(position * 2.5 + time * 0.5);
      float n2 = snoise(position * 5.0 - time * 0.8) * 0.5;
      float totalNoise = n1 + n2;
      vNoise = totalNoise;

      float displacement = totalNoise * (0.08 + amplitude * 0.48);
      vec3 pos = position + normal * displacement;
      vPosition = pos;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    varying float vNoise;
    uniform float time;
    uniform float amplitude;
    uniform vec3 colorCore;
    uniform vec3 colorMid;
    uniform vec3 colorEdge;
    uniform float modePulse;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = clamp(1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
      float fresnelPower = pow(fresnel, 2.2);

      // Arc-reactor hexagonal lattice overlay
      vec2 grid = abs(fract(vUv * 24.0 - 0.5) - 0.5) / fwidth(vUv * 24.0);
      float line = min(grid.x, grid.y);
      float hexPattern = 1.0 - min(line, 1.0);

      vec3 color = mix(colorCore, colorMid, fresnelPower * 0.75 + vNoise * 0.2);
      color = mix(color, colorEdge, pow(fresnel, 1.3));
      
      // Arc energy intensity
      color += colorCore * (amplitude * 0.6 * (1.0 - fresnelPower));
      color += colorMid * (amplitude * 0.75 * fresnelPower);
      color += hexPattern * colorMid * 0.25;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const JarvisAuraShader = {
  uniforms: {
    time: { value: 0 },
    amplitude: { value: 0 },
    auraColor: { value: new THREE.Color('#00e5ff') },
  },
  vertexShader: `
    ${noiseGLSL}
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform float time;
    uniform float amplitude;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      float n = snoise(position * 1.8 - time * 0.4);
      vec3 pos = position + normal * n * (0.16 + amplitude * 0.65);
      vPos = pos;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPos;
    uniform vec3 auraColor;
    uniform float amplitude;
    uniform float time;

    void main() {
      float fresnel = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
      float alpha = clamp(fresnel * (0.4 + amplitude * 0.8), 0.0, 0.95);
      gl_FragColor = vec4(auraColor, alpha);
    }
  `,
  transparent: true,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false
};

interface AICoreProps {
  state: AssistantState;
  analyser?: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  toggleConnection: () => void;
}

export const AICore = React.memo(function AICore({ state, analyser, outputAnalyser, toggleConnection }: AICoreProps) {
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const jarvisRingsGroupRef = useRef<THREE.Group>(null);
  const radialEqualizerGroupRef = useRef<THREE.Group>(null);
  const wireframeGroupRef = useRef<THREE.Group>(null);
  const raysRef = useRef<THREE.Group>(null);
  const coreGlowLight = useRef<THREE.PointLight>(null);

  // Smooth interpolation state references
  const amplitudeRef = useRef(0);
  const bassRef = useRef(0);
  const midRef = useRef(0);
  const trebleRef = useRef(0);
  const scaleRef = useRef(1);
  const timeDataBuffer = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(512));
  const freqDataBuffer = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(256));

  // Holographic Particle Swarm (Neutral brightness base so material color cleanly tints to Purple/White/Golden/Cyan)
  const particleData = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const r = 1.5 + Math.pow(Math.random(), 1.6) * 3.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const brightness = 0.85 + Math.random() * 0.15;
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness;
      colors[i * 3 + 2] = brightness;
    }
    return { positions, colors, count };
  }, []);

  // Marvel JARVIS Concentric Segmented Caliper Arcs
  const jarvisArcsData = useMemo(() => {
    return [
      // Inner Primary Arc Reactor Caliper
      { radius: 1.35, segments: 4, width: 0.02, speed: 1.2, rotX: 0.3, rotY: 0.1, arcLength: 1.1, color: '#00e5ff' },
      // Counter-rotating High-Precision Ring
      { radius: 1.55, segments: 6, width: 0.015, speed: -1.5, rotX: -0.5, rotY: 0.4, arcLength: 0.75, color: '#38bdf8' },
      // Middle Gyroscopic Telemetry Caliper
      { radius: 1.85, segments: 8, width: 0.018, speed: 1.8, rotX: 0.8, rotY: -0.3, arcLength: 0.55, color: '#ffd54f' },
      // Outer Angular Reticle Ring
      { radius: 2.15, segments: 12, width: 0.012, speed: -0.9, rotX: 0.1, rotY: 1.2, arcLength: 0.35, color: '#00e5ff' },
      // Far Orbital Compass Ring
      { radius: 2.50, segments: 6, width: 0.014, speed: 0.6, rotX: -1.1, rotY: -0.7, arcLength: 0.85, color: '#22d3ee' },
      // Outer Perimeter Halo
      { radius: 2.85, segments: 3, width: 0.008, speed: -0.4, rotX: 0.4, rotY: 0.6, arcLength: 1.6, color: '#38bdf8' }
    ];
  }, []);

  // Radial Equalizer Waveform Needles (Marvel Sound Radar)
  const radialNeedles = useMemo(() => {
    const count = 36;
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        angle,
        x: Math.cos(angle) * 1.45,
        y: Math.sin(angle) * 1.45,
        rotZ: angle
      };
    });
  }, []);

  // Energy Calculation Rays
  const raysData = useMemo(() => {
    return Array.from({ length: 24 }).map(() => ({
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      baseLength: 1.9 + Math.random() * 2.4,
      speed: 0.8 + Math.random() * 1.2,
      baseOpacity: 0.2 + Math.random() * 0.3
    }));
  }, []);

  useFrame((stateObj) => {
    const time = stateObj.clock.elapsedTime;
    let targetAmplitude = 0;
    let targetBass = 0;
    let targetMid = 0;
    let targetTreble = 0;

    // 1. Audio Frequency Processing
    if (state === 'SPEAKING' && outputAnalyser) {
      try {
        if (timeDataBuffer.current.length !== outputAnalyser.fftSize) {
          timeDataBuffer.current = new Uint8Array(outputAnalyser.fftSize);
        }
        outputAnalyser.getByteTimeDomainData(timeDataBuffer.current);
        
        let sumSquares = 0;
        const len = timeDataBuffer.current.length;
        for (let i = 0; i < len; i++) {
          const norm = (timeDataBuffer.current[i] - 128) / 128.0;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / len);

        if (freqDataBuffer.current.length !== outputAnalyser.frequencyBinCount) {
          freqDataBuffer.current = new Uint8Array(outputAnalyser.frequencyBinCount);
        }
        outputAnalyser.getByteFrequencyData(freqDataBuffer.current);
        
        const binCount = freqDataBuffer.current.length;
        let bSum = 0;
        const bEnd = Math.min(8, binCount - 1);
        for (let i = 1; i <= bEnd; i++) bSum += freqDataBuffer.current[i];
        targetBass = bSum / (bEnd * 255.0);

        let mSum = 0;
        const mEnd = Math.min(45, binCount - 1);
        for (let i = 9; i <= mEnd; i++) mSum += freqDataBuffer.current[i];
        targetMid = mSum / ((mEnd - 9 + 1) * 255.0);

        let tSum = 0;
        const tEnd = Math.min(128, binCount - 1);
        for (let i = 46; i <= tEnd; i++) tSum += freqDataBuffer.current[i];
        targetTreble = tSum / ((tEnd - 46 + 1) * 255.0);

        targetAmplitude = Math.min(1.0, rms * 3.6 + targetMid * 0.8);
        if (targetAmplitude < 0.02) targetAmplitude = 0;
      } catch (e) {
        targetAmplitude = 0;
      }
    } else if (state === 'LISTENING' && analyser) {
      try {
        if (freqDataBuffer.current.length !== analyser.frequencyBinCount) {
          freqDataBuffer.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqDataBuffer.current);
        let sum = 0;
        for (let i = 2; i < 32; i++) sum += freqDataBuffer.current[i];
        const micLevel = sum / (30 * 255.0);
        targetAmplitude = micLevel * 0.8;
      } catch (e) {}
    } else if (state === 'THINKING') {
      // Golden quantum pulse when computing
      targetAmplitude = 0.28 + Math.sin(time * 8.0) * 0.18;
      targetMid = 0.4 + Math.sin(time * 6.0) * 0.2;
      targetTreble = 0.5 + Math.cos(time * 10.0) * 0.3;
    }

    // Dynamic smoothing
    amplitudeRef.current += (targetAmplitude - amplitudeRef.current) * 0.16;
    bassRef.current += (targetBass - bassRef.current) * 0.14;
    midRef.current += (targetMid - midRef.current) * 0.18;
    trebleRef.current += (targetTreble - trebleRef.current) * 0.20;

    const amp = amplitudeRef.current;
    const bass = bassRef.current;
    const mid = midRef.current;
    const treble = trebleRef.current;

    // Dynamic Scale
    const targetScale = state === 'THINKING' 
      ? 1.05 + Math.sin(time * 5.0) * 0.06 
      : 1.0 + amp * 0.42 + (state === 'SPEAKING' ? Math.sin(time * 6.0) * amp * 0.05 : 0);
    scaleRef.current += (targetScale - scaleRef.current) * 0.15;
    const currentScale = scaleRef.current;

    // Colors according to State
    const isSpeaking = state === 'SPEAKING';
    const isThinking = state === 'THINKING';
    const isListening = state === 'LISTENING';
    const isError = state === 'ERROR';

    // 1. Inner Core Shader Update
    if (innerRef.current) {
      innerRef.current.scale.set(currentScale, currentScale, currentScale);
      innerRef.current.rotation.y = time * (isThinking ? 1.2 : (0.28 + amp * 0.9));
      innerRef.current.rotation.x = time * (isThinking ? 0.8 : (0.16 + amp * 0.45));
      
      const mat = innerRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.amplitude.value = amp;

      if (isError) {
        mat.uniforms.colorCore.value.setHex(0xffffff);
        mat.uniforms.colorMid.value.setHex(0xff3b30);
        mat.uniforms.colorEdge.value.setHex(0x990000);
      } else if (isThinking) {
        // THINKING: Neural Purple
        mat.uniforms.colorCore.value.setHex(0xf3e8ff);
        mat.uniforms.colorMid.value.setHex(0xa855f7);
        mat.uniforms.colorEdge.value.setHex(0x6b21a8);
      } else if (isSpeaking) {
        // SPEAKING: Pure Brilliant White
        mat.uniforms.colorCore.value.setHex(0xffffff);
        mat.uniforms.colorMid.value.setHex(0xf8fafc);
        mat.uniforms.colorEdge.value.setHex(0xcbd5e1);
      } else if (isListening) {
        // LISTENING: Luminous Golden
        mat.uniforms.colorCore.value.setHex(0xfff8e1);
        mat.uniforms.colorMid.value.setHex(0xffb300);
        mat.uniforms.colorEdge.value.setHex(0xf57c00);
      } else {
        // Resting Standby
        mat.uniforms.colorCore.value.setHex(0xffffff);
        mat.uniforms.colorMid.value.setHex(0x00e5ff);
        mat.uniforms.colorEdge.value.setHex(0x0369a1);
      }
    }

    // 2. Outer Energy Field
    if (outerRef.current) {
      const outerScale = currentScale * 1.34;
      outerRef.current.scale.set(outerScale, outerScale, outerScale);
      const mat = outerRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.time.value = time;
      mat.uniforms.amplitude.value = amp;
      
      if (isError) {
        mat.uniforms.auraColor.value.setHex(0xff453a);
      } else if (isThinking) {
        mat.uniforms.auraColor.value.setHex(0xa855f7);
      } else if (isSpeaking) {
        mat.uniforms.auraColor.value.setHex(0xffffff);
      } else if (isListening) {
        mat.uniforms.auraColor.value.setHex(0xffca28);
      } else {
        mat.uniforms.auraColor.value.setHex(0x00e5ff);
      }
    }

    // 3. JARVIS Segmented Caliper Arcs & Gyroscopes
    if (jarvisRingsGroupRef.current) {
      const ringMultiplier = isThinking ? 3.5 : (1.0 + amp * 4.0);
      jarvisRingsGroupRef.current.children.forEach((child, i) => {
        const ringMesh = child as THREE.Mesh;
        const rData = jarvisArcsData[i];
        if (!rData) return;

        const dynamicSpeed = rData.speed * ringMultiplier;
        ringMesh.rotation.z += dynamicSpeed * 0.008;
        ringMesh.rotation.y += dynamicSpeed * 0.004;

        const ringExpansion = 1.0 + (isThinking ? 0.08 * Math.sin(time * 6.0 + i) : amp * (0.15 + i * 0.05));
        ringMesh.scale.set(ringExpansion, ringExpansion, ringExpansion);

        const mat = ringMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.clamp(
          (isThinking ? 0.85 : 0.65) + amp * 0.35,
          0.2, 
          0.98
        );
        if (isThinking) {
          mat.color.setHex(0xc084fc);
        } else if (isSpeaking) {
          mat.color.setHex(0xffffff);
        } else if (isListening) {
          mat.color.setHex(0xffd54f);
        } else if (isError) {
          mat.color.setHex(0xff3b30);
        } else {
          mat.color.setHex(0x00e5ff);
        }
      });
    }

    // 4. Radial Equalizer Waveform Needles (Active when speaking/listening)
    if (radialEqualizerGroupRef.current) {
      radialEqualizerGroupRef.current.rotation.z = time * 0.2;
      radialEqualizerGroupRef.current.children.forEach((child, i) => {
        const needle = child as THREE.Mesh;
        const phase = (i / 36) * Math.PI * 2;
        const wave = Math.sin(time * 12.0 + phase * 4.0) * amp;
        const needleLength = 0.08 + Math.max(0, wave * 0.55) + (isThinking ? Math.sin(time * 8.0 + i) * 0.06 : 0);
        needle.scale.set(1.0, 1.0 + needleLength * 12.0, 1.0);
        
        const mat = needle.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.clamp(0.3 + amp * 0.7, 0.15, 0.95);
        if (isThinking) {
          mat.color.setHex(0xd8b4fe);
        } else if (isSpeaking) {
          mat.color.setHex(0xffffff);
        } else if (isListening) {
          mat.color.setHex(0xffca28);
        } else {
          mat.color.setHex(0x38bdf8);
        }
      });
    }

    // 5. Holographic Wireframe Geometries
    if (wireframeGroupRef.current) {
      const spin = isThinking ? 1.5 : (0.15 + amp * 0.5);
      wireframeGroupRef.current.rotation.x = time * spin;
      wireframeGroupRef.current.rotation.y = time * (spin * 1.3);
      
      const cageScale = currentScale * 1.18;
      wireframeGroupRef.current.scale.set(cageScale, cageScale, cageScale);

      wireframeGroupRef.current.children.forEach((child, i) => {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = (i === 0 ? 0.25 : 0.15) + amp * 0.4;
        mat.color.setHex(
          isThinking ? 0xa855f7 :
          isSpeaking ? 0xffffff :
          isListening ? 0xffb300 :
          isError ? 0xff3b30 :
          0x00e5ff
        );
      });
    }

    // 6. Holographic Particle Swarm (Pure GPU transform, 60+ FPS)
    if (particlesRef.current) {
      const pSpin = isThinking ? 0.8 : (0.12 + treble * 0.4 + bass * 0.2);
      particlesRef.current.rotation.y = time * pSpin;
      particlesRef.current.rotation.z = time * (isThinking ? 0.5 : (0.05 + mid * 0.25));
      particlesRef.current.rotation.x = Math.sin(time * 0.6) * 0.2;

      const particleScale = 1.0 + (isThinking ? 0.12 * Math.sin(time * 6.0) : (bass * 0.35 + mid * 0.15));
      particlesRef.current.scale.set(particleScale, particleScale, particleScale);

      const pMat = particlesRef.current.material as THREE.PointsMaterial;
      pMat.size = 0.022 + (isThinking ? 0.02 : mid * 0.03 + bass * 0.015);
      pMat.opacity = THREE.MathUtils.clamp(0.75 + mid * 0.25, 0.45, 0.98);
      pMat.color.setHex(
        isThinking ? 0xc084fc :
        isSpeaking ? 0xffffff :
        isListening ? 0xffd54f :
        isError ? 0xff3b30 :
        0x00e5ff
      );
    }

    // 7. Light Rays
    if (raysRef.current) {
      raysRef.current.rotation.y = time * (isThinking ? -0.8 : -0.2);
      raysRef.current.children.forEach((child, i) => {
        const ray = child as THREE.Mesh;
        const rData = raysData[i];
        if (!rData) return;

        const pulse = Math.sin(time * rData.speed * 4.0 + i) * 0.3;
        const rayLength = (rData.baseLength + pulse) * (1.0 + amp * 2.0);
        ray.scale.set(1.0 + amp * 0.6, rayLength, 1.0 + amp * 0.6);

        const mat = ray.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.clamp(rData.baseOpacity + amp * 0.7, 0.08, 0.95);
        mat.color.setHex(
          isThinking ? 0xc084fc :
          isSpeaking ? 0xffffff :
          isListening ? 0xffca28 :
          0x38bdf8
        );
      });
    }

    // 8. Core Point Light
    if (coreGlowLight.current) {
      coreGlowLight.current.intensity = 2.5 + amp * 5.0 + (isThinking ? Math.sin(time * 8.0) * 1.5 : 0);
      coreGlowLight.current.color.setHex(
        isThinking ? 0xa855f7 :
        isSpeaking ? 0xffffff :
        isListening ? 0xffb300 :
        isError ? 0xff3b30 :
        0x00e5ff
      );
    }
  });

  return (
    <group onClick={toggleConnection}>
      {/* Dynamic Core Point Light */}
      <pointLight ref={coreGlowLight} distance={8} decay={2} />

      {/* 1. Inner Plasma Singularity (Hex Lattice & Displacement) */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[0.95, 48, 48]} />
        <shaderMaterial
          args={[JarvisCoreShader]}
          transparent={true}
        />
      </mesh>

      {/* 2. Outer Energy Aura Halo */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[1.08, 36, 36]} />
        <shaderMaterial
          args={[JarvisAuraShader]}
          transparent={true}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 3. Marvel MCU JARVIS Segmented Caliper Arcs */}
      <group ref={jarvisRingsGroupRef}>
        {jarvisArcsData.map((arc, i) => (
          <mesh key={i} rotation={[arc.rotX, arc.rotY, 0]}>
            <torusGeometry args={[arc.radius, arc.width, 16, 64, arc.arcLength * Math.PI]} />
            <meshBasicMaterial
              color={arc.color}
              transparent={true}
              opacity={0.65}
              blending={THREE.AdditiveBlending}
              wireframe={false}
            />
          </mesh>
        ))}
      </group>

      {/* 4. Radial Sonic Equalizer Radar Pins */}
      <group ref={radialEqualizerGroupRef}>
        {radialNeedles.map((needle, i) => (
          <mesh key={i} position={[needle.x, needle.y, 0]} rotation={[0, 0, needle.rotZ]}>
            <boxGeometry args={[0.015, 0.08, 0.015]} />
            <meshBasicMaterial
              color="#38bdf8"
              transparent={true}
              opacity={0.5}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* 5. Holographic Wireframe Geometries */}
      <group ref={wireframeGroupRef}>
        <mesh>
          <icosahedronGeometry args={[1.25, 1]} />
          <meshBasicMaterial
            color="#00e5ff"
            wireframe={true}
            transparent={true}
            opacity={0.22}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh>
          <dodecahedronGeometry args={[1.45, 0]} />
          <meshBasicMaterial
            color="#38bdf8"
            wireframe={true}
            transparent={true}
            opacity={0.14}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 6. Holographic Particle Swarm */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particleData.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[particleData.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.024}
          vertexColors={true}
          transparent={true}
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* 7. Quantum Energy Rays */}
      <group ref={raysRef}>
        {raysData.map((ray, i) => (
          <mesh key={i} rotation={[ray.rotX, ray.rotY, ray.rotZ]}>
            <cylinderGeometry args={[0.003, 0.01, ray.baseLength, 6]} />
            <meshBasicMaterial
              color="#00e5ff"
              transparent={true}
              opacity={ray.baseOpacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
});
