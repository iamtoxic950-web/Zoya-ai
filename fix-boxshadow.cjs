const fs = require('fs');
let code = fs.readFileSync('src/components/CommandCenterHud.tsx', 'utf8');

code = code.replace(/style=\{\{ boxShadow: 'inset 0 0 15px rgba\\(6,182,212,0\.05\\)' \}\}/, 
  `style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.02) 0%, rgba(0,0,0,0) 100%)', borderLeft: '1px solid rgba(0,229,255,0.1)' }}`);

code = code.replace(/whileHover=\{\{ borderColor: 'rgba\\(6,182,212,0\.5\\)', boxShadow: 'inset 0 0 20px rgba\\(6,182,212,0\.1\\)' \}\}/, 
  `whileHover={{ borderLeft: '1px solid rgba(0,229,255,0.4)', background: 'linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(0,0,0,0) 100%)' }}`);

fs.writeFileSync('src/components/CommandCenterHud.tsx', code);
console.log("Fixed HUD box shadow");
