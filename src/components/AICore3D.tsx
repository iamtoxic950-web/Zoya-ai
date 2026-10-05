import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { AICore } from './AICore';
import { MinimalCinematicHUD } from './hud/MinimalCinematicHUD';
import { AssistantState, ReminderItem } from '../types';
import { HudMessage } from '../hooks/useVoiceAssistant';

interface AICore3DProps {
  state: AssistantState;
  analyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  toggleConnection: () => void;
  hudMessages: HudMessage[];
  systemLogs: string[];
  pipelineStage: number;
  isConnected: boolean;
  isMicActive?: boolean;
  micWarning?: string | null;
  liveTranscript?: string;
  isTranscriptFinal?: boolean;
  requestMicAccess?: () => Promise<boolean>;
  sendTextPrompt?: (text: string) => void;
  showHud?: boolean;
  onOpenMenu?: () => void;
  dueReminder?: ReminderItem | null;
  onDismissDueReminder?: () => void;
  onOpenReminders?: () => void;
}

function GalaxyEnvironment({
  outputAnalyser,
  state
}: {
  outputAnalyser: AnalyserNode | null;
  state: AssistantState;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 1500;
  const dataArray = useRef(new Uint8Array(256));

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const colorInside = new THREE.Color('#00e5ff');
    const colorOutside = new THREE.Color('#001529');
    const colorStar = new THREE.Color('#ffffff');

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 2.5 + Math.pow(Math.random(), 2) * 22;
      const spinAngle = radius * 0.45;
      const branchAngle = ((i % 4) * Math.PI * 2) / 4;

      const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.8 * radius;
      const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.8 * radius;
      const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 0.8 * radius;

      pos[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      pos[i3 + 1] = randomY;
      pos[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, Math.min(1.0, radius / 22));
      if (Math.random() > 0.88) mixedColor.lerp(colorStar, 0.7);

      col[i3] = mixedColor.r;
      col[i3 + 1] = mixedColor.g;
      col[i3 + 2] = mixedColor.b;
    }
    return [pos, col];
  }, []);

  useFrame((stateObj) => {
    const time = stateObj.clock.elapsedTime;
    let treblePulse = 0;

    if (state === 'SPEAKING' && outputAnalyser) {
      try {
        if (dataArray.current.length !== outputAnalyser.frequencyBinCount) {
          dataArray.current = new Uint8Array(outputAnalyser.frequencyBinCount);
        }
        outputAnalyser.getByteFrequencyData(dataArray.current);
        let sum = 0;
        for (let i = 30; i < 80; i++) sum += dataArray.current[i];
        treblePulse = (sum / (50 * 255.0)) * 0.6;
      } catch (e) {}
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y = time * 0.02 + treblePulse * 0.04;
      const pMat = pointsRef.current.material as THREE.PointsMaterial;
      pMat.size = 0.016 + treblePulse * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.018}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function FrequencyReactiveParticleField({
  outputAnalyser,
  state
}: {
  outputAnalyser: AnalyserNode | null;
  state: AssistantState;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 800;
  const dataArray = useRef(new Uint8Array(256));

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cyan = new THREE.Color('#00e5ff');
    const sky = new THREE.Color('#38bdf8');

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 8.5 + 2.0;

      pos[i3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i3 + 2] = r * Math.cos(phi);

      const brightness = 0.85 + Math.random() * 0.15;
      col[i3] = brightness;
      col[i3 + 1] = brightness;
      col[i3 + 2] = brightness;
    }
    return [pos, col];
  }, []);

  useFrame((stateObj) => {
    const time = stateObj.clock.elapsedTime;
    let voiceScale = 0;

    if (state === 'SPEAKING' && outputAnalyser) {
      try {
        if (dataArray.current.length !== outputAnalyser.frequencyBinCount) {
          dataArray.current = new Uint8Array(outputAnalyser.frequencyBinCount);
        }
        outputAnalyser.getByteFrequencyData(dataArray.current);
        let sum = 0;
        for (let i = 1; i < 40; i++) sum += dataArray.current[i];
        voiceScale = (sum / (39 * 255.0)) * 0.45;
      } catch (e) {}
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.y = time * 0.05;
      pointsRef.current.rotation.x = time * 0.02;
      const dynamicScale = 1.0 + voiceScale;
      pointsRef.current.scale.set(dynamicScale, dynamicScale, dynamicScale);
      const pMat = pointsRef.current.material as THREE.PointsMaterial;
      pMat.color.setHex(
        state === 'THINKING' ? 0xc084fc :
        state === 'SPEAKING' ? 0xffffff :
        state === 'LISTENING' ? 0xffd54f :
        state === 'ERROR' ? 0xff3b30 :
        0x00e5ff
      );
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        vertexColors
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function SmoothCameraRig() {
  const controlsRef = useRef<any>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      zoomSpeed={1.5}
      rotateSpeed={0.85}
      panSpeed={0.85}
      minDistance={1.4}
      maxDistance={38}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
      }}
      autoRotate={!isInteracting}
      autoRotateSpeed={0.3}
      enableDamping={true}
      dampingFactor={0.06}
      onStart={() => setIsInteracting(true)}
      onEnd={() => setIsInteracting(false)}
    />
  );
}

export const AICore3D = React.memo(function AICore3D({
  state,
  analyser,
  outputAnalyser,
  toggleConnection,
  hudMessages,
  systemLogs,
  pipelineStage,
  isConnected,
  isMicActive,
  micWarning,
  liveTranscript,
  isTranscriptFinal,
  requestMicAccess,
  sendTextPrompt,
  showHud = true,
  onOpenMenu,
  dueReminder,
  onDismissDueReminder,
  onOpenReminders
}: AICore3DProps) {
  const canvasDpr = useMemo<[number, number]>(() => {
    if (typeof window === 'undefined') return [1, 1.25];
    const isMobile = window.innerWidth < 768 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    return isMobile ? [1, 1.2] : [1, 1.5];
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#000103] overflow-hidden select-none touch-none">
      {/* 3D WebGL Canvas with unrestricted multi-finger gesture controls */}
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        dpr={canvasDpr}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        className="touch-none"
      >
        <color attach="background" args={['#000103']} />
        <fog attach="fog" args={['#000103', 5, 40]} />

        {/* Dynamic Galaxy Background */}
        <GalaxyEnvironment outputAnalyser={outputAnalyser} state={state} />

        {/* Audio Frequency Reactive Particle Swarm */}
        <FrequencyReactiveParticleField outputAnalyser={outputAnalyser} state={state} />

        {/* Marvel MCU / JARVIS Arc-Reactor 3D Hologram Core */}
        <AICore
          state={state}
          analyser={analyser}
          outputAnalyser={outputAnalyser}
          toggleConnection={toggleConnection}
        />

        {/* High-Performance Cinematic Bloom Glow */}
        <EffectComposer multisampling={0}>
          <Bloom
            luminanceThreshold={0.35}
            luminanceSmoothing={0.8}
            intensity={0.9}
            height={200}
          />
        </EffectComposer>

        {/* Fluid Multi-Touch Gesture Camera Controller */}
        <SmoothCameraRig />
      </Canvas>

      {/* Ultra-Clean Cinematic HUD Overlay */}
      {showHud && (
        <MinimalCinematicHUD
          state={state}
          logs={systemLogs}
          pipelineStage={pipelineStage}
          analyser={analyser}
          outputAnalyser={outputAnalyser}
          isConnected={isConnected}
          isMicActive={isMicActive}
          micWarning={micWarning}
          liveTranscript={liveTranscript}
          isTranscriptFinal={isTranscriptFinal}
          requestMicAccess={requestMicAccess}
          sendTextPrompt={sendTextPrompt}
          hudMessages={hudMessages}
          toggleConnection={toggleConnection}
          onOpenMenu={onOpenMenu}
          dueReminder={dueReminder}
          onDismissDueReminder={onDismissDueReminder}
          onOpenReminders={onOpenReminders}
        />
      )}
    </div>
  );
});
