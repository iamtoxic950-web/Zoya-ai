import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Radio,
  Menu,
  Clock,
  Calendar,
  Repeat,
  AlertCircle,
  X,
  FileText
} from 'lucide-react';
import { ReminderItem, ReminderRepeat } from '../../types';
import { reminderService } from '../../services/ReminderService';

interface RemindersViewProps {
  onBackToVoice: () => void;
  onOpenMenu: () => void;
}

export function RemindersView({ onBackToVoice, onOpenMenu }: RemindersViewProps) {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    // Format YYYY-MM-DDTHH:mm
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [repeat, setRepeat] = useState<ReminderRepeat>('none');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    reminderService.syncWithServer().then((list) => {
      setReminders(list);
    });

    const unsubscribe = reminderService.subscribe((list) => {
      setReminders(list);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Reminder title is required.');
      return;
    }

    try {
      await reminderService.createReminder({
        title: title.trim(),
        datetime,
        repeat,
        note: note.trim() || undefined
      });

      setTitle('');
      setNote('');
      setIsAdding(false);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save reminder.');
    }
  };

  const handleToggleComplete = async (id: string) => {
    await reminderService.toggleComplete(id);
  };

  const handleDelete = async (id: string) => {
    await reminderService.deleteReminder(id);
  };

  const handleClearCompleted = async () => {
    const completedItems = reminders.filter((r) => r.completed);
    for (const item of completedItems) {
      await reminderService.deleteReminder(item.id);
    }
  };

  const upcomingList = reminders.filter((r) => !r.completed);
  const completedList = reminders.filter((r) => r.completed);
  const currentList = activeTab === 'upcoming' ? upcomingList : completedList;

  return (
    <div className="fixed inset-0 z-40 bg-[#00040b] text-cyan-100 flex flex-col font-mono select-none overflow-hidden">
      {/* Subtle background glow */}
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
              Temporal Reminders
            </span>
            <span className="text-[8px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-400/80 bg-cyan-950/20">
              {upcomingList.length} Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:text-cyan-100 hover:border-cyan-400 text-[10px] tracking-widest uppercase transition-colors cursor-pointer"
            title="Create Reminder"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Reminder</span>
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

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* New Reminder Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleCreateReminder}
              className="p-4 sm:p-5 rounded-2xl border border-cyan-400/40 bg-[#001224]/90 shadow-[0_0_25px_rgba(0,229,255,0.15)] space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-cyan-400" />
                  Schedule New Reminder
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-cyan-500 hover:text-cyan-200 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="text-xs text-red-300 bg-red-950/40 p-2 rounded-lg border border-red-500/30 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What should Zoya remind you about? (e.g. Daily standup meeting)"
                className="w-full bg-[#000814]/90 border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-cyan-100 placeholder:text-cyan-600/60 font-sans focus:outline-none transition-all"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-cyan-500 uppercase tracking-widest mb-1">
                    Date & Time:
                  </label>
                  <input
                    type="datetime-local"
                    value={datetime}
                    onChange={(e) => setDatetime(e.target.value)}
                    className="w-full bg-[#000814] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[9px] text-cyan-500 uppercase tracking-widest mb-1">
                    Repeat Schedule:
                  </label>
                  <select
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value as ReminderRepeat)}
                    className="w-full bg-[#000814] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-cyan-200 font-mono focus:outline-none focus:border-cyan-400"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="weekdays">Every Weekday (Mon-Fri)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] text-cyan-500 uppercase tracking-widest mb-1">
                  Optional Note / Context:
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional details or instructions..."
                  className="w-full bg-[#000814]/90 border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-2 text-xs text-cyan-100 placeholder:text-cyan-600/60 font-sans focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-cyan-500/30 text-cyan-400 text-xs hover:text-cyan-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-400/60 hover:bg-cyan-900 text-cyan-100 text-xs font-bold tracking-wider uppercase cursor-pointer shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                >
                  Save Reminder
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Tabs: Upcoming vs Completed */}
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border ${
                activeTab === 'upcoming'
                  ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'border-transparent text-cyan-500 hover:text-cyan-300'
              }`}
            >
              Upcoming ({upcomingList.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase transition-all cursor-pointer border ${
                activeTab === 'completed'
                  ? 'border-cyan-400 bg-cyan-950/50 text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                  : 'border-transparent text-cyan-500 hover:text-cyan-300'
              }`}
            >
              Completed ({completedList.length})
            </button>
          </div>

          {activeTab === 'completed' && completedList.length > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-[9px] uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              Clear Completed
            </button>
          )}
        </div>

        {/* Empty State */}
        {currentList.length === 0 && (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 border border-cyan-500/15 rounded-2xl bg-[#000d1a]/40">
            <Bell className="w-8 h-8 text-cyan-600/50 mb-2" />
            <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase mb-1">
              {activeTab === 'upcoming' ? 'No Upcoming Reminders' : 'No Completed Reminders'}
            </h3>
            <p className="text-[11px] text-cyan-500/70 max-w-sm mb-3">
              {activeTab === 'upcoming'
                ? 'Create a reminder to get audio and visual alerts from Zoya when it is time.'
                : 'Finished reminders will be archived here.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => setIsAdding(true)}
                className="px-3.5 py-1.5 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-cyan-200 hover:text-cyan-100 text-[10px] tracking-wider uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Create Reminder</span>
              </button>
            )}
          </div>
        )}

        {/* Reminders List */}
        <div className="space-y-2.5">
          {currentList.map((item) => {
            const dateObj = new Date(item.datetime);
            const isOverdue = !item.completed && dateObj.getTime() < Date.now();

            return (
              <motion.div
                key={item.id}
                layout
                className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 group ${
                  item.completed
                    ? 'border-cyan-500/10 bg-[#000b14]/50 opacity-60'
                    : isOverdue
                    ? 'border-amber-500/40 bg-amber-950/15'
                    : 'border-cyan-500/20 bg-[#00101f]/60 hover:border-cyan-400/40'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button
                    onClick={() => handleToggleComplete(item.id)}
                    className="mt-0.5 text-cyan-400 hover:text-cyan-200 transition-colors cursor-pointer shrink-0"
                    title={item.completed ? 'Mark Incomplete' : 'Mark Completed'}
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Circle className="w-5 h-5 hover:text-cyan-300" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-xs sm:text-sm font-sans font-medium text-cyan-100 ${
                          item.completed ? 'line-through text-cyan-500/70' : ''
                        }`}
                      >
                        {item.title}
                      </h4>
                      {isOverdue && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/40 text-amber-300 uppercase tracking-widest">
                          Due
                        </span>
                      )}
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-cyan-400/70 font-sans flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-cyan-500" />
                        {item.note}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[9px] text-cyan-500/70 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.repeat !== 'none' && (
                        <span className="flex items-center gap-1 text-cyan-400 capitalize">
                          <Repeat className="w-2.5 h-2.5" />
                          {item.repeat}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-cyan-600 hover:text-red-400 hover:bg-red-950/30 cursor-pointer transition-colors"
                    title="Delete Reminder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
