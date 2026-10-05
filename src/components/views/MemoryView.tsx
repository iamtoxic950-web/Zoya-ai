import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Plus,
  Trash2,
  Edit3,
  Search,
  Radio,
  Menu,
  Check,
  X,
  Sparkles,
  Info,
  Tag
} from 'lucide-react';
import { memoryService, SavedMemory } from '../../services/MemoryService';

interface MemoryViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Memories' },
  { id: 'user_preference', label: 'Preferences' },
  { id: 'communication_style', label: 'Tone & Style' },
  { id: 'context', label: 'Personal Context' },
  { id: 'work', label: 'Work & Projects' }
];

export function MemoryView({ onBackToVoice, onOpenMenu }: MemoryViewProps) {
  const [memories, setMemories] = useState<SavedMemory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('user_preference');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('user_preference');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    memoryService.loadAllMemories().then((list) => {
      setMemories(list);
    });

    const unsubscribe = memoryService.subscribe((list) => {
      setMemories(list);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveNew = async () => {
    if (!newContent.trim()) return;
    await memoryService.saveMemory(newContent.trim(), newCategory);
    setNewContent('');
    setIsAdding(false);
  };

  const handleStartEdit = (m: SavedMemory) => {
    setEditingId(m.id);
    setEditContent(m.content);
    setEditCategory(m.category || 'user_preference');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await memoryService.updateMemory(id, editContent.trim(), editCategory);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await memoryService.deleteMemory(id);
  };

  const handleClearAll = async () => {
    await memoryService.clearAllMemories();
    setShowClearConfirm(false);
  };

  const filtered = memories.filter((m) => {
    const matchesCat =
      selectedCategory === 'all' || (m.category || 'user_preference') === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Subtle Background Radial */}
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
              Neural Memory
            </span>
            <span className="text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 bg-cyan-950/20">
              {memories.length} Engrams
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="Add Neural Memory"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Memory</span>
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

      {/* Main Container */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* Memory Explanation Card */}
        <section className="p-4 rounded-xl border border-cyan-500/25 bg-[#00101f]/70 backdrop-blur-md flex items-start gap-3.5 shadow-[0_0_20px_rgba(0,229,255,0.06)]">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/50 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-xs text-cyan-300/80 leading-relaxed font-sans">
            <span className="font-bold text-cyan-100 font-mono text-[11px] block mb-0.5 tracking-wider uppercase">
              How Zoya Retains Long-Term Context:
            </span>
            Zoya maintains a curated neural engram bank of your preferences, goals, and communication
            style. These memories are automatically injected into active voice conversations and text
            chats, so she remembers your context across all sessions without recording unnecessary
            clutter.
          </div>
        </section>

        {/* Add Memory Modal / Box */}
        <AnimatePresence>
          {isAdding && (
            <motion.section
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 sm:p-5 rounded-2xl border border-cyan-400/40 bg-[#001224]/90 shadow-[0_0_25px_rgba(0,229,255,0.15)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Teach Zoya a New Memory
                </span>
                <button
                  onClick={() => setIsAdding(false)}
                  className="text-cyan-500 hover:text-cyan-200 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Example: Call me Alex. I am a software engineer working with TypeScript and Next.js. I prefer concise and direct explanations."
                rows={3}
                className="w-full bg-[#000814]/90 border border-cyan-500/30 focus:border-cyan-400 rounded-xl p-3 text-xs sm:text-sm text-cyan-100 placeholder:text-cyan-600/60 font-sans focus:outline-none transition-all resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-cyan-500 uppercase tracking-widest">
                    Category:
                  </span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="bg-[#000c1c] border border-cyan-500/30 rounded-lg px-2.5 py-1 text-[10px] text-cyan-200 focus:outline-none focus:border-cyan-400 font-mono cursor-pointer"
                  >
                    <option value="user_preference">User Preference</option>
                    <option value="communication_style">Communication Style</option>
                    <option value="context">Personal Context</option>
                    <option value="work">Work & Projects</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-400 text-xs hover:text-cyan-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNew}
                    disabled={!newContent.trim()}
                    className="px-4 py-1.5 rounded-lg bg-cyan-950/90 border border-cyan-400/60 hover:bg-cyan-900 text-cyan-100 text-xs font-bold tracking-wider uppercase disabled:opacity-40 cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                  >
                    Commit Engram
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Category Filters & Search */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-mono tracking-wider transition-all cursor-pointer border ${
                    selectedCategory === cat.id
                      ? 'border-cyan-400 bg-cyan-900/50 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                      : 'border-cyan-500/20 bg-[#00101f]/50 text-cyan-400/70 hover:border-cyan-400/40 hover:text-cyan-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-500/60" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#00101f]/70 border border-cyan-500/25 focus:border-cyan-400 text-xs text-cyan-100 placeholder:text-cyan-600/60 font-sans focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Clear All Confirmation */}
        <AnimatePresence>
          {showClearConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="p-3.5 rounded-xl border border-red-500/50 bg-red-950/60 text-red-200 text-xs flex items-center justify-between gap-4 backdrop-blur-md"
            >
              <span>Wipe all permanent memories from Zoya's neural bank?</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2.5 py-1 rounded border border-red-400/30 text-red-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1 rounded bg-red-600 text-white font-bold hover:bg-red-500 cursor-pointer shadow-md"
                >
                  Wipe All
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-cyan-500/15 rounded-2xl bg-[#000d1a]/40">
            <Brain className="w-8 h-8 text-cyan-600/50 mb-2" />
            <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase mb-1">
              No Memories Found
            </h3>
            <p className="text-[11px] text-cyan-500/70 max-w-sm mb-3">
              {searchQuery
                ? 'No engrams match your search terms.'
                : 'Click "Add Memory" to explicitly teach Zoya important information about yourself.'}
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-3.5 py-1.5 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-cyan-200 hover:text-cyan-100 text-[10px] tracking-wider uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add First Memory</span>
            </button>
          </div>
        )}

        {/* Memories List */}
        <div className="space-y-2.5">
          {filtered.map((m) => {
            const isEditing = editingId === m.id;

            return (
              <motion.div
                key={m.id}
                layout
                className="p-4 rounded-xl border border-cyan-500/20 bg-[#00101f]/60 hover:border-cyan-400/40 transition-all group"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="w-full bg-[#000814] border border-cyan-400/50 rounded-lg p-2.5 text-xs text-cyan-100 font-sans focus:outline-none"
                    />

                    <div className="flex items-center justify-between">
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="bg-[#000c1c] border border-cyan-500/30 rounded-lg px-2 py-1 text-[9px] text-cyan-200 font-mono"
                      >
                        <option value="user_preference">User Preference</option>
                        <option value="communication_style">Communication Style</option>
                        <option value="context">Personal Context</option>
                        <option value="work">Work & Projects</option>
                      </select>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 rounded text-[10px] text-cyan-400 hover:text-cyan-200 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(m.id)}
                          className="px-3 py-1 rounded bg-cyan-900 border border-cyan-400 text-cyan-100 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 text-cyan-400/90 uppercase tracking-widest flex items-center gap-1">
                          <Tag className="w-2.5 h-2.5" />
                          {m.category || 'General'}
                        </span>
                        <span className="text-[9px] text-cyan-600">
                          {new Date(m.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm font-sans text-cyan-100 leading-relaxed select-text">
                        {m.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(m)}
                        className="p-1.5 rounded-lg text-cyan-500 hover:text-cyan-200 hover:bg-cyan-950/40 cursor-pointer transition-colors"
                        title="Edit Memory"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 rounded-lg text-cyan-600 hover:text-red-400 hover:bg-red-950/30 cursor-pointer transition-colors"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Clear All Footer */}
        {memories.length > 0 && (
          <div className="pt-4 border-t border-cyan-500/15 flex justify-end">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[9px] text-red-400/70 hover:text-red-300 transition-colors uppercase tracking-widest cursor-pointer"
            >
              Clear All Engrams
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
