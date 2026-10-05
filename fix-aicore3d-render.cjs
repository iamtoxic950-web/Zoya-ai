const fs = require('fs');
let code = fs.readFileSync('src/components/AICore3D.tsx', 'utf8');

// Remove the "STATUS: {state}" float box
code = code.replace(/<Float speed=\{2\} rotationIntensity=\{0\.2\} floatIntensity=\{0\.5\} position=\{\[-2\.5, 2\.5, 1\]\}>[\s\S]*?<\/Float>/, '');

// Re-insert HolographicHUD inside Canvas if it's missing
if (!code.includes('<HolographicHUD')) {
  code = code.replace(/<AICore state=\{state\}/, `<HolographicHUD state={state} hudMessages={hudMessages} systemLogs={systemLogs} pipelineStage={pipelineStage} analyser={analyser} outputAnalyser={outputAnalyser} isConnected={isConnected} />
                    <AICore state={state}`);
}

// Ensure the button is removed or redesigned
code = code.replace(/<button[\s\S]*?>\s*Enable Camera Gestures\s*<\/button>/, 
  `<button onClick={() => setEnableGestures(true)} className="absolute bottom-4 left-4 z-50 text-[8px] uppercase font-mono text-cyan-500/50 hover:text-cyan-400 bg-transparent tracking-widest">
    [ ENABLE GESTURE SYNC ]
  </button>`);

// Ensure the gesture text doesn't look like a box
code = code.replace(/className="absolute top-4 right-4 z-50 glass-panel px-4 py-2 text-cyan-400 font-mono text-xs uppercase transition-opacity duration-300 pointer-events-none"/,
  `className="absolute bottom-10 left-4 z-50 text-cyan-400 font-mono text-[10px] tracking-widest uppercase transition-opacity duration-300 pointer-events-none"`);

fs.writeFileSync('src/components/AICore3D.tsx', code);
console.log("Restored HolographicHUD in 3D and cleaned up old elements");
