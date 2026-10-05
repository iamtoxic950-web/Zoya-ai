const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

// Remove AICharacterHologram
code = code.replace(/function AICharacterHologram[\s\S]*?\n\}\n/, '');
code = code.replace(/<AICharacterHologram state=\{state\} \/>/, '');
code = code.replace(/import characterImg from '\.\.\/assets\/holographic_ai_character\.jpg';/, '');

// Add technical grid and fog
const bgAdditions = `
          <color attach="background" args={['#00030a']} />
          <fog attach="fog" args={['#00030a', 5, 30]} />
          <ambientLight intensity={0.1} />
          
          <gridHelper args={[100, 100, '#00e5ff', '#00e5ff']} position={[0, -5, 0]} material-opacity={0.05} material-transparent={true} />
          
          {/* Deep Space Background */}
          <Stars radius={50} depth={20} count={6000} factor={3} saturation={0.5} fade speed={1.5} />
          <Stars radius={100} depth={50} count={4000} factor={5} saturation={0.8} fade speed={0.8} />
          
          {/* Faint cyan atmospheric glow */}
          <mesh position={[0, 0, -20]}>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial color="#008b99" transparent opacity={0.03} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
`;

code = code.replace(/<color attach="background" args=\{\['#000205'\]\} \/>[\s\S]*?<ambientLight intensity=\{0\.1\} \/>[\s\S]*?<Stars radius=\{100\} depth=\{50\} count=\{5000\} factor=\{4\} saturation=\{0\} fade speed=\{0\.5\} \/>[\s\S]*?<Stars radius=\{150\} depth=\{100\} count=\{3000\} factor=\{6\} saturation=\{0\.5\} fade speed=\{0\.2\} \/>[\s\S]*?<Stars radius=\{200\} depth=\{150\} count=\{2000\} factor=\{8\} saturation=\{1\} fade speed=\{0\.1\} \/>/, bgAdditions);

code = code.replace(/bg-\[#000205\]/g, 'bg-[#00030a]');

fs.writeFileSync('src/components/AICore3D.tsx', code);
console.log("Updated AICore3D background and removed old character hologram");
