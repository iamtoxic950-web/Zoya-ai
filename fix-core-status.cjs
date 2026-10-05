const fs = require('fs');
let code = fs.readFileSync('src/components/CommandCenterHud.tsx', 'utf8');

const newCoreStatus = `<HudPanel title="ZOYA CORE" collapsible={false}>
          <div className="flex items-center gap-2">
            <div className={\`w-2 h-2 rounded-full \${state !== 'DISCONNECTED' && state !== 'ERROR' ? 'bg-cyan-400 drop-shadow-[0_0_5px_rgba(0,229,255,1)] animate-pulse' : 'bg-red-500'}\`} />
            <span className="text-xs sm:text-sm tracking-widest text-cyan-300 uppercase">
              {state === 'DISCONNECTED' ? 'OFFLINE' : state}
            </span>
          </div>
        </HudPanel>`;

code = code.replace(/<HudPanel title="SYS\.CORE" collapsible=\{false\}>[\s\S]*?<\/HudPanel>/, newCoreStatus);

fs.writeFileSync('src/components/CommandCenterHud.tsx', code);
console.log("Updated Core Status HUD");
