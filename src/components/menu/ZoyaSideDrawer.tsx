import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Image as ImageIcon,
  History,
  Brain,
  Bell,
  Settings,
  X,
  Radio,
  ChevronRight,
  User as UserIcon,
  LogIn,
  LogOut
} from 'lucide-react';
import { NavigationTab, ZoyaPersonalityMode } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface ZoyaSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  personalityMode: ZoyaPersonalityMode;
}

export function ZoyaSideDrawer({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  personalityMode
}: ZoyaSideDrawerProps) {
  const { user, uid, signInWithGoogle, signOut } = useAuth();

  const menuItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }> = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, desc: 'Direct text neural stream' },
    { id: 'images', label: 'Image Generation', icon: ImageIcon, desc: 'Visual synthesis engine' },
    { id: 'history', label: 'Chat History', icon: History, desc: 'Recorded session logs' },
    { id: 'memory', label: 'Memory', icon: Brain, desc: 'Persistent neural knowledge' },
    { id: 'reminders', label: 'Reminders', icon: Bell, desc: 'Scheduled tasks & alerts' },
    { id: 'settings', label: 'Settings', icon: Settings, desc: 'Voice, identity & preferences' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Side Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] z-50 bg-[#010815]/95 backdrop-blur-2xl border-l border-cyan-500/25 flex flex-col font-mono text-cyan-200 select-none shadow-[-10px_0_40px_rgba(0,229,255,0.08)] pointer-events-auto"
          >
            {/* Header */}
            <div className="p-5 border-b border-cyan-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff] animate-pulse" />
                <span className="text-sm font-bold tracking-[0.35em] text-cyan-100">
                  Z O Y A
                </span>
                <span className="text-[8px] px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-400/80 tracking-widest bg-cyan-950/30">
                  MENU
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:text-cyan-100 hover:border-cyan-400 transition-colors cursor-pointer"
                title="Close Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Voice Core Return Button */}
            <div className="px-4 pt-4">
              <button
                onClick={() => {
                  onSelectTab('home');
                  onClose();
                }}
                className={`w-full py-2.5 px-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                  activeTab === 'home'
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-100 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                    : 'border-cyan-500/25 bg-[#00101f]/60 text-cyan-300 hover:border-cyan-400/60 hover:text-cyan-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-[11px] font-bold tracking-wider">Voice Core (Home)</div>
                    <div className="text-[8px] text-cyan-400/60 tracking-wide">Active live audio interface</div>
                  </div>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </button>
            </div>

            {/* Navigation Item List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              <div className="text-[8px] tracking-[0.25em] text-cyan-500/70 uppercase px-2 py-1">
                ASSISTANT CAPABILITIES
              </div>

              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-xl border flex items-center gap-3 transition-all cursor-pointer text-left ${
                      isActive
                        ? 'border-cyan-400 bg-cyan-950/40 text-cyan-100 shadow-[0_0_14px_rgba(0,229,255,0.18)]'
                        : 'border-transparent hover:border-cyan-500/30 hover:bg-[#001222]/60 text-cyan-300/80 hover:text-cyan-100'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                        isActive
                          ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                          : 'border-cyan-500/20 bg-cyan-950/30 text-cyan-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold tracking-wider text-cyan-100 truncate">
                        {item.label}
                      </div>
                      <div className="text-[8px] text-cyan-400/60 tracking-normal truncate">
                        {item.desc}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-cyan-500/50" />
                  </button>
                );
              })}
            </div>

            {/* Footer with Authentication Status & Active Personality Info */}
            <div className="p-4 border-t border-cyan-500/20 bg-[#000a18]/90 space-y-3">
              {/* Authenticated User Status */}
              <div className="p-2.5 rounded-xl border border-cyan-500/20 bg-[#000d1c]/80 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full border border-cyan-400/50 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                      <UserIcon className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold text-cyan-100 truncate">
                      {user && !user.isAnonymous
                        ? user.displayName || user.email || 'Explorer'
                        : 'Guest Session'}
                    </div>
                    <div className="text-[8px] text-cyan-500/70 font-mono truncate">
                      UID: {uid ? `${uid.slice(0, 8)}...` : 'Connecting'}
                    </div>
                  </div>
                </div>

                {user && !user.isAnonymous ? (
                  <button
                    onClick={() => signOut()}
                    className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:text-red-200 hover:bg-red-950/40 cursor-pointer transition-colors"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => signInWithGoogle()}
                    className="px-2 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/50 hover:bg-cyan-900 text-cyan-200 text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="Sign In with Google"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Sign In</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[9px]">
                <span className="text-cyan-500/80 tracking-widest uppercase">Persona Mode:</span>
                <span className="font-bold text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-950/40">
                  {personalityMode}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
