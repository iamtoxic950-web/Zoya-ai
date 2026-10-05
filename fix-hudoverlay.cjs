const fs = require('fs');
let code = fs.readFileSync('src/components/HudOverlay.tsx', 'utf8');

code = code.replace(/className="glass-panel px-6 py-4 border border-amber-500\/40 rounded-sm backdrop-blur-md relative overflow-hidden w-full"/,
  `className="relative w-full"`);

code = code.replace(/style=\{\{[\s\S]*?\}\}/, 
  `style={{ background: 'transparent' }}`);

code = code.replace(/rgba\(255, 179, 0, 0\.3\)/g, 'rgba(0, 229, 255, 0.3)');
code = code.replace(/amber-400/g, 'cyan-400');
code = code.replace(/amber-500/g, 'cyan-500');
code = code.replace(/shadow-amber/g, 'shadow-cyan');

const cornerAccents = `{/* Corner Accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t-[1px] border-l-[1px] border-cyan-400"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t-[1px] border-r-[1px] border-cyan-400"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b-[1px] border-l-[1px] border-cyan-400"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b-[1px] border-r-[1px] border-cyan-400"></div>`;
                
code = code.replace(/\{(\/\* Corner Accents \*\/)\}[\s\S]*?<div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400"><\/div>/, cornerAccents);

fs.writeFileSync('src/components/HudOverlay.tsx', code);
console.log("Updated HudOverlay styles");
