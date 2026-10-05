import React, { useEffect, useRef } from 'react';
import { AssistantState } from '../types';

interface VoiceVisualizerProps {
  analyser: AnalyserNode | null;
  outputAnalyser?: AnalyserNode | null;
  isActive: boolean;
  state?: AssistantState;
}

export function VoiceVisualizer({ analyser, outputAnalyser, isActive, state }: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const currentAnalyser = state === 'SPEAKING' && outputAnalyser ? outputAnalyser : analyser;
    if (!currentAnalyser || !isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
        
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = currentAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);
            
      currentAnalyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
            
      const barWidth = 4;
      const gap = 4;
      const numBars = Math.floor(canvas.width / (barWidth + gap));
      const step = Math.floor(bufferLength / numBars);
            
      const totalWidth = numBars * (barWidth + gap) - gap;
      let x = (canvas.width - totalWidth) / 2;

      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      if (state === 'SPEAKING') {
        gradient.addColorStop(0, '#cbd5e1');
        gradient.addColorStop(1, '#ffffff');
      } else if (state === 'THINKING') {
        gradient.addColorStop(0, '#7e22ce');
        gradient.addColorStop(1, '#c084fc');
      } else if (state === 'LISTENING') {
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#ffd54f');
      } else {
        gradient.addColorStop(0, '#008b99');
        gradient.addColorStop(1, '#00e5ff');
      }
            
      ctx.fillStyle = gradient;

      for (let i = 0; i < numBars; i++) {
        // Average the frequency data for this segment
        let sum = 0;
        for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j];
        }
        const avg = sum / step;
                
        // Map average frequency value to bar height, minimum height is 4px
        const barHeight = Math.max(4, (avg / 255.0) * canvas.height);
                
        const y = canvas.height - barHeight;
                
        // Draw rounded rectangle for bar
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
                
        x += barWidth + gap;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, outputAnalyser, isActive, state]);

  if (!isActive) return null;

  return (
    <div className="w-full max-w-md h-20 mx-auto flex items-end justify-center">
      <canvas ref={canvasRef} width={400} height={80} className="w-full h-full" />
    </div>
  );
}
