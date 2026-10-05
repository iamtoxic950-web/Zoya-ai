const fs = require('fs');
let code = fs.readFileSync('src/components/AIPipelineTimeline.tsx', 'utf8');

code = code.replace(/className="glass-panel flex items-center gap-4 p-4 border border-\[#FFB300\]\/30 bg-\[#1a1100\]\/60 backdrop-blur-md rounded-lg relative overflow-hidden"/,
  `className="flex items-center gap-4 relative w-full"`);
  
code = code.replace(/style=\{\{ boxShadow: '0 0 20px rgba\\(255,179,0,0\.1\\)' \}\}/, 
  `style={{ background: 'transparent' }}`);

code = code.replace(/#FFB300/g, '#00e5ff');
code = code.replace(/#FFF4C2/g, '#e0fbff');
code = code.replace(/#FFD54F/g, '#008b99');
code = code.replace(/bg-\[#FFB300\]\/10/g, 'bg-[#00e5ff]/10');

fs.writeFileSync('src/components/AIPipelineTimeline.tsx', code);
console.log("Updated AIPipelineTimeline styles");
