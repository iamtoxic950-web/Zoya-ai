const fs = require('fs');
let code = fs.readFileSync('src/components/CommandCenterHud.tsx', 'utf8');

// Replace HudPanel styling to make it less boxy and more holographic
code = code.replace(/className="relative border border-cyan-500\/20 bg-\[#000810\]\/60 backdrop-blur-md p-4 w-full pointer-events-auto cursor-pointer overflow-hidden"/, 
  `className="relative p-4 w-full pointer-events-auto cursor-pointer"`);

// Replace the shadow
code = code.replace(/style=\{\{ boxShadow: 'inset 0 0 15px rgba\\(6,182,212,0\.05\\)' \}\}/, 
  `style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.02) 0%, rgba(0,0,0,0) 100%)', borderLeft: '1px solid rgba(0,229,255,0.1)' }}`);

// Make corner brackets more distinct
const cornerBrackets = `{/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-[1px] border-l-[1px] border-cyan-400/50" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-[1px] border-r-[1px] border-cyan-400/50" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-[1px] border-l-[1px] border-cyan-400/50" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-[1px] border-r-[1px] border-cyan-400/50" />
      
      {/* Decorative Lines */}
      <div className="absolute top-0 left-4 w-8 h-[1px] bg-cyan-400/20" />
      <div className="absolute bottom-0 right-4 w-8 h-[1px] bg-cyan-400/20" />`;

code = code.replace(/\{(\/\* Corner Brackets \*\/)\}[\s\S]*?<div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-cyan-400\/70" \/>/, cornerBrackets);

// Remove the heavy border-b from title
code = code.replace(/mb-3 border-b border-cyan-500\/20 pb-1/, 'mb-3 pb-1');

// Add ZOYA Identity at top center
const zoyaIdentity = `
      {/* ZOYA IDENTITY */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className="text-2xl sm:text-4xl font-bold tracking-[0.5em] text-cyan-300 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" style={{ fontFamily: 'monospace' }}>
          ZOYA
        </div>
        <div className="text-[6px] sm:text-[8px] tracking-[0.4em] text-cyan-500/80 mt-1 uppercase" style={{ fontFamily: 'monospace' }}>
          PERSONAL ARTIFICIAL INTELLIGENCE
        </div>
      </div>
`;

code = code.replace(/\{(\/\* CENTER COLUMN \(Spacer for 3D Core\) \*\/)\}/, zoyaIdentity + '\n      {$1}');

fs.writeFileSync('src/components/CommandCenterHud.tsx', code);
console.log("Updated HudPanel to be more holographic");
