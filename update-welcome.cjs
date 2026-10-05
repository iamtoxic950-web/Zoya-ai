const fs = require('fs');
let code = fs.readFileSync('src/hooks/useVoiceAssistant.tsx', 'utf8');

code = code.replace(/sessionRef\.current\.sendText\("System initialized\. Say your startup sequence\."\);/, 
  'sessionRef.current.sendText("Please welcome the user, introduce yourself as Zoya, and state that all core systems are online and ready.");');

fs.writeFileSync('src/hooks/useVoiceAssistant.tsx', code);
console.log("Updated welcome note in useVoiceAssistant.tsx");
