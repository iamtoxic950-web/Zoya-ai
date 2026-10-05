const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove the glass-panel in App.tsx
code = code.replace(/<div className="glass-panel w-full px-6 py-4 mt-2 flex flex-col items-center justify-center">[\s\S]*?<\/div>/, 
  `{state === 'ERROR' && (
            <div className="text-red-500 font-bold tracking-widest text-[10px] uppercase font-mono bg-red-900/20 px-4 py-2 border border-red-500/50 rounded pointer-events-none">
              SYSTEM ERROR: {errorMsg || 'Check API key'}
            </div>
          )}`);

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx");
