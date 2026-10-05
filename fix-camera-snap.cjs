const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

const regex = /  useFrame\(\(state, delta\) => \{[\s\S]*?controlsRef\.current\.update\(\);\n  \}\);/g;

code = code.replace(regex, `  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    controlsRef.current.update();
  });`);

fs.writeFileSync('src/components/AICore3D.tsx', code);
console.log("Removed camera snapping behavior");
