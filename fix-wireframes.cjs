const fs = require('fs');
let code = fs.readFileSync('src/components/AICore.tsx', 'utf8');

if (!code.includes('const wireframeGroupRef = useRef<THREE.Group>(null);')) {
  code = code.replace(/const raysRef = useRef<THREE\.Group>\(null\);/, 
    'const raysRef = useRef<THREE.Group>(null);\n  const wireframeGroupRef = useRef<THREE.Group>(null);');
}

code = code.replace(/<group>\s*<mesh>\s*<icosahedronGeometry args=\{\[2\.0, 1\]\} \/>/, 
  '<group ref={wireframeGroupRef}>\n        <mesh>\n          <icosahedronGeometry args={[2.0, 1]} />');
  
const animationLogic = `    // Rays
    if (raysRef.current) {
      raysRef.current.rotation.y = time * -0.1;
      raysRef.current.children.forEach((ray, i) => {
        const rData = raysData[i];
        ray.scale.y = rData.scale + Math.sin(time * rData.speed * 5.0) * (0.5 + amplitude * 2.0);
        const mat = (ray as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.1 + amplitude * 0.8 + Math.sin(time * 3.0 + i) * 0.2;
      });
    }

    if (wireframeGroupRef.current) {
       wireframeGroupRef.current.rotation.x = time * 0.15;
       wireframeGroupRef.current.rotation.y = time * 0.2;
       wireframeGroupRef.current.children.forEach((mesh, i) => {
          const mat = (mesh as THREE.Mesh).material as THREE.MeshBasicMaterial;
          mat.opacity = (i === 0 ? 0.15 : 0.08) + amplitude * 0.2;
       });
    }
  });`;

code = code.replace(/    \/\/ Rays[\s\S]*?\}\n  \}\);\n/, animationLogic + '\n');

fs.writeFileSync('src/components/AICore.tsx', code);
console.log("Animated wireframes");
