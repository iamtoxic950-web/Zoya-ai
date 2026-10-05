const fs = require('fs');
let code = fs.readFileSync('src/components/AICore.tsx', 'utf8');

const regex = /<group ref=\{ringsGroupRef\}>([\s\S]*?)<\/group>/;
const match = code.match(regex);
if (match) {
  let groupContent = match[1];
  // separate ringsData map from the extra meshes
  let newGroupContent = `
      <group ref={ringsGroupRef}>
        {ringsData.map((data, i) => (
          <mesh key={i} rotation={[data.rotX, data.rotY, 0]}>
            <torusGeometry args={[data.radius, data.isBroken ? 0.005 : 0.015, 16, data.isBroken ? 64 : 100, data.isBroken ? Math.PI * 1.5 : Math.PI * 2]} />
            <meshBasicMaterial 
               color={state === "ERROR" ? "#FF5500" : "#FFB300"} 
               transparent 
               opacity={data.opacity} 
               blending={THREE.AdditiveBlending} 
               side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      {/* Add complex wireframe geometry outside of ringsGroupRef to prevent index out of bounds */}
      <group>
        <mesh>
          <icosahedronGeometry args={[2.0, 1]} />
          <meshBasicMaterial color="#FFB300" wireframe transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[2.2, 2]} />
          <meshBasicMaterial color="#FFF4C2" wireframe transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
  `;
  
  code = code.replace(regex, newGroupContent);
  fs.writeFileSync('src/components/AICore.tsx', code);
  console.log("Fixed the out of bounds error");
}
