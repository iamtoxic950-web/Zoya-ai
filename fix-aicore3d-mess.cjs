const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

// The easiest way is to re-download or recreate AICore3D.tsx.
// Let's just create a full replacement.
const fullCode = `import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { HandGestureController } from './HandGestureController';
import { AICore } from './AICore';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { CommandCenterHud } from './CommandCenterHud';
import { HudOverlay } from './HudOverlay';
import { AIPipelineTimeline } from './AIPipelineTimeline';
import { VoiceVisualizer } from './VoiceVisualizer';

function HolographicHUD({ state, hudMessages, systemLogs, pipelineStage, analyser, outputAnalyser, isConnected }: any) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((stateObj) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(stateObj.clock.elapsedTime * 0.1) * 0.05;
      groupRef.current.position.y = Math.sin(stateObj.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2} position={[-4, 0, 1]}>
        <Html transform distanceFactor={10} style={{ width: '400px' }} position={[0, 0, 0]} rotation={[0, 0.5, 0]}>
          <div className="scale-75 origin-left">
             <AIPipelineTimeline state={state} logs={systemLogs} pipelineStage={pipelineStage} />
          </div>
        </Html>
      </Float>
      
      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2} position={[4, 1, 1]}>
        <Html transform distanceFactor={10} style={{ width: '300px' }} position={[0, 0, 0]} rotation={[0, -0.5, 0]}>
          <div className="scale-75 origin-right">
             <HudOverlay messages={hudMessages} />
          </div>
        </Html>
      </Float>
      
      <Float speed={1.5} rotationIntensity={0} floatIntensity={0.1} position={[0, -2.5, 1.5]}>
        <Html transform distanceFactor={10} style={{ width: '400px' }} position={[0, 0, 0]} rotation={[-0.2, 0, 0]}>
          <div className="scale-75 origin-center">
             <VoiceVisualizer analyser={analyser} outputAnalyser={outputAnalyser} isActive={isConnected} state={state} />
          </div>
        </Html>
      </Float>
    </group>
  );
}

function InteractiveCameraRig({ isZoomed, gesture }: { isZoomed: boolean, gesture: string }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const initialCameraPos = new THREE.Vector3(0, 0, 8);
  const initialTargetPos = new THREE.Vector3(0, 0, 0);

  useEffect(() => {
    if (isZoomed) {
      initialCameraPos.z = 4;
    } else {
      initialCameraPos.z = 8;
    }
  }, [isZoomed]);

  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    
    // If not interacting, smoothly interpolate back to initial position
    if (!isInteracting) {
      const time = state.clock.elapsedTime;
      const orbitX = Math.sin(time * 0.1) * 0.5;
      const orbitY = Math.cos(time * 0.15) * 0.2;
      
      const targetCam = new THREE.Vector3(
        initialCameraPos.x + orbitX,
        initialCameraPos.y + orbitY,
        initialCameraPos.z
      );

      camera.position.lerp(targetCam, 0.02);
      controlsRef.current.target.lerp(initialTargetPos, 0.02);
    }
    
    controlsRef.current.update();
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={3}
      maxDistance={20}
      autoRotate={!isInteracting}
      autoRotateSpeed={0.5}
      enableDamping
      dampingFactor={0.05}
      onStart={() => setIsInteracting(true)}
      onEnd={() => setIsInteracting(false)}
    />
  );
}

export function AICore3D({ state, analyser, outputAnalyser, toggleConnection, hudMessages, systemLogs, pipelineStage, isConnected }: any) {
  const [gesture, setGesture] = useState('NONE');
  const [isZoomed, setIsZoomed] = useState(false);
  const [enableGestures, setEnableGestures] = useState(false);
  const lastToggle = useRef(0);

  const handleGesture = (g: string) => {
    setGesture(g);
    if (g === 'PINCH') setIsZoomed(true);
    else setIsZoomed(false);
    
    const now = Date.now();
    if (now - lastToggle.current > 2000) {
      if (g === 'PALM' && (state === 'DISCONNECTED' || state === 'ERROR')) {
        toggleConnection();
        lastToggle.current = now;
      } else if (g === 'FIST' && state !== 'DISCONNECTED' && state !== 'ERROR' && state !== 'CONNECTING') {
        toggleConnection();
        lastToggle.current = now;
      }
    }
  };

  return (
    <>
      <div className="absolute inset-0 z-0 bg-[#00030a]">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          
          <color attach="background" args={['#00030a']} />
          <fog attach="fog" args={['#00030a', 5, 30]} />
          <ambientLight intensity={0.1} />
          
          <gridHelper args={[100, 100, '#FFB300', '#FFB300']} position={[0, -5, 0]} material-opacity={0.05} material-transparent={true} />
          
          {/* Deep Space Background */}
          <Stars radius={50} depth={20} count={6000} factor={3} saturation={0.5} fade speed={1.5} />
          <Stars radius={100} depth={50} count={4000} factor={5} saturation={0.8} fade speed={0.8} />
          
          {/* Faint gold atmospheric glow */}
          <mesh position={[0, 0, -20]}>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial color="#FFB300" transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          
          <HolographicHUD state={state} hudMessages={hudMessages} systemLogs={systemLogs} pipelineStage={pipelineStage} analyser={analyser} outputAnalyser={outputAnalyser} isConnected={isConnected} />
          
          <AICore state={state} analyser={analyser} outputAnalyser={outputAnalyser} toggleConnection={toggleConnection} />
          
          <EffectComposer>
            <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} />
          </EffectComposer>
          
          <InteractiveCameraRig isZoomed={isZoomed} gesture={gesture} />
          
        </Canvas>
        <CommandCenterHud state={state} logs={systemLogs} pipelineStage={pipelineStage} analyser={analyser} outputAnalyser={outputAnalyser} isConnected={isConnected} />
      </div>
      
      {enableGestures ? (
        <HandGestureController onGesture={handleGesture} />
      ) : (
        <button onClick={() => setEnableGestures(true)} className="absolute bottom-4 left-4 z-50 text-[8px] uppercase font-mono text-cyan-500/50 hover:text-cyan-400 bg-transparent tracking-widest">
          [ ENABLE GESTURE SYNC ]
        </button>
      )}
      
      {gesture !== 'NONE' && enableGestures && (
        <div className="absolute bottom-10 left-4 z-50 text-cyan-400 font-mono text-[10px] tracking-widest uppercase transition-opacity duration-300 pointer-events-none">
          Hand Gesture: {gesture}
        </div>
      )}
    </>
  );
}
`;

fs.writeFileSync('src/components/AICore3D.tsx', fullCode);
console.log("Rewrote AICore3D.tsx");
