import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History,
  MessageSquare,
  Plus,
  Trash2,
  Search,
  Radio,
  Menu,
  ChevronRight,
  Clock,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Conversation } from '../../types';
import { chatHistoryService } from '../../services/ChatHistoryService';

interface ChatHistoryViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export function ChatHistoryView({
  onBackToVoice,
  onOpenMenu,
  onSelectConversation,
  onNewChat
}: ChatHistoryViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    // Sync with server and local storage
    chatHistoryService.syncWithServer().then((list) => {
      setConversations(list);
      setActiveId(chatHistoryService.getActiveConversationId());
    });

    const unsubscribe = chatHistoryService.subscribe((list) => {
      setConversations(list);
      setActiveId(chatHistoryService.getActiveConversationId());
    });

    return () => unsubscribe();
  }, []);

  const handleOpenConversation = (id: string) => {
    chatHistoryService.setActiveConversationId(id);
    onSelectConversation(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await chatHistoryService.deleteConversation(id);
    setConfirmDeleteId(null);
  };

  const handleClearAll = async () => {
    await chatHistoryService.clearAllConversations();
    setShowClearConfirm(false);
  };

  const filtered = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = c.title.toLowerCase().includes(q);
    const msgMatch = c.messages.some((m) => m.text.toLowerCase().includes(q));
    return titleMatch || msgMatch;
  });

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Background Ambient Gradient */}
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
              Session Archives
            </span>
            <span className="text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 bg-cyan-950/20">
              {conversations.length} Logs
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="Start New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Session</span>
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

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-4">
        {/* Search Bar & Stats */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search session archives..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#00101f]/70 border border-cyan-500/25 focus:border-cyan-400 text-xs text-cyan-100 placeholder:text-cyan-600/60 font-sans focus:outline-none transition-colors"
            />
          </div>

          {conversations.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="self-end sm:self-auto text-[10px] tracking-widest uppercase text-red-400/80 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-950/20 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear All Archives</span>
            </button>
          )}
        </div>

        {/* Clear All Confirmation Modal */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl border border-red-500/50 bg-red-950/60 text-red-200 text-xs flex items-center justify-between gap-4 backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Permanently delete all session archives? This action cannot be undone.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1 rounded-lg border border-red-400/30 text-red-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 cursor-pointer shadow-md"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-cyan-500/15 rounded-2xl bg-[#000d1a]/40">
            <History className="w-10 h-10 text-cyan-600/50 mb-3" />
            <h3 className="text-sm font-bold tracking-widest text-cyan-300 uppercase mb-1">
              {searchQuery ? 'No Matching Archives Found' : 'No Stored Conversations'}
            </h3>
            <p className="text-xs text-cyan-500/70 max-w-sm mb-4">
              {searchQuery
                ? 'Try adjusting your search keywords.'
                : 'Conversations across voice and text modes will automatically be stored here.'}
            </p>
            <button
              onClick={onNewChat}
              className="px-4 py-2 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-cyan-200 hover:text-cyan-100 hover:border-cyan-300 text-xs tracking-wider uppercase flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Start New Conversation</span>
            </button>
          </div>
        )}

        {/* Conversations List */}
        <div className="space-y-2.5">
          {filtered.map((conv) => {
            const isActive = conv.id === activeId;
            const lastMessage = conv.messages[conv.messages.length - 1];
            const dateStr = new Date(conv.updatedAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric'
            });
            const timeStr = new Date(conv.updatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <motion.div
                key={conv.id}
                layout
                onClick={() => handleOpenConversation(conv.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(0,229,255,0.12)]'
                    : 'border-cyan-500/20 bg-[#00101f]/60 hover:border-cyan-400/40 hover:bg-[#001426]/70'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                      isActive
                        ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                        : 'border-cyan-500/25 bg-cyan-950/30 text-cyan-400'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold tracking-wide text-cyan-100 truncate">
                        {conv.title}
                      </h4>
                      {isActive && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded border border-cyan-400/50 bg-cyan-900/60 text-cyan-200 uppercase tracking-widest">
                          Active
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-cyan-400/60 font-sans truncate mt-0.5">
                      {lastMessage
                        ? `${lastMessage.sender === 'user' ? 'You: ' : 'Zoya: '}${lastMessage.text}`
                        : 'Empty conversation session'}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[9px] text-cyan-500/60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {dateStr} at {timeStr}
                      </span>
                      <span>·</span>
                      <span>{conv.messages.length} messages</span>
                      <span>·</span>
                      <span className="uppercase tracking-widest">{conv.type} mode</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {confirmDeleteId === conv.id ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 bg-red-950/80 p-1 rounded-lg border border-red-500/50"
                    >
                      <button
                        onClick={(e) => handleDelete(conv.id, e)}
                        className="px-2 py-0.5 text-[9px] uppercase tracking-wider bg-red-600 text-white rounded font-bold hover:bg-red-500 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="px-1.5 py-0.5 text-[9px] text-red-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(conv.id);
                      }}
                      className="p-2 rounded-lg text-cyan-600 hover:text-red-400 hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <ChevronRight className="w-4 h-4 text-cyan-500/40 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
