const fs = require('fs');
let code = fs.readFileSync('src/components/AIPipelineTimeline.tsx', 'utf8');

code = code.replace(/#00e5ff/g, '#FFB300');
code = code.replace(/#e0fbff/g, '#FFF4C2');
code = code.replace(/#008b99/g, '#FFD54F');
code = code.replace(/bg-\[#FFB300\]\/10/g, 'bg-[#FFB300]/10'); // Fix potential double replacement issue if any

fs.writeFileSync('src/components/AIPipelineTimeline.tsx', code);
console.log("Reverted AIPipelineTimeline styles to golden");
