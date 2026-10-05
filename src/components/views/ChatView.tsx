import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Radio,
  Plus,
  Volume2,
  VolumeX,
  Menu,
  Sparkles,
  Bot
} from 'lucide-react';
import { Conversation, ChatMessage, ZoyaPersonalityMode } from '../../types';
import { chatHistoryService } from '../../services/ChatHistoryService';
import { settingsService } from '../../services/SettingsService';
import { memoryService } from '../../services/MemoryService';

interface ChatViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
  personalityMode: ZoyaPersonalityMode;
}

export function ChatView({ onBackToVoice, onOpenMenu, personalityMode }: ChatViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Load or create active conversation
  useEffect(() => {
    chatHistoryService.getOrCreateActiveConversation('text').then((conv) => {
      setConversation(conv);
    });

    const unsubscribe = chatHistoryService.subscribe((convs) => {
      const activeId = chatHistoryService.getActiveConversationId();
      const active = convs.find((c) => c.id === activeId);
      if (active) {
        setConversation(active);
      }
    });

    return () => {
      unsubscribe();
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Auto-scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading || !conversation) return;

    setInputText('');
    setIsLoading(true);

    // 1. Add user message locally and to storage
    await chatHistoryService.addMessage(conversation.id, {
      sender: 'user',
      text
    });

    const settings = settingsService.getSettings();

    try {
      // 2. Fetch Zoya reply from API with personality and memories
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          personalityMode,
          includeAudio: settings.autoSpeakChat,
          conversationHistory: conversation.messages.slice(-8)
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.text || "I'm with you—let's keep going.";

      // 3. Add Zoya reply to conversation
      const updated = await chatHistoryService.addMessage(conversation.id, {
        sender: 'zoya',
        text: replyText,
        audioBase64: data.audio
      });

      setConversation(updated);

      // 4. If autoSpeakChat is enabled and audio returned, play it
      if (settings.autoSpeakChat && data.audio) {
        playBase64Audio(data.audio, updated.messages[updated.messages.length - 1].id);
      }
    } catch (err: any) {
      console.error('[ChatView] Error sending message:', err);
      await chatHistoryService.addMessage(conversation.id, {
        sender: 'zoya',
        text: `Connection glitch: ${err.message || 'Unable to connect to neural matrix'}. Please try again.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const playBase64Audio = (base64Wav: string, messageId: string) => {
    try {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }

      if (playingAudioId === messageId) {
        setPlayingAudioId(null);
        return;
      }

      const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
      currentAudioRef.current = audio;
      setPlayingAudioId(messageId);

      audio.onended = () => {
        setPlayingAudioId(null);
        currentAudioRef.current = null;
      };

      audio.onerror = () => {
        setPlayingAudioId(null);
        currentAudioRef.current = null;
      };

      audio.play().catch(() => {
        setPlayingAudioId(null);
      });
    } catch (e) {
      setPlayingAudioId(null);
    }
  };

  const handleStartNewChat = async () => {
    const newConv = await chatHistoryService.createConversation('New Conversation', 'text');
    setConversation(newConv);
  };

  const quickPrompts = [
    "What can you do as my AI assistant?",
    "Check my upcoming reminders",
    "What do you remember about me?",
    "Tell me an interesting science fact"
  ];

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Top Ambient Haze */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(0,180,216,0.12)_0%,_transparent_70%)]" />

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

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-wider text-cyan-200 truncate max-w-[200px]">
              {conversation?.title || 'Zoya Neural Chat'}
            </span>
            <span className="text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 bg-cyan-950/20">
              {personalityMode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
          </button>

          <button
            onClick={onOpenMenu}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="Open Menu"
          >
            <Menu className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-4 max-w-4xl w-full mx-auto">
        {conversation?.messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center my-12 px-4">
            <div className="w-12 h-12 rounded-2xl border border-cyan-400/30 bg-cyan-950/30 flex items-center justify-center text-cyan-300 mb-4 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-[0.25em] text-cyan-100 uppercase mb-2">
              Zoya Neural Text Stream
            </h2>
            <p className="text-xs text-cyan-400/70 max-w-md mb-8 tracking-wide">
              Direct text interface connected to the active Zoya consciousness, persistent memories, and personality matrix.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  className="p-3 rounded-xl border border-cyan-500/20 bg-[#00101d]/60 hover:border-cyan-400/50 hover:bg-cyan-950/30 text-left text-[11px] text-cyan-300 hover:text-cyan-100 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <span className="truncate">{prompt}</span>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-500/40 group-hover:text-cyan-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {conversation?.messages.map((msg) => {
          const isUser = msg.sender === 'user';

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1 text-[9px] text-cyan-500/70 tracking-widest uppercase">
                {!isUser && (
                  <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00e5ff]" />
                    ZOYA
                  </span>
                )}
                {isUser && <span>YOU</span>}
                <span>·</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed select-text ${
                  isUser
                    ? 'bg-cyan-950/60 border border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(0,229,255,0.08)]'
                    : 'bg-[#001222]/85 border border-cyan-500/25 text-cyan-100 shadow-[0_0_20px_rgba(0,229,255,0.05)]'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans tracking-wide">{msg.text}</div>

                {/* Optional Play Voice Button for Zoya Replies */}
                {!isUser && msg.audioBase64 && (
                  <div className="mt-2 pt-2 border-t border-cyan-500/15 flex items-center gap-2">
                    <button
                      onClick={() => playBase64Audio(msg.audioBase64!, msg.id)}
                      className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-cyan-400 hover:text-cyan-200 transition-colors uppercase cursor-pointer"
                    >
                      {playingAudioId === msg.id ? (
                        <>
                          <VolumeX className="w-3 h-3 text-amber-300" />
                          <span className="text-amber-300 font-bold">Stop Voice</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Play Audio</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Thinking Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#001222]/80 border border-cyan-500/20 text-cyan-300 text-xs w-fit"
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shadow-[0_0_8px_#c084fc]" />
            <span className="text-[10px] tracking-widest uppercase font-mono">Neural Processing...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Bar */}
      <footer className="relative z-10 px-4 py-3 sm:px-6 sm:py-4 border-t border-cyan-500/20 bg-[#010814]/90 backdrop-blur-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="max-w-4xl mx-auto flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message Zoya..."
              disabled={isLoading}
              className="w-full bg-[#00101d]/80 border border-cyan-500/30 hover:border-cyan-400/60 focus:border-cyan-400 rounded-xl px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-cyan-100 placeholder:text-cyan-600/70 font-sans tracking-wide focus:outline-none focus:shadow-[0_0_15px_rgba(0,229,255,0.2)] backdrop-blur-md transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-cyan-950/80 border border-cyan-400/50 hover:bg-cyan-900/80 hover:border-cyan-300 text-cyan-200 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.15)] shrink-0"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
