const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

code = code.replace(/<gridHelper args=\{\[100, 100, '#00e5ff', '#00e5ff'\]\}/g, `<gridHelper args={[100, 100, '#FFB300', '#FFB300']}`);
code = code.replace(/<meshBasicMaterial color="#008b99" transparent opacity=\{0\.03\}/g, `<meshBasicMaterial color="#FFB300" transparent opacity={0.03}`);

fs.writeFileSync('src/components/AICore3D.tsx', code);
console.log("Updated background grid and fog colors in AICore3D.tsx");
