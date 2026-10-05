const fs = require('fs');
let code = fs.readFileSync('src/components/CommandCenterHud.tsx', 'utf8');

// I will just rewrite the layout part of CommandCenterHud.tsx
const newLayout = `
      {/* ZOYA IDENTITY & TIME (TOP CENTER) */}
      <div className="absolute top-4 sm:top-8 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
        <div className="text-2xl sm:text-4xl font-bold tracking-[0.5em] text-cyan-300 drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]" style={{ fontFamily: 'monospace' }}>
          ZOYA
        </div>
        <div className="text-[6px] sm:text-[8px] tracking-[0.4em] text-cyan-500/80 mt-1 uppercase" style={{ fontFamily: 'monospace' }}>
          PERSONAL ARTIFICIAL INTELLIGENCE
        </div>
        
        <div className="mt-4 pointer-events-auto">
          <HudPanel title="SYS.TIME" initExpanded={true} collapsible={false}>
            <div className="flex flex-col items-center">
              <div className="text-xl sm:text-3xl font-bold tracking-[0.1em] text-cyan-300">
                {time.toLocaleTimeString('en-US', { hour12: false })}
              </div>
              <div className="text-[9px] sm:text-xs tracking-[0.2em] mt-1 text-cyan-600 uppercase">
                {time.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </HudPanel>
        </div>
      </div>

      {/* LEFT COLUMN (NETWORK, VOICE) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-8 flex flex-col gap-4 w-[140px] sm:w-[280px] pointer-events-auto z-50">
        <HudPanel title="SYS.NET">
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-center justify-end h-6 gap-[2px] w-6">
                <div className={\`w-full h-1 \${network.online ? 'bg-cyan-400' : 'bg-cyan-900'} transition-colors duration-500\`} />
                <div className={\`w-full h-2 \${network.online ? 'bg-cyan-400' : 'bg-cyan-900'} transition-colors duration-500 delay-100\`} />
                <div className={\`w-full h-3 \${network.online ? 'bg-cyan-400' : 'bg-cyan-900'} transition-colors duration-500 delay-200\`} />
             </div>
             <div className="flex flex-col">
               <span className="text-[8px] sm:text-[10px] text-cyan-600">CONNECTION</span>
               <span className="text-[9px] sm:text-sm tracking-widest text-cyan-300">{network.online ? \`ONLINE [\${network.type}]\` : 'OFFLINE'}</span>
             </div>
          </div>
        </HudPanel>
        
        <HudPanel title="SYS.VOICE" collapsible={false}>
          <div className="flex flex-col items-center gap-2">
             <div className="text-[9px] sm:text-xs tracking-[0.3em] animate-pulse text-cyan-300">
               {state === 'LISTENING' ? 'LISTENING...' : state === 'THINKING' ? 'PROCESSING...' : state === 'SPEAKING' ? 'ZOYA SPEAKING...' : 'IDLE'}
             </div>
             <div className="w-full h-12">
                <VoiceVisualizer analyser={analyser} outputAnalyser={outputAnalyser} isActive={isConnected} state={state} />
             </div>
          </div>
        </HudPanel>
      </div>

      {/* RIGHT COLUMN (DEVICE, SYSTEM) */}
      <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-8 flex flex-col gap-4 w-[140px] sm:w-[280px] pointer-events-auto z-50">
        <HudPanel title="SYS.DEVICE">
          <div className="grid grid-cols-2 gap-2 text-[9px] sm:text-xs">
            <div className="text-cyan-700">PLATFORM</div>
            <div className="text-cyan-300 text-right">{navigator.platform || 'UNKNOWN'}</div>
            
            <div className="text-cyan-700">BATTERY</div>
            <div className="text-cyan-300 text-right">
              {battery ? \`\${Math.round(battery.level * 100)}% \${battery.charging ? '[CHG]' : ''}\` : 'UNAVAILABLE'}
            </div>
          </div>
        </HudPanel>
        
        <HudPanel title="SYS.PERF">
          <div className="flex flex-col gap-2 text-[9px] sm:text-xs">
            <div className="flex justify-between">
              <span className="text-cyan-700">MEMORY</span>
              <span className="text-cyan-300">
                {memory ? \`\${Math.round(memory.usedJSHeapSize / 1048576)}MB\` : 'UNAVAILABLE'}
              </span>
            </div>
            {memory && (
              <div className="w-full h-1 bg-cyan-900/50 mt-1">
                <div 
                  className="h-full bg-cyan-400" 
                  style={{ width: \`\${(memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100}%\` }}
                />
              </div>
            )}
          </div>
        </HudPanel>
      </div>

      {/* BOTTOM CENTER (CORE STATUS / EVENTS) */}
      <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 w-[280px] sm:w-[400px] pointer-events-auto z-50">
        <HudPanel title="ZOYA CORE" collapsible={false}>
          <div className="flex items-center justify-center gap-3">
            <div className={\`w-3 h-3 rounded-full \${state !== 'DISCONNECTED' && state !== 'ERROR' ? 'bg-cyan-400 drop-shadow-[0_0_5px_rgba(0,229,255,1)] animate-pulse' : 'bg-red-500'}\`} />
            <span className="text-xs sm:text-sm tracking-widest text-cyan-300 uppercase font-bold">
              {state === 'DISCONNECTED' ? 'OFFLINE' : state}
            </span>
          </div>
        </HudPanel>
        
        <HudPanel title="SYS.FEED" collapsible={false}>
          <div className="h-[80px] flex flex-col justify-end overflow-hidden text-[7px] sm:text-[9px] tracking-wide relative">
             <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#000810] to-transparent z-10" />
             <div className="flex flex-col gap-1 text-cyan-400/80">
                {logs.slice(-4).map((log, i) => (
                  <div key={i} className="flex gap-2 whitespace-nowrap">
                    <span className="opacity-50">{time.toLocaleTimeString('en-US', {hour12:false})}</span>
                    <span className="truncate uppercase">{log}</span>
                  </div>
                ))}
             </div>
          </div>
        </HudPanel>
      </div>
`;

code = code.replace(/\{(\/\* LEFT COLUMN \(Time, Device, Perf\) \*\/)\}[\s\S]*?(?=\{\/\* ZOYA IDENTITY & TIME \(TOP CENTER\) \*\/|\Z)/, newLayout);
// Wait, I didn't have `/* LEFT COLUMN (Time, Device, Perf) */` in the current file, I changed the layout before. Let's just grab the whole body between the outermost div and HudPanel definition.

const splitPoint1 = code.indexOf('<div className="absolute inset-0 pointer-events-none z-40 overflow-hidden font-mono text-cyan-500 p-2 sm:p-6">') + '<div className="absolute inset-0 pointer-events-none z-40 overflow-hidden font-mono text-cyan-500 p-2 sm:p-6">'.length;
const splitPoint2 = code.indexOf('</div>\n    </div>\n  );\n}\n\nfunction HudPanel');

const codeToKeepTop = code.substring(0, splitPoint1);
const codeToKeepBottom = code.substring(splitPoint2);

fs.writeFileSync('src/components/CommandCenterHud.tsx', codeToKeepTop + '\n' + newLayout + '\n' + codeToKeepBottom);
console.log("Updated entire HUD layout");
