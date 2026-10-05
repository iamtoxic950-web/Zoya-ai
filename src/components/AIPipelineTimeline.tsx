import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AssistantState } from '../types';
import { Brain, Search, Database, Cpu, MessageSquare, Zap, CheckCircle2, Mic } from 'lucide-react';

interface Props {
  state: AssistantState;
  logs: string[];
  pipelineStage: number;
}

const STAGES = [
  { id: 'LISTENING', icon: Mic, title: 'Voice Input', desc: 'Capturing audio stream' },
  { id: 'INTENT', icon: Brain, title: 'Intent Detected', desc: 'Parsing semantic meaning' },
  { id: 'CONTEXT', icon: Search, title: 'Analyzing Context', desc: 'Evaluating session state' },
  { id: 'MEMORY', icon: Database, title: 'Memory Retrieval', desc: 'Querying vector database' },
  { id: 'REASONING', icon: Cpu, title: 'AI Reasoning', desc: 'Processing neural pathways' },
  { id: 'RESPONSE', icon: MessageSquare, title: 'Formulating', desc: 'Synthesizing output' },
  { id: 'ACTION', icon: Zap, title: 'Executing', desc: 'Dispatching commands' },
  { id: 'COMPLETED', icon: CheckCircle2, title: 'Completed', desc: 'Cycle finished' },
];

export function AIPipelineTimeline({ state, logs, pipelineStage }: Props) {
  const isVisible = pipelineStage !== -1 && state !== 'DISCONNECTED' && state !== 'ERROR';
  const stage = STAGES[pipelineStage] || null;

  if (!isVisible || !stage) return null;
  const Icon = stage.icon;

  return (
    <div className="flex flex-col items-center justify-center pointer-events-none w-[300px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', y: 20 }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)', y: -20 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
          className="flex items-center gap-4 relative w-full"
          style={{ boxShadow: '0 0 20px rgba(255,179,0,0.1)' }}
        >
          {/* Scanning line effect */}
          <motion.div 
            className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFB300]/50"
            animate={{ y: [0, 80] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />

          <div className="w-10 h-10 rounded-full flex items-center justify-center border border-[#FFB300] bg-[#FFB300]/10 text-[#FFB300] relative">
            <Icon size={18} />
            <div className="absolute inset-0 rounded-full border border-[#FFB300] animate-ping opacity-30" />
          </div>
          
          <div className="flex flex-col">
            <span className="text-sm font-mono font-bold tracking-widest text-[#FFF4C2] uppercase">
              {stage.title}
            </span>
            <span className="text-[10px] text-[#FFD54F]/70 font-mono tracking-wide uppercase">
              {stage.desc}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
