const fs = require('fs');
let code = fs.readFileSync('src/components/HudOverlay.tsx', 'utf8');

code = code.replace(/rgba\(0, 229, 255/g, 'rgba(255, 179, 0');
code = code.replace(/cyan-400/g, 'amber-400');
code = code.replace(/cyan-500/g, 'amber-500');
code = code.replace(/shadow-cyan/g, 'shadow-amber');

fs.writeFileSync('src/components/HudOverlay.tsx', code);
console.log("Reverted HudOverlay styles to golden");
