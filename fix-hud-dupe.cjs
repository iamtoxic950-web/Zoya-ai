const fs = require('fs');
let code = fs.readFileSync('src/components/CommandCenterHud.tsx', 'utf8');

// The file has a duplicate import React... at line 198
const lines = code.split('\n');
const duplicateIdx = lines.findIndex((line, idx) => idx > 10 && line.startsWith("import React, { useState"));

if (duplicateIdx !== -1) {
    const codeBeforeDupe = lines.slice(0, duplicateIdx).join('\n');
    
    // Now we need to append the HudPanel definition
    const hudPanelDef = `
    </div>
  );
}

function HudPanel({ title, children, initExpanded = true, collapsible = true }: { title: string, children: React.ReactNode, initExpanded?: boolean, collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(collapsible && window.innerWidth < 640 ? false : initExpanded);
  
  return (
    <motion.div 
      layout
      onClick={() => collapsible && setExpanded(!expanded)}
      className="relative p-4 w-full pointer-events-auto cursor-pointer"
      style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.02) 0%, rgba(0,0,0,0) 100%)', borderLeft: '1px solid rgba(0,229,255,0.1)' }}
      animate={{ opacity: 1 }}
      whileHover={{ borderLeft: '1px solid rgba(0,229,255,0.4)', background: 'linear-gradient(135deg, rgba(0,229,255,0.05) 0%, rgba(0,0,0,0) 100%)' }}
    >
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-[1px] border-l-[1px] border-cyan-400/50" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-[1px] border-r-[1px] border-cyan-400/50" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-[1px] border-l-[1px] border-cyan-400/50" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-[1px] border-r-[1px] border-cyan-400/50" />
      
      {/* Decorative Lines */}
      <div className="absolute top-0 left-4 w-8 h-[1px] bg-cyan-400/20" />
      <div className="absolute bottom-0 right-4 w-8 h-[1px] bg-cyan-400/20" />
      
      {/* Scanline */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #06b6d4 2px, #06b6d4 4px)' }} 
      />

      <motion.div layout className="text-[7px] sm:text-[9px] font-bold tracking-[0.3em] text-cyan-500/80 mb-3 pb-1 flex justify-between items-center">
        <span>{title}</span>
        {collapsible && <span className="text-cyan-600 font-normal">{expanded ? '[-]' : '[+]'}</span>}
      </motion.div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative z-10"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
`;
    fs.writeFileSync('src/components/CommandCenterHud.tsx', codeBeforeDupe + '\n' + hudPanelDef);
    console.log("Fixed duplicate code in CommandCenterHud");
} else {
    console.log("Duplicate not found");
}
