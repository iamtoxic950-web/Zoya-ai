const fs = require('fs');
let code = fs.readFileSync('src/components/AICore.tsx', 'utf8');

code = code.replace(/0xFFF4C2/g, '0xe0fbff');
code = code.replace(/0xFFB300/g, '0x00e5ff');
code = code.replace(/0xFF4400/g, '0xff2a00');
code = code.replace(/0xAA0000/g, '0xff0000');

fs.writeFileSync('src/components/AICore.tsx', code);
console.log("Fixed AICore.tsx colors");
