import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  RefreshCw,
  Radio,
  Menu,
  Maximize2,
  X,
  AlertCircle,
  Copy,
  Check,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import {
  imageGenerationService,
  ImageGenerationError,
  ImageGenerationErrorType
} from '../../services/ImageGenerationService';

interface ImageGenerationViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
}

interface GeneratedImageItem {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: string;
  createdAt: number;
}

export function ImageGenerationView({ onBackToVoice, onOpenMenu }: ImageGenerationViewProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ImageGenerationErrorType | null>(null);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [history, setHistory] = useState<GeneratedImageItem[]>(() => {
    try {
      const saved = localStorage.getItem('zoya_generated_images_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [previewImage, setPreviewImage] = useState<GeneratedImageItem | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  const saveToHistory = (item: GeneratedImageItem) => {
    const updated = [item, ...history.filter((h) => h.id !== item.id)].slice(0, 20);
    setHistory(updated);
    try {
      localStorage.setItem('zoya_generated_images_v1', JSON.stringify(updated));
    } catch {}
  };

  const handleGenerate = async (customPrompt?: string) => {
    const text = (customPrompt || prompt).trim();
    if (!text || isGenerating) return;

    setIsGenerating(true);
    setErrorMsg(null);
    setErrorType(null);

    try {
      // Clean service abstraction: no provider-specific API logic in UI
      const result = await imageGenerationService.generateImage(text, aspectRatio);

      const newItem: GeneratedImageItem = {
        id: result.metadata.id,
        url: result.imageUrl,
        prompt: text,
        aspectRatio,
        createdAt: result.metadata.createdAt
      };

      setCurrentImage(newItem);
      saveToHistory(newItem);
    } catch (err: any) {
      const isTypedError = err && typeof err === 'object' && 'type' in err;
      const type: ImageGenerationErrorType = isTypedError ? err.type : 'UNKNOWN';
      const message = isTypedError ? err.message : (err?.message || 'Image synthesis notice.');
      console.info('[ImageGen] Synthesis status:', type);

      setErrorType(type);
      setErrorMsg(message);
      // Notice: we do NOT clear the user's prompt on failure, preserving their input!
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariation = () => {
    if (!currentImage) return;
    const variationPrompt = `${currentImage.prompt}, cinematic variation, high detail, masterpiece`;
    setPrompt(variationPrompt);
    handleGenerate(variationPrompt);
  };

  const handleDownload = (item: GeneratedImageItem) => {
    try {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = `zoya-${item.prompt.slice(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.warn('Download error:', e);
    }
  };

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const suggestedPrompts = [
    'Futuristic holographic quantum core floating in deep space, glowing cyan and gold rings, 8k resolution',
    'Cyberpunk neon laboratory with neural interfaces and glowing glass consoles, dark cinematic lighting',
    'Cosmic planetary nebula viewed from a sleek interstellar observation deck, realistic space haze',
    'Bioluminescent crystal garden on an alien world beneath a twin moon sky, ethereal glow'
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(0,180,216,0.1)_0%,_transparent_70%)]" />

      {/* Header */}
      <header className="relative z-10 px-4 py-3 sm:px-6 sm:py-3.5 border-b border-cyan-500/20 bg-[#010814]/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToVoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 transition-colors cursor-pointer text-[10px] tracking-widest uppercase"
            title="Return to Voice Interface"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Voice Core</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-cyan-200">
              Image Synthesis
            </span>
            <span className="hidden sm:inline text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 bg-cyan-950/20">
              Gemini Vision Engine
            </span>
          </div>
        </div>

        <button
          onClick={onOpenMenu}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Menu</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-5xl w-full mx-auto space-y-6">
        {/* Prompt Input Form Container */}
        <section className="p-4 sm:p-5 rounded-2xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md shadow-[0_0_25px_rgba(0,229,255,0.06)]">
          <label className="block text-[10px] font-bold tracking-[0.25em] text-cyan-300 uppercase mb-2">
            Synthesize Visual Artifact
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to visualize (e.g. quantum cybernetic ring system in deep space)..."
              disabled={isGenerating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              className="flex-1 bg-[#000a14]/90 border border-cyan-500/30 hover:border-cyan-400/60 focus:border-cyan-400 rounded-xl px-4 py-3 text-xs sm:text-sm text-cyan-100 placeholder:text-cyan-600/60 font-sans tracking-wide focus:outline-none focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all"
            />

            <button
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || isGenerating}
              className="px-5 py-3 rounded-xl bg-cyan-950/90 border border-cyan-400/60 hover:bg-cyan-900/90 hover:border-cyan-300 text-cyan-100 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-[0_0_15px_rgba(0,229,255,0.18)] shrink-0"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          {/* Aspect Ratio Options */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-cyan-500/15">
            <span className="text-[9px] tracking-widest text-cyan-500 uppercase mr-1">
              Aspect Ratio:
            </span>
            {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                disabled={isGenerating}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all cursor-pointer border ${
                  aspectRatio === ratio
                    ? 'border-cyan-400 bg-cyan-900/50 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.25)]'
                    : 'border-cyan-500/20 bg-[#000e1c]/50 text-cyan-400/70 hover:border-cyan-400/40 hover:text-cyan-200'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Suggested Prompts */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestedPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPrompt(p);
                  handleGenerate(p);
                }}
                disabled={isGenerating}
                className="text-[9px] px-2.5 py-1 rounded-md border border-cyan-500/15 bg-cyan-950/20 text-cyan-400/70 hover:text-cyan-200 hover:border-cyan-400/40 hover:bg-cyan-950/40 transition-colors text-left truncate max-w-full cursor-pointer"
              >
                + {p}
              </button>
            ))}
          </div>
        </section>

        {/* Error Banner with Categorized Guidance */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border backdrop-blur-md flex items-start gap-3.5 ${
              errorType === 'PAID_REQUIRED'
                ? 'border-amber-500/50 bg-[#160f04]/90 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
                : errorType === 'QUOTA_EXHAUSTED'
                ? 'border-amber-500/40 bg-[#140e03]/85 text-amber-200'
                : 'border-red-500/50 bg-[#170505]/90 text-red-200'
            }`}
          >
            {errorType === 'PAID_REQUIRED' ? (
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}

            <div className="flex-1 space-y-1.5">
              <div className="text-[10px] font-mono uppercase tracking-widest font-bold text-amber-300">
                {errorType === 'PAID_REQUIRED'
                  ? 'Cloud Project Feature Limitation'
                  : errorType === 'QUOTA_EXHAUSTED'
                  ? 'Synthesis Rate Limit Reached'
                  : 'Image Synthesis Error'}
              </div>

              <div className="text-xs font-sans leading-relaxed text-slate-200">
                {errorMsg}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono">
                {errorType !== 'PAID_REQUIRED' && (
                  <button
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/50 hover:bg-cyan-900 text-cyan-200 text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry Generation</span>
                  </button>
                )}

                <span className="text-[10px] text-cyan-400/60 font-sans">
                  Prompt preserved in input bar
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setErrorMsg(null);
                setErrorType(null);
              }}
              className="text-slate-400 hover:text-white p-1 cursor-pointer"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Current Active Result */}
        {currentImage && (
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 sm:p-6 rounded-2xl border border-cyan-400/30 bg-[#00101f]/90 shadow-[0_0_30px_rgba(0,229,255,0.12)] flex flex-col md:flex-row gap-6 items-center"
          >
            <div className="relative group rounded-xl overflow-hidden border border-cyan-500/30 bg-black/60 max-w-md w-full aspect-square flex items-center justify-center">
              <img
                src={currentImage.url}
                alt={currentImage.prompt}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setPreviewImage(currentImage)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/70 border border-cyan-400/50 text-cyan-200 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-lg hover:text-cyan-100"
                title="Expand Full View"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 w-full">
              <div>
                <span className="text-[9px] tracking-widest text-cyan-500 uppercase">
                  Active Synthesis Prompt
                </span>
                <p className="mt-1 text-xs sm:text-sm font-sans text-cyan-100 leading-relaxed bg-[#000b17]/70 p-3 rounded-xl border border-cyan-500/20 select-text">
                  "{currentImage.prompt}"
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleDownload(currentImage)}
                  className="px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-400/60 hover:bg-cyan-900/80 text-cyan-200 text-xs tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Image</span>
                </button>

                <button
                  onClick={handleVariation}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-xl bg-[#00152b]/80 border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 text-xs tracking-wider uppercase flex items-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate Variation</span>
                </button>

                <button
                  onClick={() => handleCopyPrompt(currentImage.prompt, currentImage.id)}
                  className="px-3 py-2 rounded-xl border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy Prompt"
                >
                  {copiedPromptId === currentImage.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[10px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Prompt</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[9px] text-cyan-500/60 tracking-wider">
                Ratio: {currentImage.aspectRatio} · Generated at{' '}
                {new Date(currentImage.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </motion.section>
        )}

        {/* Previous Creations Gallery */}
        {history.length > 0 && (
          <section className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-cyan-400/80 uppercase">
                Session Synthesis Logs ({history.length})
              </span>
              <button
                onClick={() => {
                  setHistory([]);
                  localStorage.removeItem('zoya_generated_images_v1');
                }}
                className="text-[9px] text-cyan-600 hover:text-cyan-300 transition-colors cursor-pointer uppercase tracking-widest"
              >
                Clear Gallery
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-xl overflow-hidden border border-cyan-500/20 bg-[#00101d]/60 hover:border-cyan-400/50 transition-all shadow-sm"
                >
                  <img
                    src={item.url}
                    alt={item.prompt}
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setPreviewImage(item)}
                        className="p-1.5 rounded-lg bg-black/60 text-cyan-200 hover:text-white cursor-pointer"
                        title="View Full Size"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-1.5 rounded-lg bg-black/60 text-cyan-200 hover:text-white cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[9px] text-cyan-100 line-clamp-2 font-sans select-none">
                      {item.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Full Size Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-5 right-5 p-2 rounded-full border border-cyan-500/40 text-cyan-300 hover:text-cyan-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden border border-cyan-400/40 shadow-[0_0_50px_rgba(0,229,255,0.2)]">
              <img
                src={previewImage.url}
                alt={previewImage.prompt}
                className="w-full h-full object-contain max-h-[75vh]"
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => handleDownload(previewImage)}
                className="px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-400/60 text-cyan-200 text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:bg-cyan-900"
              >
                <Download className="w-4 h-4" />
                <span>Save to Device</span>
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
