const fs = require('fs');
let code = fs.readFileSync('src/components/AICore.tsx', 'utf8');

// The Golden colors requested:
// colorA: 0xFFF4C2 (light gold)
// colorB: 0xFFB300 (gold/amber)

code = code.replace(/mat\.uniforms\.colorA\.value\.setHex\(0xe0fbff\);/, 'mat.uniforms.colorA.value.setHex(0xFFF4C2);');
code = code.replace(/mat\.uniforms\.colorB\.value\.setHex\(0x00e5ff\);/, 'mat.uniforms.colorB.value.setHex(0xFFB300);');
code = code.replace(/color=\{state === 'ERROR' \? "#FF5500" : "#00ffff"\}/g, 'color={state === "ERROR" ? "#FF5500" : "#FFB300"}');
code = code.replace(/color="#e0fbff"/g, 'color="#FFF4C2"');
code = code.replace(/color=\{state === 'ERROR' \? "#FF0000" : "#00ffff"\}/g, 'color={state === "ERROR" ? "#FF0000" : "#FFB300"}');
code = code.replace(/color="#00e5ff"/g, 'color="#FFB300"');

// And in OuterFieldShader we can also make the default color golden
code = code.replace(/value: new THREE\.Color\('#008b99'\)/, "value: new THREE.Color('#FFB300')");

fs.writeFileSync('src/components/AICore.tsx', code);
console.log("Updated colors in AICore.tsx to golden");
