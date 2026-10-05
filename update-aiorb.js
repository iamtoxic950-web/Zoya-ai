const fs = require('fs');
let code = fs.readFileSync('src/components/AIOrb.tsx', 'utf8');

// Update colors
code = code.replace(/let coreColors = \['#67e8f9', '#06b6d4', '#083344'\];.*?\n/g, "let coreColors = ['#00e5ff', '#00b4cc', '#002933'];\n");

code = code.replace(/coreColors = \['#fef08a', '#facc15', '#a16207'\];.*/g, "coreColors = ['#008b99', '#005566', '#001a1f']; glowColor = 'rgba(0, 139, 153, 0.4)';");
code = code.replace(/coreColors = \['#bfdbfe', '#60a5fa', '#1d4ed8'\];.*/g, "coreColors = ['#00e5ff', '#00b4cc', '#002933']; glowColor = 'rgba(0, 229, 255, 0.5)';");
code = code.replace(/coreColors = \['#e9d5ff', '#c084fc', '#7e22ce'\];.*/g, "coreColors = ['#e0fbff', '#00e5ff', '#005566']; glowColor = 'rgba(0, 229, 255, 0.7)';");
code = code.replace(/coreColors = \['#ffffff', '#f1f5f9', '#cbd5e1'\];.*/g, "coreColors = ['#ffffff', '#00e5ff', '#00b4cc']; glowColor = 'rgba(0, 229, 255, 0.9)';");
code = code.replace(/coreColors = \['#94a3b8', '#475569', '#0f172a'\];.*/g, "coreColors = ['#004455', '#00222b', '#001115']; glowColor = 'rgba(0, 68, 85, 0.1)';");

// Change "ZOYA" text to "JARVIS" just in visual? Wait, the user said "like jarvis have", didn't ask to rename Zoya to Jarvis. 
// "You are Zoya... can you add these type if realtime ui animation like jarvis have". I'll keep the text "ZOYA".

fs.writeFileSync('src/components/AIOrb.tsx', code);
console.log("Updated AIOrb colors");
