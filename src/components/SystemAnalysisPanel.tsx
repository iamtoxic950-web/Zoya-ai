import React from 'react';

export function SystemAnalysisPanel({ text }: { text: string }) {
  // Generate random particles
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const top = Math.random() * 100 + '%';
    const left = Math.random() * 100 + '%';
    const delay = Math.random() * 2 + 's';
    const duration = 1 + Math.random() * 2 + 's';
    return (
      <div 
        key={i} 
        className="absolute w-1 h-1 bg-cyan-300 rounded-full animate-ping opacity-70 pointer-events-none"
        style={{ top, left, animationDelay: delay, animationDuration: duration }}
      />
    );
  });

  return (
    <div className="flex flex-col gap-2 relative min-h-[40px] justify-center">
      {particles}
      <span className="relative z-10">{text}</span>
      <div className="w-full bg-cyan-900/30 h-1 rounded overflow-hidden relative z-10">
         <div className="bg-cyan-400 h-full w-full animate-[progress_1.5s_ease-in-out]" style={{ transformOrigin: 'left' }} />
      </div>
    </div>
  );
}
