const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

// Replace CameraRig with a custom controller that uses OrbitControls reference
code = code.replace(/function CameraRig[\s\S]*?return null;\n}/, `
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
`);

code = code.replace(/<OrbitControls[\s\S]*?\/>\s*<CameraRig isZoomed=\{isZoomed\} \/>/, 
  `<InteractiveCameraRig isZoomed={isZoomed} gesture={gesture} />`);

fs.writeFileSync('src/components/AICore3D.tsx', code);
console.log("Updated camera controls in AICore3D.tsx");
